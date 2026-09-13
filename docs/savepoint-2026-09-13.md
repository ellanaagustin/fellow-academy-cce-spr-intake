# Savepoint 2026-09-13 21:30 (Asia/Manila)

Branch: `main` (feature/date-rules merged fast-forward and pushed). Spec and progress log: `SPEC.md`. Last commit 73c46dc.
Live site: https://fellow-academy-cce-spr-intake.netlify.app (Netlify deploys main).

## Production stack (moved 2026-09-13 ~21:10 Manila)

| Thing | Value |
|---|---|
| Prod sheet | "SPR Intakes", owner support@fellowacademy.com.au, id `1WOCgd-xi1RUGHu8JhexLzaMFzqeatNowLA3rpmkffJs`; editors jeraisy.swnco@gmail.com, agustin.ellanamickaela@gmail.com |
| Prod script (bound) | `1I3mi_pchiipFW0EX8CgAOay_ZqoEjNGXd40uREJ8t1XAWMJud594tgcR` (`.clasp.prod.json`, clasp profile `prod` = support@) |
| Form deployment (live, in index.html) | `AKfycbxBcdRp88zDFCBap3UxxYnyQJXi8rigtRupDZrkFZcWQFBEL2olUwn1VFSOl43Q7fO-8Q` @3, execute as owner, anyone anonymous |
| Admin deployment | `AKfycbwzDS_QVs4IJgTFG7K8r44vr3qAErcC_isXWEtL0_v12keHS8v05PTjlTap_GcjUtDv1g` @2, execute as user accessing, anyone (ADMIN_EMAILS gates) → `…/exec?page=admin` |
| Dev (former prod) | Sheet "SPR Intakes" owned by jeraisy.swnco@gmail.com, script `1jz9VT…` (`.clasp.json`), deployments in deploy.sh `dev` case |
| Old original prod | "SPR Intakes Backend" (support@), original script untouched; superseded |

## Phase table

| Item | State | Proof |
|---|---|---|
| Date rules (lead 2, capacity, blocked, override) | Live | Live endpoint returns `{today,minDate,maxDate,unavailable[]}`; 19/19 rule tests |
| Candidate page (minimalist, brand fonts, branded pickers) | Live | Netlify serves page with new form URL (checked 21:16); headless Chrome verified greyed days before the move |
| Admin page: calendar, drawer, range block, move booking + email, search, names on days | Live @2 | support@ opened it and saw blocked dates; move flow verified in preview and on dev with real email |
| Emails from support@ | Live | Form deployment runs as support@; move emails sent by whoever moves, From support@ only if that account has the alias |
| Old→new data | Copy taken 21:03 | Submissions on Jeraisy's sheet after 21:03 must be pasted across by hand |

## Credentials present locally (names only)
- `~/.clasprc.json` tokens: `default` (jeraisy.swnco@gmail.com), `prod` (support@fellowacademy.com.au)
- No `.env`. Script exec URLs are public by design (index.html, deploy.sh).

## Next actions
1. Jeraisy and Ellana: open the new admin URL once from their Gmail accounts and accept the consent (unverified-app step). Blocked on them.
2. Jeraisy: compare the old sheet (own Drive) with the new one for rows after 21:03 Manila and paste any across; rename the old sheet "OLD". Blocked on Jeraisy.
3. Routine: `bash apps-script/deploy.sh prod all` after any Code.gs/admin.html change; push main for index.html changes.

## Resume commands
```
node tests/rules.test.js                       # 19 rule checks
bash apps-script/deploy.sh prod all            # push + republish live form + admin (clasp profile prod)
bash apps-script/deploy.sh dev all             # former project on Jeraisy's sheet
clasp --user prod -P .clasp.prod.json deployments
curl -sS -L "https://script.google.com/macros/s/AKfycbxBcdRp88zDFCBap3UxxYnyQJXi8rigtRupDZrkFZcWQFBEL2olUwn1VFSOl43Q7fO-8Q/exec"
```
Headless check of the candidate page: serve the repo on localhost (`node <scratchpad>/serve.js .`), drive Chrome over CDP to click a format radio, then read `.cal-day` classes. Admin preview mode (no server) at `/apps-script/admin.html` exercises the client with a mock.

## Gotchas
- `clasp create --type sheets --parentId X` ignores X and creates a new spreadsheet; use `--parentId` alone to bind to an existing sheet.
- An execute-as-owner deployment answers 403 then 404 ("page not found") until the owner has consented in a browser and the deployment is republished afterwards.
- When manifest scopes change, existing users are not re-prompted reliably; remove the app at myaccount.google.com/permissions and reopen the page.
- Workspace policy blocked support@ from opening the Gmail-owned admin app; an app owned inside the Workspace opens fine.
- Consumer Gmail cannot transfer Drive ownership to a Workspace account; copy the sheet under the Workspace account instead. Drive-API copy carries the bound script along.
- Web-app executeAs/access live in the manifest per version; deploy.sh rewrites appsscript.json per target.
- Admin page runs as the signed-in user: needs Editor on the sheet, else "You do not have permission to access the requested document".
- MYSELF/DOMAIN access shows "Sorry, unable to open the file" before doGet; ADMIN_EMAILS is the real gate.
- From address = the account the script runs as; `from:` only works for a configured "Send mail as" alias. Display name and reply-to are set regardless.
- Google's "created by a Google Apps Script user" banner cannot be hidden by the page.
- Native time inputs and select menus can't be styled; three selects + `appearance: base-select` (Chrome/Edge) instead.
- Testing POST with curl: capture the 302 Location and GET it; `curl -L` re-POSTs and returns 411.
