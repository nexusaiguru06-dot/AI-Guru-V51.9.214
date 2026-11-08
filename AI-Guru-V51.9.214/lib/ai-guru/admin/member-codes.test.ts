import { describe, it, expect } from 'vitest';
import { formatCode, nextCode, parseCode, sameTeacher, syncCounters, yearTag } from './member-codes';

describe('member numbers', () => {
  it('formats ST-123-26 and TE-34-26', () => {
    expect(formatCode('ST', 123, '26')).toBe('ST-123-26');
    expect(formatCode('TE', 34, '26')).toBe('TE-34-26');
  });
  it('uses the Indian-time year', () => {
    expect(yearTag(new Date('2026-12-31T20:00:00Z'))).toBe('27'); // 1:30 am on 1 Jan 2027 in India
    expect(yearTag(new Date('2026-06-01T00:00:00Z'))).toBe('26');
  });
  it('counts per kind and year, never repeating', () => {
    const c: Record<string, number> = {};
    const d26 = new Date('2026-10-19T00:00:00Z'), d27 = new Date('2027-02-01T00:00:00Z');
    expect(nextCode(c, 'ST', d26)).toBe('ST-1-26');
    expect(nextCode(c, 'ST', d26)).toBe('ST-2-26');
    expect(nextCode(c, 'TE', d26)).toBe('TE-1-26');
    expect(nextCode(c, 'ST', d27)).toBe('ST-1-27');
    expect(nextCode(c, 'ST', d26)).toBe('ST-3-26');
  });
  it('catches up with numbers that already exist and ignores old AIG ids', () => {
    const c: Record<string, number> = {};
    syncCounters(c, ['ST-120-26', 'AIG0042', undefined, 'ST-7-25']);
    expect(nextCode(c, 'ST', new Date('2026-10-19T00:00:00Z'))).toBe('ST-121-26');
  });
  it('parses codes in any case', () => {
    expect(parseCode('st-9-26')).toEqual({ kind: 'ST', n: 9, yy: '26' });
    expect(parseCode('AIG0042')).toBeNull();
  });
  it('one teacher, one number', () => {
    expect(sameTeacher({ teacherName: 'A', teacherPhone: '+91 98765 43210' }, { teacherName: 'B', teacherPhone: '9876543210' })).toBe(true);
    expect(sameTeacher({ teacherName: 'Anu', school: 'GHS' }, { teacherName: ' anu ', school: 'ghs' })).toBe(true);
    expect(sameTeacher({ teacherName: 'Anu', school: 'GHS' }, { teacherName: 'Anu', school: 'XYZ' })).toBe(false);
  });
});
