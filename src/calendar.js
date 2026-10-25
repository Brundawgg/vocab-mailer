// Picks the send time from Google Calendar: the first open stretch of at least 15 minutes
// from 8:30am, never during an event and never in the 30 minutes before a coffee chat or call.
const ical = require("node-ical");
const { localParts } = require("./schedule");

const EARLIEST = 8 * 60 + 30;
const MIN_GAP = 15;
const CHAT_BUFFER = 30;
// Coffee chats and calls are titled like "<Alex Bruno | Ava Schmitt>", "Call with Chuck", "Alex Bruno and Jake".
const CHAT_PATTERNS = [/<[^>]*\|[^>]*>/, /<>/, /^call\b/i, /\bcall with\b/i, /^alex bruno (and|\()/i];

function isChat(title) {
  return CHAT_PATTERNS.some(re => re.test(title || ""));
}

async function eventsOn(urls, key) {
  const [y, m, d] = key.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - 86400000);
  const to = new Date(Date.UTC(y, m - 1, d) + 2 * 86400000);
  const out = [];
  for (const url of urls) {
    const data = await ical.async.fromURL(url);
    for (const ev of Object.values(data)) {
      if (ev.type !== "VEVENT" || ev.status === "CANCELLED") continue;
      for (const inst of ical.expandRecurringEvent(ev, { from, to })) {
        if (inst.isFullDay || (inst.event && inst.event.transparency === "TRANSPARENT")) continue;
        const s = localParts(inst.start), e = localParts(inst.end);
        if (s.key !== key) continue;
        out.push({ title: inst.summary, start: s.minutes, end: e.key === key ? e.minutes : 24 * 60 });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// Weekly class times, one per line: "Tue,Thu 08:10-09:25 ECON 134". Used for calendars
// that can't be shared by a private link.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function classEventsOn(spec, key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const out = [];
  for (const line of (spec || "").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z,]+)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*(.*)$/);
    if (!match || !match[1].split(",").includes(day)) continue;
    out.push({ title: match[6] || "Class", start: +match[2] * 60 + +match[3], end: +match[4] * 60 + +match[5] });
  }
  return out;
}

function blockedIntervals(events) {
  const raw = events.map(ev => ({ start: isChat(ev.title) ? ev.start - CHAT_BUFFER : ev.start, end: ev.end, title: ev.title }));
  raw.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

// First minute from EARLIEST that opens a free stretch of at least MIN_GAP minutes.
function firstOpening(blocked) {
  let cursor = EARLIEST;
  for (const b of blocked) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= MIN_GAP) return cursor;
    cursor = Math.max(cursor, b.end);
  }
  return cursor;
}

function isBlocked(blocked, minute) {
  return blocked.some(b => minute >= b.start && minute < b.end);
}

module.exports = { eventsOn, classEventsOn, blockedIntervals, firstOpening, isBlocked, isChat, EARLIEST };
