// ══════════════════════════════════════════════════════════════════
//  Fellow Academy — SPR Intake Backend (Google Apps Script)
//
//  Files in this project:  Code.gs (this file)  +  admin.html
//
//  Endpoints
//    GET  /exec              → JSON availability for the candidate form
//    GET  /exec?page=admin   → admin web app (Google sign-in, allow-listed emails)
//    POST /exec              → intake submission, validated under a lock
//
//  Sheet tabs (created automatically if missing)
//    SPR Intakes  – one row per submission (existing)
//    Settings     – key/value: default_capacity, min_lead_days, timezone, window_days
//    Dates        – per-date overrides: Date, Capacity, Blocked, Note
// ══════════════════════════════════════════════════════════════════

// ── CONFIGURE ─────────────────────────────────────────────────────
var NOTIFICATION_EMAIL = 'agustin.ellanamickaela@gmail.com, support@fellowacademy.com.au';
var FROM_EMAIL = 'support@fellowacademy.com.au';   // used as From when the running account is this address or has it as a Gmail "Send mail as" alias
var FROM_NAME  = 'Fellow Academy';
var ADMIN_EMAILS = [
  'support@fellowacademy.com.au',
  'agustin.ellanamickaela@gmail.com',
  'jeraisy.swnco@gmail.com'
];
var SHEET_NAME     = 'SPR Intakes';
var SETTINGS_SHEET = 'Settings';
var DATES_SHEET    = 'Dates';
// ──────────────────────────────────────────────────────────────────

var DEFAULT_SETTINGS = {
  default_capacity: 1,
  min_lead_days:    2,
  timezone:         'Australia/Sydney',
  window_days:      120
};

var COL = { FORMAT: 8, ZOOM_DATE: 9, SELF_DATE: 12, NAME: 1, PACKAGE: 7, ZOOM_TIME: 10, ZOOM_TZ: 11, EMAIL: 2, PARTNER_NAME: 5, PARTNER_EMAIL: 6 };

