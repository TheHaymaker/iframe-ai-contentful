import { test, expect } from "@playwright/test";

test.describe("Hub popup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub.html");
  });

  test("renders the Hub shell with header", async ({ page }) => {
    await expect(page.getByText("CMS Hub")).toBeVisible();
    await expect(page.getByText(/connected window/i)).toBeVisible();
  });

  test("shows three tabs", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /export/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /import/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /generate/i })).toBeVisible();
  });

  test("Export tab is active by default", async ({ page }) => {
    const exportTab = page.getByRole("tab", { name: /export/i });
    await expect(exportTab).toHaveAttribute("aria-selected", "true");
  });

  test("switching to Import tab shows textarea", async ({ page }) => {
    await page.getByRole("tab", { name: /import/i }).click();
    await expect(page.getByPlaceholder(/Paste ComponentTreeNode/i)).toBeVisible();
  });

  test("switching to Generate tab shows drop zone", async ({ page }) => {
    await page.getByRole("tab", { name: /generate/i }).click();
    await expect(page.getByText(/Drop a screenshot/i)).toBeVisible();
  });

  test("Import tab validates bad JSON", async ({ page }) => {
    await page.getByRole("tab", { name: /import/i }).click();
    const textarea = page.getByPlaceholder(/Paste ComponentTreeNode/i);
    await textarea.fill("not valid json");
    await expect(page.getByText(/Invalid JSON/i)).toBeVisible();
  });

  test("Import tab validates valid JSON with wrong shape", async ({ page }) => {
    await page.getByRole("tab", { name: /import/i }).click();
    const textarea = page.getByPlaceholder(/Paste ComponentTreeNode/i);
    await textarea.fill('[{"wrong": "shape"}]');
    await expect(page.getByText(/Invalid structure/i)).toBeVisible();
  });

  test("Import tab accepts valid ComponentTreeNode JSON", async ({ page }) => {
    await page.getByRole("tab", { name: /import/i }).click();
    const textarea = page.getByPlaceholder(/Paste ComponentTreeNode/i);
    const validJson = JSON.stringify([
      { id: "test-1", type: "Hero", props: { heading: "Test" } },
    ]);
    await textarea.fill(validJson);

    // Should show preview with the node
    await expect(page.getByText("Preview")).toBeVisible();
    // No error should be visible
    await expect(page.getByText(/Invalid/i)).not.toBeVisible();
  });

  test("Generate tab shows feature map reference", async ({ page }) => {
    await page.getByRole("tab", { name: /generate/i }).click();
    const details = page.getByText(/Available Components/i);
    await expect(details).toBeVisible();
  });

  test("shows no connected windows message when standalone", async ({ page }) => {
    // When accessed directly (no iframes connected), should show empty state
    await expect(page.getByText(/No iframes connected|No tree data/i)).toBeVisible();
  });
});
