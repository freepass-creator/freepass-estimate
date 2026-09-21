export function applyProductTheme(cfg={}){
  const root=document.documentElement;
  const brand=cfg.brand_color||'#1B2A4A';
  root.style.setProperty('--brand',brand);
  root.style.setProperty('--brand-700','#0F1B35');
  root.style.setProperty('--brand-800','#07111F');
  root.style.setProperty('--brand-100','#C8D4E4');
  root.style.setProperty('--brand-50','#E6ECF5');
  root.style.setProperty('--accent','#1B2A4A');
  root.style.setProperty('--accent-soft','#F2F3F5');

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',brand);

  const displayName='프리패스모빌리티';
  document.title=displayName+' · 신차 장기렌터카 견적';
  const description=document.querySelector('meta[name="description"]');
  if(description) description.setAttribute('content',displayName+' 신차 장기렌터카 견적 화면');
  const ogTitle=document.querySelector('meta[property="og:title"]');
  if(ogTitle) ogTitle.setAttribute('content',displayName+' · 신차 장기렌터카 견적');
  const ogDescription=document.querySelector('meta[property="og:description"]');
  if(ogDescription) ogDescription.setAttribute('content',displayName+' 신차 장기렌터카 견적 화면');
  const ogSite=document.querySelector('meta[property="og:site_name"]');
  if(ogSite) ogSite.setAttribute('content',displayName);
  const appleTitle=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(appleTitle) appleTitle.setAttribute('content','프리패스 견적');
  const manifest=document.querySelector('link[rel="manifest"]');
  if(manifest) manifest.setAttribute('href','/freepass-manifest.webmanifest');

  const brandName=document.getElementById('brand-name-top');
  if(brandName) brandName.textContent=displayName;
  document.querySelectorAll('img.ci, img.gate-ci').forEach((img)=>{
    img.setAttribute('src','/freepass-wordmark.svg');
    img.setAttribute('alt','프리패스모빌리티');
  });
}
