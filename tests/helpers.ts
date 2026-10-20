import { expect, type Page } from "@playwright/test";

export const WELCOME = "Welcome to your notebook";

/** Fresh app with seed data. Collects console errors for later assertion. */
export async function freshApp(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(cards(page).first()).toBeVisible();
  await page.waitForFunction(() => localStorage.getItem("cn.data") !== null);
  return errors;
}

export const cards = (page: Page) => page.getByTestId("note-card");
export const card = (page: Page, title: string | RegExp) =>
  page.getByTestId("note-card").filter({ has: page.getByRole("heading", { name: title }) });
export const editor = (page: Page) => page.locator("[data-editor]");
export const itemInputs = (page: Page) => editor(page).getByLabel("Checklist item text");

/** On narrow screens the "New note" header button is replaced by a FAB. */
/** The usable "New note" control: header button on wide screens, FAB on phones (drawer copy excluded). */
export const newNoteButton = (page: Page) =>
  page.locator("header, body > div > button").getByRole("button", { name: "New note" }).or(
    page.locator("button[aria-label='New note']"),
  ).filter({ visible: true }).first();

export async function newNote(page: Page, title: string) {
  await newNoteButton(page).click();
  const titleBox = editor(page).getByLabel("Note title");
  await expect(titleBox).toBeFocused();
  await titleBox.fill(title);
}

export async function openNote(page: Page, title: string) {
  await page.getByRole("button", { name: `Open note: ${title}`, exact: true }).click();
  await expect(editor(page)).toBeVisible();
}

export async function closeEditor(page: Page) {
  await editor(page).getByRole("button", { name: "Close editor" }).click();
  await expect(editor(page)).toBeHidden();
}

export async function addItems(page: Page, ...texts: string[]) {
  const add = editor(page).getByLabel("Add checklist item");
  for (const text of texts) {
    await add.fill(text);
    await add.press("Enter");
  }
}

/** Persisted data after the app's debounced save has run. */
export async function stored(page: Page) {
  await page.waitForFunction(() => localStorage.getItem("cn.data") !== null);
  await page.waitForTimeout(400); // > save debounce (300 ms)
  return page.evaluate(() => JSON.parse(localStorage.getItem("cn.data") ?? "null"));
}

/** Sidebar is a drawer on mobile: open it first when needed. */
export async function goTo(page: Page, name: RegExp | string) {
  const toggle = page.getByRole("button", { name: "Open navigation" });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("navigation", { name: "Notes navigation" }).getByRole("button", { name }).first().click();
}

export async function values(locator: import("@playwright/test").Locator) {
  return locator.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
}
