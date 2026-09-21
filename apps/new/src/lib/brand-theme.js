const clamp=(n)=>Math.max(0,Math.min(255,Math.round(n)));
const rgb=(hex)=>{
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex||'').trim());
  return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:null;
};
const hex=(a)=>'#'+a.map(v=>clamp(v).toString(16).padStart(2,'0')).join('');
const shade=(c,p)=>{const a=rgb(c);return a?hex(a.map(v=>v*(1+p))):c};
const mixWhite=(c,p)=>{const a=rgb(c);return a?hex(a.map(v=>v+(255-v)*p)):c};

export function applyProductTheme(cfg={}){
  const root=document.documentElement;
  const brand=cfg.brand_color||'#1B2A4A';
  const freepass=cfg.company_id==='freepass';
  root.style.setProperty('--brand',brand);
  root.style.setProperty('--brand-700',freepass?'#0F1B35':shade(brand,-0.18));
  root.style.setProperty('--brand-800',freepass?'#07111F':shade(brand,-0.30));
  root.style.setProperty('--brand-100',freepass?'#C8D4E4':mixWhite(brand,0.82));
  root.style.setProperty('--brand-50',freepass?'#E6ECF5':mixWhite(brand,0.94));
  root.style.setProperty('--accent',freepass?'#1B2A4A':brand);
  root.style.setProperty('--accent-soft',freepass?'#F2F3F5':mixWhite(brand,0.94));

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',brand);

  const displayName=freepass?'프리패스모빌리티':(cfg.name||'웰릭스 모빌리티');
  document.title=displayName+' · 신차 장기렌터카 견적';
  const description=document.querySelector('meta[name="description"]');
  if(description) description.setAttribute('content',displayName+' 신차 장기렌터카 셀프견적');
  const ogTitle=document.querySelector('meta[property="og:title"]');
  if(ogTitle) ogTitle.setAttribute('content',displayName+' · 신차 장기렌터카 견적');
  const ogDescription=document.querySelector('meta[property="og:description"]');
  if(ogDescription) ogDescription.setAttribute('content',displayName+' 신차 장기렌터카 셀프견적');
  const ogSite=document.querySelector('meta[property="og:site_name"]');
  if(ogSite) ogSite.setAttribute('content',displayName);
  const appleTitle=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(appleTitle) appleTitle.setAttribute('content',freepass?'프리패스 견적':'웰릭스 견적');
  const manifest=document.querySelector('link[rel="manifest"]');
  if(manifest) manifest.setAttribute('href',freepass?'/freepass-manifest.webmanifest':'/manifest.webmanifest');

  const brandName=document.getElementById('brand-name-top');
  if(brandName) brandName.textContent=displayName;
  document.querySelectorAll('img.ci, img.gate-ci').forEach((img)=>{
    img.setAttribute('src',freepass?'/freepass-wordmark.svg':'/welrix-ci.png');
    img.setAttribute('alt',freepass?'freepassmobility':'웰릭스 모빌리티');
  });
}
