# Apps Script deployment

Two files go into the Apps Script project bound to the sheet: `Code.gs` and `admin.html`.

## Update an existing deployment (dev or prod)

1. Open the sheet → Extensions → Apps Script.
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Add a file: `+` → HTML → name it `admin` (Apps Script adds `.html`). Paste `admin.html`.
4. Edit `ADMIN_EMAILS` and `NOTIFICATION_EMAIL` at the top of `Code.gs`.
5. Deploy → Manage deployments → pencil icon on the existing deployment → Version: New version → Deploy.
   The `/exec` URL does not change.
6. Open the `/exec` URL in a browser. You should see JSON with `today`, `minDate`, `maxDate`, `unavailable`.
   The first call creates the `Settings` and `Dates` tabs.

## Admin deployment (second deployment of the same project)

1. Deploy → New deployment → type Web app.
2. Execute as: **User accessing the web app**. Who has access: **Only myself** (dev) or your Workspace domain (prod).
3. Deploy, then open `<that exec URL>?page=admin`. Authorise the script once when prompted.
4. Your account must be in `ADMIN_EMAILS` and must have edit access to the sheet.

Never set the admin deployment to "Anyone".

## Sheet tabs

- `Settings`: `default_capacity` (1), `min_lead_days` (2), `timezone` (Australia/Sydney), `window_days` (120).
- `Dates`: one row per override. `Capacity` blank = default. `Blocked` TRUE hides the date regardless of capacity.
  Reopen a full date by raising its capacity; reopen a blocked date by clearing Blocked.
