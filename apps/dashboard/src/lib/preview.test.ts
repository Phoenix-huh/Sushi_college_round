import { describe, expect, it } from 'vitest';
import { buildPreviewUrl, loadPreviewOpen, savePreviewOpen } from './preview';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    data,
  };
}

describe('buildPreviewUrl', () => {
  it('shows the plain live site when no patch is selected', () => {
    expect(buildPreviewUrl('http://localhost:4100', null)).toBe('http://localhost:4100/');
  });

  it('puts the patch id in preview_patch, which patchwork-runtime.js reads', () => {
    expect(buildPreviewUrl('http://localhost:4100', 'abc-123')).toBe('http://localhost:4100/?preview_patch=abc-123');
  });

  it('does not double the slash when the base URL already ends with one', () => {
    expect(buildPreviewUrl('http://localhost:4100/', null)).toBe('http://localhost:4100/');
    expect(buildPreviewUrl('http://localhost:4100//', 'x')).toBe('http://localhost:4100/?preview_patch=x');
  });

  it('encodes the id so it cannot add extra query parameters', () => {
    expect(buildPreviewUrl('http://a.test', 'x&evil=1')).toBe('http://a.test/?preview_patch=x%26evil%3D1');
  });
});

describe('preview window open state', () => {
  it('defaults to open', () => {
    expect(loadPreviewOpen(fakeStorage())).toBe(true);
  });

  it('remembers that the user closed it, and that they re-opened it', () => {
    const s = fakeStorage();
    savePreviewOpen(false, s);
    expect(loadPreviewOpen(s)).toBe(false);
    savePreviewOpen(true, s);
    expect(loadPreviewOpen(s)).toBe(true);
  });

  it('still works when storage is unavailable or throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadPreviewOpen(broken)).toBe(true);
    expect(() => savePreviewOpen(false, broken)).not.toThrow();
    expect(loadPreviewOpen(undefined)).toBe(true);
  });
});
