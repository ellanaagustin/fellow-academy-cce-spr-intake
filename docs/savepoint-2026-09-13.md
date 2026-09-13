# Savepoint 2026-09-13 17:00 (Asia/Manila)

Branch: `feature/date-rules` (not pushed). Spec and progress log: `SPEC.md`. Last feature commit b70bd34.

## Phase table

| Item | State | Proof |
|---|---|---|
| Backups of prod sheet | Done | Drive copy "SPR Intakes — BACKUP 2026-09-13" (support account); `backups/*.csv` local, gitignored |
| Dev sheet + dev script | Done | "SPR Intakes — DEV" owned by jeraisy.swnco@gmail.com; script id in `.clasp.json` |
| Page picks script URL by host | Done | `index.html` SCRIPT_URL_DEV on localhost/file/`?env=dev`, prod otherwise |
| Phase 1: Settings/Dates tabs + GET availability | Done, deployed dev public @3 | curl GET returns `{today,minDate,maxDate,unavailable[]}` matching real bookings |
| Phase 2: POST validation under lock | Done, deployed dev public @3 | too_soon / full / missing_date rejected; success then full on same date |
| Phase 3: candidate calendar + reads reply | Coded, not browser-verified | Node syntax check passes; awaiting Jeraisy's from-disk check |
| Phase 4: admin page | Done, deployed dev admin @10 | Full-width calendar, right-side drawer with chevron handle; Jeraisy approved in browser 17:00 |
| Admin access for other allow-listed accounts | Deployment fixed (ANYONE @7); sheet share pending | Ellana got past the Drive error; now "You do not have permission to access the requested document" until DEV sheet is shared |
| Blocked-date path | Unit-tested only | `tests/rules.test.js`; no live Dates row yet |
| Phase 5: prod rollout | Not started | — |

## Credentials present locally (names only)
- clasp login token in `~/.clasprc.json` (Google account jeraisy.swnco@gmail.com)
- No `.env` files. Script exec URLs are public by design and live in `index.html` and `apps-script/deploy.sh`.

## Next actions
1. Jeraisy: share the DEV sheet with agustin.ellanamickaela@gmail.com as Editor, then Ellana reloads the admin page. Blocked on Jeraisy.
2. Jeraisy: open `index.html` from disk, confirm calendars load with booked days greyed, submit a test on an open day. Blocked on Jeraisy.
3. Jeraisy: in the admin page, block one day and save, then reload the candidate page and confirm it is greyed. Blocked on Jeraisy.
4. Claude: fix anything from 1–3, then `git push -u origin feature/date-rules` when Jeraisy says push.
5. Prod rollout in SPEC.md order: paste `Code.gs` + `admin.html` into prod script, New version on existing deployment, add admin deployment (execute as user accessing, access Anyone), share prod sheet with every ADMIN_EMAILS account as Editor, then merge to main.

## Resume commands
```
node tests/rules.test.js                 # 19 rule checks
bash apps-script/deploy.sh dev all       # push + republish both dev deployments
bash apps-script/deploy.sh dev admin     # admin only
curl -sS -L "<public exec url>"          # availability JSON
```
Admin dev page: `https://script.google.com/macros/s/AKfycbx9pxbXowdjzCqkfo-t1F-16cbxL6D3Kj-zOinIKgMybPdmeRcDg2OCvRC-CTjZ_Wn3/exec?page=admin`

## Gotchas
- Web-app executeAs/access are stored in `appsscript.json` per version; `deploy.sh` rewrites it before each deploy. Never `clasp deploy` without it.
- Admin deployment access must be ANYONE. MYSELF (or DOMAIN for gmail admins) makes Google show "Sorry, unable to open the file at this time" before doGet runs; the ADMIN_EMAILS check never executes.
- Admin page executes as the signed-in user and calls `getActiveSpreadsheet`, so every admin needs Editor on the sheet. Missing share shows "Could not load: Exception: You do not have permission to access the requested document".
- Claude Code's auto-mode classifier blocks `deploy.sh` runs that widen deployment access; Jeraisy runs those with `! bash apps-script/deploy.sh dev admin`.
- `clasp clone` overwrites local files; only clone into a scratch dir.
- Testing POST with curl: capture the 302 Location and GET it. `curl -L` re-POSTs and Google returns 411.
- Sheet date cells come back as Date objects; `toDateStr` normalises with the spreadsheet timezone.
- Hidden inputs ignore `required`; calendar dates are validated in `handleSubmit`.
- Drawer handle must live inside the drawer element (panel `overflow: visible`, inner `.panel-scroll` scrolls) so it moves with the transform; a separately positioned tab looked detached.
