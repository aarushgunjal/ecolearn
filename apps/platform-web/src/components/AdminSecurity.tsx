import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Factor = { id: string; friendly_name?: string };
type Enrollment = { id: string; secret: string; qr: string };

export function AdminSecurity({
  promptOnly = false,
}: {
  promptOnly?: boolean;
}) {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    const access = await supabase.rpc("ecolearn_admin_access");
    if (access.error)
      throw new Error(
        "Could not check administrator security. Please try again.",
      );
    const status = access.data as { is_admin: boolean; verified: boolean };
    setAdmin(status.is_admin);
    setVerified(status.verified);
    if (!status.is_admin) return;
    const list = await supabase.auth.mfa.listFactors();
    if (list.error) throw list.error;
    setFactors(list.data.totp);
    setFactorId((current) =>
      list.data.totp.some((f) => f.id === current)
        ? current
        : (list.data.totp[0]?.id ?? ""),
    );
  }, [user]);

  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const enroll = () =>
    run(async () => {
      const { data, error: failed } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "EcoLearn",
        friendlyName: `Authenticator ${new Date().toISOString()}`,
      });
      if (failed) throw failed;
      setEnrollment({
        id: data.id,
        secret: data.totp.secret,
        qr: data.totp.qr_code,
      });
      setCode("");
    });
  const verify = () =>
    run(async () => {
      const { error: failed } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment?.id ?? factorId,
        code,
      });
      if (failed) throw failed;
      setEnrollment(null);
      setCode("");
      await refresh();
      setNotice("Administrator access verified for this session.");
    });
  const cancel = () =>
    run(async () => {
      if (enrollment) {
        const { error: failed } = await supabase.auth.mfa.unenroll({
          factorId: enrollment.id,
        });
        if (failed) throw failed;
      }
      setEnrollment(null);
      setCode("");
    });

  if (!user || (!admin && !error) || (promptOnly && verified)) return null;
  return (
    <section
      aria-label="Administrator security"
      className="my-6 rounded-2xl border border-[#cbdcc5] bg-white p-6"
    >
      <h2 className="text-lg font-semibold">Administrator security</h2>
      <p className="mt-2 text-sm text-[#58675d]">
        {verified
          ? "Two-factor authentication is active for this session."
          : "Verify with an authenticator app to manage all communities. Your regular learning account remains available."}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      {!admin && error && (
        <button
          className="mt-3 underline"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          Retry security check
        </button>
      )}
      {admin && (
        <>
          {enrollment && (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                Scan this code in your authenticator, or enter the setup key
                manually.
              </p>
              <img
                alt="Authenticator setup QR code"
                width={180}
                height={180}
                src={
                  enrollment.qr.startsWith("data:image/svg+xml")
                    ? enrollment.qr
                    : `data:image/svg+xml,${encodeURIComponent(enrollment.qr)}`
                }
              />
              <label className="block text-sm font-semibold">
                Setup key
                <input
                  aria-label="Authenticator setup key"
                  readOnly
                  value={enrollment.secret}
                  className="mt-1 w-full rounded-lg border p-3 font-mono text-xs"
                />
              </label>
              <p className="text-sm">
                Keep a backup in your authenticator or add a second
                authenticator after setup. This key is shown only during setup.
              </p>
            </div>
          )}
          {(!verified || enrollment) && (enrollment || factors.length > 0) && (
            <form
              className="mt-4 flex max-w-sm flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              {!enrollment && factors.length > 1 && (
                <label>
                  Authenticator
                  <select
                    value={factorId}
                    onChange={(e) => setFactorId(e.target.value)}
                    className="block w-full rounded-lg border p-2"
                  >
                    {factors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.friendly_name ?? "Authenticator"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm font-semibold">
                Authenticator code
                <input
                  aria-label="Authenticator code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 block w-full rounded-lg border p-3"
                />
              </label>
              <button
                disabled={busy || code.length !== 6}
                className="rounded-xl bg-[#173d2a] px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? "Checking..."
                  : enrollment
                    ? "Enable authenticator"
                    : "Verify administrator access"}
              </button>
              {enrollment && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="underline"
                >
                  Cancel setup
                </button>
              )}
            </form>
          )}
          {!enrollment && (verified || factors.length === 0) && (
            <button
              disabled={busy}
              onClick={() => void enroll()}
              className="mt-4 rounded-xl bg-[#173d2a] px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {factors.length
                ? "Add backup authenticator"
                : "Set up authenticator"}
            </button>
          )}
          {verified && !enrollment && factors.length > 1 && (
            <div className="mt-4 space-y-2">
              {factors.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <span>{f.friendly_name ?? "Authenticator"}</span>
                  <button
                    disabled={busy}
                    className="text-red-700 underline"
                    onClick={() =>
                      void run(async () => {
                        const r = await supabase.auth.mfa.unenroll({
                          factorId: f.id,
                        });
                        if (r.error) throw r.error;
                        await refresh();
                      })
                    }
                  >
                    Remove authenticator
                  </button>
                </div>
              ))}
            </div>
          )}
          {!verified && factors.length > 0 && (
            <p className="mt-3 text-sm text-[#58675d]">
              Lost your authenticator? Use your backup authenticator. If both
              are unavailable, contact support for account recovery.
            </p>
          )}
        </>
      )}
    </section>
  );
}
