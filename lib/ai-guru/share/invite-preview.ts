/**
 * V51.9.91: rich link previews for invite links. When /j/CODE is pasted into WhatsApp, Telegram, Facebook or X, their preview
 * robot gets a small page with Open Graph tags and a picture showing the code, instead of following the redirect to the plain
 * sign-up page. People are still redirected straight away (and this page also forwards anyone it reaches by mistake).
 * The preview never carries a student's name: previews are cached by the apps and shown to anyone the link reaches.
 */
import { spacedCode } from './join-code';

/** Link-preview robots. Kept to robots only: in-app browsers (Instagram, LINE…) are people and must be redirected. */
const BOTS = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterestbot|SkypeUriPreview|redditbot|Embedly|Iframely|vkShare|Snap URL Preview|Googlebot|bingbot|Applebot|Mastodon|Bluesky/i;
export const isPreviewBot = (ua: string | null | undefined): boolean => !!ua && BOTS.test(ua);

export interface InviteInfo {
  /** Clean code, or '' when the link had none / it is not valid. */
  code: string;
  /** Class or centre name for a class join code (only shown when it is plain ASCII, see `cardGroup`). */
  group?: string;
  /** e.g. "10% off fees"; omitted when the code gives no discount. */
  offer?: string;
}

export interface PreviewText { title: string; description: string; imageAlt: string }

export function previewText(i: InviteInfo): PreviewText {
  if (!i.code) {
    return {
      title: 'AI Guru — Learn Maths and Science in Malayalam and English',
      description: 'Animated step-by-step lessons in Malayalam and English, quizzes that earn toffees, and reports for parents.',
      imageAlt: 'AI Guru',
    };
  }
  const c = spacedCode(i.code);
  const offer = i.offer ? ` and get ${i.offer}` : '';
  if (i.group) {
    return {
      title: `Join ${i.group} on AI Guru`,
      description: `Class code ${c} is already filled in when you open this link${offer}. Lessons in Malayalam and English, quizzes with toffees.`,
      imageAlt: `Join ${i.group} on AI Guru — class code ${c}`,
    };
  }
  return {
    title: 'You’re invited to AI Guru 🍬',
    description: `A friend invited you. Code ${c} is filled in when you open this link${offer}. Lessons in Malayalam and English, quizzes that earn toffees.`,
    imageAlt: `AI Guru invite — code ${c}`,
  };
}

/** The class name, only when the preview picture can draw it (the picture's font has no Malayalam shaping). */
export const cardGroup = (g?: string): string | undefined => (g && /^[\x20-\x7E]{1,40}$/.test(g) ? g : undefined);

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The page preview robots read. `pageUrl` is the /j/CODE link, `image` the card picture, `to` where people should end up. */
export function invitePreviewHtml(o: { pageUrl: string; image: string; to: string; text: PreviewText }): string {
  const { title, description, imageAlt } = o.text;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AI Guru">
<meta property="og:locale" content="en_IN">
<meta property="og:url" content="${esc(o.pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(o.image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(o.image)}">
<meta http-equiv="refresh" content="0;url=${esc(o.to)}">
<link rel="canonical" href="${esc(o.pageUrl)}">
</head><body><p><a href="${esc(o.to)}">${esc(title)} — continue</a></p></body></html>`;
}
