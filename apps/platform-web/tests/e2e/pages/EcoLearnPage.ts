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
    if (name === "Profile" || name === "Notifications") {
      await this.page.getByRole("button", { name, exact: true }).first().click();
      return;
    }
    const primary = name === "Challenges" ? "Learn" : ["Schools", "Organizations"].includes(name) ? "Community" : "Scan";
    await this.openPrimarySection(primary);
    const label = name === "Schools" ? "Classrooms" : name === "Challenges" ? "Quests" : name;
    await this.page.getByRole("navigation", { name: "Section navigation" }).getByRole("button", { name: label, exact: true }).click();
  }

  async openAuthDialog() {
    await this.page.getByRole("button", { name: "Join free" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Start your eco journey" }),
    ).toBeVisible();
  }
}
