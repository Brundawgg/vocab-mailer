// Reorders words.json so difficulty ramps up over the year while categories stay mixed.
// Words already emailed stay where they are. Usage: node scripts/order-words.js <number already sent>
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "words.json");
const words = JSON.parse(fs.readFileSync(file, "utf8"));
const keep = Number(process.argv[2] || 0);

const fixed = words.slice(0, keep);
// Easier words (below level 4) are treated as level 4 so they mix into the early months instead of all coming first.
// Within a level, a stable hash of the word spreads them out so earlier batches don't cluster.
const rank = w => Math.max(w.level, 4);
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pool = words.slice(keep).sort((a, b) => rank(a) - rank(b) || hash(a.word) - hash(b.word));
const ordered = fixed.slice();
while (pool.length) {
  // Among the next few easiest words, take the first whose category differs from the last two.
  const recent = ordered.slice(-2).map(w => w.category);
  const window = pool.slice(0, 8);
  const pick = window.find(w => !recent.includes(w.category)) || window[0];
  ordered.push(pool.splice(pool.indexOf(pick), 1)[0]);
}

fs.writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
const sample = n => ordered.slice(n, n + 5).map(w => `${w.word} (${w.level})`).join(", ");
console.log(`Ordered ${ordered.length} words. Start: ${sample(0)}\nMiddle: ${sample(160)}\nEnd: ${sample(315)}`);