// ── Entry points ───────────────────────────────────────────────────
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'admin') return serveAdmin();
  return json(getAvailability());
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData ? e.postData.contents : '{}');
  } catch (err) {
    return json({ status: 'error', message: 'Invalid payload' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json({ status: 'error', message: 'Server busy, please try again' });
  }

  try {
    var ctx   = loadContext();
    var date  = bookingDateOf(data);
    var check = checkDate(ctx, date);
    if (!check.ok) {
      return json({ status: 'rejected', reason: check.reason, message: check.message, availability: summarize(ctx) });
    }
    saveToSheet(data);
  } catch (err) {
    Logger.log('SPR intake error: ' + err);
    return json({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }

  try { sendNotificationEmail(data); } catch (err) { Logger.log('Email error: ' + err); }
  return json({ status: 'success' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── Availability ───────────────────────────────────────────────────
function loadContext() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  var settings = readSettings(ss);
  var today    = Utilities.formatDate(new Date(), settings.timezone, 'yyyy-MM-dd');
  return {
    ss:        ss,
    settings:  settings,
    today:     today,
    minDate:   addDays(today, settings.min_lead_days),
    maxDate:   addDays(today, settings.window_days),
    overrides: readOverrides(ss),
    booked:    readBookedCounts(ss)
  };
}

function summarize(ctx) {
  var unavailable = [];
  for (var d = ctx.minDate; d <= ctx.maxDate; d = addDays(d, 1)) {
    if (!checkDate(ctx, d).ok) unavailable.push(d);
  }
  return { today: ctx.today, minDate: ctx.minDate, maxDate: ctx.maxDate, unavailable: unavailable };
}

function getAvailability() {
  return summarize(loadContext());
}

function dayState(ctx, d) {
  var o = ctx.overrides[d] || {};
  var capacity = (o.capacity !== '' && o.capacity != null) ? Number(o.capacity) : Number(ctx.settings.default_capacity);
  return { capacity: capacity, blocked: !!o.blocked, note: o.note || '', booked: ctx.booked[d] || 0 };
}

function checkDate(ctx, d) {
  if (!d)               return { ok: false, reason: 'missing_date', message: 'Please choose a date.' };
  if (d < ctx.minDate)  return { ok: false, reason: 'too_soon',     message: 'Please choose a date at least ' + ctx.settings.min_lead_days + ' days from today.' };
  if (d > ctx.maxDate)  return { ok: false, reason: 'too_far',      message: 'That date is too far ahead. Please choose an earlier date.' };
  var s = dayState(ctx, d);
  if (s.blocked)                return { ok: false, reason: 'blocked', message: 'That date is not available. Please choose another date.' };
  if (s.booked >= s.capacity)   return { ok: false, reason: 'full',    message: 'That date has just filled up. Please choose another date.' };
  return { ok: true };
}

function bookingDateOf(data) {
  var fmt = String(data.format || '').toLowerCase();
  var raw = fmt.indexOf('zoom') !== -1 ? data.zoom_date : data.self_date;
  var m = String(raw || '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

// ── Sheet readers ──────────────────────────────────────────────────
function ensureSheets(ss) {
  if (!ss.getSheetByName(SETTINGS_SHEET)) {
    var s = ss.insertSheet(SETTINGS_SHEET);
    var rows = [['key', 'value']];
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { rows.push([k, DEFAULT_SETTINGS[k]]); });
    s.getRange(1, 1, rows.length, 2).setValues(rows);
    s.getRange(1, 1, 1, 2).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(DATES_SHEET)) {
    var d = ss.insertSheet(DATES_SHEET);
    d.getRange(1, 1, 1, 4).setValues([['Date', 'Capacity', 'Blocked', 'Note']]).setFontWeight('bold');
    d.setFrozenRows(1);
    d.getRange('A2:A').setNumberFormat('@');
  }
}

function readSettings(ss) {
  var out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  var rows = ss.getSheetByName(SETTINGS_SHEET).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][0]).trim(), v = rows[i][1];
    if (!k || v === '') continue;
    out[k] = (k === 'timezone') ? String(v).trim() : Number(v);
  }
  return out;
}

function readOverrides(ss) {
  var sheet = ss.getSheetByName(DATES_SHEET);
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var d = toDateStr(rows[i][0], tz);
    if (!d) continue;
    out[d] = { row: i + 1, capacity: rows[i][1], blocked: rows[i][2] === true || String(rows[i][2]).toUpperCase() === 'TRUE', note: String(rows[i][3] || '') };
  }
  return out;
}

function readBookedCounts(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return {};
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var d = rowBookingDate(rows[i], tz);
    if (d) out[d] = (out[d] || 0) + 1;
  }
  return out;
}

function rowBookingDate(row, tz) {
  var isZoom = String(row[COL.FORMAT]).toLowerCase().indexOf('zoom') !== -1;
  return toDateStr(isZoom ? row[COL.ZOOM_DATE] : row[COL.SELF_DATE], tz);
}

function toDateStr(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
}

function addDays(dateStr, n) {
  var p = dateStr.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

// ── Admin ──────────────────────────────────────────────────────────
function currentAdmin() {
  var active = Session.getActiveUser().getEmail();
  var effective = Session.getEffectiveUser().getEmail();
  if (!active || active !== effective) return null;
  return ADMIN_EMAILS.indexOf(active) !== -1 ? active : null;
}

function requireAdmin() {
  var who = currentAdmin();
  if (!who) throw new Error('Not authorised');
  return who;
}

function serveAdmin() {
  var who = currentAdmin();
  if (!who) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:24px">Not authorised' +
      (Session.getActiveUser().getEmail() ? ' for ' + Session.getActiveUser().getEmail() : '') +
      '. Open this page from the admin deployment with an allow-listed Google account.</p>'
    );
  }
  var t = HtmlService.createTemplateFromFile('admin');
  t.adminEmail = who;
  return t.evaluate().setTitle('SPR Bookings — Admin').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ym = 'yyyy-MM'
function adminGetMonth(ym) {
  requireAdmin();
  var ctx = loadContext();
  var ss = ctx.ss;
  var tz = ss.getSpreadsheetTimeZone();

  var bookingsByDate = {};
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var d = rowBookingDate(rows[i], tz);
      if (!d || d.slice(0, 7) !== ym) continue;
      var isZoom = String(rows[i][COL.FORMAT]).toLowerCase().indexOf('zoom') !== -1;
      (bookingsByDate[d] = bookingsByDate[d] || []).push({
        row: i + 1,
        name: String(rows[i][COL.NAME]),
        email: String(rows[i][COL.EMAIL]),
        package: String(rows[i][COL.PACKAGE]).replace(/\s*\(\$\d+\)/, ''),
        format: isZoom ? 'Zoom' : 'Self-record',
        time: isZoom ? (toTimeStr(rows[i][COL.ZOOM_TIME], tz) + ' ' + String(rows[i][COL.ZOOM_TZ]).toUpperCase()).trim() : ''
      });
    }
  }

  var p = ym.split('-').map(Number);
  var daysInMonth = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  var days = [];
  for (var day = 1; day <= daysInMonth; day++) {
    var ds = ym + '-' + (day < 10 ? '0' : '') + day;
    var s = dayState(ctx, ds);
    days.push({
      date: ds, booked: s.booked, capacity: s.capacity, blocked: s.blocked, note: s.note,
      tooSoon: ds < ctx.minDate, past: ds < ctx.today,
      bookings: bookingsByDate[ds] || []
    });
  }
  return { ym: ym, today: ctx.today, minDate: ctx.minDate, settings: ctx.settings, days: days, sheetUrl: ss.getUrl(), sheetId: sheet ? sheet.getSheetId() : null };
}

