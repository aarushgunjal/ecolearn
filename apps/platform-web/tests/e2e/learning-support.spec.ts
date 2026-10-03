import { expect, test } from "@playwright/test";
import easyLessons from "../../../../packages/learning/easy-reading.json" with { type: "json" };
import additionalLessons from "../../../../packages/learning/additional-lessons.json" with { type: "json" };
import { readFileSync } from "node:fs";

test("easy-reading answers match the database grading keys", () => {
  const schema = ["202608020001_secure_delaware_platform.sql", "202610030001_expand_lessons.sql"].map((name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8")).join("\n");
  for (const [id, content] of Object.entries(easyLessons)) {
    expect(schema).toContain(`('${id}', ${content.answer})`);
    expect(content.choiceSymbols).toHaveLength(content.choices.length);
  }
});

test.beforeEach(async ({ page }) => {
  await page.route("https://ecolearn-test.supabase.co/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

for (const lesson of additionalLessons) {
  test(`standard lesson: ${lesson.title} teaches and grades its new topic`, async ({ page }) => {
    await page.goto(`/learn?lesson=${lesson.id}`);
    await expect(page.getByRole("heading", { name: lesson.title, exact: true })).toBeVisible();
    await expect(page.getByText(lesson.content.intro, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: lesson.source.title })).toHaveAttribute("href", lesson.source.url);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    for (const fact of lesson.content.facts) {
      await expect(page.getByRole("heading", { name: fact.title, exact: true })).toBeVisible();
      await expect(page.getByText(fact.body, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    await page.getByRole("button", { name: lesson.content.choices[lesson.content.answer], exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("button", { name: "Finish practice" })).toBeVisible();
    expect(easyLessons[lesson.id].answer).toBe(lesson.content.answer);
  });
}

test("the learning path includes all twelve lessons in order", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("button", { name: /Quiz included/ })).toHaveCount(12);
  for (const [index, lesson] of additionalLessons.entries()) {
    await expect(page.getByRole("button", { name: new RegExp(lesson.title) })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Quiz included/ }).nth(index + 6)).toContainText(lesson.title);
  }
  await expect(page.getByText("0 of 12 lessons complete", { exact: true })).toBeVisible();
});

test("easy reading persists, can be reversed, and works when preference storage fails", async ({ page }) => {
  await page.goto("/learn");
  const toggle = page.getByRole("switch", { name: /Easy reading/ });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByRole("heading", { name: "Let's help the Earth!" })).toBeVisible();
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByRole("heading", { name: /Build your eco instinct/ })).toBeVisible();
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "ecolearn.easyReading") throw new Error("Preference storage blocked");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "ecolearn.easyReading") throw new Error("Preference storage blocked");
      return setItem.call(this, key, value);
    };
  });
  await page.reload();
  await toggle.click();
  await expect(page.getByRole("heading", { name: "Let's help the Earth!" })).toBeVisible();
});

for (const [id, content] of Object.entries(easyLessons)) {
  test(`easy lesson: ${content.title} preserves completion and accessible choices`, async ({ page }) => {
    await page.goto(`/learn?lesson=${id}`);
    await page.getByRole("switch", { name: /Easy reading/ }).click();
    await expect(page.getByRole("heading", { name: content.title })).toBeVisible();
    for (let step = 0; step < 4; step++) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: content.question })).toBeFocused();
    await expect(page.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "5");
    await expect(page.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuemax", "5");
    const check = page.getByRole("button", { name: "Check answer" });
    await expect(check).toBeDisabled();
    const wrong = page.getByRole("button", { name: content.choices[(content.answer + 1) % 3], exact: true });
    await wrong.click();
    await check.click();
    await expect(page.getByRole("button", { name: "Finish practice" })).toHaveCount(0);
    await page.getByRole("button", { name: "Try again" }).click();
    const right = page.getByRole("button", { name: content.choices[content.answer], exact: true });
    await right.focus();
    await page.keyboard.press("Space");
    await expect(right).toHaveAttribute("aria-pressed", "true");
    const box = await right.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await check.click();
    await expect(page.getByRole("button", { name: "Finish practice" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: content.explanation })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("switch", { name: /Easy reading/ }).click();
    await expect(check).toBeDisabled();
    await expect(page.getByRole("button", { name: "Finish practice" })).toHaveCount(0);
  });
}

test("Listen reads quiz choices and stops on step change, mode change, and exit", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { spoken: [] as string[], stopped: 0 };
    Object.assign(window, { speechTest: state });
    Object.defineProperty(window, "speechSynthesis", { value: {
      cancel: () => { state.stopped++; },
      speak: (utterance: SpeechSynthesisUtterance) => { state.spoken.push(utterance.text); },
    } });
  });
  await page.goto("/learn?lesson=10000000-0000-4000-8000-000000000001");
  await page.getByRole("switch", { name: /Easy reading/ }).click();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop reading" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Listen", exact: true })).toBeVisible();
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  const spoken = await page.evaluate(() => (window as unknown as { speechTest: { spoken: string[] } }).speechTest.spoken);
  expect(spoken.at(-1)).toContain("2. One at a time, with no bag");
  await page.getByRole("switch", { name: /Easy reading/ }).click();
  await expect(page.getByRole("button", { name: "Listen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  const stops = await page.evaluate(() => (window as unknown as { speechTest: { stopped: number } }).speechTest.stopped);
  await page.getByRole("button", { name: "All lessons" }).click();
  expect(await page.evaluate(() => (window as unknown as { speechTest: { stopped: number } }).speechTest.stopped)).toBeGreaterThan(stops);
});

test("Listen failures remain recoverable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: { cancel() {}, speak() { throw new Error("No voice"); } } });
  });
  await page.goto("/learn?lesson=10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Listen could not start" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start clean" })).toBeVisible();
});

test("a child can finish guest practice without an account or an XP claim", async ({ page }) => {
  const completions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("complete_ecolearn_lesson")) completions.push(request.url());
  });
  await page.goto("/learn?lesson=10000000-0000-4000-8000-000000000001");
  await page.getByRole("switch", { name: /Easy reading/ }).click();
  for (let step = 0; step < 4; step++) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "One at a time, with no bag", exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.getByText("Practice complete!", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Let's help the Earth!" })).toBeVisible();
  expect(completions).toEqual([]);
});
