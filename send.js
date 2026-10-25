// Runs every 15 minutes in the morning (GitHub Actions). Sends today's email once,
// at the first open time on the calendar, and records it in state/sent.json.
//
//   node send.js                  normal run
//   node send.js --dry-run        build today's email into out/ without sending
//   node send.js --date=2026-10-31 --dry-run   preview another day
//   node send.js --now            send immediately, ignoring the calendar (still once per day)
//   node send.js --test           send a "[Test]" copy of the next email now and print the calendar's pick; records nothing
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const words = require("./words.json");
const { START_DATE, localParts, planFor } = require("./src/schedule");
const { eventsOn, classEventsOn, blockedIntervals, firstOpening, isBlocked, isChat } = require("./src/calendar");
const { wordEmail, quizEmail } = require("./src/email");

const LATEST = 12 * 60 + 30; // past this, send regardless of the calendar
const STATE_PATH = path.join(__dirname, "state", "sent.json");

const args = process.argv.slice(2);
const flag = name => args.includes("--" + name);
const option = name => (args.find(a => a.startsWith("--" + name + "=")) || "").split("=")[1];

function hhmm(m) {
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${mm}${h < 12 ? "am" : "pm"}`;
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")); } catch { return {}; }
}

// Calendar events (CALENDAR_URLS) plus weekly class times (CLASS_SCHEDULE) for one day.
async function eventsFor(key) {
  const urls = (process.env.CALENDAR_URLS || "").split(/\s+/).filter(Boolean);
  const events = urls.length ? await eventsOn(urls, key) : [];
  return events.concat(classEventsOn(process.env.CLASS_SCHEDULE, key)).sort((a, b) => a.start - b.start);
}

async function shouldSendNow(key, minutes) {
  if (minutes < 8 * 60 + 30) return { send: false, why: `too early (${hhmm(minutes)})` };
  if (minutes >= LATEST) return { send: true, why: "late-morning fallback" };
  let blocked;
  try {
    blocked = blockedIntervals(await eventsFor(key));
  } catch (e) {
    return { send: true, why: "calendar unavailable (" + e.message + ")" };
  }
  const target = firstOpening(blocked);
  if (minutes < target) return { send: false, why: `waiting for the first opening at ${hhmm(target)}` };
  if (isBlocked(blocked, minutes)) return { send: false, why: `${hhmm(minutes)} is during an event or right before a chat` };
  return { send: true, why: `open slot (first opening ${hhmm(target)})` };
}

async function main() {
  const now = localParts();
  const test = flag("test");
  let key = option("date") || now.key;
  if (test && planFor(key, words.length).kind === "none") key = START_DATE;
  const plan = planFor(key, words.length);
  if (plan.kind === "none") return console.log(`${key}: nothing to send (${plan.reason})`);

  const email = plan.kind === "quiz"
    ? quizEmail(plan.indexes.map(i => words[i]), plan.week, key)
    : wordEmail(words[plan.index], plan.index + 1);
  if (test) {
    email.subject = "[Test] " + email.subject;
    const events = await eventsFor(key);
    console.log(`Calendar for ${key}: ${events.length} timed events`);
    for (const ev of events) console.log(`  ${hhmm(ev.start)}-${hhmm(ev.end)}  ${isChat(ev.title) ? "[chat] " : ""}${ev.title}`);
    console.log(`Email would go out at ${hhmm(firstOpening(blockedIntervals(events)))}`);
  }

  if (flag("dry-run")) {
    fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
    const file = path.join(__dirname, "out", `${key}.html`);
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${email.subject}</title>${email.html}`);
    return console.log(`${key}: "${email.subject}" written to ${file}`);
  }

  const state = readState();
  if (!test && state[key]) return console.log(`${key}: already sent "${state[key].subject}" at ${state[key].at}`);

  if (!test && !flag("now")) {
    const decision = await shouldSendNow(key, now.minutes);
    console.log(`${key} ${hhmm(now.minutes)}: ${decision.why}`);
    if (!decision.send) return;
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD, TO_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) throw new Error("Set GMAIL_USER, GMAIL_APP_PASSWORD and TO_EMAIL");
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  await transport.sendMail({ from: `Words <${GMAIL_USER}>`, to: TO_EMAIL, subject: email.subject, html: email.html, text: email.text });
  if (test) return console.log(`Test email "${email.subject}" sent`);

  state[key] = { subject: email.subject, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
  console.log(`${key}: sent "${email.subject}"`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
