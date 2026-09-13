// ══════════════════════════════════════════════════════════════════
//  Fellow Academy — SPR Intake Form Backend
//  Google Apps Script  (paste this entire file into Apps Script)
//
//  What it does on every form submission:
//    1. Appends a row to a Google Sheet called "SPR Intakes"
//    2. Sends a formatted notification email to NOTIFICATION_EMAIL
//
//  Setup (5 minutes — full steps in the README below):
//    1. Go to script.google.com → New project
//    2. Paste this code, replacing the two constants below
//    3. Deploy as Web App (Execute as: Me, Access: Anyone)
//    4. Copy the deployment URL into spr_intake_form.html → SCRIPT_URL
// ══════════════════════════════════════════════════════════════════

// ── CONFIGURE THESE TWO LINES ──────────────────────────────────────
var NOTIFICATION_EMAIL = 'agustin.ellanamickaela@gmail.com, support@fellowacademy.com.au';  // notification recipients
var SHEET_NAME         = 'SPR Intakes';                        // tab name in the spreadsheet
// ──────────────────────────────────────────────────────────────────


// ── Entry point ────────────────────────────────────────────────────
function doPost(e) {
  try {
    var raw  = e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    saveToSheet(data);
    sendNotificationEmail(data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('SPR intake error: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ── Save to Google Sheet ───────────────────────────────────────────
function saveToSheet(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  // Create sheet + header row if it doesn't exist yet
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      'Submitted At (UTC)',
      'Candidate Name',
      'Candidate Email',
      'Candidate Phone',
      'Exam Sitting',
      'Partner Name',
      'Partner Email',
      'Package',
      'Format',
      'Zoom Date',
      'Zoom Time',
      'Zoom Timezone',
      'Self-Record Date',
      'Self-Record Device',
      'Clinical Encounter Stations',
      'Case Discussion Stations',
      'Feedback Expectations'
    ];
    sheet.appendRow(headers);
    // Bold & freeze the header row
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f1ea');
    sheet.setFrozenRows(1);
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
  }

  sheet.appendRow([
    data.submitted_at      || '',
    data.candidate_name    || '',
    data.candidate_email   || '',
    data.candidate_phone   || '',
    data.exam_sitting      || '',
    data.partner_name      || '',
    data.partner_email     || '',
    data.package           || '',
    data.format            || '',
    data.zoom_date         || '',
    data.zoom_time         || '',
    data.zoom_timezone     || '',
    data.self_date         || '',
    data.self_device       || '',
    data.stations_ce            || '',
    data.stations_cd            || '',
    data.feedback_expectations  || ''
  ]);
}


// ── Send notification email ────────────────────────────────────────
function sendNotificationEmail(data) {

  // Format the submission timestamp for AEST
  var submittedAt = '—';
  try {
    var d = new Date(data.submitted_at);
    submittedAt = Utilities.formatDate(d, 'Australia/Sydney', 'dd MMM yyyy h:mm a \'AEST\'');
  } catch(e) { submittedAt = data.submitted_at || '—'; }

  // Build subject line
  var subject = 'New SPR Intake: ' + (data.candidate_name || 'Unknown') + ' — ' + (data.package || 'package unknown');

  // Session-specific rows (Zoom vs self-record)
  var sessionRows = '';
  if (data.format && data.format.toLowerCase().indexOf('zoom') !== -1) {
    sessionRows =
      row('Preferred Date',  data.zoom_date     || '—') +
      row('Preferred Time',  data.zoom_time     || '—') +
      row('Timezone',        data.zoom_timezone || '—');
  } else if (data.format) {
    sessionRows =
      row('Recording Date',  data.self_date     || '—') +
      row('Recording Device', data.self_device  || '—');
  }

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">',

    // Header bar
    '<div style="background:#8a6a25;padding:20px 28px;border-radius:4px 4px 0 0;">',
      '<p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Fellow Academy · CCE SPR</p>',
      '<h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#fff;">New Intake Form Submission</h1>',
    '</div>',

    // Body
    '<div style="border:1px solid #e0ddd3;border-top:none;border-radius:0 0 4px 4px;padding:28px;">',

      '<p style="margin:0 0 24px;font-size:13px;color:#6e6a62;">Submitted: ' + submittedAt + '</p>',

      section('Candidate', [
        row('Name',         data.candidate_name  || '—'),
        row('Email',        data.candidate_email || '—'),
        row('Phone',        data.candidate_phone || '—'),
        row('Exam Sitting', data.exam_sitting    || '—')
      ]),

      section('Role-Play Partner', [
        row('Name',  data.partner_name  || '—'),
        row('Email', data.partner_email || '—')
      ]),

      section('Booking', [
        row('Package', data.package || '—'),
        row('Format',  data.format  || '—'),
        sessionRows
      ]),

      section('Station Selections', [
        row('Clinical Encounters', data.stations_ce || '—'),
        row('Case Discussions',    data.stations_cd || '—')
      ]),

      section('Feedback Expectations', [
        row('What they expect', data.feedback_expectations || '—')
      ]),

      '<hr style="border:none;border-top:1px solid #e0ddd3;margin:28px 0 16px;">',
      '<p style="margin:0;font-size:11px;color:#aaa;letter-spacing:0.06em;text-transform:uppercase;">Fellow Academy · Auto-notification · Do not reply</p>',

    '</div>',
    '</div>'
  ].join('');

  MailApp.sendEmail({
    to:       NOTIFICATION_EMAIL,
    subject:  subject,
    htmlBody: html
  });
}


// ── HTML helpers ───────────────────────────────────────────────────
function section(title, rows) {
  return [
    '<div style="margin-bottom:24px;">',
      '<p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a25;">' + title + '</p>',
      '<table style="width:100%;border-collapse:collapse;">',
        rows.join(''),
      '</table>',
    '</div>'
  ].join('');
}

function row(label, value) {
  return [
    '<tr>',
      '<td style="padding:5px 0;font-size:13px;color:#6e6a62;width:38%;vertical-align:top;">' + label + '</td>',
      '<td style="padding:5px 0;font-size:13.5px;color:#1a1a1a;font-weight:500;">' + value + '</td>',
    '</tr>'
  ].join('');
}


// ══════════════════════════════════════════════════════════════════
//  SETUP GUIDE
// ══════════════════════════════════════════════════════════════════
//
//  Step 1 — Create the Google Apps Script
//  ----------------------------------------
//  a. Go to https://script.google.com
//  b. Click "New project"
//  c. Delete the placeholder code in Code.gs
//  d. Paste this entire file
//  e. Click the floppy-disk icon (or Ctrl+S) to save
//
//  Step 2 — Link a Google Sheet (recommended but optional)
//  --------------------------------------------------------
//  a. Create a NEW Google Sheet at sheets.google.com — name it "SPR Intakes Backend"
//  b. From that sheet, click Extensions → Apps Script
//  c. Paste this code there (it will be bound to that sheet)
//
//  Step 3 — Deploy as a Web App
//  -----------------------------
//  a. Click "Deploy" (top right) → "New deployment"
//  b. Click the gear icon next to "Type" → select "Web app"
//  c. Set:
//       Description:       SPR Intake Form v1
//       Execute as:        Me (your Google account)
//       Who has access:    Anyone
//  d. Click "Deploy"
//  e. Copy the Web App URL — it looks like:
//       https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
//
//  Step 4 — Paste the URL into the HTML form
//  -------------------------------------------
//  a. Open index.html
//  b. Find this line near the bottom of the <script> section:
//       var SCRIPT_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
//  c. Replace the placeholder with your actual URL
//  d. Save the file
//
//  Step 5 — Authorise the script (one-time)
//  ------------------------------------------
//  a. In the Apps Script editor, click the Run button (triangle) on the doPost function
//     (or any function) — Google will ask you to authorise it
//  b. Click "Review permissions" → choose your Google account
//  c. You may see "Google hasn't verified this app" — click "Advanced" → "Go to ... (unsafe)"
//  d. Click "Allow"
//  This lets the script send email and write to Sheets on your behalf.
//
//  You're done. Test by submitting the form — you'll get an email within seconds
//  and a new row will appear in your Google Sheet.
//
// ══════════════════════════════════════════════════════════════════
