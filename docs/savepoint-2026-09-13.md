# Savepoint 2026-09-13 18:05 (Asia/Manila)

Branch: `feature/date-rules` (not pushed). Spec and progress log: `SPEC.md`. Last feature commit 855bb60.

## Phase table

| Item | State | Proof |
|---|---|---|
| Backups of prod sheet | Done | Drive copy "SPR Intakes — BACKUP 2026-09-13" (support account); `backups/*.csv` local, gitignored |
| Dev sheet + dev script | Done | "SPR Intakes — DEV" owned by jeraisy.swnco@gmail.com; script id in `.clasp.json` |
| Page picks script URL by host | Done | `index.html` SCRIPT_URL_DEV on localhost/file/`?env=dev`, prod otherwise |
| Phase 1: Settings/Dates tabs + GET availability | Done, deployed dev public @3 | curl GET returns `{today,minDate,maxDate,unavailable[]}` matching real bookings |
| Phase 2: POST validation under lock | Done, deployed dev public @3 | too_soon / full / missing_date rejected; success then full on same date |
| Phase 3: candidate calendar + reads reply | Verified on localhost | Headless Chrome on http://localhost:5173: 1–14 Sep off, 15/16/17/19/20/24 struck through, 18+ open; both Zoom and self-record calendars |
| Phase 4: admin page | Done, deployed dev admin @11 | Full-width calendar, drawer with handle, shift-click range block; Jeraisy approved drawer in browser |
| Admin access for other allow-listed accounts | Deployment fixed (ANYONE @7); sheet share pending | Ellana now gets "You do not have permission to access the requested document" until DEV sheet is shared |
| Candidate page neumorphic redesign | Coded, verified headless, awaiting Jeraisy's eye | Stylesheet only (markup/script identical to backup except time field); classic design at `docs/design-backup/index-classic-2026-09-13.html` |
| Branded pickers | Done | Time = 3 selects → hidden zoom_time HH:MM (5/40/PM → 17:40); selects `appearance: base-select` in Chrome/Edge, native fallback elsewhere |
| Blocked-date live round trip | Not done | Needs an admin to block a day on dev, then re-run headless check |
| Phase 5: prod rollout | Not started | — |

## Credentials present locally (names only)
- clasp login token in `~/.clasprc.json` (Google account jeraisy.swnco@gmail.com)
- No `.env` files. Script exec URLs are public by design and live in `index.html` and `apps-script/deploy.sh`.

## Next actions
1. Jeraisy: open http://localhost:5173 (start with `node <scratchpad>/serve.js .` or any static server; `file://` also works) and approve or adjust the neumorphic candidate page. Blocked on Jeraisy.
2. Jeraisy: share the DEV sheet with agustin.ellanamickaela@gmail.com as Editor, then Ellana reloads the admin page. Blocked on Jeraisy.
3. Jeraisy: in admin, block one open day (or shift-click a range) and save; Claude re-runs the headless check to confirm it turns unavailable on the candidate calendar. Blocked on Jeraisy.
4. Claude: `git push -u origin feature/date-rules` when Jeraisy says push.
5. Prod rollout in SPEC.md order: paste `Code.gs` + `admin.html` into prod script, New version on the existing public deployment, add admin deployment (execute as user accessing, access Anyone), share prod sheet with every ADMIN_EMAILS account as Editor, then merge to main. Republish the dev public deployment too (`deploy.sh dev public`) since Code.gs changed after @3.

## Resume commands
```
node tests/rules.test.js                 # 19 rule checks
bash apps-script/deploy.sh dev all       # push + republish both dev deployments
bash apps-script/deploy.sh dev admin     # admin only
curl -sS -L "<public exec url>"          # availability JSON
```
Admin dev page: `https://script.google.com/macros/s/AKfycbx9pxbXowdjzCqkfo-t1F-16cbxL6D3Kj-zOinIKgMybPdmeRcDg2OCvRC-CTjZ_Wn3/exec?page=admin`

Headless check (Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`): serve the repo on localhost, then either `chrome --headless=new --dump-dom <url>` and grep `cal-day` classes, or drive it over CDP (`--remote-debugging-port`, Node's built-in WebSocket) to click a format radio before screenshotting, because the calendars live inside hidden reveal panels.

## Gotchas
- Web-app executeAs/access are stored in `appsscript.json` per version; `deploy.sh` rewrites it before each deploy. Never `clasp deploy` without it.
- Admin deployment access must be ANYONE. MYSELF (or DOMAIN for gmail admins) makes Google show "Sorry, unable to open the file at this time" before doGet runs.
- Admin page executes as the signed-in user, so every admin needs Editor on the sheet, or they get "You do not have permission to access the requested document".
- Google's "This application was created by a Google Apps Script user" banner cannot be removed by the page. It is hidden only for viewers in the script owner's Workspace domain. Iframe embedding hides it but breaks sign-in under third-party cookie blocking; rejected.
- Claude Code's auto-mode classifier blocks `deploy.sh` runs that widen deployment access; Jeraisy runs those with `! bash apps-script/deploy.sh dev admin`.
- `clasp clone` overwrites local files; only clone into a scratch dir.
- Testing POST with curl: capture the 302 Location and GET it. `curl -L` re-POSTs and Google returns 411.
- Sheet date cells come back as Date objects; `toDateStr` normalises with the spreadsheet timezone.
- Hidden inputs ignore `required`; calendar dates are validated in `handleSubmit`. The three time selects are in `zoomFields` so they toggle required with the Zoom format.
- Drawer handle must live inside the drawer element (panel `overflow: visible`, inner `.panel-scroll` scrolls) so it moves with the transform.
- Global `label` rule is small uppercase gold; option/station/attest labels override it or their descriptions render as spaced capitals.
- Native `<input type="time">` and native select menus cannot be styled; use selects with `appearance: base-select` (Chrome/Edge) and compose values into a hidden input.
