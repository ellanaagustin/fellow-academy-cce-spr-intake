const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8');
const Utilities = { formatDate: (d, tz, f) => d.toISOString().slice(0, f === 'HH:mm' ? 0 : 10) };
const ctxFactory = new Function('Utilities', src + '\nreturn { addDays, checkDate, bookingDateOf, summarize, toDateStr, dayState };');
const L = ctxFactory(Utilities);
let fails = 0;
function eq(name, a, b) { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' → ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b))); }

eq('addDays basic', L.addDays('2026-09-13', 2), '2026-09-15');
eq('addDays month roll', L.addDays('2026-09-30', 1), '2026-10-01');
eq('addDays year roll', L.addDays('2026-12-31', 1), '2027-01-01');
eq('toDateStr string', L.toDateStr('2026-09-20', 'UTC'), '2026-09-20');
eq('toDateStr Date', L.toDateStr(new Date(Date.UTC(2026, 8, 20)), 'UTC'), '2026-09-20');
eq('toDateStr junk', L.toDateStr('20/09/2026', 'UTC'), '');
eq('bookingDate zoom', L.bookingDateOf({ format: 'Zoom session', zoom_date: '2026-09-20', self_date: '2026-09-21' }), '2026-09-20');
eq('bookingDate self', L.bookingDateOf({ format: 'Self-record', zoom_date: '2026-09-20', self_date: '2026-09-21' }), '2026-09-21');
eq('bookingDate missing', L.bookingDateOf({ format: 'Zoom session' }), '');

const ctx = {
  settings: { default_capacity: 1, min_lead_days: 2, window_days: 10, timezone: 'UTC' },
  today: '2026-09-13', minDate: '2026-09-15', maxDate: '2026-09-23',
  overrides: { '2026-09-17': { capacity: 3, blocked: false }, '2026-09-18': { capacity: '', blocked: true }, '2026-09-19': { capacity: '', blocked: false } },
  booked: { '2026-09-16': 1, '2026-09-17': 2, '2026-09-19': 1 }
};
eq('too soon (today)', L.checkDate(ctx, '2026-09-13').reason, 'too_soon');
eq('too soon (tomorrow)', L.checkDate(ctx, '2026-09-14').reason, 'too_soon');
eq('min date ok', L.checkDate(ctx, '2026-09-15').ok, true);
eq('full at default cap', L.checkDate(ctx, '2026-09-16').reason, 'full');
eq('override cap 3 with 2 booked ok', L.checkDate(ctx, '2026-09-17').ok, true);
eq('blocked', L.checkDate(ctx, '2026-09-18').reason, 'blocked');
eq('blank capacity uses default → full', L.checkDate(ctx, '2026-09-19').reason, 'full');
eq('too far', L.checkDate(ctx, '2026-09-24').reason, 'too_far');
eq('missing', L.checkDate(ctx, '').reason, 'missing_date');
eq('summarize unavailable', L.summarize(ctx).unavailable, ['2026-09-16', '2026-09-18', '2026-09-19']);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
