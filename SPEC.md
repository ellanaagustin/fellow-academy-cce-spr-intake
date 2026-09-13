# SPR Intake — Date Rules Spec

Status: DRAFT, awaiting sign-off. Written 2026-09-13.

## Rules (from client, verbatim intent)

1. Candidates cannot select today or tomorrow. Earliest selectable date is today + 2 calendar days.
2. Admin can manually block any date.
3. Admin can set a maximum capacity per date.
4. When capacity is reached the date becomes unavailable automatically.
5. Admin can reopen or override a blocked or full date.

Decisions taken:
- One submission = one unit of capacity, regardless of package or format.
- Zoom and self-record dates count against the same per-date capacity.
- "Today" is computed on the server in Australia/Sydney, never from the candidate's device clock.
- A global default capacity applies to every date without an override row. Starts at 1.
- The old hardcoded Zoom time-slot blocks in index.html are removed. Rules are date-level only.

## Stack

Unchanged: static index.html on Netlify, Google Apps Script web app bound to the Google Sheet.
Dev: local index.html (localhost or ?env=dev) posts to the former project bound to "SPR Intakes" owned by jeraisy.swnco@gmail.com (experiments only).
Prod (since 2026-09-13 21:10 Manila): Netlify site posts to the script bound to "SPR Intakes" owned by support@fellowacademy.com.au (a copy of Jeraisy's sheet; ids in docs/savepoint-2026-09-13.md and apps-script/deploy.sh).
The page picks the script URL by hostname.

## Data model (Sheet tabs)

### `SPR Intakes` (existing, unchanged)
Booking date for a row = Zoom Date if Format contains "zoom", else Self-Record Date.

### `Settings` (new, key/value, created by the script if missing)
| key              | value             |
|------------------|-------------------|
| default_capacity | 1                 |
| min_lead_days    | 2                 |
| timezone         | Australia/Sydney  |
| window_days      | 120               |

### `Dates` (new, one row per override, created by the script if missing)
| Date (yyyy-mm-dd) | Capacity | Blocked | Note |
|-------------------|----------|---------|------|
Capacity blank = use default. Blocked TRUE = unavailable regardless of capacity.
To reopen a full date: raise Capacity on its row. To reopen a blocked date: clear Blocked.
This tab is the admin panel. No admin page is built.

## Availability computation (server)

For each date d from minDate (today + min_lead_days) to today + window_days:
- blocked   = Dates row for d has Blocked = TRUE
- capacity  = Dates row Capacity if set, else default_capacity
- booked    = count of SPR Intakes rows whose booking date = d
- available = !blocked && booked < capacity

## Endpoints (Apps Script)

### GET /exec
Returns `{ today, minDate, maxDate, unavailable: ["yyyy-mm-dd", ...] }`.
Only unavailable dates are exposed. No counts, no notes, no capacities.

### POST /exec (existing, hardened)
Under LockService (30s wait):
1. Parse payload. Determine booking date from format.
2. Reject if date < minDate → `{ status: "rejected", reason: "too_soon" }`
3. Reject if blocked → `{ status: "rejected", reason: "blocked" }`
4. Reject if booked >= capacity → `{ status: "rejected", reason: "full" }`
5. Otherwise append row, send email, return `{ status: "success" }`.
Every rejection carries a human `message` the page shows verbatim.
Payload shape is unchanged, so the old page keeps working during rollout.

## Client (index.html)

- On load: fetch availability. Until it arrives, date fields show a skeleton. On failure, show a retry notice and keep the form usable with only the min-date rule applied client-side.
- Both date inputs get `min = minDate` and `max = maxDate`.
- Date picker: replace the native input with a small month-grid calendar that greys out unavailable dates and shows a legend. Native inputs cannot disable individual days.
- Fetch reads the JSON reply (no-cors mode removed). Rejections render inline next to the date field, and the calendar refreshes so the date shows as unavailable.
- Submit button disabled while the request is in flight.

## Admin page (decided 2026-09-13: Apps Script hosted, Google sign-in)

Served by the same script project as a second web-app deployment using HtmlService.
Deployment settings: Execute as "User accessing the web app", access "Anyone" for dev and prod.
"Anyone" still requires Google sign-in; "Only myself" or a domain restriction blocks the gmail admins
before doGet runs (Drive shows "Sorry, unable to open the file at this time"). ADMIN_EMAILS and
Sheet edit permission are the real access control, since the page runs as the signed-in admin.

Styled to match index.html (same fonts, palette, section cards). Screens:
- Month calendar. Each day shows booked/capacity, state colour (open, full, blocked, past/too soon).
- Click a day: side panel with capacity input, block/unblock toggle, note, and that day's bookings
  (name, package, format, time). Save writes the Dates row via `google.script.run`.
- Settings strip: default capacity, lead days, window. Writes the Settings tab.
- Bookings list for the month, newest first, with a link to the Sheet row.
- Polls availability every 30 s; every save re-renders from the server's reply.

Server functions exposed to the admin page (all re-check that the caller can edit the Sheet):
`adminGetMonth(yyyy-mm)`, `adminSetDate(date, {capacity, blocked, note})`, `adminSetSettings({...})`.
The candidate GET endpoint stays separate and exposes only the unavailable-date list.

Realtime: no push channel exists in Apps Script. Candidate page polls every 30 s and re-fetches
when the date picker opens. Double booking is prevented by the POST lock, not by polling.

## Security notes

- Server validates every rule; the client is convenience only.
- Admin authority = Google account access to the Sheet. No passphrase gates.
- GET exposes only a list of dates. Nothing personal leaves the sheet.
- Script executes as the sheet owner; deployment access "Anyone" is required for a public form and is unchanged.

## Rollout order

1. Dev sheet: paste new script, redeploy, verify GET and POST with curl and with the local page.
2. Push branch to GitHub. Netlify branch deploy for a second check against the dev script (dev URL is selected on localhost only, so this step uses a query flag `?env=dev`).
3. Prod sheet: paste new script, Manage deployments → edit existing deployment → New version. The exec URL stays the same. Script creates the Settings and Dates tabs on first run.
4. Merge to main. Netlify deploys the page.
Old page + new script is safe. New page + old script is not, so the script always goes first.

## Phases

1. Script: Settings and Dates tabs, availability function, GET endpoint. Curl test.
2. Script: POST validation under lock. Curl test with a full date, a blocked date, a too-soon date.
3. Page: fetch availability, calendar, read reply, error and loading states. Localhost test.
4. Admin page: HtmlService page, month calendar, day panel, settings. Test on dev deployment.
5. Rollout per order above, admin deployment included.

## Progress log

- 2026-09-13 Backups taken (Drive copy + local CSV). Dev sheet and dev script created by Jeraisy. Page selects script URL by hostname. Git linked to GitHub, branch feature/date-rules.
- 2026-09-13 Phases 1–3 coded on branch: Code.gs (Settings/Dates tabs, GET availability, POST validation under lock, admin functions), admin.html (neumorphic admin calendar), index.html (calendar pickers, availability polling, reads JSON reply, old time-slot blocks removed). Node syntax check on all three; `node tests/rules.test.js` passes 19 rule checks. Awaiting dev deployment for live GET/POST tests.
- 2026-09-13 clasp linked (.clasp.json → apps-script/, dev account). `bash apps-script/deploy.sh dev all` pushes and republishes both dev deployments; manifest is rewritten per target because web-app settings live in the manifest. Live dev tests passed: GET availability JSON; POST too_soon / full / missing_date rejected; success on open date then same date rejected as full. Blocked-date path covered by unit test only until a Dates row exists.
- 2026-09-13 16:05 (Manila) SAVEPOINT. Completed: Phases 1–4 coded and deployed to dev (public deployment @3, admin deployment @5). Proof: `node tests/rules.test.js` 19/19 pass; live dev curl: GET availability JSON correct; POST too_soon/full/missing_date rejected; success on 2026-09-16 then same date rejected full. Decisions: neumorphic admin base changed to cool white; prod deploys stay manual; jeraisy.swnco@gmail.com added to ADMIN_EMAILS. Gotchas: Apps Script web-app settings live in the manifest per version, so deploy.sh rewrites appsscript.json per target; clasp clone into a scratch dir, never into the repo (overwrites files); GAS POST replies need the 302 followed as GET (curl -L re-POSTs and gets 411). Blocked: Jeraisy to confirm admin page opens for jeraisy.swnco@gmail.com and to test index.html from disk. Next: browser verification of candidate calendar + admin page, then blocked-date live test, then push branch and prod rollout.
- 2026-09-13 16:30 (Manila) SAVEPOINT. Completed: admin page confirmed working in browser for jeraisy.swnco@gmail.com (screenshot: Sept 2026 calendar, day panel, bookings list with row links); primary button restyled to white neumorphic with gold text, deployed admin @6. Tests 19/19. Decisions: all admin buttons white neumorphic, colour only on text/icons/state dots; gold fill kept for the active toggle. Blocked: Jeraisy to (a) test index.html from disk and (b) block a day in admin then confirm it vanishes from the candidate calendar. Next: after (a)+(b), push branch, then prod rollout.
- 2026-09-13 17:00 (Manila) SAVEPOINT. Completed: admin deployment access switched MYSELF→ANYONE (deploy.sh, dev admin @7) after Ellana got Drive "Sorry, unable to open the file" — MYSELF blocks non-owner accounts before doGet; calendar spans full width with taller cells; day panel is a right-side drawer with flush chevron handle (tuck away, keep selection), × close, Escape, backdrop under 861px; deployed dev admin @10; Jeraisy approved look in browser. Commit b70bd34. Tests 19/19. Decisions: prod admin default also ANYONE (DOMAIN would block gmail admins); admin page runs as the signed-in user so each ADMIN_EMAILS account needs Editor on the sheet. Gotchas: "Could not load: You do not have permission to access the requested document" = admin lacks sheet access, not a script bug. Blocked: Jeraisy to share DEV sheet with agustin.ellanamickaela@gmail.com as Editor; index.html from-disk test; block-a-day round trip. Next: those three, then push branch, then prod rollout.
- 2026-09-13 18:05 (Manila) SAVEPOINT. Completed: admin shift-click date range with drawer range mode + adminSetRange (dev admin @11); candidate page verified on localhost via headless Chrome against dev (1–14 Sep off, 15/16/17/19/20/24 struck, both calendars) and from the shell curl; index.html restyled to the admin neumorphic system with classic design backed up at docs/design-backup/index-classic-2026-09-13.html; time field now three selects composing zoom_time HH:MM (5/40/PM → 17:40 verified); selects branded via appearance: base-select (Chrome/Edge, native fallback elsewhere). Commits b70bd34, 30e9a81, 855bb60. Tests 19/19. Decisions: range save keeps per-day capacity unless a number is entered; range capped at 62 days; Google's "created by a Google Apps Script user" banner cannot be hidden from the page — it disappears for same-Workspace-domain viewers only, iframe embedding rejected (third-party cookie sign-in). Gotchas: headless Chrome via CDP (scratchpad shot.js/picker.js) can drive the page and screenshot; the reveal panels are hidden until a format radio is clicked so --dump-dom alone shows no visible calendar. Blocked: Jeraisy to share DEV sheet with agustin.ellanamickaela@gmail.com (Editor); Jeraisy to block a day in admin for the live round-trip; Jeraisy to approve the redesign in browser (localhost:5173). Next: those three, then push branch, then prod rollout (public deployment must be republished too because Code.gs changed).
- 2026-09-13 21:30 (Manila) SAVEPOINT. Completed: feature branch merged to main (fast-forward) and live on Netlify; PRODUCTION MOVED to a support@fellowacademy.com.au-owned copy of the sheet ("SPR Intakes", id 1WOCgd-xi1RUGHu8JhexLzaMFzqeatNowLA3rpmkffJs) with a new bound script (1I3mi_pchiipFW0EX8CgAOay_ZqoEjNGXd40uREJ8t1XAWMJud594tgcR; form deployment AKfycbxBcdRp…@3, admin AKfycbwzDS…@2); live page verified serving the new form URL and the endpoint returns availability JSON; admin page opened by support@ with consent granted; admin gained move-booking (with optional email), search box with upcoming list, candidate names+times on day tiles; Code.gs sender helper (From support@ when the running account owns/aliases it), explicit manifest scopes (spreadsheets.currentonly, userinfo.email, gmail.send); candidate page restyled minimalist on fellowacademy.com.au brand (classic + neumorphic designs backed up in docs/design-backup). Commits 8e01026, d8d31a0, 73c46dc. Tests 19/19. Decisions: Workspace ownership chosen so emails come from support@ and data lives in the org; consumer→Workspace ownership transfer is impossible so a copy + new bound script was used; old project on Jeraisy's sheet kept as "dev" target in deploy.sh; Google's "created by a Google Apps Script user" banner accepted. Gotchas: clasp create with --type sheets ignores --parentId and creates a new sheet (use --parentId alone); an execute-as-owner deployment returns 403/404 until the owner consents in a browser AND the deployment is republished afterwards; changed scopes need each admin to remove the app at myaccount.google.com/permissions and reopen; Workspace accounts may be blocked from Gmail-owned web apps by org policy (was the case for support@ before the move). Blocked: Jeraisy + Ellana to open the new admin URL once and consent; Jeraisy to copy any submissions that landed on the old sheet between 21:03 and ~21:13 Manila. Next: those two, then routine use; deploys via `bash apps-script/deploy.sh prod all`.
