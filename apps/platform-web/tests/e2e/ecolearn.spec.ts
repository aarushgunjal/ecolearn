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
    await app.openPrimarySection("Map");
    await expect(page.getByRole("heading", { name: /Find the right place/ })).toBeVisible();
    await app.openPrimarySection("Learn");
    await expect(page.getByRole("heading", { name: /Build your eco instinct/ })).toBeVisible();
    await app.openPrimarySection("Community");
    await expect(page.getByRole("heading", { name: /Sign in to join your people/ })).toBeVisible();
    await app.openMoreSection("Challenges");
    await expect(page.getByRole("heading", { name: /Quests with purpose/ })).toBeVisible();

    const sections = [
      ["Local rules", /Delaware recycling rules/],
      ["Schools", /Sign in to join your people/],
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

  test("selects the electronics DSWA video from the verified catalog category", async ({ page }) => {
    await page.route("**/functions/v1/delaware-guidance", async (route) => {
      const payload = route.request().postDataJSON();
      if (payload?.mode === "suggestions") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestions: [] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verified: true,
          guidance: {
            title: "Can opener",
            seoName: "can-opener",
            matchConfidence: 1,
            category: "Electronics",
            curbside: false,
            instructions: "Take this item to an approved electronics collection location.",
            tags: ["Electronics", "Electronic goods"],
            sourceName: "Delaware DNREC Recyclopedia",
            sourceUrl: "https://dnrec.delaware.gov/waste-hazardous/recycling/what/",
          },
        }),
      });
    });

    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Scan");
    await page.getByRole("textbox", { name: "Search official Delaware items" }).fill("can opener");
    await page.getByRole("button", { name: "Check", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Can opener" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "DSWA Electronics Recycling" })).toBeVisible();
    await expect(page.locator('iframe[title="DSWA Electronics Recycling"]')).toHaveAttribute(
      "src",
      /youtube-nocookie\.com\/embed\//,
    );
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
    await expect(page.getByRole("button", { name: "Close sign-in dialog" })).toBeVisible();
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

  test("opens the learning path from the home lesson card", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await page.getByRole("button", { name: /Recycling basics The recycling loop/ }).click();
    await expect(page.getByRole("heading", { name: /Build your eco instinct/ })).toBeVisible();
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("renders every nearby result on an interactive map", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"], {
      origin: "http://127.0.0.1:8080",
    });
    await context.setGeolocation({ latitude: 39.7391, longitude: -75.5398 });
    let requestedType = "";
    await page.route("**/functions/v1/find-disposal-sites", async (route) => {
      requestedType = route.request().postDataJSON()?.type ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sourceName: "Delaware DSWA, DNREC Recyclopedia, and OpenStreetMap",
          sourceUrl: "https://dswa.com/facility/",
          matchedTag: "Electronics recycling",
          notice: "Verify accepted materials and current hours before visiting.",
          sites: [
            {
              id: "dswa-delaware-recycling-center",
              name: "Delaware Recycling Center",
              type: "DSWA recycling center",
              latitude: 39.7052121,
              longitude: -75.5390718,
              distanceKm: 3.8,
              address: "1101 Lambson Lane, New Castle, DE 19720",
              services: ["Electronics", "Household hazardous waste"],
              sourceUrl: "https://dswa.com/facility/delaware-recycling-center/",
            },
            {
              id: "dnrec-2385",
              name: "NERDiT Recycles",
              type: "Drop Off Only",
              latitude: 39.7508883,
              longitude: -75.5220288,
              distanceKm: 2,
              address: "3030 Bowers St, Wilmington, DE, 19802",
              sourceUrl: "https://dnrec.delaware.gov/waste-hazardous/recycling/what/",
            },
          ],
        }),
      });
    });
    await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());

    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Map");
    await page.getByRole("button", { name: "Electronics", exact: true }).click();
    await page.getByRole("button", { name: "Find nearby locations" }).click();

    await expect(page.getByRole("application", { name: /Nearby disposal map with 2 locations/ })).toBeVisible();
    await expect(page.locator(".ecolearn-map-marker")).toHaveCount(2);
    await expect(page.getByText("Delaware Recycling Center", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Show NERDiT Recycles on map" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get directions ↗" }).first()).toHaveAttribute("href", /google\.com\/maps\/dir/);
    expect(requestedType).toBe("electronics");
  });

  test("handles denied location permission without sending a lookup", async ({ page, context }) => {
    await context.clearPermissions();
    let called = false;
    await page.route("**/functions/v1/find-disposal-sites", async (route) => {
      called = true;
      await route.abort();
    });
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openPrimarySection("Map");
    await page.getByRole("button", { name: "Find nearby locations" }).click();
    await expect(page.getByText("Location permission needed", { exact: true }).first()).toBeVisible();
    expect(called).toBe(false);
  });

  test("keeps community data private while preserving public organization and notification actions", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();

    await app.openPrimarySection("Community");
    await expect(page.getByRole("heading", { name: /Sign in to join your people/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join group" })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign in or create an account" }).click();
    await expect(page.getByRole("heading", { name: "Start your eco journey" })).toBeVisible();
    await page.getByRole("button", { name: "Close sign-in dialog" }).click();

    await app.openMoreSection("Organizations");
    await page.getByRole("button", { name: "Manage campaign" }).click();
    await page.getByRole("button", { name: "Invite volunteers" }).click();
    await expect(page.getByRole("button", { name: "Campaign open" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Volunteers invited" })).toBeVisible();

    await app.openMoreSection("Notifications");
    await page.getByRole("button", { name: /Your daily quest is ready/ }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("ecolearn-notifications-read"))).toBe("true");
  });

  test("saves local-rule selection and keeps official source reachable", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openMoreSection("Local rules");
    await page.getByLabel("Your municipality").selectOption("Kent County, DE");
    await page.getByRole("button", { name: "Save location" }).click();
    await expect(page.getByText("IN KENT COUNTY, DE")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Delaware DNREC Recyclopedia/ })).toHaveAttribute("href", /^https:\/\/dnrec\.delaware\.gov/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("ecolearn-city"))).toBe("Kent County, DE");
  });

  test("challenge actions persist and guests cannot claim account XP", async ({ page }) => {
    const app = new EcoLearnPage(page);
    await app.goto();
    await app.openMoreSection("Challenges");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Completed!" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Claim 40 XP" }).click();
    await expect(page.getByText("Sign in to claim XP", { exact: true }).first()).toBeVisible();
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

test("privacy, terms, and support pages are directly reachable", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "EcoLearn Support" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("link", { name: "aarushgunjal1@gmail.com" })).toHaveAttribute(
    "href",
    /mailto:aarushgunjal1@gmail\.com/,
  );
});
