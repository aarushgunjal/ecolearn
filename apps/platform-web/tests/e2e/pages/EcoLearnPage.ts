import { expect, type Page } from "@playwright/test";

export class EcoLearnPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
    await expect(this.page.getByRole("banner")).toBeVisible();
  }

  async openPrimarySection(
    name: "Home" | "Scan" | "Map" | "Learn" | "Community",
  ) {
    await this.page.getByRole("button", { name, exact: true }).first().click();
  }

  async openMoreSection(
    name:
      | "Local rules"
      | "Challenges"
      | "Schools"
      | "Profile"
      | "Organizations"
      | "Scan tools"
      | "Notifications",
  ) {
    await this.page
      .getByRole("button", { name: "More EcoLearn tools" })
      .first()
      .click();
    await this.page.getByRole("button", { name, exact: true }).last().click();
  }

  async openAuthDialog() {
    await this.page.getByRole("button", { name: "Join free" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Start your eco journey" }),
    ).toBeVisible();
  }
}