function toTimeStr(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'HH:mm');
  return String(v || '');
}

// patch = { capacity: number|'' , blocked: bool, note: string }
function adminSetDate(date, patch) {
  requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Bad date');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    var sheet = ss.getSheetByName(DATES_SHEET);
    var existing = readOverrides(ss)[date];
    var capacity = (patch.capacity === '' || patch.capacity == null) ? '' : Number(patch.capacity);
    var values = [[date, capacity, !!patch.blocked, String(patch.note || '')]];
    if (existing) {
      sheet.getRange(existing.row, 1, 1, 4).setValues(values);
    } else {
      sheet.appendRow(values[0]);
      sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('@').setValue(date);
    }
  } finally {
    lock.releaseLock();
  }
  return adminGetMonth(date.slice(0, 7));
}

// Applies blocked + note to every day from..to inclusive. capacity '' keeps each day's existing value.
function adminSetRange(from, to, patch) {
  requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Bad range');
  var dates = [];
  for (var d = from; d <= to && dates.length <= 62; d = addDays(d, 1)) dates.push(d);
  if (dates.length > 62) throw new Error('Range too long (max 62 days)');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    var sheet = ss.getSheetByName(DATES_SHEET);
    var overrides = readOverrides(ss);
    var setCap = !(patch.capacity === '' || patch.capacity == null);
    var blocked = !!patch.blocked, note = String(patch.note || '');
    var appendRows = [];
    dates.forEach(function (date) {
      var existing = overrides[date];
      var capacity = setCap ? Number(patch.capacity) : (existing ? existing.capacity : '');
      var values = [date, capacity, blocked, note];
      if (existing) sheet.getRange(existing.row, 1, 1, 4).setValues([values]);
      else appendRows.push(values);
    });
    if (appendRows.length) {
      var start = sheet.getLastRow() + 1;
      sheet.getRange(start, 1, appendRows.length, 1).setNumberFormat('@');
      sheet.getRange(start, 1, appendRows.length, 4).setValues(appendRows);
    }
  } finally {
    lock.releaseLock();
  }
  return adminGetMonth(from.slice(0, 7));
}

