// @vitest-environment node
/** V51.9.198 — the textbook links and the web search for a syllabus that is not listed. */
import { describe, expect, it } from 'vitest';
import { TEXTBOOK_SITES, textbookSearchUrl } from './textbooks';

describe('textbooks', () => {
  it('official https sites, CBSE first, one per board', () => {
    expect(TEXTBOOK_SITES[0]).toMatchObject({ board: 'CBSE (NCERT)', url: 'https://ncert.nic.in/textbook.php' });
    for (const s of TEXTBOOK_SITES) expect(s.url).toMatch(/^https:\/\/[a-z0-9.-]+\.(nic\.in|gov\.in|ebalbharati\.in)\//);
    expect(new Set(TEXTBOOK_SITES.map((s) => s.url)).size).toBe(TEXTBOOK_SITES.length);
  });
  it('the web search names the syllabus, class and subject', () => {
    expect(textbookSearchUrl({ syllabus: 'Gujarat board', grade: '8', subject: 'Science' })).toBe('https://www.google.com/search?q=Gujarat%20board%20class%208%20Science%20textbook%20PDF%20official');
    expect(textbookSearchUrl({ syllabus: 'IGCSE' })).toBe('https://www.google.com/search?q=IGCSE%20textbook%20PDF%20official');
  });
});
