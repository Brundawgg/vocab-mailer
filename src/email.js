// Builds the daily word email and the Saturday quiz email (HTML plus a plain-text version).
const questions = require("./questions");

const PRACTICE_URL = "https://brundawgg.github.io/vocab-mailer/";
const POS_NAME = { adjective: "adjective", verb: "verb", noun: "noun", phrase: "phrase", conjunction: "conjunction", adverb: "adverb", preposition: "preposition" };
const CONTEXTS = [["interview", "In an interview"], ["finance", "In finance"], ["everyday", "In conversation"]];

const FONT = "font-family:Georgia,'Times New Roman',Times,serif;";
const WRAP = `max-width:560px;margin:0 auto;padding:4px;${FONT}color:#111111;font-size:16px;line-height:1.4;`;
const LABEL = "font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#555555;";
const RULE = "border-top:1px solid #111111;padding-top:10px;";

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function formIn(w, sentence) {
  const m = sentence.match(new RegExp("\\b" + reEsc(w.word.replace(/e$/, "")) + "[a-z-]*", "i"));
  return m ? m[0] : w.word;
}
function wrapPart(sentence, part, open, close) {
  const i = sentence.indexOf(part);
  if (i < 0) return esc(sentence);
  return esc(sentence.slice(0, i)) + open + esc(part) + close + esc(sentence.slice(i + part.length));
}
function bolded(w, sentence) { return wrapPart(sentence, formIn(w, sentence), "<b>", "</b>"); }
function practiceButton() {
  return `<a href="${PRACTICE_URL}" style="display:block;border:1px solid #111111;padding:12px 16px;text-align:center;color:#111111;text-decoration:none;">Five-minute practice on your words &rarr;</a>`;
}
// Stable shuffle so a rerun of the same day builds the same email.
function seededShuffle(items, seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wordEmail(w, number) {
  const subject = capital(w.word);
  const meta = [w.pronunciation, POS_NAME[w.part_of_speech] || w.part_of_speech].filter(Boolean).join(" &nbsp;·&nbsp; ");
  let html = `<div style="${WRAP}">`;
  html += `<div style="${LABEL}">Word No. ${number} &nbsp;·&nbsp; Level ${w.level}</div>`;
  html += `<div style="font-size:36px;line-height:1.1;margin:2px 0 2px;">${esc(w.word)}</div>`;
  html += `<div style="font-style:italic;color:#555555;margin-bottom:12px;">${meta}</div>`;
  html += `<p style="margin:0 0 8px;">${esc(capital(w.definition))}.</p>`;
  html += `<p style="margin:0 0 14px;color:#333333;"><i>Origin.</i> ${esc(w.hook)}</p>`;
  html += `<div style="${RULE}">`;
  CONTEXTS.forEach(([key, label], i) => {
    html += `<div style="${LABEL}">${label}</div>`;
    html += `<p style="margin:0 0 ${i === 2 ? 14 : 8}px;">“${bolded(w, w.examples[key])}”</p>`;
  });
  html += `</div><div style="${RULE}">`;
  html += `<p style="margin:0 0 6px;"><i>Instead of</i> “${esc(w.instead_of)},” say <b>${esc(w.word)}</b>.</p>`;
  html += `<p style="margin:0 0 16px;"><i>Make it yours.</i> Say one sentence about your own experience, an internship, a project, a club, using <b>${esc(w.word)}</b>.</p>`;
  html += `</div>${practiceButton()}</div>`;

  const text = [
    `WORD NO. ${number} - LEVEL ${w.level}`,
    w.word,
    [w.pronunciation, POS_NAME[w.part_of_speech]].filter(Boolean).join(" - "),
    "",
    `${capital(w.definition)}.`,
    `Origin. ${w.hook}`,
    "",
    ...CONTEXTS.flatMap(([key, label]) => [label.toUpperCase(), `"${w.examples[key]}"`]),
    "",
    `Instead of "${w.instead_of}," say "${w.word}."`,
    `Make it yours. Say one sentence about your own experience using "${w.word}".`,
    "",
    `Five-minute practice: ${PRACTICE_URL}`
  ].join("\n");
  return { subject, html, text };
}

function quizEmail(words, week, seed) {
  const subject = "Weekly Review";
  const nameOrder = seededShuffle(words, seed + "name");
  const upgrade = seededShuffle(words, seed + "up").slice(0, 3);
  const question = questions[(week - 1) % questions.length];

  let html = `<div style="${WRAP}">`;
  html += `<div style="${LABEL}">Weekly Review &nbsp;·&nbsp; Week ${week}</div>`;
  html += `<div style="font-size:30px;line-height:1.15;margin:4px 0 12px;">${words.length} words this week</div>`;

  html += `<div style="${RULE}"><div style="${LABEL}">Part 1 &nbsp;·&nbsp; Name the word</div>`;
  html += `<p style="margin:2px 0 8px;color:#555555;">Think of the word for each meaning before you scroll.</p>`;
  nameOrder.forEach((w, i) => { html += `<p style="margin:0 0 6px;">${i + 1}. ${esc(capital(w.definition))}</p>`; });
  html += `</div>`;

  html += `<div style="${RULE}margin-top:10px;"><div style="${LABEL}">Part 2 &nbsp;·&nbsp; Upgrade the sentence</div>`;
  html += `<p style="margin:2px 0 8px;color:#555555;">Swap the underlined words for one of this week's words.</p>`;
  upgrade.forEach((w, i) => {
    html += `<p style="margin:0 0 6px;">${i + 1}. “${wrapPart(w.weak.sentence, w.weak.phrase, '<span style="text-decoration:underline;">', "</span>")}”</p>`;
  });
  html += `</div>`;

  html += `<div style="${RULE}margin-top:10px;"><div style="${LABEL}">Part 3 &nbsp;·&nbsp; Mock interview</div>`;
  html += `<p style="margin:4px 0 6px;font-size:19px;">“${esc(question)}”</p>`;
  html += `<p style="margin:0 0 16px;color:#555555;">Answer out loud in about 60 seconds. Work in three of this week's words where they fit naturally.</p>`;
  html += `</div>${practiceButton()}`;

  html += `<div style="height:260px;"></div>`;
  html += `<div style="${RULE}"><div style="${LABEL}">Answers</div>`;
  html += `<p style="margin:4px 0 4px;"><i>Part 1.</i> ${nameOrder.map((w, i) => `${i + 1}. ${esc(w.word)}`).join(" &nbsp;·&nbsp; ")}</p>`;
  html += `<p style="margin:0 0 4px;"><i>Part 2.</i></p>`;
  upgrade.forEach((w, i) => { html += `<p style="margin:0 0 4px;">${i + 1}. “${bolded(w, w.examples.interview)}”</p>`; });
  html += `</div></div>`;

  const text = [
    `WEEKLY REVIEW - WEEK ${week}`,
    "",
    "PART 1 - NAME THE WORD",
    ...nameOrder.map((w, i) => `${i + 1}. ${capital(w.definition)}`),
    "",
    "PART 2 - UPGRADE THE SENTENCE (swap the weak words)",
    ...upgrade.map((w, i) => `${i + 1}. "${w.weak.sentence}" (weak: ${w.weak.phrase})`),
    "",
    "PART 3 - MOCK INTERVIEW",
    `"${question}"`,
    "Answer out loud in about 60 seconds using three of this week's words.",
    "",
    `Five-minute practice: ${PRACTICE_URL}`,
    "", "", "", "",
    "ANSWERS",
    "Part 1: " + nameOrder.map((w, i) => `${i + 1}. ${w.word}`).join(", "),
    "Part 2:",
    ...upgrade.map((w, i) => `${i + 1}. "${w.examples.interview}"`)
  ].join("\n");
  return { subject, html, text };
}

module.exports = { wordEmail, quizEmail, PRACTICE_URL };
