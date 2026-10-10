let bannerEl: HTMLDivElement | null = null;

export function togglePreviewMode(isActive: boolean) {
  if (isActive) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'patchwork-preview-banner';
      bannerEl.textContent = 'PATCHWORK PREVIEW MODE (DRAFT)';
      bannerEl.style.position = 'fixed';
      bannerEl.style.bottom = '0';
      bannerEl.style.left = '0';
      bannerEl.style.width = '100%';
      bannerEl.style.backgroundColor = '#f59e0b';
      bannerEl.style.color = '#fff';
      bannerEl.style.textAlign = 'center';
      bannerEl.style.padding = '8px';
      bannerEl.style.fontWeight = 'bold';
      bannerEl.style.zIndex = '999999';
      bannerEl.style.pointerEvents = 'none';
      document.body.appendChild(bannerEl);
    }
    bannerEl.style.display = 'block';
  } else {
    if (bannerEl) {
      bannerEl.style.display = 'none';
    }
  }
}
