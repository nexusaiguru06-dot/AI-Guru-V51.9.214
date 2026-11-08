import { describe, expect, it } from 'vitest';
import { mlNumbersInText, numberWords, wholeNumber } from './ml-numbers';
import { mlGenitive, speakable } from '../reels/motion/speech';

describe('V51.9.160 Malayalam numbers and questions', () => {
  it('reads numbers as Kerala classrooms say them', () => {
    const cases: Array<[number, string]> = [
      [0, 'പൂജ്യം'], [2, 'രണ്ട്'], [10, 'പത്ത്'], [12, 'പന്ത്രണ്ട്'], [19, 'പത്തൊൻപത്'], [20, 'ഇരുപത്'], [21, 'ഇരുപത്തിയൊന്ന്'],
      [22, 'ഇരുപത്തിരണ്ട്'], [25, 'ഇരുപത്തിയഞ്ച്'], [48, 'നാൽപ്പത്തിയെട്ട്'], [90, 'തൊണ്ണൂറ്'], [99, 'തൊണ്ണൂറ്റിയൊൻപത്'],
      [100, 'നൂറ്'], [125, 'നൂറ്റി ഇരുപത്തിയഞ്ച്'], [500, 'അഞ്ഞൂറ്'], [900, 'തൊള്ളായിരം'], [1000, 'ആയിരം'],
      [2500, 'രണ്ടായിരത്തി അഞ്ഞൂറ്'], [5000, 'അയ്യായിരം'], [25000, 'ഇരുപത്തിയഞ്ച് ആയിരം'], [100000, 'ഒരു ലക്ഷം'],
      [125000, 'ഒരു ലക്ഷത്തി ഇരുപത്തിയഞ്ച് ആയിരം'], [10000000, 'ഒരു കോടി'],
    ];
    for (const [n, w] of cases) expect(wholeNumber(n), String(n)).toBe(w);
    expect(numberWords('2.5')).toBe('രണ്ട് പോയിന്റ് അഞ്ച്');
    expect(numberWords('1,25,000')).toBe('ഒരു ലക്ഷത്തി ഇരുപത്തിയഞ്ച് ആയിരം');
    expect(mlNumbersInText('2 എക്സ് പ്ലസ് വൈ സമം 25')).toBe('രണ്ട് എക്സ് പ്ലസ് വൈ സമം ഇരുപത്തിയഞ്ച്');
  });
  it('asks "x = ?" as a question', () => {
    expect(speakable('2x+y=25, x=?', 'ml')).toBe('2 എക്സ് പ്ലസ് വൈ സമം 25, എക്സിന്റെ വില എത്ര?');
    expect(speakable('y = ?', 'ml')).toBe('വൈയുടെ വില എത്ര?');
    expect(speakable('3 + 4 = ?', 'ml')).toBe('3 പ്ലസ് 4 എത്ര?');
    expect(speakable('x = ?', 'en')).toBe('what is x?');
    expect(speakable('3 + 4 = ?', 'en')).toBe('3 plus 4 equals what?');
    expect(mlGenitive('ആർ')).toBe('ആറിന്റെ');
    expect(mlGenitive('എൻ')).toBe('എന്നിന്റെ');
    expect(speakable('2x + y = 25', 'ml')).toBe('2 എക്സ് പ്ലസ് വൈ സമം 25'); // unchanged without a question
  });
});
