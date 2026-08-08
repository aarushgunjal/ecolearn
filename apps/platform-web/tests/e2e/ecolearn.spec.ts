import { expect, test } from "@playwright/test";
import { EcoLearnPage } from "./pages/EcoLearnPage";

test.describe("EcoLearn guest journeys", () => {
  test("renders primary and extended platform sections", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Extended navigation uses the compact mobile menu.");
    const app = new EcoLearnPage(page);
    await app.goto();
    await expect(page.getByRole("heading", { name: /Small choices/ })).toBeVisible();

    await app.openPrimarySection("Scan");
    await expect(page.getByRole("heading", { name: "Item scanner" })).toBeVisible();
    await app.openPrimarySection("Learn");
    await expect(page.getByRole("heading", { name: /Build your eco instinct/ })).toBeVisible();
    await app.openPrimarySection("Challenges");
    await expect(page.getByRole("heading", { name: /Quests with purpose/ })).toBeVisible();
    await app.openPrimarySection("Ranks");
    await expect(page.getByRole("heading", { name: "Better together." })).toBeVisible();

    const sections = [
      ["Local rules", /Delaware recycling rules/],
      ["Community", /Your community/],
      ["Schools", /EcoLearn for Delaware schools/],
      ["Organizations", /Organization hub/],
      ["Scan tools", /Smart scan tools/],
      ["Notifications", /Notifications/],
    ] as const;
    for (const [menuName, heading] of sections) {
      await app.openMoreSection(menuName);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    }
  });

  test("restores a shareable scan URL and hides admin navigation from guests", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop menu assertion.");
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "Item scanner" })).toBeVisible();
    await page.getByRole("button", { name: "More EcoLearn tools" }).first().click();
    await expect(page.getByRole("button", { name: "Admin portal" })).toHaveCount(0);
  });

  test("keeps empty lookup disabled and handles script text without execution", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Scan");
    let dialogOpened = false;
    page.on("dialog", async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });

    const check = page.getByRole("button", { name: "Check", exact: true });
    await expect(check).toBeDisabled();
    await page.getByRole("textbox", { name: "Search official Delaware items" }).fill("<script>alert('qa')</script>");
    await expect(check).toBeEnabled();
    await check.click();
    await expect(page.getByText("No disposal advice is shown without a DNREC match")).toBeVisible();
    expect(dialogOpened).toBe(false);
  });

  test("shows official predictive item suggestions", async ({ page }) => {
    await page.route("**/functions/v1/delaware-guidance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [
            { title: "Aluminum Cans", category: "Recyclables" },
            { title: "Aerosol Cans", category: "Household products" },
          ],
        }),
      });
    });

    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Scan");
    await page
      .getByRole("textbox", { name: "Search official Delaware items" })
      .fill("soda can");

    await expect(
      page.getByRole("option", { name: /Aluminum Cans/ }),
    ).toBeVisible();
  });

  test("offers gallery and camera selection as separate mobile-safe controls", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Scan");

    await expect(page.getByRole("button", { name: "Choose from gallery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take a photo" })).toBeVisible();
    const galleryInput = page.locator('input[aria-label="Choose photo from gallery"]');
    const cameraInput = page.locator('input[aria-label="Take a photo with camera"]');
    await expect(galleryInput).not.toHaveAttribute("capture", /.+/);
    await expect(cameraInput).toHaveAttribute("capture", "environment");
  });

  test("requires valid registration fields", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openAuthDialog();
    await page.getByRole("textbox", { name: "Email address" }).fill("not-an-email");
    await page.getByRole("textbox", { name: "Password" }).fill("short");
    await page.getByRole("button", { name: "Create free account" }).last().click();
    await expect(page.getByRole("heading", { name: "Start your eco journey" })).toBeVisible();
  });

  test("requires the correct lesson answer before completion", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Learn");
    await page.getByRole("button", { name: /Recycling basics The recycling loop/ }).click();
    for (let index = 0; index < 4; index += 1) {
      await page.getByRole("button", { name: "Continue" }).click();
    }
    const check = page.getByRole("button", { name: "Check answer" });
    await expect(check).toBeDisabled();
    await page.getByRole("button", { name: "Keep empty items loose in the bin" }).click();
    await check.click();
    await expect(page.getByRole("button", { name: /Complete lesson \+20 XP/ })).toBeVisible();
  });
});

test("mobile primary navigation remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = new EcoLearnPage(page);
  await app.goto();
  await app.openPrimarySection("Scan");
  await expect(page.getByRole("heading", { name: "Item scanner" })).toBeVisible();
});

test("public account-deletion instructions are reachable without signing in", async ({ page }) => {
  await page.goto("/delete-account");
  await expect(page.getByRole("heading", { name: "Delete your EcoLearn account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request account deletion" })).toHaveAttribute(
    "href",
    /mailto:aarushgunjal1@gmail\.com/,
  );
});
