/** V51.9.160 — the on-device Malayalam voice: what it reads, its tokens, the model's settings and inputs, WAV out. */
import { describe, expect, it } from 'vitest';
import { encodeWav, inputRoles, onnxMetadata, parseTokens, rasaSentences, rasaText, tokenize, tokenOptions } from './rasa-core';
import { ttsProviderOrder, markTtsProviderDown, clearTtsProviderDown } from './provider-order';

/** A minimal ONNX ModelProto: ir_version, a "graph" blob to skip, and metadata_props. */
function fakeOnnx(meta: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const bytes: number[] = [];
  const varint = (n: number) => { while (n >= 0x80) { bytes.push((n & 0x7f) | 0x80); n >>>= 7; } bytes.push(n); };
  const field = (f: number, payload: number[]) => { varint((f << 3) | 2); varint(payload.length); bytes.push(...payload); };
  varint((1 << 3) | 0); varint(8); // ir_version 8
  field(7, Array.from({ length: 300 }, (_, i) => i % 256)); // graph (skipped by length)
  for (const [k, v] of Object.entries(meta)) {
    const kb = [...enc.encode(k)], vb = [...enc.encode(v)];
    field(14, [0x0a, kb.length, ...kb, 0x12, vb.length, ...vb]);
  }
  return Uint8Array.from(bytes);
}

describe('V51.9.160 on-device Malayalam voice (Rasa)', () => {
  it('reads the model settings from the ONNX file without loading it', () => {
    expect(onnxMetadata(fakeOnnx({ add_blank: '1', sample_rate: '22050', frontend: 'characters' }))).toEqual({ add_blank: '1', sample_rate: '22050', frontend: 'characters' });
    expect(onnxMetadata(Uint8Array.from([1, 2, 3]))).toEqual({});
  });
  it('turns Malayalam letters into the model tokens, with blanks between them', () => {
    const tokens = parseTokens('_ 0\n  1\nമ 2\nല 3\nാ 4\n');
    expect(tokens.get(' ')).toBe(1);
    const o = tokenOptions({ add_blank: '1' }, tokens);
    expect(o).toEqual({ addBlank: true, blankId: 0 });
    expect(tokenize('മല ാX', tokens, o)).toEqual({ ids: [0, 2, 0, 3, 0, 1, 0, 4, 0], skipped: ['X'] });
    expect(tokenize('മല', tokens, tokenOptions({ add_blank: '0' }, tokens)).ids).toEqual([2, 3]);
  });
  it('knows Sherpa and Hugging Face input names', () => {
    expect(inputRoles(['x', 'x_length', 'noise_scale', 'length_scale', 'noise_scale_w', 'sid', 'emotion_id'])).toEqual({ x: 'ids', x_length: 'length', noise_scale: 'noise', length_scale: 'lengthScale', noise_scale_w: 'noiseW', sid: 'sid', emotion_id: 'emotion' });
    expect(inputRoles(['input_ids', 'attention_mask', 'speaker_id'])).toEqual({ input_ids: 'ids', attention_mask: 'mask', speaker_id: 'sid' });
  });
  it('reads maths and numbers in Malayalam words, and leaves English sentences to the next voice', () => {
    expect(rasaText('2x+y=25, x=?')).toEqual({ text: 'രണ്ട് എക്സ് പ്ലസ് വൈ സമം ഇരുപത്തിയഞ്ച്, എക്സിന്റെ വില എത്ര?', english: false });
    expect(rasaText('ത്രികോണത്തിന്റെ കോണുകളുടെ തുക 180 ഡിഗ്രി').text).toBe('ത്രികോണത്തിന്റെ കോണുകളുടെ തുക നൂറ്റി എൺപത് ഡിഗ്രി');
    expect(rasaText('The sum of the angles of a triangle is 180 degrees').english).toBe(true);
    expect(rasaText('ഇത് ഒരു triangle ആണ്').english).toBe(true); // the voice would drop "triangle": Edge says this sentence
    expect(rasaText('ഇത് ഒരു ത്രികോണം ആണ്').english).toBe(false);
    expect(rasaText('ഈ QR സ്കാൻ ചെയ്ത് ചേരൂ')).toEqual({ text: 'ഈ ക്യൂ ആർ സ്കാൻ ചെയ്ത് ചേരൂ', english: false });
    expect(rasaSentences('ഒന്നാമത്. രണ്ടാമത്? Third!')).toEqual(['ഒന്നാമത്', 'രണ്ടാമത്']);
  });
  it('writes a WAV the browser can play', () => {
    const w = encodeWav(Float32Array.from([0, 0.5, -0.5, 1]), 22050);
    expect(new TextDecoder().decode(w.slice(0, 4))).toBe('RIFF');
    expect(new DataView(w.buffer).getUint32(24, true)).toBe(22050);
    expect(w.length).toBe(44 + 8);
  });
  it('is tried for Malayalam (right after Edge, V51.9.165) only when downloaded and switched on, and English never uses it', () => {
    clearTtsProviderDown();
    expect(ttsProviderOrder('malayalam', 'auto', Date.now(), true)[1]).toBe('rasa');
    expect(ttsProviderOrder('english', 'auto', Date.now(), true)).not.toContain('rasa');
    expect(ttsProviderOrder('malayalam', 'auto', Date.now(), false)).not.toContain('rasa');
    markTtsProviderDown('rasa'); // an English sentence it stepped aside for does not push it back
    expect(ttsProviderOrder('malayalam', 'auto', Date.now(), true)[1]).toBe('rasa');
  });
});
