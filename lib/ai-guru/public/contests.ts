/**
 * Festival and holiday contests. Each runs in a yearly window (month-day to month-day, India time), has five themed
 * questions, and gives bonus toffees while it is open. The dates of moving festivals (Onam) are set to a wide window.
 */
import type { Bi, Q } from './lessons';

export interface Contest { id: string; emoji: string; title: Bi; blurb: Bi; from: string; to: string; bonus: number; questions: Q[] }
const b = (en: string, ml: string): Bi => ({ en, ml });
const n = (v: string): Bi => b(v, v);
const q = (en: string, ml: string, opts: string[], answer: number, whyEn: string, whyMl: string): Q => ({ q: b(en, ml), options: opts.map(n), answer, why: b(whyEn, whyMl) });

export const CONTESTS: Contest[] = [
  {
    id: 'onam', emoji: '🌼', from: '08-18', to: '09-15', bonus: 2,
    title: b('Onam maths quiz', 'ഓണം കണക്ക് ക്വിസ്'), blurb: b('Pookalam, sadya and vallam kali: five quick questions. Bonus toffees all festival.', 'പൂക്കളം, സദ്യ, വള്ളംകളി: അഞ്ച് ചോദ്യങ്ങൾ. ഉത്സവക്കാലത്ത് ബോണസ് ടോഫി.'),
    questions: [
      q('A sadya is served to 8 guests. Each guest gets 3 banana-leaf pieces. How many pieces are needed?', 'സദ്യ 8 അതിഥികൾക്ക്. ഓരോരുത്തർക്കും 3 വാഴയില കഷണം. ആകെ എത്ര?', ['11', '24', '16', '32'], 1, '8 × 3 = 24.', '8 × 3 = 24.'),
      q('A round pookalam has diameter 2 metres. What is its radius?', 'വൃത്താകൃതിയിലുള്ള പൂക്കളത്തിന്റെ വ്യാസം 2 മീറ്റർ. ആരം എത്ര?', ['4 m', '1 m', '2 m', '0.5 m'], 1, 'The radius is half of the diameter: 2 ÷ 2 = 1 m.', 'ആരം വ്യാസത്തിന്റെ പകുതി: 2 ÷ 2 = 1 മീ.'),
      q('Vallam kali: 4 boats, each with 25 rowers. How many rowers in all?', 'വള്ളംകളി: 4 വള്ളം, ഓരോന്നിലും 25 തുഴക്കാർ. ആകെ എത്ര?', ['29', '75', '100', '125'], 2, '4 × 25 = 100.', '4 × 25 = 100.'),
      q('5 litres of payasam is shared equally among 10 people. How much does each get?', '5 ലിറ്റർ പായസം 10 പേർക്ക് തുല്യമായി. ഓരോരുത്തർക്കും എത്ര?', ['2 L', '0.5 L', '5 L', '0.1 L'], 1, '5 ÷ 10 = 0.5 litre.', '5 ÷ 10 = 0.5 ലിറ്റർ.'),
      q('Onam lasts 10 days and Atham is day 1. Which day is Thiruvonam?', 'ഓണം 10 ദിവസം, അത്തം ഒന്നാം ദിവസം. തിരുവോണം ഏത് ദിവസം?', ['Day 8', 'Day 9', 'Day 10', 'Day 11'], 2, 'Thiruvonam is the 10th and last day.', 'തിരുവോണം 10-ാം (അവസാന) ദിവസമാണ്.'),
    ],
  },
  {
    id: 'childrens-day', emoji: '🎈', from: '11-10', to: '11-16', bonus: 2,
    title: b('Children’s Day quiz', 'ശിശുദിന ക്വിസ്'), blurb: b('Five questions for 14 November. Bonus toffees all week.', 'നവംബർ 14-ന് അഞ്ച് ചോദ്യങ്ങൾ. ഈ ആഴ്ച ബോണസ് ടോഫി.'),
    questions: [
      q('Children’s Day is on 14 November. How many days are there from 10 November to 14 November (counting both)?', 'ശിശുദിനം നവംബർ 14. നവംബർ 10 മുതൽ 14 വരെ (രണ്ടും ഉൾപ്പെടെ) എത്ര ദിവസം?', ['4', '5', '6', '3'], 1, '10, 11, 12, 13, 14 is 5 days.', '10, 11, 12, 13, 14 = 5 ദിവസം.'),
      q('A class of 40 children share 120 sweets equally. How many does each child get?', '40 കുട്ടികൾ 120 മിഠായി തുല്യമായി പങ്കിടുന്നു. ഓരോരുത്തർക്കും എത്ര?', ['2', '3', '4', '30'], 1, '120 ÷ 40 = 3.', '120 ÷ 40 = 3.'),
      q('A balloon costs ₹5. How much do 12 balloons cost?', 'ഒരു ബലൂണിന് ₹5. 12 ബലൂണിന് എത്ര?', ['₹17', '₹50', '₹60', '₹72'], 2, '12 × 5 = 60.', '12 × 5 = 60.'),
      q('A rectangular banner is 6 m long and 2 m wide. What is its area?', '6 മീ നീളവും 2 മീ വീതിയുമുള്ള ബാനറിന്റെ വിസ്തീർണം?', ['8 sq m', '12 sq m', '16 sq m', '4 sq m'], 1, 'Area = 6 × 2 = 12 square metres.', 'വിസ്തീർണം = 6 × 2 = 12 ചതുരശ്ര മീറ്റർ.'),
      q('Which is the biggest: 1/2, 1/4, 3/4, 1/8?', 'ഏറ്റവും വലുത് ഏത്: 1/2, 1/4, 3/4, 1/8?', ['1/2', '1/4', '3/4', '1/8'], 2, '3/4 = 6/8, which is more than 1/2 = 4/8.', '3/4 = 6/8, ഇത് 1/2 = 4/8-നേക്കാൾ വലുതാണ്.'),
    ],
  },
  {
    id: 'christmas', emoji: '🎄', from: '12-18', to: '12-26', bonus: 2,
    title: b('Christmas quiz', 'ക്രിസ്മസ് ക്വിസ്'), blurb: b('Stars, cakes and carols. Bonus toffees until Boxing Day.', 'നക്ഷത്രം, കേക്ക്, കരോൾ. ബോണസ് ടോഫി.'),
    questions: [
      q('A star has 5 points. How many points are on 6 stars?', 'ഒരു നക്ഷത്രത്തിന് 5 മൂലകൾ. 6 നക്ഷത്രത്തിന് എത്ര?', ['11', '25', '30', '35'], 2, '6 × 5 = 30.', '6 × 5 = 30.'),
      q('A cake is cut into 8 equal slices and 3 are eaten. What fraction is left?', 'കേക്ക് 8 തുല്യ കഷണമായി മുറിച്ചു, 3 കഴിച്ചു. ബാക്കി എത്ര ഭാഗം?', ['3/8', '5/8', '1/8', '8/3'], 1, '8 − 3 = 5 slices left, so 5/8.', '8 − 3 = 5 കഷണം ബാക്കി, അതായത് 5/8.'),
      q('Christmas is on 25 December. How many days from 20 December to 25 December (counting both)?', 'ക്രിസ്മസ് ഡിസംബർ 25. ഡിസംബർ 20 മുതൽ 25 വരെ (രണ്ടും ഉൾപ്പെടെ) എത്ര ദിവസം?', ['5', '6', '7', '4'], 1, '20, 21, 22, 23, 24, 25 is 6 days.', '20, 21, 22, 23, 24, 25 = 6 ദിവസം.'),
      q('A carol group has 12 singers. If 3 more join, how many singers?', 'കരോൾ സംഘത്തിൽ 12 പേർ. 3 പേർ കൂടി ചേർന്നാൽ?', ['9', '15', '36', '14'], 1, '12 + 3 = 15.', '12 + 3 = 15.'),
      q('A gift box is 10 cm by 5 cm. What is its perimeter?', '10 സെ.മീ × 5 സെ.മീ പെട്ടിയുടെ ചുറ്റളവ്?', ['15 cm', '30 cm', '50 cm', '25 cm'], 1, '2 × (10 + 5) = 30 cm.', '2 × (10 + 5) = 30 സെ.മീ.'),
    ],
  },
  {
    id: 'republic-day', emoji: '🇮🇳', from: '01-20', to: '01-27', bonus: 2,
    title: b('Republic Day quiz', 'റിപ്പബ്ലിക് ദിന ക്വിസ്'), blurb: b('Five questions around 26 January. Bonus toffees all week.', 'ജനുവരി 26-നെ ചുറ്റിപ്പറ്റി അഞ്ച് ചോദ്യങ്ങൾ. ബോണസ് ടോഫി.'),
    questions: [
      q('The Constitution of India came into force on 26 January 1950. How many years is it to 26 January 2000?', '1950 ജനുവരി 26-ന് ഭരണഘടന നിലവിൽ വന്നു. 2000 ജനുവരി 26 വരെ എത്ര വർഷം?', ['40', '50', '60', '45'], 1, '2000 − 1950 = 50.', '2000 − 1950 = 50.'),
      q('The Indian flag has 3 equal stripes. What fraction of the flag is one stripe?', 'ത്രിവർണ പതാകയിൽ 3 തുല്യ വരകൾ. ഒരു വര പതാകയുടെ എത്ര ഭാഗം?', ['1/2', '1/3', '1/4', '3/1'], 1, '1 of 3 equal parts is 1/3.', '3 തുല്യ ഭാഗത്തിൽ 1 = 1/3.'),
      q('The Ashoka Chakra has 24 spokes. How many spokes are in half the wheel?', 'അശോകചക്രത്തിന് 24 ആരക്കാലുകൾ. പകുതി ചക്രത്തിൽ എത്ര?', ['6', '12', '24', '48'], 1, 'Half of 24 is 12.', '24-ന്റെ പകുതി 12.'),
      q('A parade has 15 rows of 8 children. How many children march?', 'പരേഡിൽ 8 കുട്ടികൾ വീതമുള്ള 15 നിര. ആകെ എത്ര?', ['23', '100', '120', '115'], 2, '15 × 8 = 120.', '15 × 8 = 120.'),
      q('A flag is 90 cm long and 60 cm wide. What is its area?', '90 സെ.മീ നീളവും 60 സെ.മീ വീതിയുമുള്ള പതാകയുടെ വിസ്തീർണം?', ['150 sq cm', '300 sq cm', '5400 sq cm', '540 sq cm'], 2, '90 × 60 = 5400 square cm.', '90 × 60 = 5400 ചതുരശ്ര സെ.മീ.'),
    ],
  },
];

const md = (day: string) => day.slice(5);
/** Contests that are open on a day (YYYY-MM-DD, India time). */
export const activeContests = (day: string): Contest[] => CONTESTS.filter((c) => md(day) >= c.from && md(day) <= c.to);
/** The next contest to open (this year or next) and how many days away it is. */
export function nextContest(day: string): { contest: Contest; inDays: number } | null {
  const y = Number(day.slice(0, 4));
  const list = CONTESTS.flatMap((c) => [y, y + 1].map((yy) => ({ contest: c, start: `${yy}-${c.from}` }))).filter((x) => x.start > day).sort((a, b) => a.start.localeCompare(b.start));
  if (!list.length) return null;
  return { contest: list[0].contest, inDays: Math.round((Date.parse(`${list[0].start}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000) };
}
/** The year a contest edition belongs to (the window start's year). */
export const contestYear = (day: string) => Number(day.slice(0, 4));
