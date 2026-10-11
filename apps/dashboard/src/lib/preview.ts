/**
 * Helpers for the "Site preview" window on the Patches page.
 * Kept free of React so they can be unit-tested.
 */

/** What the preview window shows: the live site, or the live site with ONE patch previewed on top. */
export function buildPreviewUrl(baseUrl: string, patchId: string | null): string {
  const base = baseUrl.replace(/\/+$/, '');
  return patchId ? `${base}/?preview_patch=${encodeURIComponent(patchId)}` : `${base}/`;
}

const OPEN_KEY = 'patchwork_preview_open';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage can be missing or throw (private mode, blocked cookies), so never assume it works. */
function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Was the preview window left open? Open unless the user explicitly closed it. */
export function loadPreviewOpen(storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    return storage?.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function savePreviewOpen(open: boolean, storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(OPEN_KEY, String(open));
  } catch {
    /* not persisted; the window still works for this visit */
  }
}
