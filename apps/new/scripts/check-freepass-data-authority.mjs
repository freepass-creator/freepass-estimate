import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyDebt = new Set([
  'src/firebase/config.js',
  'src/firebase/quotes.js',
  'src/firebase/contracts.js',
  'src/firebase/chat.js',
  'src/components/home/LeadForm.vue',
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'scripts'].includes(entry.name)) return [];
      return walk(absolute);
    }
    return /\.(?:js|mjs|vue)$/.test(entry.name) ? [absolute] : [];
  });
}

const patterns = [
  /from\s+['"]firebase\/(?:firestore|database|storage)['"]/,
  /firebase-firestore\.js/,
  /firebase-database\.js/,
  /firebase-storage\.js/,
  /getFirestore\s*\(/,
  /getDatabase\s*\(/,
  /getStorage\s*\(/,
];

const violations = [];
const debtSeen = [];

for (const scope of ['src', 'api']) {
  const base = path.join(root, scope);
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    const rel = path.relative(root, file).replaceAll('\\', '/');
    const text = fs.readFileSync(file, 'utf8');
    if (!patterns.some((pattern) => pattern.test(text))) continue;

    // Firebase Auth is allowed only for identity. Files with database/storage use must be debt-listed.
    if (legacyDebt.has(rel)) debtSeen.push(rel);
    else violations.push(rel);
  }
}

if (violations.length) {
  console.error('FreePass Data authority violation: direct Firebase business-data access exists outside the migration debt list.');
  for (const rel of [...new Set(violations)].sort()) console.error('- ' + rel);
  process.exit(1);
}

console.log('FreePass Data authority guard OK.');
console.log('Estimate migration debt still allowed temporarily:');
for (const rel of [...new Set(debtSeen)].sort()) console.log('- ' + rel);
