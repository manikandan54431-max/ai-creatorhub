const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) results = results.concat(walk(p));
    else if (p.endsWith('.jsx')) results.push(p);
  });
  return results;
}

const files = walk('src');

console.log('--- 1. Malformed CSS / var() expressions ---');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (/var\(--[a-zA-Z0-9_-]+\),\s*#[0-9a-fA-F]+/i.test(l)) {
      console.log('Malformed var():', f, (i+1), l.trim());
    }
  });
});

console.log('\n--- 2. White text in shared components, forms, modals, tables, dashboards ---');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (/color:\s*['"](#fff|#ffffff|white)['"]/i.test(l)) {
      const start = Math.max(0, i - 4);
      const end = Math.min(lines.length, i + 5);
      const ctx = lines.slice(start, end).join(' ');
      // Exclude dark hero sections (About, Blog hero, etc.), intentional buttons with dark background, dark badges
      const hasDarkBg = /(--gradient-hero|--color-primary|--color-accent|#0f172a|#1e1b4b|#183B3A|#0F766E|#111518|#191F24|rgba\(0,\s*0,\s*0|background:\s*['"](#1|#0)|bg-primary|btn-gradient|btn-primary)/i.test(ctx);
      const isBadgeOrTag = /badge|tag|status ===|statusMap|role ===/i.test(ctx);
      
      if (!hasDarkBg && !isBadgeOrTag) {
        console.log(`POTENTIAL ISSUE in ${f}:${i+1} -> ${l.trim()}`);
      }
    }
  });
});

console.log('\n--- 3. Check hardcoded black text on dark background in dark mode ---');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (/color:\s*['"](#000|#000000|black)['"]/i.test(l)) {
      console.log(`Black text in ${f}:${i+1} -> ${l.trim()}`);
    }
  });
});
