/**
 * Runs at document_start.
 *
 * Sets data-patchwork-extension on <html> as early as possible so that any
 * in-page Patchwork runtime (e.g. on the demo site) detects the extension
 * and stands down. This prevents duplicate application of patches
 * (such as confirm dialogs asking twice or toggles cancelling themselves).
 */
try {
  const mark = () => {
    const root = document.documentElement || document.firstElementChild;
    if (root) {
      root.setAttribute('data-patchwork-extension', 'true');
    }
  };

  mark();

  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', mark, { once: true });
  }
} catch {
  // Never throw into host page
}
