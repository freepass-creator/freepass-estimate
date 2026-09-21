// FreePass Estimate owns this module. No price-table or source-catalog copying.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [mode,consumer]=process.argv.slice(2);
assert.ok(['--check','--apply'].includes(mode)&&consumer,'Usage: node scripts/sync-color-contract.mjs --check|--apply <consumer-root>');
for(const file of ['src/lib/exterior-paint.js','src/lib/selection-summary.js','src/lib/haptics.js','src/components/mobile/SelectionSummary.vue']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url));
 const target=path.resolve(consumer,file);
 if(mode==='--apply')fs.writeFileSync(target,source);
 assert.ok(source.equals(fs.readFileSync(target)),'Consumer contract differs: '+file);
 console.log('PASS: identical canonical selection contract at '+target);
}
