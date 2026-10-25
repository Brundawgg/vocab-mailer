// Validates a batch of new words and appends it to words.json.
// Usage: node scripts/merge-words.js words-batch.json
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mainPath = path.join(root, "words.json");
const batchPath = path.resolve(process.argv[2]);

const all = JSON.parse(fs.readFileSync(mainPath, "utf8")).concat(JSON.parse(fs.readFileSync(batchPath, "utf8")));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const seen = new Set();
const problems = [];

for (const w of all) {
  if (seen.has(w.word)) problems.push("duplicate: " + w.word);
  seen.add(w.word);
  for (const k of ["level", "part_of_speech", "definition", "hook", "instead_of", "weak"]) {
    if (w[k] === undefined) problems.push(w.word + " missing " + k);
  }
  // The practice page finds the word inside each sentence by its stem, so every sentence must contain it.
  const stem = w.word.replace(/e$/, "");
  for (const c of ["interview", "finance", "everyday"]) {
    if (!new RegExp("\\b" + reEsc(stem) + "[a-z-]*", "i").test(w.examples[c])) problems.push(w.word + ": word not found in " + c + " sentence");
  }
  if (w.weak && !w.weak.sentence.includes(w.weak.phrase)) problems.push(w.word + ": weak phrase not in its sentence");
}

if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
fs.writeFileSync(mainPath, JSON.stringify(all, null, 2) + "\n");
fs.unlinkSync(batchPath);
const levels = {};
all.forEach(w => { levels[w.level] = (levels[w.level] || 0) + 1; });
console.log("Merged. " + all.length + " words. Levels: " + JSON.stringify(levels));
