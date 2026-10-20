import { test, expect } from "@playwright/test";
import { WELCOME, values, addItems, card, closeEditor, editor, freshApp, itemInputs, newNote, openNote, stored } from "./helpers";

const progress = (page: import("@playwright/test").Page) => editor(page).getByTestId("checklist-progress");

test.describe("Checklist", () => {
  test("add items with Enter; whitespace-only input is ignored", async ({ page }) => {
    await freshApp(page);
    await newNote(page, "Packing");
    await editor(page).getByRole("button", { name: "Add checklist" }).click();
    await addItems(page, "Passport", "Charger", "   ");
    await expect(itemInputs(page)).toHaveCount(2);
    await expect.poll(() => values(itemInputs(page))).toEqual(["Passport", "Charger"]);
    await expect(progress(page)).toHaveText("0/2 done");
  });

  test("complete items, progress updates, completed move to their own section, persists immediately", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    const box = editor(page).getByRole("checkbox", { name: "Try checking this off" });
    await box.click();
    await expect(box).toHaveAttribute("aria-checked", "true");
    await expect(progress(page)).toHaveText("1/4 done");
    await expect(editor(page).getByText("Completed · 1")).toBeVisible();
    await expect(editor(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

    // Persisted without any save action.
    const note = (await stored(page)).notes.find((n: { title: string }) => n.title.startsWith("Welcome"));
    expect(note.items.find((i: { text: string }) => i.text === "Try checking this off").done).toBe(true);

    await page.reload();
    await expect(editor(page).getByRole("checkbox", { name: "Try checking this off" })).toHaveAttribute("aria-checked", "true");

    // Uncheck returns it to pending.
    await editor(page).getByRole("checkbox", { name: "Try checking this off" }).click();
    await expect(progress(page)).toHaveText("0/4 done");
    await expect(editor(page).getByText(/Completed ·/)).toBeHidden();
  });

  test("card shows progress and distinguishes completed items", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("checkbox", { name: "Try checking this off" }).click();
    await closeEditor(page);
    const welcome = card(page, new RegExp(WELCOME));
    await expect(welcome).toContainText("1/4");
    await expect(welcome).toContainText("3 open");
    await expect(welcome.getByText("Try checking this off")).toHaveClass(/line-through/);
  });

  test("edit item text keeps spaces and empty intermediate states", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    const first = itemInputs(page).first();
    await first.fill("");
    await expect(itemInputs(page)).toHaveCount(4); // not deleted while focused
    await first.pressSequentially("buy  milk ");
    await expect(first).toHaveValue("buy  milk ");
    await expect(itemInputs(page).nth(1)).toHaveValue(/Open a note/); // neighbour untouched
  });

  test("blank items are pruned when focus leaves the checklist", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await itemInputs(page).first().fill("");
    await editor(page).getByLabel("Note title").click();
    await expect(itemInputs(page)).toHaveCount(3);
  });

  test("Enter inside an item inserts a new item below; Backspace on empty removes it", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await itemInputs(page).first().press("End");
    await itemInputs(page).first().press("Enter");
    await expect(itemInputs(page)).toHaveCount(5);
    await expect(itemInputs(page).nth(1)).toBeFocused();
    await page.keyboard.type("Inserted");
    await expect(itemInputs(page).nth(1)).toHaveValue("Inserted");
    await itemInputs(page).nth(1).fill("");
    await itemInputs(page).nth(1).press("Backspace");
    await expect(itemInputs(page)).toHaveCount(4);
    await expect(itemInputs(page).first()).toBeFocused();
  });

  test("delete item", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await itemInputs(page).first().focus();
    await editor(page).getByRole("button", { name: "Delete item" }).first().click();
    await expect(itemInputs(page)).toHaveCount(3);
    await expect(itemInputs(page).first()).toHaveValue(/Open a note/);
  });

  test("reorder with buttons, keyboard (Alt+Arrow), and boundaries disabled", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    const firstText = await itemInputs(page).first().inputValue();
    await itemInputs(page).first().focus();
    await expect(editor(page).getByRole("button", { name: "Move item up" }).first()).toBeDisabled();
    await editor(page).getByRole("button", { name: "Move item down" }).first().click();
    await expect(itemInputs(page).nth(1)).toHaveValue(firstText);

    await itemInputs(page).nth(1).press("Alt+ArrowUp");
    await expect(itemInputs(page).first()).toHaveValue(firstText);
    await expect(editor(page).getByRole("button", { name: "Move item down" }).last()).toBeDisabled();

    await page.reload();
    await expect(itemInputs(page).first()).toHaveValue(firstText);
  });

  test("reorder with drag and drop", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "drag handle is a pointer-device affordance");
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    const texts = await values(itemInputs(page));
    const rows = editor(page).getByTestId("checklist-item");
    await rows.nth(0).locator("[draggable=true]").dragTo(rows.nth(2));
    await expect.poll(() => values(itemInputs(page))).toEqual([texts[1], texts[2], texts[0], texts[3]]);
  });

  test("hide completed toggles visibility and is remembered per note", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("checkbox", { name: "Try checking this off" }).click();
    await editor(page).getByRole("button", { name: "Hide completed" }).click();
    await expect(editor(page).getByRole("checkbox", { name: "Try checking this off" })).toBeHidden();
    await expect(editor(page).getByText("1 completed item hidden")).toBeVisible();
    await expect(progress(page)).toHaveText("1/4 done"); // progress counts hidden items
    await page.reload();
    await expect(editor(page).getByRole("checkbox", { name: "Try checking this off" })).toBeHidden();
    await editor(page).getByRole("button", { name: "Show completed" }).click();
    await expect(editor(page).getByRole("checkbox", { name: "Try checking this off" })).toBeVisible();
  });

  test("converting checklist to text keeps item content", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("checkbox", { name: "Try checking this off" }).click();
    await editor(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Convert checklist to text" }).click();
    await expect(itemInputs(page)).toHaveCount(0);
    await expect(editor(page).getByLabel("Note content")).toHaveValue(/✓ Try checking this off/);
    await expect(editor(page).getByLabel("Note content")).toHaveValue(/Switch the theme/);
  });

  test("checklist in trashed note is read-only", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await openNote(page, WELCOME + " 👋");
    await expect(editor(page).getByRole("checkbox").first()).toBeEnabled();
  });
});
