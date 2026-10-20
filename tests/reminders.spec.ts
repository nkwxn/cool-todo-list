import { test, expect, type Page } from "@playwright/test";
import { WELCOME, card, closeEditor, editor, freshApp, goTo, openNote, stored } from "./helpers";

// Fixed local wall-clock start so date math is deterministic.
const START = new Date(2026, 9, 20, 10, 0, 0); // Oct 20 2026, 10:00 local

async function setupClock(page: Page) {
  await page.clock.install({ time: START });
}

/** Record Notification constructor calls (permission is granted by config). */
async function spyNotifications(page: Page) {
  await page.addInitScript(() => {
    const calls: { title: string; body?: string }[] = [];
    (window as unknown as { __notifications: typeof calls }).__notifications = calls;
    const Native = window.Notification;
    class Spy extends Native {
      constructor(title: string, options?: NotificationOptions) {
        super(title, options);
        calls.push({ title, body: options?.body });
        // Simulate the user clicking the notification shortly after.
        (window as unknown as { __lastNotification: Notification }).__lastNotification = this;
      }
    }
    Object.defineProperty(window, "Notification", { value: Spy, configurable: true });
  });
}

const notifications = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notifications: { title: string; body?: string }[] }).__notifications);

async function setReminder(page: Page, date: string, time: string, repeat?: string) {
  const section = editor(page).getByRole("region", { name: "Reminder" });
  const add = section.getByRole("button", { name: "Add reminder" });
  if (await add.isVisible()) await add.click();
  else await section.getByRole("button", { name: "Edit" }).click();
  await section.getByLabel("Date").fill(date);
  await section.getByLabel("Time").fill(time);
  if (repeat) await section.getByLabel("Repeat").selectOption({ label: repeat });
  await section.getByRole("button", { name: /Save reminder|Update reminder/ }).click();
}

