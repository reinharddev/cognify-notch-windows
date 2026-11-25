import { describe, expect, it } from 'vitest';
import { EMOTIONS, POOLS, SITUATIONS, pickPool, type CompanionConfig } from './companion';

const dynamic: CompanionConfig = { mode: 'dynamic', fixed: 'idle', blink: true, map: {} };

describe('wajah dinamis', () => {
  it('kumpulan ekspresi hanya berisi ekspresi yang ada dan punya variasi', () => {
    for (const [id, pool] of Object.entries(POOLS)) {
      expect(new Set(pool).size, id).toBeGreaterThanOrEqual(4);
      for (const e of pool!) expect((EMOTIONS as readonly string[]).includes(e), `${id}:${e}`).toBe(true);
    }
  });
  it('pickPool tidak mengulang ekspresi yang sedang tampil', () => {
    for (let i = 0; i < 200; i++) expect(pickPool(dynamic, 'music', 'sing')).not.toBe('sing');
  });
  it('mode selain Dinamis memakai satu ekspresi tetap', () => {
    expect(pickPool({ ...dynamic, mode: 'fixed', fixed: 'sad' }, 'music', 'idle')).toBe('sad');
  });
  it('setiap keadaan dan kejadian punya ekspresi bawaan yang sah', () => {
    for (const s of SITUATIONS) expect((EMOTIONS as readonly string[]).includes(s.emotion), s.id).toBe(true);
  });
});
