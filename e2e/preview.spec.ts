import { test, expect } from "@playwright/test";

test.describe("Preview iframe", () => {
  test("renders the preview page directly", async ({ page }) => {
    await page.goto("/preview.html");
    await expect(
      page.getByText("Drag a component from the palette to get started"),
    ).toBeVisible();
  });

  test("shows the Open Hub launcher button", async ({ page }) => {
    await page.goto("/preview.html");
    await expect(
      page.getByRole("button", { name: /Open Hub/i }),
    ).toBeVisible();
  });
});