// Moves one booking (sheet row) to newDate. opts = { notify: bool, force: bool, ym: 'yyyy-MM' to return }.
// Without force, a full or blocked target returns { needsConfirm: true, reason } and changes nothing.
function adminMoveBooking(row, newDate, opts) {
  var who = requireAdmin();
  opts = opts || {};
  row = Number(row);
  if (!(row >= 2)) throw new Error('Bad row');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) throw new Error('Bad date');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var booking;
  try {
    var ctx = loadContext();
    var ss = ctx.ss;
    var tz = ss.getSpreadsheetTimeZone();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || row > sheet.getLastRow()) throw new Error('Booking not found');
    var values = sheet.getRange(row, 1, 1, 17).getValues()[0];
    var isZoom = String(values[COL.FORMAT]).toLowerCase().indexOf('zoom') !== -1;
    var oldDate = rowBookingDate(values, tz);
    if (!oldDate) throw new Error('Row has no booking date');
    if (oldDate === newDate) throw new Error('Already on that date');

    var override = ctx.overrides[newDate] || {};
    var capacity = (override.capacity === '' || override.capacity == null) ? ctx.settings.default_capacity : Number(override.capacity);
    var booked = ctx.booked[newDate] || 0;
    var reason = override.blocked ? 'blocked' : (booked >= capacity ? 'full' : '');
    if (reason && !opts.force) return { needsConfirm: true, reason: reason, booked: booked, capacity: capacity };

    var col = (isZoom ? COL.ZOOM_DATE : COL.SELF_DATE) + 1;
    sheet.getRange(row, col).setNumberFormat('@').setValue(newDate);
    booking = {
      name: String(values[COL.NAME]), email: String(values[COL.EMAIL]),
      partnerName: String(values[COL.PARTNER_NAME]), partnerEmail: String(values[COL.PARTNER_EMAIL]),
      format: isZoom ? 'Zoom' : 'Self-record', pkg: String(values[COL.PACKAGE]),
      time: isZoom ? (toTimeStr(values[COL.ZOOM_TIME], tz) + ' ' + String(values[COL.ZOOM_TZ]).toUpperCase()).trim() : '',
      oldDate: oldDate, newDate: newDate, tz: tz
    };
  } finally {
    lock.releaseLock();
  }
  var email = { attempted: !!opts.notify, to: booking.email, error: '', from: '' };
  if (opts.notify) {
    try { email.from = sendMoveEmail(booking, who); }
    catch (err) { email.error = String(err && err.message || err); Logger.log('Move email error: ' + err); }
  }
  var data = adminGetMonth(opts.ym || newDate.slice(0, 7));
  data.email = email;
  return data;
}

function sendMoveEmail(b, movedBy) {
  if (!b.email) return;
  var fmt = function (d) { var p = d.split('-').map(Number); return Utilities.formatDate(new Date(p[0], p[1] - 1, p[2]), b.tz, 'EEEE d MMMM yyyy'); };
  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">',
    '<div style="background:#8a6a25;padding:20px 28px;border-radius:4px 4px 0 0;">',
      '<p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Fellow Academy · CCE SPR</p>',
      '<h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#fff;">Your session date has changed</h1>',
    '</div>',
    '<div style="border:1px solid #e0ddd3;border-top:none;border-radius:0 0 4px 4px;padding:28px;">',
      '<p style="margin:0 0 18px;font-size:14px;">Hi ' + b.name + ',</p>',
      '<p style="margin:0 0 18px;font-size:14px;line-height:1.6;">Your Station Performance Review session has been moved to a new date. Everything else about your booking stays the same.</p>',
      section('New booking', [
        row('New date', '<strong>' + fmt(b.newDate) + '</strong>'),
        row('Previous date', fmt(b.oldDate)),
        row('Format', b.format + (b.time ? ' · ' + b.time : '')),
        row('Package', b.pkg)
      ]),
      '<p style="margin:0 0 18px;font-size:13px;color:#6e6a62;line-height:1.6;">Case materials and session details will follow the usual schedule for the new date. If this date does not work for you, reply to this email and we will sort it out.</p>',
      '<hr style="border:none;border-top:1px solid #e0ddd3;margin:28px 0 16px;">',
      '<p style="margin:0;font-size:11px;color:#aaa;letter-spacing:0.06em;text-transform:uppercase;">Fellow Academy · Sent by ' + movedBy + '</p>',
    '</div>',
    '</div>'
  ].join('');
  var cc = [b.partnerEmail, NOTIFICATION_EMAIL].filter(Boolean).join(', ');
  return sendBrandedEmail({ to: b.email, cc: cc, subject: 'Your SPR session has moved to ' + fmt(b.newDate), htmlBody: html });
}

