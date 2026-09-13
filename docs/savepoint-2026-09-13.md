# Savepoint 2026-09-13 (Asia/Manila)

Branch: `feature/date-rules` (not pushed). Spec and progress log: `SPEC.md`.

## Phase table

| Item | State | Proof |
|---|---|---|
| Backups of prod sheet | Done | Drive copy "SPR Intakes — BACKUP 2026-09-13" (support account); `backups/*.csv` local, gitignored |
| Dev sheet + dev script | Done | "SPR Intakes — DEV" owned by jeraisy.swnco@gmail.com; script id in `.clasp.json` |
| Page picks script URL by host | Done | `index.html` SCRIPT_URL_DEV on localhost/file/`?env=dev`, prod otherwise |
| Phase 1: Settings/Dates tabs + GET availability | Done, deployed dev @3 | curl GET returns `{today,minDate,maxDate,unavailable[]}` matching real bookings |
| Phase 2: POST validation under lock | Done, deployed dev @3 | too_soon / full / missing_date rejected; success then full on same date |
| Phase 3: candidate calendar + reads reply | Coded, not browser-verified | Node syntax check passes; awaiting Jeraisy's browser check |
| Phase 4: admin page (neumorphic, white) | Coded, deployed dev @5 | Awaiting Jeraisy's confirmation it opens for jeraisy.swnco@gmail.com |
| Blocked-date path | Unit-tested only | `tests/rules.test.js`; no live Dates row yet |
| Phase 5: prod rollout | Not started | — |

## Credentials present locally (names only)
- clasp login token in `~/.clasprc.json` (Google account jeraisy.swnco@gmail.com)
- Google Drive connector in Claude session (support@fellowacademy.com.au) — session-scoped, nothing on disk
- No `.env` files. Script exec URLs are public by design and live in `index.html` and `apps-script/deploy.sh`.

## Next actions
1. Jeraisy: open `index.html` from disk, confirm calendars load with 15/16/17/19/20 Sep greyed, submit a test on an open day. Blocked on Jeraisy.
2. Jeraisy: open admin URL (`apps-script/deploy.sh` ADMIN_ID + `?page=admin`), block one day, confirm candidate page hides it. Blocked on Jeraisy.
3. Claude: fix anything from 1–2, then `git push -u origin feature/date-rules` when Jeraisy says push.
4. Prod rollout in SPEC.md order: paste `Code.gs` + `admin.html` into prod script, New version on existing deployment, add admin deployment (domain-restricted), then merge to main.

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
- `clasp clone` overwrites local files; only clone into a scratch dir.
- Testing POST with curl: capture the 302 Location and GET it. `curl -L` re-POSTs and Google returns 411.
- Sheet date cells come back as Date objects; `toDateStr` normalises with the spreadsheet timezone.
- Hidden inputs ignore `required`; calendar dates are validated in `handleSubmit`.
