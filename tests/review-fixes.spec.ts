import { test, expect, type Page } from "@playwright/test";
import { WELCOME, card, cards, closeEditor, editor, freshApp, openNote, stored } from "./helpers";

/** Write raw bytes to storage and reload so the app hydrates from them. */
async function loadWithStored(page: Page, raw: string) {
  await page.evaluate((value) => localStorage.setItem("cn.data", value), raw);
  await page.reload();
}

const backups = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("cn.data.backup-"))
      .map((key) => localStorage.getItem(key)),
  );

test.describe("Review fixes: data safety", () => {
  test("unreadable stored data is backed up, not overwritten with demo notes", async ({ page }) => {
    await freshApp(page);
    const raw = '{"notes": [ this is not json';
    await loadWithStored(page, raw);
    await expect(page.getByText("couldn't be read")).toBeVisible();
    await expect(page.getByText("Your notebook is empty")).toBeVisible();
    await expect(cards(page)).toHaveCount(0); // no demo notes seeded over user data
    expect(await backups(page)).toEqual([raw]);
    await page.waitForTimeout(600); // past the save debounce
    // The new (empty) state may be saved, but the original bytes survive in the backup.
    expect(await backups(page)).toEqual([raw]);
  });

  test("data from a newer app version is preserved, never downgraded", async ({ page }) => {
    await freshApp(page);
    const raw = JSON.stringify({ version: 99, notes: [], categories: [], settings: {} });
    await loadWithStored(page, raw);
    await expect(page.getByText("couldn't be read")).toBeVisible();
    expect(await backups(page)).toEqual([raw]);
  });

  test("malformed individual notes are repaired or dropped instead of crashing", async ({ page }) => {
    const errors = await freshApp(page);
    const raw = JSON.stringify({
      version: 1,
      notes: [
        null,
        {},
        { id: "a", title: 42, items: "nope", reminder: { dueAt: "soon" }, color: "neon", priority: "urgent" },
        { id: "b", title: "Survivor", body: "ok", items: [{ id: "i1", text: "keep me", done: true }, { bad: 1 }], categoryId: "ghost" },
        { id: "b", title: "Duplicate id" },
      ],
      categories: [{ id: "c1", name: "  " }, "junk", { id: "c2", name: "Work", color: "rose" }],
      settings: { sort: "bogus", view: "list" },
    });
    await loadWithStored(page, raw);
    await expect(page.getByText(/Repaired \d+ damaged records/)).toBeVisible();
    await expect(cards(page)).toHaveCount(2);
    await expect(card(page, "Untitled")).toHaveAttribute("data-note-color", "slate");
    await expect(card(page, "Survivor")).toContainText("1/1");
    await openNote(page, "Survivor");
    await expect(editor(page).getByRole("button", { name: "Add category" })).toBeVisible(); // ghost category cleared
    await closeEditor(page);

    const data = await stored(page);
    expect(data.notes.map((n: { id: string }) => n.id)).toEqual(["a", "b"]);
    expect(data.notes[0]).toMatchObject({ title: "", items: [], reminder: null, priority: "medium" });
    expect(data.categories).toEqual([{ id: "c2", name: "Work", color: "rose" }]);
    expect(data.settings).toEqual({ sort: "updated", view: "list" });
    expect(errors.filter((e) => !e.includes("Download the React DevTools"))).toEqual([]);
  });

  test("far-past recurring reminder catches up instantly (no runaway loop)", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 20, 10, 0) });
    await freshApp(page);
    const anchor = new Date(2000, 0, 3, 8, 15).getTime(); // ~9,800 daily periods ago
    await page.evaluate((dueAt) => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      data.notes[1].reminder = { id: "r", dueAt, anchor: dueAt, recurrence: "daily", firedAt: null };
      localStorage.setItem("cn.data", JSON.stringify(data));
    }, anchor);
    const started = Date.now();
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Reminder:" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(5000);
    await page.waitForTimeout(600);
    const reminder = (await stored(page)).notes[1].reminder;
    expect(reminder.dueAt).toBe(new Date(2026, 9, 21, 8, 15).getTime()); // next day, same local time
  });

  test("implausible timestamps (e.g. -8.64e15) are rejected at load", async ({ page }) => {
    await freshApp(page);
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      data.notes[1].reminder = { id: "r", dueAt: -8.64e15, recurrence: "daily", firedAt: null };
      localStorage.setItem("cn.data", JSON.stringify(data));
    });
    await page.reload();
    await expect(cards(page)).toHaveCount(2);
    await page.waitForTimeout(600);
    expect((await stored(page)).notes[1].reminder).toBeNull();
  });

  test("stored schema version is preserved through load (migrations can see it)", async ({ page }) => {
    await freshApp(page);
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      delete data.version; // legacy blob without version → treated as v1, still loads
      localStorage.setItem("cn.data", JSON.stringify(data));
    });
    await page.reload();
    await expect(cards(page)).toHaveCount(2);
    expect(await backups(page)).toEqual([]);
  });

  test("edits are debounced but flushed when the page is hidden", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await editor(page).getByLabel("Note title").fill("Flushed title");
    // Hide the page before the debounce fires.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const titles = (await stored(page)).notes.map((n: { title: string }) => n.title);
    expect(titles).toContain("Flushed title");
  });
});

