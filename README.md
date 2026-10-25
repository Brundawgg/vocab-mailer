# vocab-mailer

Emails one interview-ready vocabulary word every morning, timed around my Google Calendar, plus a weekly quiz on Saturdays.

- `words.json` – the word list (add batches with `node scripts/merge-words.js <file>`)
- `send.js` – builds and sends today's email; runs every 15 minutes from GitHub Actions
- `docs/` – the practice game, served at https://brundawgg.github.io/vocab-mailer/ (rebuild with `node scripts/build-site.js`)

Preview any day's email: `node send.js --date=2026-10-31 --dry-run`
