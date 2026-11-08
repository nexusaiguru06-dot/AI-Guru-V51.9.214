import { describe, expect, it } from 'vitest';
import { getDocument, getDocumentPdf, getMaterial, isSafeId, saveMaterial } from './store';

describe('V51.9.172 store ids cannot leave the store folder', () => {
  it('accepts the real id shapes', () => {
    expect(isSafeId('doc:AbC_12-xyz')).toBe(true);
    expect(isSafeId('material:9aB-c_d')).toBe(true);
  });
  it('refuses paths', () => {
    for (const bad of ['../x', '..\\x', 'a/b', '', '.', 'a.b', 'x'.repeat(200), '/etc/passwd']) expect(isSafeId(bad)).toBe(false);
  });
  it('reads return nothing and writes throw for a path id', async () => {
    expect(await getDocument('../../../data/ai-guru/admin/auth')).toBeNull();
    expect(await getMaterial('../../../package')).toBeNull();
    expect(await getDocumentPdf('../x')).toBeNull();
    await expect(saveMaterial({ id: '../../../ag-proof', documentId: 'x' } as never)).rejects.toThrow('Invalid id');
  });
});
