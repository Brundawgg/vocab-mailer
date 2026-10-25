// Picks the send time from the day's calendar events: the first open stretch of at least
// 15 minutes from 8:30am, never during an event and never in the 30 minutes before a coffee chat or call.
const EARLIEST = 8 * 60 + 30;
const MIN_GAP = 15;
const CHAT_BUFFER = 30;
// Coffee chats and calls are titled like "<Alex Bruno | Ava Schmitt>", "Call with Chuck", "Alex Bruno and Jake".
const CHAT_PATTERNS = [/<[^>]*\|[^>]*>/, /<>/, /^call\b/i, /\bcall with\b/i, /^alex bruno (and|\()/i];

function isChat(title) {
  return CHAT_PATTERNS.some(re => re.test(title || ""));
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

module.exports = { blockedIntervals, firstOpening, isBlocked, isChat, EARLIEST };