test.describe("Reminders", () => {
  test.beforeEach(async ({ page }) => {
    await setupClock(page);
    await spyNotifications(page);
  });

  test("set reminder: stored as correct local instant, shown in card, strip and Reminders view", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-20", "14:30");
    const summary = editor(page).getByTestId("reminder-summary");
    await expect(summary).toContainText("2:30");
    await expect(summary).toContainText(/in [45] hours/); // 4h30m away

    const due = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder.dueAt;
    expect(due).toBe(new Date(2026, 9, 20, 14, 30).getTime());

    await closeEditor(page);
    await expect(card(page, "Getting organized")).toContainText(/in [45] hours/);
    await expect(page.getByRole("region", { name: "Upcoming reminders" })).toContainText("Getting organized");

    await goTo(page, /^Reminders/);
    await expect(page.getByTestId("reminder-group-today")).toContainText("Getting organized");
  });

  test("validation: past one-off time is rejected, empty time is rejected", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-19", "09:00");
    await expect(editor(page).getByRole("alert")).toHaveText(/already passed/);
    expect((await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder).toBeNull();
  });

  test("due reminder fires a browser notification + toast once, opening the note on click", async ({ page }) => {
    await freshApp(page);
    await openNote(page, WELCOME + " 👋");
    await setReminder(page, "2026-10-20", "10:05");
    await closeEditor(page);

    await page.clock.fastForward("04:00");
    expect(await notifications(page)).toHaveLength(0);

    await page.clock.fastForward("01:30");
    await expect(page.getByRole("status").filter({ hasText: "Reminder: Welcome" })).toBeVisible();
    const calls = await notifications(page);
    expect(calls).toHaveLength(1);
    expect(calls[0].title).toContain("Welcome");
    expect(calls[0].body).toContain("Try checking this off"); // open checklist items as details

    // No duplicate on later ticks.
    await page.clock.fastForward("02:00");
    expect(await notifications(page)).toHaveLength(1);

    // Clicking the system notification navigates to the note.
    await page.evaluate(() => {
      const n = (window as unknown as { __lastNotification: Notification }).__lastNotification;
      n.onclick?.(new Event("click"));
    });
    await expect(editor(page)).toBeVisible();
    await expect(editor(page).getByTestId("reminder-summary")).toContainText("notified");
  });

  test("toast 'Open' button navigates to the note", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-20", "10:01");
    await closeEditor(page);
    await page.clock.fastForward("01:30");
    await page.getByRole("status").filter({ hasText: "Getting organized" }).getByRole("button", { name: "Open" }).click();
    await expect(editor(page).getByLabel("Note title")).toHaveValue("Getting organized");
  });

  test("postpone (snooze) moves the due time; cancel removes it", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-20", "11:00");
    const section = editor(page).getByRole("region", { name: "Reminder" });
    await section.getByRole("button", { name: "Postpone" }).click();
    await page.getByRole("menuitem", { name: "In 3 hours" }).click();
    let due = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder.dueAt;
    expect(due).toBe(START.getTime() + 3 * 3600_000);

    await section.getByRole("button", { name: "Postpone" }).click();
    await page.getByRole("menuitem", { name: "Tomorrow morning" }).click();
    due = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder.dueAt;
    expect(due).toBe(new Date(2026, 9, 21, 9, 0).getTime());

    await section.getByRole("button", { name: "Cancel reminder" }).click();
    await expect(section.getByRole("button", { name: "Add reminder" })).toBeVisible();
    await closeEditor(page);
    await expect(card(page, "Getting organized")).not.toContainText("Tomorrow");
    expect((await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder).toBeNull();
    await goTo(page, /^Reminders/);
    await expect(page.getByText("No reminders")).toBeVisible();
  });

  test("update reminder time and recurrence", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-20", "11:00");
    await setReminder(page, "2026-10-22", "08:15", "Every week");
    const r = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder;
    expect(r.dueAt).toBe(new Date(2026, 9, 22, 8, 15).getTime());
    expect(r.recurrence).toBe("weekly");
    await expect(editor(page).getByTestId("reminder-summary")).toContainText("Every week");
  });

  test("recurring daily reminder fires and advances to the next day at the same local time", async ({ page }) => {
    await freshApp(page);
    await openNote(page, "Getting organized");
    await setReminder(page, "2026-10-20", "10:02", "Every day");
    await closeEditor(page);
    await page.clock.fastForward("03:00");
    await expect.poll(async () => (await notifications(page)).length).toBe(1);
    const r = (await stored(page)).notes.find((n: { title: string }) => n.title === "Getting organized").reminder;
    expect(r.dueAt).toBe(new Date(2026, 9, 21, 10, 2).getTime());
    await goTo(page, /^Reminders/);
    await expect(page.getByTestId("reminder-group-upcoming")).toContainText("Getting organized");
  });

  test("missed reminder (app was closed) shows as overdue and fires on next open", async ({ page }) => {
    await freshApp(page);
    // Write a reminder that came due while the app was closed.
    await page.evaluate((due) => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      data.notes[1].reminder = { id: "r1", dueAt: due, recurrence: "none", firedAt: null };
      localStorage.setItem("cn.data", JSON.stringify(data));
    }, START.getTime() - 3600_000);
    await page.reload();
    await expect.poll(async () => (await notifications(page)).length).toBe(1);
    await expect(page.getByRole("status").filter({ hasText: "Reminder:" })).toBeVisible();
  });

  test("archived notes with a due reminder never fire", async ({ page }) => {
    await freshApp(page);
    await page.evaluate((due) => {
      const data = JSON.parse(localStorage.getItem("cn.data")!);
      data.notes[1].reminder = { id: "r1", dueAt: due, recurrence: "none", firedAt: null };
      data.notes[1].archived = true;
      localStorage.setItem("cn.data", JSON.stringify(data));
    }, START.getTime() - 60_000);
    await page.reload();
    await page.clock.fastForward("00:30");
    expect(await notifications(page)).toHaveLength(0);
  });

  test("notification permission is NOT requested on page load", async ({ browser }) => {
    // Headless Chrome reports "denied" without a grant; simulate a first-time visitor ("default").
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __asked: number }).__asked = 0;
      Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
      Notification.requestPermission = async () => {
        (window as unknown as { __asked: number }).__asked++;
        return "default";
      };
    });
    await page.goto("/");
    await expect(page.getByTestId("note-card").first()).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0);
    await goTo(page, /^Reminders/);
    await expect(page.getByRole("button", { name: "Enable notifications" })).toBeVisible();
    await context.close();
  });
});
