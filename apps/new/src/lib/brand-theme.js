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

  if(freepass){
    document.title=document.title.replace(/웰릭스\s*모빌리티|웰릭스/g,'FreePass');
    const brandName=document.getElementById('brand-name-top');
    if(brandName) brandName.textContent='프리패스모빌리티';
    document.querySelectorAll('img.ci, img.gate-ci').forEach((img)=>{
      img.setAttribute('src','/freepass-wordmark.svg');
      img.setAttribute('alt','freepassmobility');
    });
  }
}
