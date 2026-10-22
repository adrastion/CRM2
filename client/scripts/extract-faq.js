const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '../src/_faq_extract_tmp.txt'), 'utf8');
const items = [];

const pushUnique = (question, answer, category) => {
  const q = question.replace(/\\'/g, "'");
  if (items.some((i) => i.question === q)) return;
  items.push({
    question: q,
    answer: answer.replace(/\\'/g, "'"),
    category,
  });
};

const reTpl = /\{\s*question:\s*'((?:\\'|[^'])*)'[\s\S]*?answer:\s*`([\s\S]*?)`[\s\S]*?category:\s*'((?:\\'|[^'])*)'/g;
let m;
while ((m = reTpl.exec(raw))) {
  pushUnique(m[1], m[2], m[3]);
}

const reStr = /\{\s*question:\s*'((?:\\'|[^'])*)'[\s\S]*?answer:\s*'((?:\\'|[^'])*)'[\s\S]*?category:\s*'((?:\\'|[^'])*)'/g;
while ((m = reStr.exec(raw))) {
  pushUnique(m[1], m[2], m[3]);
}

console.log('parsed', items.length);
items.forEach((i) => console.log('-', i.question));
fs.writeFileSync(path.join(__dirname, '../src/_faq_parsed.json'), JSON.stringify(items, null, 2));
