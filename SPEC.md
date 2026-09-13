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
Dev: local index.html posts to the dev script (sheet "SPR Intakes — DEV", owner jeraisy.swnco).
Prod: Netlify site posts to the prod script (sheet "SPR Intakes Backend", owner support@fellowacademy).
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
Deployment settings: Execute as "User accessing the web app", access "Only myself" for dev,
"Anyone within fellowacademy.com.au" (or a named account) for prod. Google handles sign-in.
The page runs as the signed-in admin, so Sheet edit permission is the real access control.

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
