'use client';

/** Registers the reel fonts (Noto Serif + Noto Sans Malayalam, OFL) from /public/fonts/reel. */

import { setMeasurer } from './metrics';
import { loadBrandLogo } from './brand';

const FILES: Array<[family: string, file: string, weight: string]> = [
  ['AIGuruSerif', 'NotoSerif_400Regular.ttf', '400'],
  ['AIGuruSerif', 'NotoSerif_600SemiBold.ttf', '600'],
  ['AIGuruSerif', 'NotoSerif_700Bold.ttf', '700'],
  ['AIGuruMalayalam', 'NotoSansMalayalam_400Regular.ttf', '400'],
  ['AIGuruMalayalam', 'NotoSansMalayalam_600SemiBold.ttf', '600'],
  ['AIGuruMalayalam', 'NotoSansMalayalam_700Bold.ttf', '700'],
  // V51.9.101: look fonts (OFL; see OFL-look-fonts.txt): rounded (Baloo 2 + Baloo Chettan 2) and hand (Kalam + Chilanka)
  ['AIGuruRound', 'baloo-2-latin-400-normal.woff2', '400'],
  ['AIGuruRound', 'baloo-2-latin-600-normal.woff2', '600'],
  ['AIGuruRound', 'baloo-2-latin-700-normal.woff2', '700'],
  ['AIGuruRoundMl', 'baloo-chettan-2-malayalam-400-normal.woff2', '400'],
  ['AIGuruRoundMl', 'baloo-chettan-2-malayalam-600-normal.woff2', '600'],
  ['AIGuruRoundMl', 'baloo-chettan-2-malayalam-700-normal.woff2', '700'],
  ['AIGuruHand', 'kalam-latin-400-normal.woff2', '400'],
  ['AIGuruHand', 'kalam-latin-700-normal.woff2', '700'],
  ['AIGuruHandMl', '../chilanka/Chilanka-Regular.woff2', '400'],
];

/** V51.9.106: the extra font styles, loaded only when a reel uses them (about 40–120 KB each). */
const EXTRA: Record<string, Array<[family: string, file: string, weight: string]>> = {
  modern: [['AIGuruModern', 'lexend-latin-400-normal.woff2', '400'], ['AIGuruModern', 'lexend-latin-600-normal.woff2', '600'], ['AIGuruModern', 'lexend-latin-700-normal.woff2', '700'],
    ['AIGuruModernMl', 'anek-malayalam-malayalam-400-normal.woff2', '400'], ['AIGuruModernMl', 'anek-malayalam-malayalam-600-normal.woff2', '600'], ['AIGuruModernMl', 'anek-malayalam-malayalam-700-normal.woff2', '700']],
  bubbly: [['AIGuruBubbly', 'fredoka-latin-400-normal.woff2', '400'], ['AIGuruBubbly', 'fredoka-latin-600-normal.woff2', '600'], ['AIGuruBubbly', 'fredoka-latin-700-normal.woff2', '700'],
    ['AIGuruBubblyMl', 'manjari-malayalam-400-normal.woff2', '400'], ['AIGuruBubblyMl', 'manjari-malayalam-700-normal.woff2', '700']],
  marker: [['AIGuruMarker', 'patrick-hand-latin-400-normal.woff2', '400'],
    ['AIGuruMarkerMl', 'gayathri-malayalam-400-normal.woff2', '400'], ['AIGuruMarkerMl', 'gayathri-malayalam-700-normal.woff2', '700']],
  elegant: [['AIGuruElegant', 'playfair-display-latin-400-normal.woff2', '400'], ['AIGuruElegant', 'playfair-display-latin-600-normal.woff2', '600'], ['AIGuruElegant', 'playfair-display-latin-700-normal.woff2', '700'],
    ['AIGuruElegantMl', 'noto-serif-malayalam-malayalam-400-normal.woff2', '400'], ['AIGuruElegantMl', 'noto-serif-malayalam-malayalam-600-normal.woff2', '600'], ['AIGuruElegantMl', 'noto-serif-malayalam-malayalam-700-normal.woff2', '700']],
  comic: [['AIGuruComic', 'comic-neue-latin-400-normal.woff2', '400'], ['AIGuruComic', 'comic-neue-latin-700-normal.woff2', '700']],
};
const extraLoading = new Map<string, Promise<void>>();

/** Loads one font style (no-op for the built-in ones). Resolves when it is ready to measure and draw. */
export function loadFontKind(kind: string | null | undefined, base = '/fonts/reel/'): Promise<void> {
  const files = kind ? EXTRA[kind] : undefined;
  if (!files || typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  let p = extraLoading.get(kind!);
  if (!p) {
    p = Promise.all(files.map(async ([family, file, weight]) => {
      try { const face = new FontFace(family, `url(${base}${file})`, { weight }); await face.load(); document.fonts.add(face); } catch { /* the serif stands in */ }
    })).then(() => undefined);
    extraLoading.set(kind!, p);
  }
  return p;
}

let loading: Promise<void> | null = null;

export function loadReelFonts(base = '/fonts/reel/'): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  loading ??= Promise.all([
    loadBrandLogo(),
    ...FILES.map(async ([family, file, weight]) => {
      try {
        const face = new FontFace(family, `url(${base}${file})`, { weight });
        await face.load();
        document.fonts.add(face);
      } catch {
        /* fall back to system serif */
      }
    }),
  ]).then(() => {
    // Re-measure with the real fonts (layout is computed when a reel is built).
    setMeasurer(null);
  });
  return loading;
}
