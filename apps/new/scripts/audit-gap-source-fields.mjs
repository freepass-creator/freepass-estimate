import fs from 'node:fs';
const feed=JSON.parse(fs.readFileSync('public/data/freepass-newcar/current-feed.snapshot.json','utf8'));
const minor=JSON.parse(fs.readFileSync('public/data/freepass-newcar/domestic-minor.json','utf8'));
const ids=[
 'renault_그랑 콜레오스_하이브리드 E-Tech_techno',
 'renault_아르카나_하이브리드 E-Tech_iconic',
 'renault_필랑트_하이브리드 E-Tech_techno',
 'genesis_g70',
 'FNJS4RPT1',
 'kgm_GL5_G5A1M_GL5AP01',
 'kgm_UH5_QGSMA_UH5AP01',
 'kgm_MC5_MC5QA_MC5AE01',
 'kgm_MD5_MD5CA_MD5AB01',
 'kgm_XW5_XMHKA_XW5BD02'
];
for(const id of ids){
  const r=(feed.rows||[]).find(x=>x.id===id);
  console.log('FEED',id,JSON.stringify(r));
}
console.log('MINOR_TOP',JSON.stringify(minor).slice(0,20000));
