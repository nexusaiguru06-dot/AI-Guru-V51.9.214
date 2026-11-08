/** V51.9.209 — the number that names a passage (the board and the server must agree on it, so the ids of its blocks match). */
export function passageHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
export const blockKeyOf = (passage: string) => `rag${Math.abs(passageHash(passage))}`;
