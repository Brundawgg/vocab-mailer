// Copies words.json into practice.html, then writes the GitHub Pages copy to docs/index.html.
// Usage: node scripts/build-site.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const words = fs.readFileSync(path.join(root, "words.json"), "utf8").trim();
const pagePath = path.join(root, "practice.html");

let page = fs.readFileSync(pagePath, "utf8");
page = page.replace(/\/\/ WORDS:BEGIN[\s\S]*?\/\/ WORDS:END/, () => "// WORDS:BEGIN\nconst WORDS = " + words + ";\n// WORDS:END");
fs.writeFileSync(pagePath, page);

// practice.html is written as a page body (title, links and styles first); split it into a full document.
const split = page.indexOf("</style>") + "</style>".length;
const head = page.slice(0, split).replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, "");
const body = page.slice(split).trim();
const site =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  head + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n";

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "index.html"), site);
console.log("Built docs/index.html with " + JSON.parse(words).length + " words");
