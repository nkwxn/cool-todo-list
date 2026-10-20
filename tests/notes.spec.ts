import { test, expect } from "@playwright/test";
import { WELCOME, card, cards, closeEditor, editor, freshApp, goTo, newNote, newNoteButton, openNote, stored } from "./helpers";

test.describe("Notes", () => {
  test("loads with seed notes and no console errors or nested buttons", async ({ page }) => {
    const errors = await freshApp(page);
    await expect(card(page, new RegExp(WELCOME))).toBeVisible();
    await expect(page.locator("button button")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("create and edit a note; edits persist without a save button", async ({ page }) => {
    await freshApp(page);
    await newNote(page, "Groceries plan");
    await editor(page).getByLabel("Note content").fill("Line one\nLine two");
    await closeEditor(page);
    await expect(card(page, "Groceries plan")).toContainText("Line two");

    await openNote(page, "Groceries plan");
    await editor(page).getByLabel("Note title").fill("Groceries plan v2");
    await page.reload();
    await expect(card(page, "Groceries plan v2")).toBeVisible();
    const data = await stored(page);
    expect(data.notes.find((n: { title: string }) => n.title === "Groceries plan v2").body).toBe("Line one\nLine two");
  });

  test("open note is deep-linkable via ?note= and survives reload", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    expect(page.url()).toContain("?note=");
    await page.reload();
    await expect(editor(page)).toBeVisible();
    await expect(editor(page).getByLabel("Note title")).toHaveValue(/Welcome/);
  });

  test("stale ?note= id is ignored gracefully", async ({ page }) => {
    await freshApp(page);
    await page.goto("/?note=does-not-exist");
    await expect(cards(page).first()).toBeVisible();
    await expect(editor(page)).toBeHidden();
    await expect(page).not.toHaveURL(/note=/);
  });

  test("Escape closes the editor even when focus is outside inputs", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeHidden();
  });

  test("empty note shows 'Untitled' and is kept", async ({ page }) => {
    await freshApp(page);
    const before = await cards(page).count();
    await newNoteButton(page).click();
    await closeEditor(page);
    await expect(cards(page)).toHaveCount(before + 1);
    await expect(card(page, "Untitled")).toBeVisible();
  });

  test("duplicate creates an independent copy without the reminder", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(editor(page).getByLabel("Note title")).toHaveValue(/\(copy\)$/);
    await editor(page).getByLabel("Checklist item text").first().fill("Changed only in copy");
    await closeEditor(page);
    await openNote(page, WELCOME + " 👋");
    await expect(editor(page).getByLabel("Checklist item text").first()).toHaveValue("Try checking this off");
  });

  test("pin and unpin from the card moves notes between sections", async ({ page }) => {
    await freshApp(page);
    const pinned = page.getByRole("region", { name: "Pinned" });
    await expect(pinned).toContainText("Welcome");
    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Pin Getting organized" }).click();
    await expect(pinned).toContainText("Getting organized");
    await page.getByRole("button", { name: "Unpin Getting organized" }).click();
    await expect(pinned).not.toContainText("Getting organized");
  });

  test("color change applies a distinct tint and persists", async ({ page }) => {
    await freshApp(page);
    const target = card(page, "Getting organized");
    const before = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
    await openNote(page, "Getting organized");
    await editor(page).getByRole("button", { name: "Note color" }).click();
    await page.getByRole("menuitemradio", { name: "amber color" }).click();
    await closeEditor(page);
    await expect(target).toHaveAttribute("data-note-color", "amber");
    const after = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);
    await page.reload();
    await expect(card(page, "Getting organized")).toHaveAttribute("data-note-color", "amber");
  });

  test("archive with undo, then unarchive from Archive view", async ({ page }) => {
    await freshApp(page);
    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Archive Getting organized" }).click();
    await expect(card(page, "Getting organized")).toBeHidden();
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(card(page, "Getting organized")).toBeVisible();

    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Archive Getting organized" }).click();
    await goTo(page, /^Archive/);
    await expect(card(page, "Getting organized")).toBeVisible();
    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Unarchive Getting organized" }).click();
    await expect(card(page, "Getting organized")).toBeHidden();
    await goTo(page, /^All notes/);
    await expect(card(page, "Getting organized")).toBeVisible();
  });

  test("trash from editor closes it; restore; delete forever needs confirmation", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await editor(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(editor(page)).toBeHidden();
    await expect(card(page, "Getting organized")).toBeHidden();

    await goTo(page, /^Trash/);
    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Restore Getting organized" }).click();
    await expect(card(page, "Getting organized")).toBeHidden();
    await goTo(page, /^All notes/);
    await expect(card(page, "Getting organized")).toBeVisible();

    // Trash again, open it in trash (read-only), then delete forever.
    await card(page, "Getting organized").hover();
    await page.getByRole("button", { name: "Move Getting organized to trash" }).click();
    await goTo(page, /^Trash/);
    await openNote(page, "Getting organized");
    await expect(editor(page).getByLabel("Note title")).toHaveAttribute("readonly", "");
    await editor(page).getByRole("button", { name: "Delete forever" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete note forever?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Getting organized")).toBeVisible();
    await editor(page).getByRole("button", { name: "Delete forever" }).click();
    await page.getByRole("dialog", { name: "Delete note forever?" }).getByRole("button", { name: "Delete forever" }).click();
    await expect(editor(page)).toBeHidden();
    await expect(page.getByText("Trash is empty")).toBeVisible();
    expect((await stored(page)).notes.some((n: { title: string }) => n.title === "Getting organized")).toBe(false);
  });

  test("empty trash removes all trashed notes", async ({ page }) => {
    await freshApp(page);
    for (const title of ["Getting organized", WELCOME + " 👋"]) {
      await card(page, title).hover();
      await page.getByRole("button", { name: `Move ${title} to trash` }).click();
    }
    await expect(page.getByText("Your notebook is empty")).toBeVisible();
    await goTo(page, /^Trash/);
    await page.getByRole("button", { name: "Empty trash" }).click();
    await page.getByRole("dialog", { name: "Empty trash?" }).getByRole("button", { name: "Empty trash" }).click();
    await expect(page.getByText("Trash is empty")).toBeVisible();
  });
});

test.describe("Search, sort, filter, categories", () => {
  test("search matches title, body, checklist item and category; empty state + clear", async ({ page }) => {
    await freshApp(page);
    const search = page.getByLabel("Search notes");
    for (const [query, expected] of [
      ["welcome", WELCOME],
      ["sidebar", "Getting organized"], // body text
      ["grip handle", WELCOME], // checklist item
      ["personal", "Getting organized"], // category name
      ["WELCOME", WELCOME], // case-insensitive
    ] as const) {
      await search.fill(query);
      await expect(cards(page)).toHaveCount(1);
      await expect(cards(page).first()).toContainText(expected);
    }
    await search.fill("zzz-no-match");
    await expect(page.getByText("No matching notes")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).first().click();
    await expect(cards(page)).toHaveCount(2);
  });

  test("Cmd/Ctrl+K and / focus search; Escape in search clears it", async ({ page }) => {
    await freshApp(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByLabel("Search notes")).toBeFocused();
    await page.keyboard.type("grip");
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Search notes")).toHaveValue("");
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(page.getByLabel("Search notes")).toBeFocused();
  });

  test("sort by title, priority, created; choice persists; pinned stays first", async ({ page }) => {
    await freshApp(page);
    for (const title of ["Banana", "apple", "Cherry"]) {
      await newNote(page, title);
      await closeEditor(page);
    }
    await openNote(page, "Cherry");
    await editor(page).getByRole("button", { name: /^Priority/ }).click();
    await page.getByRole("menuitem", { name: "High" }).click();
    await closeEditor(page);

    const others = page.getByRole("region", { name: "Others" }).getByRole("heading", { level: 3 });
    const sortBy = async (label: string) => {
      await page.getByRole("button", { name: /^Sort:/ }).click();
      await page.getByRole("menuitem", { name: label }).click();
    };

    await sortBy("Title (A–Z)");
    await expect(others).toHaveText(["apple", "Banana", "Cherry", "Getting organized"]);
    await sortBy("Priority");
    await expect(others.first()).toHaveText("Cherry");
    await sortBy("Date created");
    await expect(others).toHaveText(["Cherry", "apple", "Banana", "Getting organized"]);
    await expect(page.getByRole("region", { name: "Pinned" })).toContainText("Welcome");

    await page.reload();
    await expect(others).toHaveText(["Cherry", "apple", "Banana", "Getting organized"]);
  });

  test("grid/list layout toggle persists", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "layout toggle is hidden on phones");
    await freshApp(page);
    await page.getByRole("radio", { name: "List" }).click();
    await expect(page.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");
    expect((await stored(page)).settings.view).toBe("list");
  });

  test("category create, duplicate-name validation, assign, filter, rename, delete", async ({ page }) => {
    await freshApp(page);
    const openSidebar = async () => {
      const toggle = page.getByRole("button", { name: "Open navigation" });
      if (await toggle.isVisible()) await toggle.click();
    };
    await openSidebar();
    await page.getByRole("button", { name: "New category" }).click();
    const dialog = page.getByRole("dialog", { name: "New category" });
    const create = dialog.getByRole("button", { name: "Create category" });
    await expect(create).toBeDisabled(); // empty name
    await dialog.getByLabel("Name").fill("personal");
    await expect(dialog.getByText("already exists")).toBeVisible();
    await expect(create).toBeDisabled();
    await dialog.getByLabel("Name").fill("  Work  ");
    await dialog.getByRole("button", { name: "rose category color" }).click();
    await create.click();
    await expect(dialog).toBeHidden();

    // New note created inside a category view is filed into it.
    await goTo(page, /^Work/);
    await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();
    await expect(page.getByText("Nothing in Work yet")).toBeVisible();
    await newNote(page, "Quarterly review");
    await expect(editor(page).getByRole("button", { name: /Add category|Work/ })).toContainText("Work");
    await closeEditor(page);
    await expect(cards(page)).toHaveCount(1);

    // Assign an existing note via the editor's category picker.
    await goTo(page, /^All notes/);
    await openNote(page, WELCOME + " 👋");
    await editor(page).getByRole("button", { name: "Add category" }).click();
    await page.getByRole("menuitem", { name: "Work" }).click();
    await closeEditor(page);
    await goTo(page, /^Work/);
    await expect(cards(page)).toHaveCount(2);

    // Rename.
    await openSidebar();
    await page.getByRole("button", { name: "Work options" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("dialog", { name: "Edit category" }).getByLabel("Name").fill("Office");
    await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Office" })).toBeVisible();

    // Delete keeps notes (uncategorized) and falls back to All notes.
    await openSidebar();
    await page.getByRole("button", { name: "Office options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: /Delete “Office”/ }).getByRole("button", { name: "Delete category" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "All notes" })).toBeVisible();
    await expect(card(page, "Quarterly review")).toBeVisible();
    expect((await stored(page)).notes.every((n: { categoryId: string | null }) => n.categoryId === null || typeof n.categoryId === "string")).toBe(true);
  });
});

test.describe("Theme", () => {
  test("switch light/dark/system without flash; persists across reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await freshApp(page);
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(html).toHaveClass(/dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(14, 14, 16)");

    // The pre-hydration script must apply the class before any React code runs.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await page.unroute("**/_next/static/**/*.js");
    await page.reload();

    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitem", { name: "System" }).click();
    await expect(html).not.toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveClass(/dark/);
  });
});
