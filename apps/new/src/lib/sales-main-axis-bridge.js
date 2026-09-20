import {
  optionAxisEffect,
  configurationAxes,
  resolveProviderCandidate,
  absorbedAxisOptionIds,
  driveClass,
} from './newcar/configuration-resolver.js';

const BRIDGE_URL = '/data/freepass-newcar/sales-main-axis-bridge.json';
let bridgeCache = null;

function S(v){ return String(v ?? '').trim(); }
function seatFrom(v){
  const m = S(v).match(/(\d{1,2})\s*인승/);
  return m ? Number(m[1]) : null;
}
function driveToken(v){
  const s=S(v);
  if (/AWD/i.test(s)) return 'AWD';
  if (/4WD|HTRAC|사륜/i.test(s)) return '4WD';
  if (/2WD/i.test(s)) return '2WD';
  if (/FWD|전륜/i.test(s)) return 'FWD';
  if (/RWD|후륜/i.test(s)) return 'RWD';
  return '';
}
function structuralGroup(v){
  return S(v)
    .replace(/\b\d{1,2}\s*인승\b/gi,' ')
    .replace(/\b(?:2WD|4WD|AWD|FWD|RWD|HTRAC)\b/gi,' ')
    .replace(/\b(?:일반|선구매|렌터카)\b/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function uniquePush(arr, value){ if(value && !arr.includes(value)) arr.push(value); }

export async function loadSalesMainAxisBridge(){
  if (bridgeCache) return bridgeCache;
  const res = await fetch(BRIDGE_URL, { cache:'no-store' });
  if (!res.ok) throw new Error('main axis bridge load failed: '+res.status);
  const data = await res.json();
  if (data?.schema !== 'freepass-sales-main-axis-bridge/v2') {
    throw new Error('unsupported main axis bridge schema');
  }
  bridgeCache = data;
  globalThis.window && (window.__FREEPASS_SALES_MAIN_AXIS_BRIDGE = data);
  return data;
}

export function salesMainAxisBridge(){
  return bridgeCache || globalThis.window?.__FREEPASS_SALES_MAIN_AXIS_BRIDGE || null;
}

export function redirectProviderTrimSelection(providerTrimId){
  const b=salesMainAxisBridge();
  return b?.redirect_provider_trim_ids?.[providerTrimId] || null;
}

function bridgeEntryForTrim(trim){
  if (!trim) return null;
  const b=salesMainAxisBridge();
  return b?.by_provider_trim_id?.[trim._provider_base_trim_id || trim.trim_id]
    || (trim._canonical_product_id ? b?.by_canonical_product_id?.[trim._canonical_product_id] : null)
    || null;
}

function optionAxesForVariant(variant){
  const axes=new Set();
  for(const trim of variant?.trims || []){
    for(const id of trim._main_axis_option_ids || []){
      const effect=optionAxisEffect(variant.options_master?.[id]);
      if(effect?.axis) axes.add(effect.axis);
    }
  }
  return axes;
}

function trimSeat(trim){
  const v=trim?._base_axes?.seats;
  return v != null ? Number(v) : seatFrom(trim?.group);
}
function trimDrive(trim){
  const raw=trim?._base_axes?.drivetrain;
  return raw ? driveClass(raw) || raw : driveClass(trim?.group);
}

export function computeUiPowertrainGroups(variant){
  const trims=(variant?.trims || []).filter(t=>t.operating !== false);
  const optionAxes=optionAxesForVariant(variant);
  const seatValues=new Set(trims.map(trimSeat).filter(v=>Number.isFinite(v)));
  const driveValues=new Set(trims.map(trimDrive).filter(Boolean));
  const showSeats=!optionAxes.has('seats') && seatValues.size > 1;
  const showDrive=!optionAxes.has('drivetrain') && driveValues.size > 1;

  for(const trim of trims){
    const parts=[];
    const structural=structuralGroup(trim.group);
    uniquePush(parts, structural);
    if(showSeats){
      const seats=trimSeat(trim);
      if(Number.isFinite(seats)) uniquePush(parts, seats+'인승');
    }
    if(showDrive){
      const token=driveToken(trim.group)
        || ({all:'4WD',two:'2WD',front:'FWD',rear:'RWD'}[trimDrive(trim)] || '');
      uniquePush(parts, token);
    }
    trim._ui_powertrain_group=parts.filter(Boolean).join(' · ');
  }
  return { optionAxes:[...optionAxes], showSeats, showDrive };
}

export function applySalesMainAxisBridge(db, bridge=salesMainAxisBridge()){
  if (!db || !bridge) return db;
  const bases=new Set(Object.keys(bridge.by_provider_trim_id || {}));
  const suppressed=new Set(bridge.suppressed_provider_trim_ids || []);

  for(const mf of db.manufacturers || []){
    for(const model of mf.models || []){
      for(const variant of model.variants || []){
        variant.options_master ||= {};
        variant.exclusive_groups ||= [];

        for(const trim of variant.trims || []){
          const entry=bridge.by_provider_trim_id?.[trim.trim_id];
          if(!entry) continue;

          trim._provider_base_trim_id=trim.trim_id;
          trim._canonical_product_id=entry.canonical_product_id;
          trim._base_axes={ ...(entry.base_axes || {}) };
          trim._provider_candidates=(entry.provider_candidates || []).map(x=>({ ...x }));
          trim._main_axis_option_ids=[];

          // Provider catalog may contain its own axis-like options. Main estimator is authoritative.
          trim.available_options=(trim.available_options || []).filter(id=>!optionAxisEffect(variant.options_master?.[id]));

          const byAxis=new Map();
          for(const axisOpt of entry.axis_options || []){
            const id=axisOpt.id;
            variant.options_master[id]={
              name:axisOpt.name,
              price:Number(axisOpt.price_won || 0) / 10000,
              sub:axisOpt.sub || '',
              _main_axis:true,
              _axis_effect:axisOpt.effect || null,
              _canonical_option_id:axisOpt.raw_id || null,
            };
            trim._main_axis_option_ids.push(id);
            if(!trim.available_options.includes(id)) trim.available_options.push(id);
            const axis=axisOpt.effect?.axis;
            if(axis){
              if(!byAxis.has(axis)) byAxis.set(axis,[]);
              byAxis.get(axis).push(id);
            }
          }

          for(const [axis,members] of byAxis){
            if(members.length < 2) continue;
            const gid='main-axis:'+axis+':'+entry.canonical_product_id;
            if(!variant.exclusive_groups.some(g=>g.id===gid)){
              variant.exclusive_groups.push({
                id:gid,
                label:axis==='seats' ? '인승' : '구동방식',
                members:[...members],
              });
            }
          }
        }

        variant.trims=(variant.trims || []).filter(t=>!suppressed.has(t.trim_id) || bases.has(t.trim_id));
        computeUiPowertrainGroups(variant);
      }
    }
  }
  return db;
}

export async function loadAndApplySalesMainAxisBridge(db){
  const bridge=await loadSalesMainAxisBridge();
  return applySalesMainAxisBridge(db, bridge);
}

export function resolveBridgeProviderSelection(trim, optionsMaster, selectedOptionIds){
  const entry=bridgeEntryForTrim(trim);
  if(!entry) return null;
  const selected=[...(selectedOptionIds || [])];
  const axes=configurationAxes({ _base_axes:entry.base_axes || {} }, optionsMaster || {}, selected);
  const candidate=resolveProviderCandidate(entry.provider_candidates || [], axes);
  if(!candidate) return { entry, axes, candidate:null, absorbedOptionIds:[], absorbedWon:0 };

  const absorbedOptionIds=absorbedAxisOptionIds(
    { _base_axes:entry.base_axes || {} },
    optionsMaster || {},
    selected,
    candidate,
  );
  const absorbed=new Set(absorbedOptionIds);
  const absorbedWon=selected
    .filter(id=>absorbed.has(id))
    .reduce((sum,id)=>sum + Math.round(Number(optionsMaster?.[id]?.price || 0) * 10000),0);

  return { entry, axes, candidate, absorbedOptionIds, absorbedWon };
}
