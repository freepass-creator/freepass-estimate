import html2canvas from 'html2canvas';

async function quoteImage(element, isCurrent) {
  if (!element || !isCurrent()) throw new Error('견적 계산이 완료된 뒤 다시 눌러 주세요.');
  await document.fonts?.ready;
  await Promise.all([...element.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {})));
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  if (!isCurrent()) throw new Error('견적 조건이 변경됐습니다. 계산 완료 후 다시 복사해 주세요.');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('견적 이미지를 만들지 못했습니다.');
  return blob;
}

export async function copyQuoteImage(element, { isCurrent = () => true, prepare = null } = {}) {
  // Start clipboard.write in the user's click gesture. Safari supports an
  // asynchronously generated Blob inside ClipboardItem.
  const blobPromise = (async () => {
    let prepared;
    try {
      prepared = prepare ? await prepare(element) : null;
      return await quoteImage(prepared?.element || element, isCurrent);
    } finally { prepared?.cleanup?.(); }
  })();
  if (navigator.clipboard?.write && globalThis.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      return 'copied';
    } catch (error) {
      if (!isCurrent()) throw error;
    }
  }
  const blob = await blobPromise;
  if (!isCurrent()) throw new Error('견적이 변경됐습니다. 다시 눌러 주세요.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'freepass-신차견적.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