test.describe("Review fixes: reminders & pins", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 20, 10, 0) });
  });

  test("archive → Undo keeps the pin", async ({ page }) => {
    await freshApp(page);
    await card(page, new RegExp(WELCOME)).hover();
    await page.getByRole("button", { name: `Archive ${WELCOME} 👋` }).click();
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("region", { name: "Pinned" })).toContainText("Welcome");
  });

  test("postponing a recurring reminder only shifts this occurrence", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    const section = editor(page).getByRole("region", { name: "Reminder" });
    await section.getByRole("button", { name: "Add reminder" }).click();
    await section.getByLabel("Date").fill("2026-10-20");
    await section.getByLabel("Time").fill("10:05");
    await section.getByLabel("Repeat").selectOption({ label: "Every day" });
    await section.getByRole("button", { name: "Save reminder" }).click();

    await section.getByRole("button", { name: "Postpone" }).click();
    await page.getByRole("menuitem", { name: "In 1 hour" }).click();
    await expect(editor(page).getByTestId("reminder-summary")).toContainText("postponed");
    await expect(editor(page).getByTestId("reminder-summary")).toContainText("11:00");

    // Nothing fires at the original 10:05 …
    await page.clock.fastForward("10:00");
    await expect(page.getByRole("status").filter({ hasText: "Reminder:" })).toHaveCount(0);
    // … it fires at the postponed 11:00, then the series returns to 10:05 tomorrow.
    await page.clock.fastForward("51:00");
    await expect(page.getByRole("status").filter({ hasText: "Reminder: Getting organized" })).toBeVisible();
    await page.waitForTimeout(600);
    const reminder = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder;
    expect(reminder.dueAt).toBe(new Date(2026, 9, 21, 10, 5).getTime());
    expect(reminder.snoozedUntil).toBeNull();
  });

  test("monthly reminder on the 31st returns to the 31st after a short month", async ({ page }) => {
    await page.clock.setFixedTime(new Date(2027, 0, 31, 9, 1)); // Jan 31 2027, just after due
    await freshApp(page);
    const jan31 = new Date(2027, 0, 31, 9, 0).getTime();
    const advance = async (to: Date) => {
      await page.clock.setFixedTime(to);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForTimeout(700);
      return (await stored(page)).notes[1].reminder.dueAt as number;
    };
    await page.evaluate((dueAt) => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      data.notes[1].reminder = { id: "r", dueAt, anchor: dueAt, recurrence: "monthly", firedAt: null };
      localStorage.setItem("cn.data", JSON.stringify(data));
    }, jan31);
    await page.reload();
    await page.waitForTimeout(700);
    expect((await stored(page)).notes[1].reminder.dueAt).toBe(new Date(2027, 1, 28, 9, 0).getTime());
    expect(await advance(new Date(2027, 1, 28, 9, 1))).toBe(new Date(2027, 2, 31, 9, 0).getTime());
    expect(await advance(new Date(2027, 2, 31, 9, 1))).toBe(new Date(2027, 3, 30, 9, 0).getTime());
  });
});

test.describe("Review fixes: performance", () => {
  test("typing in the editor re-renders only the edited card", async ({ page }) => {
    // React DevTools hook: count commits per NoteCard fiber (keyed by note id) without app instrumentation.
    await page.addInitScript(() => {
      const renders: Record<string, number> = {};
      (window as unknown as { __cardRenders: typeof renders }).__cardRenders = renders;
      const visit = (fiber: { elementType?: { type?: { name?: string } } | null; type?: { name?: string } | null; memoizedProps?: { note?: { id: string } }; alternate?: unknown; child?: unknown; sibling?: unknown } | null, root: boolean) => {
        let node = fiber;
        while (node) {
          const name = node.elementType?.type?.name ?? node.type?.name;
          const prev = node.alternate as { memoizedProps?: unknown } | null;
          if (name === "NoteCard" && node.memoizedProps?.note && (!prev || prev.memoizedProps !== node.memoizedProps)) {
            const id = node.memoizedProps.note.id;
            renders[id] = (renders[id] ?? 0) + 1;
          }
          visit(node.child as typeof fiber, false);
          node = root ? null : (node.sibling as typeof fiber);
        }
      };
      (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        renderers: new Map(),
        inject: () => 1,
        onCommitFiberRoot: (_id: number, root: { current: unknown }) => visit(root.current as Parameters<typeof visit>[0], true),
        onCommitFiberUnmount: () => {},
        onPostCommitFiberRoot: () => {},
        checkDCE: () => {},
      };
    });
    await freshApp(page);
    const ids = await stored(page).then((d) => d.notes.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })));
    const welcomeId = ids.find((n: { title: string }) => n.title.startsWith("Welcome")).id;
    const editedId = ids.find((n: { title: string }) => n.title === "Getting organized").id;

    await openNote(page, "Getting organized");
    const before = await page.evaluate(() => ({ ...(window as unknown as { __cardRenders: Record<string, number> }).__cardRenders }));
    await editor(page).getByLabel("Note content").pressSequentially(" typing", { delay: 15 });
    const after = await page.evaluate(() => ({ ...(window as unknown as { __cardRenders: Record<string, number> }).__cardRenders }));

    expect(after[editedId] ?? 0).toBeGreaterThan(before[editedId] ?? 0); // instrumentation works
    expect(after[welcomeId] ?? 0).toBe(before[welcomeId] ?? 0); // untouched card did not re-render
  });
});
