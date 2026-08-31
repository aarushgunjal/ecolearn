const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const url = args.get("--url");
const requests = Number(args.get("--requests") ?? 200);
const concurrency = Number(args.get("--concurrency") ?? 20);
const method = (args.get("--method") ?? "GET").toUpperCase();
const body = args.get("--body");
const headersInput = args.get("--headers") ?? process.env.STRESS_HEADERS_JSON;
const timeoutMs = Number(args.get("--timeout-ms") ?? 15000);
const expectedStatuses = new Set(
  (args.get("--expect-status") ?? "200,201,202,204,301,302,304")
    .split(",")
    .map(Number),
);

if (!url || !Number.isInteger(requests) || requests < 1 || !Number.isInteger(concurrency) || concurrency < 1) {
  console.error("Usage: node scripts/stress-test.mjs --url <url> [--requests 200] [--concurrency 20] [--method GET] [--body JSON] [--headers JSON]");
  process.exit(2);
}

let requestHeaders = {};
if (headersInput) {
  try {
    requestHeaders = JSON.parse(headersInput);
  } catch {
    console.error("--headers or STRESS_HEADERS_JSON must contain a JSON object.");
    process.exit(2);
  }
}
if (body && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")) {
  requestHeaders["Content-Type"] = "application/json";
}

const latencies = [];
const statuses = new Map();
const errors = new Map();
let bytes = 0;
let cursor = 0;

const worker = async () => {
  while (true) {
    const requestNumber = cursor;
    cursor += 1;
    if (requestNumber >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method,
        headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
        body: body || undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await response.arrayBuffer();
      bytes += payload.byteLength;
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      errors.set(name, (errors.get(name) ?? 0) + 1);
    } finally {
      latencies.push(performance.now() - started);
    }
  }
};

const started = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
const durationMs = performance.now() - started;
latencies.sort((left, right) => left - right);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * value) - 1)] ?? 0;
const successful = Array.from(statuses.entries())
  .filter(([status]) => expectedStatuses.has(status))
  .reduce((sum, [, count]) => sum + count, 0);

const report = {
  url,
  method,
  requests,
  concurrency,
  expectedStatuses: Array.from(expectedStatuses),
  successful,
  failed: requests - successful,
  durationMs: Math.round(durationMs),
  requestsPerSecond: Number((requests / (durationMs / 1000)).toFixed(2)),
  latencyMs: {
    min: Number((latencies[0] ?? 0).toFixed(2)),
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2)),
    max: Number((latencies.at(-1) ?? 0).toFixed(2)),
  },
  statuses: Object.fromEntries(statuses),
  errors: Object.fromEntries(errors),
  transferredBytes: bytes,
};

console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
