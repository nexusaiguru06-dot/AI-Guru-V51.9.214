/** V51.9.95: matching books to students (pure). */
import { describe, expect, it } from 'vitest';
import { bookMatches, gradeKey, ownerLabel, syllabusKey } from './catalog';
import { cleanLibrarySettings, DEFAULT_LIBRARY, maskKey } from './settings';

describe('library catalog', () => {
  it('normalises syllabus and standard', () => {
    expect(['kerala', 'SCERT Kerala', 'Kerala State'].map(syllabusKey)).toEqual(['kerala', 'kerala', 'kerala']);
    expect(['CBSE', 'NCERT', 'cbse'].map(syllabusKey)).toEqual(['cbse', 'cbse', 'cbse']);
    expect(syllabusKey('')).toBe('');
    expect(['8', 'Std 8', 'Class 08'].map(gradeKey)).toEqual(['8', '8', '8']);
  });
  it('a book matches on syllabus and standard (medium only orders the list)', () => {
    expect(bookMatches({ syllabus: 'kerala', grade: '8' }, { syllabus: 'kerala', standard: '8' })).toBe(true);
    expect(bookMatches({ syllabus: 'SCERT Kerala', grade: 'Class 8' }, { syllabus: 'kerala', standard: '8' })).toBe(true);
    expect(bookMatches({ syllabus: 'cbse', grade: '8' }, { syllabus: 'kerala', standard: '8' })).toBe(false);
    expect(bookMatches({ syllabus: 'kerala', grade: '9' }, { syllabus: 'kerala', standard: '8' })).toBe(false);
    expect(bookMatches({ syllabus: 'kerala', grade: '8' }, { standard: '8' })).toBe(false);
    expect(ownerLabel({ kind: 'student', id: 'x', name: 'Arjun' })).toBe('Made by a student');
    expect(ownerLabel(undefined)).toBe('AI Guru');
  });
  it('cloud settings keep the key unless replaced or removed', () => {
    const key = 'AIza' + 'x'.repeat(35);
    const s = cleanLibrarySettings({ cloudKey: key, studentsMayCreate: true, dailyLimit: 3 }, DEFAULT_LIBRARY);
    expect(s).toMatchObject({ cloudKey: key, studentsMayCreate: false, dailyLimit: 3, reviewStudentWork: false }); // V51.9.187: never for students
    expect(cleanLibrarySettings({ cloudKey: maskKey(key), dailyLimit: 3 }, s as never)).toMatchObject({ cloudKey: key });
    expect(cleanLibrarySettings({ cloudKey: null }, s as never)).toMatchObject({ cloudKey: undefined });
    expect(cleanLibrarySettings({ cloudKey: 'nope' }, DEFAULT_LIBRARY)).toMatch(/Gemini/);
    expect(cleanLibrarySettings({ dailyLimit: 999 }, DEFAULT_LIBRARY)).toMatch(/Daily/);
  });
});
