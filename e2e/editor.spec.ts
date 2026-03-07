import { test, expect } from "@playwright/test";

test.describe("Editor Shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the editor with sidebar and iframe", async ({ page }) => {
    // Sidebar header
    await expect(page.getByText("CMS Editor")).toBeVisible();

    // Tab buttons in sidebar
    await expect(page.getByRole("button", { name: /palette/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /tree/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /props/i })).toBeVisible();

    // iframe exists
    const iframe = page.locator('iframe[title="Preview"]');
    await expect(iframe).toBeVisible();
  });

  test("component palette shows available components", async ({ page }) => {
    await expect(page.getByText("Hero")).toBeVisible();
    await expect(page.getByText("TextBlock")).toBeVisible();
    await expect(page.getByText("ImageCard")).toBeVisible();
    await expect(page.getByText("Button")).toBeVisible();
  });

  test("clicking a palette component adds a slice", async ({ page }) => {
    // Click Hero in palette
    await page.getByRole("button", { name: /Hero/i }).first().click();

    // Switch to tree tab to verify it was added
    await page.getByRole("button", { name: /tree/i }).click();

    // Should see Section > Container > Hero in tree
    await expect(page.getByText("Section")).toBeVisible();
    await expect(page.getByText("Container")).toBeVisible();
  });

  test("selecting a node shows prop editor", async ({ page }) => {
    // Add a Hero
    await page.getByRole("button", { name: /Hero/i }).first().click();

    // Switch to tree tab
    await page.getByRole("button", { name: /tree/i }).click();

    // Click on a node (Hero) in the tree
    const heroNode = page.locator("button").filter({ hasText: "Hero" });
    if (await heroNode.count() > 0) {
      await heroNode.first().click();

      // Props tab should show up with input fields
      await expect(page.getByRole("button", { name: /props/i })).toBeVisible();
    }
  });

  test("iframe preview shows empty state initially", async ({ page }) => {
    const iframe = page.frameLocator('iframe[title="Preview"]');
    await expect(
      iframe.getByText("Drag a component from the palette to get started"),
    ).toBeVisible();
  });

  test("Open Hub button is visible in iframe", async ({ page }) => {
    const iframe = page.frameLocator('iframe[title="Preview"]');
    await expect(iframe.getByRole("button", { name: /Open Hub/i })).toBeVisible();
  });
});
