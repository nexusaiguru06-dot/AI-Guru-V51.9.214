/**
 * V51.9.198 — where students download their textbooks: the official, free sites of each board (checked November 2026).
 * Not listed? The page searches the web for "<syllabus> class <n> <subject> textbook PDF".
 */
export interface TextbookSite { board: string; covers: string; url: string; note?: string }

export const TEXTBOOK_SITES: TextbookSite[] = [
  { board: 'CBSE (NCERT)', covers: 'Class 1–12 · English, Hindi and Urdu', url: 'https://ncert.nic.in/textbook.php', note: 'Choose the class, subject and book, then download the chapters or the whole book.' },
  { board: 'NCERT ePathshala', covers: 'The same NCERT books as e-books', url: 'https://epathshala.nic.in/epathshala.php?id=Students&type=eTextbooks&ln=en' },
  { board: 'DIKSHA (all states)', covers: 'Textbooks of many state boards, with videos', url: 'https://diksha.gov.in/', note: 'Pick your state and board, then your class.' },
  { board: 'Kerala (SCERT)', covers: 'Class 1–12 · KITE Samagra portal', url: 'https://samagra.kite.kerala.gov.in/', note: 'Open “Textbooks”, then choose the class and medium.' },
  { board: 'Tamil Nadu', covers: 'Samacheer Kalvi textbooks on DIKSHA Tamil Nadu', url: 'https://diksha.gov.in/tn/' },
  { board: 'Karnataka (KTBS)', covers: 'Class 1–10 · Kannada, English and other media', url: 'https://textbooks.karnataka.gov.in/textbooks/en' },
  { board: 'Maharashtra (Balbharati)', covers: 'Class 1–12 · e-books', url: 'https://books.ebalbharati.in/' },
  { board: 'Andhra Pradesh', covers: 'School textbooks (view or download)', url: 'https://cse.ap.gov.in/loadacademictextbookpublicview' },
  { board: 'Telangana (SCERT)', covers: 'e-textbooks', url: 'https://scert.telangana.gov.in/' },
];

/** ICSE / ISC books come from private publishers: there is no official free download. */
export const ICSE_NOTE = 'ICSE and ISC books are printed by private publishers, so there is no official free download. Ask your school for the book, or upload the PDF your school gives you.';

/** A web search for a textbook that is not listed. */
export function textbookSearchUrl(q: { syllabus?: string; grade?: string; subject?: string }): string {
  const words = [q.syllabus, q.grade && `class ${q.grade}`, q.subject, 'textbook PDF official'].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(words)}`;
}
