import { describe, it, expect } from 'vitest';
import { SEED_KB, addMessage, categoryFor, counts, detectCategories, inbox, markRead, matchKb, newThread, summaryOf } from './core';

const st = { role: 'student' as const, id: 's1', name: 'Anju', code: 'ST-1-26' };
const te = { role: 'teacher' as const, id: 'TE-3-26', name: 'Rema', code: 'TE-3-26' };

describe('messages (V51.9.153)', () => {
  it('money always shows red, whatever was chosen', () => {
    expect(detectCategories('I paid the fee by UPI but no receipt')).toContain('money');
    expect(categoryFor('my ₹500 was taken twice', 'technical')).toBe('money');
    expect(categoryFor('ഫീസ് അടച്ചു', undefined)).toBe('money');
    expect(categoryFor('the video is not working', undefined)).toBe('technical');
    expect(categoryFor('please add a dark mode', undefined)).toBe('suggestion');
    expect(categoryFor('cost of 5 pens is 60, find one pen', 'study')).toBe('study'); // maths words are not money
    expect(categoryFor('hello', 'app-help')).toBe('app-help');
  });
  it('the bot answers from the knowledge base only when it fits', () => {
    expect(matchKb('I forgot my PIN, cannot sign in', SEED_KB, { role: 'student' })?.entry.id).toBe('kb-pin');
    expect(matchKb('no voice in the class, cannot hear the teacher', SEED_KB)?.entry.id).toBe('kb-voice');
    expect(matchKb('how do I make a reel and share on whatsapp', SEED_KB)?.entry.id).toBe('kb-reel');
    expect(matchKb('my fee receipt is wrong', SEED_KB)).toBeNull();
    expect(matchKb('hi', SEED_KB)).toBeNull();
    expect(matchKb('I forgot my PIN', SEED_KB, { role: 'teacher' })).toBeNull(); // a students-only answer
  });
  it('threads: status, unread for the other side, inbox order and counts', () => {
    const a = newThread('student-admin', st);
    addMessage(a, { at: '2026-10-27T05:00:00Z', from: 'student', by: 'Anju', text: 'The fee page shows ₹ twice', category: 'technical' });
    expect([a.category, a.status, a.unread.admin]).toEqual(['money', 'needs-reply', 1]);
    addMessage(a, { at: '2026-10-27T05:01:00Z', from: 'admin', by: 'office', text: 'Fixed' });
    expect([a.status, a.unread.student]).toEqual(['answered', 1]);
    markRead(a, 'admin');
    const b = newThread('teacher-admin', te);
    addMessage(b, { at: '2026-10-27T04:00:00Z', from: 'teacher', by: 'Rema', text: 'Please add a new class', category: 'suggestion' });
    const c = newThread('teacher-student', st, te);
    addMessage(c, { at: '2026-10-27T06:00:00Z', from: 'teacher', by: 'Rema', text: 'Do page 12' });
    expect(c.unread).toEqual({ student: 1 });
    const list = [summaryOf(a), summaryOf(b), summaryOf(c)];
    expect(inbox(list).map((t) => t.id)).toEqual([b.id, a.id]); // waiting for the office first; teacher–student only on request
    expect(inbox(list, { kind: 'teacher-student' }).map((t) => t.id)).toEqual([c.id]);
    expect(inbox(list, { status: 'open', kind: 'teacher-admin' }).map((t) => t.party.name)).toEqual(['Rema']);
    expect(inbox(list, { q: 'st-1' }).length).toBe(1);
    expect(counts(list).suggestion).toEqual({ open: 1, all: 1 });
    expect(counts(list).money).toEqual({ open: 0, all: 1 });
  });
  it('a bot answer does not ping the office until the writer says it did not help', () => {
    const t = newThread('student-admin', st);
    addMessage(t, { at: '2026-10-27T05:00:00Z', from: 'student', by: 'Anju', text: 'forgot pin' });
    addMessage(t, { at: '2026-10-27T05:00:01Z', from: 'bot', by: 'bot', text: 'Use Forgot PIN', kb: 'kb-pin', ask: 'solved' });
    expect(t.status).toBe('bot');
  });
  it('money stays red only while the matter is open', () => {
    const t = newThread('student-admin', st);
    addMessage(t, { at: '2026-10-27T05:00:00Z', from: 'student', by: 'Anju', text: 'fee paid, no receipt' });
    addMessage(t, { at: '2026-10-27T05:00:30Z', from: 'student', by: 'Anju', text: 'also the video does not work' });
    expect(t.category).toBe('money');
    addMessage(t, { at: '2026-10-27T05:01:00Z', from: 'admin', by: 'office', text: 'done' });
    addMessage(t, { at: '2026-10-27T05:02:00Z', from: 'student', by: 'Anju', text: 'the video is not working', category: 'technical' });
    expect(t.category).toBe('technical');
  });
});

import { cleanNote, noteFileName, noteParagraphs } from './notes';
describe('V51.9.154 teacher notes in messages', () => {
  it('cleans a note and splits it into teachable parts', () => {
    expect(cleanNote({ title: '  ', body: 'x' })).toBeNull();
    expect(cleanNote({ title: 'Cells', body: 'A\n\nB', itemId: 'i1' })).toEqual({ title: 'Cells', body: 'A\n\nB', itemId: 'i1' });
    expect(noteParagraphs('One line\nwraps here.\n\n\nTwo.')).toEqual(['One line wraps here.', 'Two.']);
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const parts = noteParagraphs(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 700)).toBe(true);
    expect(parts.join(' ')).toBe(long);
    expect(noteFileName('Light: a/b?')).toBe('Light a b.txt');
    expect(noteFileName('ഭിന്നസംഖ്യകൾ — Fractions')).toBe('Fractions.txt');
    expect(noteFileName('പ്രകാശം')).toBe('teacher-note.txt');
    expect(noteFileName('Cells — parts')).toBe('Cells - parts.txt');
  });
});
