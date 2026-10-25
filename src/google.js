// Reads every calendar on the Google account through the Calendar API, using a stored
// OAuth refresh token (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).
const { localParts, TIME_ZONE } = require("./schedule");

const API = "https://www.googleapis.com/calendar/v3";

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error("Google sign-in failed: " + (body.error_description || body.error));
  return body.access_token;
}

async function get(url, token) {
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const body = await res.json();
  if (!res.ok) throw new Error("Google Calendar error: " + ((body.error && body.error.message) || res.status));
  return body;
}

// Timed events on `key` (a Los Angeles date) across all calendars, skipping events marked
// "free", events the user declined, and all-day events.
async function googleEventsOn(key) {
  const token = await accessToken();
  const [y, m, d] = key.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString();
  const to = new Date(Date.UTC(y, m - 1, d) + 2 * 86400000).toISOString();
  const { items: calendars = [] } = await get(API + "/users/me/calendarList?minAccessRole=reader", token);
  const out = [];
  for (const cal of calendars) {
    if (cal.hidden || cal.selected === false) continue;
    const params = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", timeZone: TIME_ZONE, maxResults: "250" });
    const { items = [] } = await get(`${API}/calendars/${encodeURIComponent(cal.id)}/events?${params}`, token);
    for (const ev of items) {
      if (ev.status === "cancelled" || ev.transparency === "transparent" || !ev.start || !ev.start.dateTime) continue;
      const me = (ev.attendees || []).find(a => a.self);
      if (me && me.responseStatus === "declined") continue;
      const s = localParts(new Date(ev.start.dateTime)), e = localParts(new Date(ev.end.dateTime));
      if (s.key !== key) continue;
      out.push({ title: ev.summary || "", start: s.minutes, end: e.key === key ? e.minutes : 24 * 60 });
    }
  }
  return out;
}

module.exports = { googleEventsOn };
