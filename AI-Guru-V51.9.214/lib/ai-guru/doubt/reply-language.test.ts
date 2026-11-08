import { describe, expect, it } from 'vitest';
import { SAME_LANGUAGE_LINE, speechLangOf } from './reply-language';

describe('V51.9.165: the doubt pane answers in the language the student speaks', () => {
  it('tells the AI to follow the student’s language every turn', () => {
    expect(SAME_LANGUAGE_LINE).toMatch(/SAME language/);
    expect(SAME_LANGUAGE_LINE).toMatch(/switch with them/);
  });
  it('finds the speaking language of an answer from its script', () => {
    expect(speechLangOf('x ന്റെ വില 10 ആണ്')).toBe('ml-IN');
    expect(speechLangOf('x का मान 10 है')).toBe('hi-IN');
    expect(speechLangOf('x இன் மதிப்பு 10')).toBe('ta-IN');
    expect(speechLangOf('قيمة x هي 10')).toBe('ar-SA');
    expect(speechLangOf('The value of x is 10')).toBe('en-IN');
    expect(speechLangOf('ഇരുവശത്തുനിന്നും 5 കുറയ്ക്കുക, LCM and HCF')).toBe('ml-IN');
    expect(speechLangOf('12 + 5')).toBe('en-IN');
  });
});
