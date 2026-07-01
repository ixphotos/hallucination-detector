import { readFileSync, writeFileSync } from 'fs';

const questions = JSON.parse(readFileSync('./data/questions.json', 'utf8'));

let fixed = 0;
let broken = 0;

for (const q of questions) {
  for (const h of q.hallucinations) {
    const expected = q.passage.slice(h.start, h.end);
    if (expected === h.text) continue;

    // Try to find the correct offset
    const idx = q.passage.indexOf(h.text);
    if (idx === -1) {
      console.warn(`[${q.id}] Could not find: "${h.text.slice(0, 60)}..."`);
      broken++;
    } else {
      console.log(`[${q.id}] Fixed offset: ${h.start}→${idx} for "${h.text.slice(0, 50)}..."`);
      h.start = idx;
      h.end = idx + h.text.length;
      fixed++;
    }
  }
}

writeFileSync('./data/questions.json', JSON.stringify(questions, null, 2));
console.log(`\nDone. Fixed: ${fixed}, Could not fix: ${broken}`);
