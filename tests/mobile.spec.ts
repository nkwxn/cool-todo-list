import { test, expect } from "@playwright/test";
import { WELCOME, addItems, card, closeEditor, editor, freshApp, goTo, itemInputs, newNote, openNote } from "./helpers";

test.describe("Responsive / mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-only checks");

  test("no horizontal overflow; FAB visible; sidebar is an off-canvas drawer", async ({ page }) => {
    await freshApp(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Exactly one usable New note control in the viewport (the FAB); drawer copy is off-screen + inert.
    const inViewport = await page.getByRole("button", { name: "New note" }).evaluateAll((els) =>
      els.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > 0 && r.left < innerWidth && !e.closest("[inert]");
      }).length,
    );
    expect(inViewport).toBe(1);

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toBeInViewport();
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(sidebar).not.toBeInViewport();
  });

  test("editor is full-screen and checklist row actions are reachable by touch", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    const box = await editor(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(box!.width)).toBe(viewport.width);
    // Without hover, delete buttons must be visible (not opacity 0).
    const opacity = await editor(page).getByRole("button", { name: "Delete item" }).first()
      .evaluate((el) => getComputedStyle(el.parentElement!).opacity);
    expect(opacity).toBe("1");
    await editor(page).getByRole("checkbox", { name: "Try checking this off" }).tap();
    await expect(editor(page).getByTestId("checklist-progress")).toHaveText("1/4 done");
  });

  test("full mobile flow: create checklist note, file it, search, archive", async ({ page }) => {
    await freshApp(page);
    await newNote(page, "Phone list");
    await editor(page).getByRole("button", { name: "Add checklist" }).tap();
    await addItems(page, "Call mom", "Pay rent");
    await expect(itemInputs(page)).toHaveCount(2);
    await closeEditor(page);
    await page.getByLabel("Search notes").fill("rent");
    await expect(card(page, "Phone list")).toBeVisible();
    await page.getByLabel("Search notes").fill("");
    // Card actions are visible without hover on touch devices.
    await page.getByRole("button", { name: "Archive Phone list" }).tap();
    await goTo(page, /^Archive/);
    await expect(card(page, "Phone list")).toBeVisible();
  });
});
