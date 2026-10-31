// Install an authenticated, version-pinned rate packet and reviewed mappings.
// No network calls, customer data, cookies or tokens are requested by this tool.
import { readFile,writeFile,mkdir,chmod } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReference,resolveKamatchRates } from '../api/_kamatch/rates.js';
import { KAMATCH_APP_DIGEST,tableDigest,resolveKamatchProfile } from '../api/_kamatch/reference.js';
const args=process.argv.slice(2);
const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
if(!value('--reference')||!value('--mapping')) throw new Error('--reference <private browser packet> --mapping <reviewed stable-ID mapping>');
const reference=validateReference(JSON.parse(await readFile(resolve(value('--reference')),'utf8')),KAMATCH_APP_DIGEST);
if(!Number.isFinite(Date.parse(reference.capturedAt))||Date.now()-Date.parse(reference.capturedAt)>3600000) throw new Error('최근 1시간 이내 수집한 원본 자료를 사용해 주세요.');
const mapping=JSON.parse(await readFile(resolve(value('--mapping')),'utf8'));
if(!mapping.products||!Object.keys(mapping.products).length) throw new Error('검토한 stable product ID 매핑이 비어 있습니다.');
const profiles={schema:'freepass-kamatch-mapping/v1',applicationDigest:KAMATCH_APP_DIGEST,tablesDigest:tableDigest(reference),products:{}};
for(const [id,raw] of Object.entries(mapping.products)) {
  const profile=Object.fromEntries(['brand','model','lineup','trim','vehicleType','insuranceProperty'].map(k=>[k,raw[k]]));
  profile.baselines=Object.fromEntries(['deliveryFee','tintFee','dashcamFee'].map(k=>[k,raw.baselines?.[k]]));
  profiles.products[id]=profile;
  resolveKamatchProfile(profiles,reference,id);
  for(const term of [36,48,60])for(const creditType of ['general','low']) {
    resolveKamatchRates(reference,profile,{term,creditType,deliveryType:'dealer',mileage:30000,depositRate:5});
  }
}
if(args.includes('--check')) {
  console.log(JSON.stringify({valid:true,products:Object.keys(profiles.products).length,capturedAt:reference.capturedAt}));
} else {
  const app=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const directory=resolve(value('--directory')||join(app,'.private','kamatch'));
  await mkdir(directory,{recursive:true,mode:0o700});
  const digest=profiles.tablesDigest;
  const files={KAMATCH_REFERENCE_FILE:join(directory,`reference-${digest}.json`),KAMATCH_PROFILE_FILE:join(directory,`profiles-${digest}.json`)};
  for(const [key,body]of [['KAMATCH_REFERENCE_FILE',reference],['KAMATCH_PROFILE_FILE',profiles]]) {
    await writeFile(files[key],JSON.stringify(body),'utf8');await chmod(files[key],0o600);
  }
  const envPath=join(app,'.env.local');
  let env='';try{env=await readFile(envPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  env=env.split('\n').filter(line=>!Object.keys(files).some(key=>line.startsWith(key+'='))).join('\n').trimEnd()+'\n';
  for(const[key,path]of Object.entries(files))env+=`${key}=${JSON.stringify(path)}\n`;
  await writeFile(envPath,env,{mode:0o600});await chmod(envPath,0o600);
  console.log(JSON.stringify({installed:true,products:Object.keys(profiles.products).length,capturedAt:reference.capturedAt,restartDevServer:true}));
}