// Sends as support@fellowacademy.com.au when possible; otherwise as the running account, named "Fellow Academy" with reply-to support@.
function sendBrandedEmail(m) {
  var opts = { htmlBody: m.htmlBody, name: FROM_NAME, replyTo: FROM_EMAIL };
  if (m.cc) opts.cc = m.cc;
  var me = Session.getEffectiveUser().getEmail();
  if (me !== FROM_EMAIL) {
    // Works only if FROM_EMAIL is a "Send mail as" alias of the running account; otherwise fall back to the account itself.
    try {
      GmailApp.sendEmail(m.to, m.subject, '', Object.assign({ from: FROM_EMAIL }, opts));
      return FROM_EMAIL;
    } catch (err) {
      Logger.log('Send as ' + FROM_EMAIL + ' failed for ' + me + ': ' + err);
    }
  }
  GmailApp.sendEmail(m.to, m.subject, '', opts);
  return me;
}

// Run once from the script editor after scopes change so the owner grants them for the "execute as me" deployment.
function authorizeOnce() {
  Logger.log('Authorised as ' + Session.getEffectiveUser().getEmail());
}

function adminSetSettings(patch) {
  requireAdmin();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  var rows = sheet.getDataRange().getValues();
  Object.keys(patch).forEach(function (k) {
    if (!(k in DEFAULT_SETTINGS)) return;
    var v = (k === 'timezone') ? String(patch[k]) : Number(patch[k]);
    if (k !== 'timezone' && (!isFinite(v) || v < 0)) throw new Error('Bad value for ' + k);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === k) { sheet.getRange(i + 1, 2).setValue(v); return; }
    }
    sheet.appendRow([k, v]);
  });
  return readSettings(ss);
}

// ── Save to Google Sheet ───────────────────────────────────────────
function saveToSheet(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      'Submitted At (UTC)', 'Candidate Name', 'Candidate Email', 'Candidate Phone', 'Exam Sitting',
      'Partner Name', 'Partner Email', 'Package', 'Format', 'Zoom Date', 'Zoom Time', 'Zoom Timezone',
      'Self-Record Date', 'Self-Record Device', 'Clinical Encounter Stations', 'Case Discussion Stations',
      'Feedback Expectations'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f1ea');
    sheet.setFrozenRows(1);
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

// ── Notification email ─────────────────────────────────────────────
function sendNotificationEmail(data) {
  var submittedAt = '—';
  try {
    submittedAt = Utilities.formatDate(new Date(data.submitted_at), 'Australia/Sydney', 'dd MMM yyyy h:mm a \'AEST\'');
  } catch (e) { submittedAt = data.submitted_at || '—'; }

  var subject = 'New SPR Intake: ' + (data.candidate_name || 'Unknown') + ' — ' + (data.package || 'package unknown');

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
    '<div style="background:#8a6a25;padding:20px 28px;border-radius:4px 4px 0 0;">',
      '<p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Fellow Academy · CCE SPR</p>',
      '<h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#fff;">New Intake Form Submission</h1>',
    '</div>',
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

  sendBrandedEmail({ to: NOTIFICATION_EMAIL, subject: subject, htmlBody: html });
}

function section(title, rows) {
  return [
    '<div style="margin-bottom:24px;">',
      '<p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a25;">' + title + '</p>',
      '<table style="width:100%;border-collapse:collapse;">', rows.join(''), '</table>',
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
