# Graph Report - .  (2026-10-24)

## Corpus Check
- Corpus is ~20,829 words - fits in a single context window. You may not need a graph.

## Summary
- 334 nodes · 720 edges · 19 communities (17 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Note App UI Shell
- State and Storage
- Package Dependencies
- Reminders and Notifications
- TypeScript Config
- Playwright Test Suite
- State Providers
- Docs and Agent Rules
- Reminder Scheduling Logic
- Theme System
- Root Layout and Fonts
- Next.js Branding Asset
- Globe Icon Asset
- Window Icon Asset
- Vercel Branding
- File Icon Asset
- ESLint Config
- Next Config

## God Nodes (most connected - your core abstractions)
1. `cn()` - 30 edges
2. `ReminderEditor()` - 17 edges
3. `compilerOptions` - 16 edges
4. `Note` - 15 edges
5. `editor()` - 13 edges
6. `AppShell()` - 12 edges
7. `effectiveDue()` - 12 edges
8. `createId()` - 12 edges
9. `useToast()` - 9 edges
10. `NotesAction` - 9 edges

## Surprising Connections (you probably didn't know these)
- `NotesProvider()` --indirect_call--> `notesReducer()`  [INFERRED]
  components/providers/notes-provider.tsx → lib/reducer.ts
- `ChecklistProps` --references--> `Note`  [EXTRACTED]
  components/checklist.tsx → lib/types.ts
- `Checklist()` --calls--> `createId()`  [EXTRACTED]
  components/checklist.tsx → lib/utils.ts
- `AppShell()` --calls--> `useNow()`  [EXTRACTED]
  components/note-app.tsx → hooks/use-now.ts
- `AppShell()` --calls--> `useReminderScheduler()`  [EXTRACTED]
  components/note-app.tsx → hooks/use-reminder-scheduler.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Next.js Project Bootstrapping and Development Workflow** — readme_cool_todo_list_project, readme_create_next_app, readme_dev_server, readme_app_page_tsx [INFERRED 0.85]

## Communities (19 total, 2 thin omitted)

### Community 0 - "Note App UI Shell"
Cohesion: 0.06
Nodes (57): AppSkeleton(), Checklist(), AppShell(), CategoryForm(), GROUP_META, isTypingTarget(), Nav, NoteApp() (+49 more)

### Community 1 - "State and Storage"
Cohesion: 0.10
Nodes (36): NoteCardProps, NoteEditorProps, mapNote(), notesReducer(), touch(), createSeedData(), ideasNote(), welcomeNote() (+28 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.05
Nodes (37): eslint, eslint-config-next, lucide-react, next, dependencies, lucide-react, next, react (+29 more)

### Community 3 - "Reminders and Notifications"
Cohesion: 0.10
Nodes (33): RemindersView(), defaultDueAt(), ReminderEditor(), roundToMinute(), tomorrowMorning(), listeners, NotificationPermissionState, notify() (+25 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "Playwright Test Suite"
Cohesion: 0.22
Nodes (17): progress(), addItems(), card(), cards(), closeEditor(), editor(), freshApp(), goTo() (+9 more)

### Community 6 - "State Providers"
Cohesion: 0.16
Nodes (16): ChecklistProps, NotesContext, NotesContextValue, NotesProvider(), snapshot(), ToastAction, ToastContext, ToastContextValue (+8 more)

### Community 7 - "Docs and Agent Rules"
Cohesion: 0.13
Nodes (15): generate-agent-files.js (written by next dev), Next.js Agent Rules Block, Next.js Breaking Changes Notice, Bundled Next.js Docs in node_modules/next/dist/docs/, app/page.tsx Entry Page, Cool Todo List and Reminders Project, create-next-app, Development Server (npm/yarn/pnpm/bun dev) (+7 more)

### Community 8 - "Reminder Scheduling Logic"
Cohesion: 0.39
Nodes (10): useReminderScheduler(), activeReminders(), buildReminderBody(), effectiveDue(), groupReminders(), hasFired(), isReminderDue(), reminderGroup (+2 more)

### Community 9 - "Theme System"
Cohesion: 0.24
Nodes (10): ThemeMenu(), listeners, readPreference(), subscribePreference(), subscribeSystem(), ThemeContext, ThemeContextValue, ThemePreference (+2 more)

### Community 10 - "Root Layout and Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 11 - "Next.js Branding Asset"
Cohesion: 0.50
Nodes (4): Next.js Wordmark (N E X T js text paths), Static Asset Served from public/ Directory, Vercel/Next.js Brand Asset, Next.js Logo SVG

### Community 12 - "Globe Icon Asset"
Cohesion: 0.50
Nodes (4): GlobeIcon, Internationalization / Web Concept Symbol, Next.js Public Static Assets Directory, Globe Icon SVG

### Community 13 - "Window Icon Asset"
Cohesion: 0.50
Nodes (4): Window Icon SVG, Browser Window Metaphor, Gray #666 Fill Style, WindowIcon Glyph

### Community 14 - "Vercel Branding"
Cohesion: 0.67
Nodes (3): Deployment Platform, Vercel, Vercel Logo (vercel.svg)

### Community 15 - "File Icon Asset"
Cohesion: 0.67
Nodes (3): file.svg (Generic Document Icon), Document/File Page Glyph, Next.js Public Static Asset

## Knowledge Gaps
- **111 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `SORT_LABEL`, `VIEW_TITLE` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Note` connect `Reminder Scheduling Logic` to `Note App UI Shell`, `State and Storage`, `Reminders and Notifications`, `State Providers`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `cn()` connect `Note App UI Shell` to `Reminders and Notifications`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `geistSans`, `geistMono`, `metadata` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Note App UI Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.06259780907668232 - nodes in this community are weakly interconnected._
- **Should `State and Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.09565217391304348 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Reminders and Notifications` be split into smaller, more focused modules?**
  _Cohesion score 0.1006006006006006 - nodes in this community are weakly interconnected._