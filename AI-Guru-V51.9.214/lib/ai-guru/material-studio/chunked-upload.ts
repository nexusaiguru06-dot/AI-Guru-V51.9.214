/**
 * V51.9.204 — a large PDF sent in pieces. Netlify takes at most about 4.5 MB in one request, so a textbook over that
 * failed with an empty reply ("Unexpected end of JSON input"). The browser now sends the file in pieces of CHUNK_BYTES
 * to /material-studio/upload-chunk; the last piece joins them into `uploads/u_<id>.pdf`, and /material-studio/index
 * reads it with `uploadKey` exactly as a direct Cloud Storage upload.
 */
/** V51.9.205: 1 MB pieces (3 MB pieces still failed on a Netlify site). */
export const CHUNK_BYTES = 1024 * 1024;
export const UPLOAD_ID = /^[a-f0-9]{24}$/;
export const uploadKeyOf = (id: string) => `uploads/u_${id}.pdf`;
export const partKeyOf = (id: string, part: number) => `uploads/parts/u_${id}/${String(part).padStart(4, '0')}.bin`;
export const partsFolderOf = (id: string) => `uploads/parts/u_${id}`;

/** Checks one piece's numbers: part 0…parts-1, at most 100 pieces (300 MB), never bigger than CHUNK_BYTES. */
export function checkPart(id: string, part: number, parts: number, bytes: number): string | null {
  if (!UPLOAD_ID.test(id)) return 'Bad upload id';
  if (!Number.isInteger(parts) || parts < 1 || parts > 100) return 'Bad number of pieces';
  if (!Number.isInteger(part) || part < 0 || part >= parts) return 'Bad piece number';
  if (!(bytes > 0) || bytes > CHUNK_BYTES) return `Each piece must be 1 byte to ${CHUNK_BYTES / 1048576} MB`;
  return null;
}

/** Splits a size into pieces: [start, end) byte ranges. */
export const pieces = (size: number, chunk = CHUNK_BYTES): Array<[number, number]> =>
  Array.from({ length: Math.max(1, Math.ceil(size / chunk)) }, (_, i) => [i * chunk, Math.min(size, (i + 1) * chunk)]);

/** A reply that may not be JSON (a platform error page or an empty body) turned into a clear message. */
export async function readJsonReply(r: Response, what: string): Promise<{ ok?: boolean; error?: string; [k: string]: unknown }> {
  const text = await r.text().catch(() => '');
  try { if (text) return JSON.parse(text); } catch { /* not JSON */ }
  if (r.status === 413) return { ok: false, error: `${what}: the file is too large for the server in one piece. Please try again (it is now sent in pieces), or upload one chapter at a time.` };
  if (r.status === 504) return { ok: false, error: `${what}: the server took too long and stopped (the host allows about 60 seconds). Upload a smaller PDF, for example one chapter at a time, and try again.` };
  if (r.status === 502 || r.status === 500) return { ok: false, error: `${what}: the server stopped with an error (${r.status}). This is usually the time limit (about 60 seconds) or the file storage. Try "Use only Part 1", or a smaller PDF.` };
  return { ok: false, error: `${what} failed (server reply ${r.status}${r.statusText ? ` ${r.statusText}` : ''}). Please try again.` };
}
