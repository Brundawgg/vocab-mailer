// Which email goes out on a given day. Matches the practice page: one new word per day
// starting START_DATE, except Saturdays, which get a weekly quiz on the past week's words.
const START_DATE = "2026-10-26";
const TIME_ZONE = "America/Los_Angeles";

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function keyOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function weekday(key) {
  return new Date(parseKey(key)).getUTCDay();
}
const DAY = 86400000;

// Number of words introduced from START_DATE through `key`, inclusive.
function wordsThrough(key) {
  let n = 0;
  for (let t = parseKey(START_DATE); t <= parseKey(key); t += DAY) if (new Date(t).getUTCDay() !== 6) n++;
  return n;
}

// Wall-clock date and time in Los Angeles for an instant.
function localParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date).map(p => [p.type, p.value])
  );
  return { key: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function planFor(key, wordCount) {
  if (parseKey(key) < parseKey(START_DATE)) return { kind: "none", reason: "before start date" };
  const n = wordsThrough(key);
  if (weekday(key) === 6) {
    const weekStart = keyOf(Math.max(parseKey(START_DATE), parseKey(key) - 6 * DAY));
    const before = parseKey(weekStart) > parseKey(START_DATE) ? wordsThrough(keyOf(parseKey(weekStart) - DAY)) : 0;
    const week = Math.floor((parseKey(key) - parseKey(START_DATE)) / (7 * DAY)) + 1;
    return { kind: "quiz", week, indexes: range(before, Math.min(n, wordCount)) };
  }
  if (n > wordCount) return { kind: "none", reason: "word list is used up" };
  return { kind: "word", index: n - 1 };
}
function range(a, b) {
  const out = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}

module.exports = { START_DATE, TIME_ZONE, localParts, planFor, weekday };
