// One-time setup: signs in to Google Calendar (read-only) and saves the OAuth client and
// refresh token as GitHub secrets. Needs client_secret.json (a Desktop OAuth client) in the
// project folder. Usage: node scripts/google-auth.js
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFileSync, exec } = require("child_process");

const REPO = "Brundawgg/vocab-mailer";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const root = path.join(__dirname, "..");
const file = fs.readdirSync(root).find(f => /^client_secret.*\.json$/.test(f));
if (!file) throw new Error("Put the downloaded client_secret JSON file in " + root);
const { client_id, client_secret } = JSON.parse(fs.readFileSync(path.join(root, file), "utf8")).installed;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const code = url.searchParams.get("code");
  if (!code) { res.end(url.searchParams.get("error") || "Waiting for Google..."); return; }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: redirect, grant_type: "authorization_code" })
    });
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) throw new Error(tokens.error_description || "Google did not return a refresh token");
    const cals = await (await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers: { Authorization: "Bearer " + tokens.access_token } })).json();
    for (const [name, value] of [["GOOGLE_CLIENT_ID", client_id], ["GOOGLE_CLIENT_SECRET", client_secret], ["GOOGLE_REFRESH_TOKEN", tokens.refresh_token]]) {
      execFileSync("gh", ["secret", "set", name, "-R", REPO], { input: value });
    }
    const names = (cals.items || []).map(c => c.summary);
    res.end("Done. Words can now read your calendars. You can close this tab.");
    console.log(`Connected. Found ${names.length} calendars: ${names.join(", ")}`);
    console.log("Saved GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN to GitHub.");
  } catch (e) {
    res.end("Something went wrong: " + e.message);
    console.error(e.message);
    process.exitCode = 1;
  }
  server.close();
});

let redirect;
server.listen(0, "127.0.0.1", () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id, redirect_uri: redirect, response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", login_hint: "abruno29@students.claremontmckenna.edu"
  });
  console.log("Opening Google sign-in. If no browser opens, visit:\n" + auth);
  exec(`start "" "${auth}"`);
});
