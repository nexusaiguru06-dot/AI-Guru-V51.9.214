/**
 * Public sample lessons: short, hand-written, English and Malayalam on the same page, with a 3-question quiz.
 * They need no sign-in and no AI key, so anyone (and Google) can open them. Quiz answers are checked in tests.
 */
export interface Bi { en: string; ml: string }
export interface Step { h: Bi; p: Bi }
export interface Q { q: Bi; options: Bi[]; answer: number; why: Bi }
export interface PublicLesson { slug: string; cls: number; subject: 'Maths' | 'Science'; title: Bi; summary: Bi; steps: Step[]; quiz: Q[] }

const b = (en: string, ml: string): Bi => ({ en, ml });
const n = (v: string): Bi => b(v, v);

export const LESSONS: PublicLesson[] = [
  {
    slug: 'add-fractions-same-denominator', cls: 5, subject: 'Maths',
    title: b('Adding fractions with the same denominator', 'ഒരേ ഛേദമുള്ള ഭിന്നസംഖ്യകൾ കൂട്ടാം'),
    summary: b('When the bottom numbers match, add only the top numbers.', 'ഛേദം ഒന്നുതന്നെയാണെങ്കിൽ അംശങ്ങൾ മാത്രം കൂട്ടിയാൽ മതി.'),
    steps: [
      { h: b('Numerator and denominator', 'അംശവും ഛേദവും'), p: b('In a fraction the top number is the numerator and the bottom number is the denominator. 3/8 means 3 of 8 equal parts.', 'ഭിന്നസംഖ്യയിൽ മുകളിലെ സംഖ്യ അംശം, താഴത്തേത് ഛേദം. 3/8 എന്നാൽ 8 തുല്യ ഭാഗങ്ങളിൽ 3 ഭാഗം.') },
      { h: b('Same denominator', 'ഛേദം ഒന്നെങ്കിൽ'), p: b('Add the numerators and keep the denominator as it is. 2/7 + 3/7 = 5/7.', 'അംശങ്ങൾ കൂട്ടുക, ഛേദം അതേപടി എഴുതുക. 2/7 + 3/7 = 5/7.') },
      { h: b('A whole one', 'മുഴുവൻ കിട്ടിയാൽ'), p: b('When the numerator equals the denominator the answer is 1. 3/8 + 5/8 = 8/8 = 1.', 'അംശവും ഛേദവും തുല്യമായാൽ ഉത്തരം 1 ആണ്. 3/8 + 5/8 = 8/8 = 1.') },
    ],
    quiz: [
      { q: n('1/5 + 2/5 = ?'), options: [n('3/10'), n('3/5'), n('2/5'), n('3/25')], answer: 1, why: b('Add the tops (1 + 2 = 3) and keep the bottom 5.', 'അംശങ്ങൾ കൂട്ടി (1 + 2 = 3), ഛേദം 5 അതേപടി.') },
      { q: n('3/9 + 4/9 = ?'), options: [n('7/18'), n('1/9'), n('7/9'), n('12/9')], answer: 2, why: b('3 + 4 = 7, the denominator stays 9.', '3 + 4 = 7, ഛേദം 9 തന്നെ.') },
      { q: n('5/12 + 7/12 = ?'), options: [n('12/24'), n('1'), n('35/12'), n('5/12')], answer: 1, why: b('5 + 7 = 12, so 12/12 = 1 whole.', '5 + 7 = 12, 12/12 = 1 (മുഴുവൻ).') },
    ],
  },
  {
    slug: 'hcf-by-listing-factors', cls: 6, subject: 'Maths',
    title: b('HCF by listing factors', 'ഘടകങ്ങൾ എഴുതി ഉസാഘ (HCF) കണ്ടെത്താം'),
    summary: b('The highest common factor is the biggest number that divides both numbers.', 'രണ്ട് സംഖ്യകളെയും ഹരിക്കുന്ന ഏറ്റവും വലിയ സംഖ്യയാണ് ഉസാഘ.'),
    steps: [
      { h: b('List the factors', 'ഘടകങ്ങൾ എഴുതുക'), p: b('Factors of 12: 1, 2, 3, 4, 6, 12. Factors of 18: 1, 2, 3, 6, 9, 18.', '12-ന്റെ ഘടകങ്ങൾ: 1, 2, 3, 4, 6, 12. 18-ന്റെ ഘടകങ്ങൾ: 1, 2, 3, 6, 9, 18.') },
      { h: b('Find the common ones', 'പൊതുഘടകങ്ങൾ'), p: b('The numbers in both lists: 1, 2, 3 and 6.', 'രണ്ട് പട്ടികയിലും വരുന്നവ: 1, 2, 3, 6.') },
      { h: b('Pick the biggest', 'ഏറ്റവും വലുത്'), p: b('The biggest common factor is the HCF. So the HCF of 12 and 18 is 6.', 'ഏറ്റവും വലിയ പൊതുഘടകമാണ് ഉസാഘ. അതുകൊണ്ട് 12, 18 എന്നിവയുടെ ഉസാഘ 6.') },
    ],
    quiz: [
      { q: b('HCF of 8 and 12?', '8, 12 എന്നിവയുടെ ഉസാഘ?'), options: [n('2'), n('4'), n('6'), n('24')], answer: 1, why: b('Common factors of 8 and 12 are 1, 2, 4. The biggest is 4.', '8, 12 എന്നിവയുടെ പൊതുഘടകങ്ങൾ 1, 2, 4. ഏറ്റവും വലുത് 4.') },
      { q: b('HCF of 15 and 25?', '15, 25 എന്നിവയുടെ ഉസാഘ?'), options: [n('1'), n('3'), n('5'), n('75')], answer: 2, why: b('Common factors: 1 and 5. The biggest is 5.', 'പൊതുഘടകങ്ങൾ: 1, 5. ഏറ്റവും വലുത് 5.') },
      { q: b('HCF of 7 and 9?', '7, 9 എന്നിവയുടെ ഉസാഘ?'), options: [n('1'), n('7'), n('9'), n('63')], answer: 0, why: b('7 and 9 share only the factor 1.', '7, 9 എന്നിവയ്ക്ക് പൊതുവായി 1 മാത്രം.') },
    ],
  },
  {
    slug: 'area-and-perimeter-of-a-rectangle', cls: 4, subject: 'Maths',
    title: b('Area and perimeter of a rectangle', 'ചതുരത്തിന്റെ വിസ്തീർണവും ചുറ്റളവും'),
    summary: b('Area is length × breadth. Perimeter is the distance around.', 'വിസ്തീർണം = നീളം × വീതി. ചുറ്റളവ് = ചുറ്റുമുള്ള ദൂരം.'),
    steps: [
      { h: b('Area = length × breadth', 'വിസ്തീർണം = നീളം × വീതി'), p: b('A rectangle 8 cm long and 5 cm wide has area 8 × 5 = 40 square cm.', '8 സെ.മീ നീളവും 5 സെ.മീ വീതിയുമുള്ള ചതുരത്തിന്റെ വിസ്തീർണം 8 × 5 = 40 ചതുരശ്ര സെ.മീ.') },
      { h: b('Perimeter', 'ചുറ്റളവ്'), p: b('Perimeter = 2 × (length + breadth). For 8 and 5 it is 2 × 13 = 26 cm.', 'ചുറ്റളവ് = 2 × (നീളം + വീതി). 8, 5 ആയാൽ 2 × 13 = 26 സെ.മീ.') },
      { h: b('A square', 'സമചതുരം'), p: b('In a square all sides are equal: area = side × side. Side 7 cm gives 49 square cm.', 'സമചതുരത്തിൽ എല്ലാ വശങ്ങളും തുല്യം: വിസ്തീർണം = വശം × വശം. 7 സെ.മീ വശമെങ്കിൽ 49 ചതുരശ്ര സെ.മീ.') },
    ],
    quiz: [
      { q: b('Area of a rectangle 9 cm by 4 cm?', '9 സെ.മീ × 4 സെ.മീ ചതുരത്തിന്റെ വിസ്തീർണം?'), options: [n('13'), n('26'), n('36'), n('40')], answer: 2, why: b('9 × 4 = 36 square cm.', '9 × 4 = 36 ചതുരശ്ര സെ.മീ.') },
      { q: b('Perimeter of a rectangle 6 cm by 4 cm?', '6 സെ.മീ × 4 സെ.മീ ചതുരത്തിന്റെ ചുറ്റളവ്?'), options: [n('10'), n('20'), n('24'), n('48')], answer: 1, why: b('2 × (6 + 4) = 20 cm.', '2 × (6 + 4) = 20 സെ.മീ.') },
      { q: b('Area of a square with side 6 cm?', '6 സെ.മീ വശമുള്ള സമചതുരത്തിന്റെ വിസ്തീർണം?'), options: [n('12'), n('24'), n('30'), n('36')], answer: 3, why: b('6 × 6 = 36 square cm.', '6 × 6 = 36 ചതുരശ്ര സെ.മീ.') },
    ],
  },
  {
    slug: 'percentage-of-a-number', cls: 7, subject: 'Maths',
    title: b('Finding a percentage of a number', 'ഒരു സംഖ്യയുടെ ശതമാനം കണ്ടെത്താം'),
    summary: b('Percent means “out of 100”. Multiply by the percent and divide by 100.', 'ശതമാനം എന്നാൽ “നൂറിൽ”. ശതമാനം കൊണ്ട് ഗുണിച്ച് 100 കൊണ്ട് ഹരിക്കുക.'),
    steps: [
      { h: b('Percent means out of 100', 'ശതമാനം എന്നാൽ നൂറിൽ'), p: b('25% means 25 out of 100, which is 25/100 = 1/4.', '25% എന്നാൽ നൂറിൽ 25, അതായത് 25/100 = 1/4.') },
      { h: b('A percentage of a number', 'ഒരു സംഖ്യയുടെ ശതമാനം'), p: b('25% of 80 = 80 × 25/100 = 20.', '80-ന്റെ 25% = 80 × 25/100 = 20.') },
      { h: b('The 10% shortcut', '10% എളുപ്പവഴി'), p: b('To find 10%, divide by 10. 10% of 250 = 25.', '10% കാണാൻ സംഖ്യയെ 10 കൊണ്ട് ഹരിക്കുക. 250-ന്റെ 10% = 25.') },
    ],
    quiz: [
      { q: b('20% of 150?', '150-ന്റെ 20%?'), options: [n('20'), n('30'), n('75'), n('300')], answer: 1, why: b('150 × 20/100 = 30.', '150 × 20/100 = 30.') },
      { q: b('5% of 200?', '200-ന്റെ 5%?'), options: [n('5'), n('10'), n('20'), n('40')], answer: 1, why: b('10% of 200 is 20, so 5% is half of it: 10.', '200-ന്റെ 10% = 20, 5% അതിന്റെ പകുതി: 10.') },
      { q: b('75% of 40?', '40-ന്റെ 75%?'), options: [n('10'), n('20'), n('30'), n('35')], answer: 2, why: b('40 × 75/100 = 30.', '40 × 75/100 = 30.') },
    ],
  },
  {
    slug: 'photosynthesis-how-plants-make-food', cls: 6, subject: 'Science',
    title: b('Photosynthesis: how plants make food', 'പ്രകാശസംശ്ലേഷണം: ചെടികൾ ഭക്ഷണം ഉണ്ടാക്കുന്നത്'),
    summary: b('Leaves use sunlight, water and carbon dioxide to make food and give out oxygen.', 'സൂര്യപ്രകാശം, വെള്ളം, കാർബൺ ഡൈ ഓക്സൈഡ് എന്നിവ കൊണ്ട് ഇലകൾ ഭക്ഷണം ഉണ്ടാക്കി ഓക്സിജൻ പുറത്തുവിടുന്നു.'),
    steps: [
      { h: b('What is needed', 'വേണ്ടത്'), p: b('Sunlight, water, carbon dioxide and the green pigment chlorophyll in the leaves.', 'സൂര്യപ്രകാശം, വെള്ളം, കാർബൺ ഡൈ ഓക്സൈഡ്, ഇലയിലെ ഹരിതകം (ക്ലോറോഫിൽ).') },
      { h: b('What happens in the leaf', 'ഇലയിൽ സംഭവിക്കുന്നത്'), p: b('Leaves take in carbon dioxide and roots take in water. With sunlight they make sugar, the plant’s food.', 'ഇലകൾ കാർബൺ ഡൈ ഓക്സൈഡ് വലിച്ചെടുക്കുന്നു, വേര് വെള്ളം എടുക്കുന്നു. സൂര്യപ്രകാശത്തിൽ ഇവ ചേർന്ന് പഞ്ചസാര (ചെടിയുടെ ഭക്ഷണം) ഉണ്ടാകുന്നു.') },
      { h: b('What comes out', 'പുറത്തുവിടുന്നത്'), p: b('Plants release oxygen, the gas we breathe.', 'ചെടികൾ ഓക്സിജൻ പുറത്തുവിടുന്നു; നമ്മൾ ശ്വസിക്കുന്നത് അതാണ്.') },
    ],
    quiz: [
      { q: b('Which gas do leaves take in for photosynthesis?', 'പ്രകാശസംശ്ലേഷണത്തിന് ഇലകൾ വലിച്ചെടുക്കുന്ന വാതകം?'), options: [b('Oxygen', 'ഓക്സിജൻ'), b('Carbon dioxide', 'കാർബൺ ഡൈ ഓക്സൈഡ്'), b('Nitrogen', 'നൈട്രജൻ'), b('Hydrogen', 'ഹൈഡ്രജൻ')], answer: 1, why: b('Leaves absorb carbon dioxide from the air.', 'ഇലകൾ വായുവിൽ നിന്ന് കാർബൺ ഡൈ ഓക്സൈഡ് എടുക്കുന്നു.') },
      { q: b('The green pigment in leaves is called?', 'ഇലകളിലെ പച്ച വർണ്ണവസ്തുവിന്റെ പേര്?'), options: [b('Chlorophyll', 'ക്ലോറോഫിൽ'), b('Haemoglobin', 'ഹീമോഗ്ലോബിൻ'), b('Keratin', 'കെരാറ്റിൻ'), b('Melanin', 'മെലാനിൻ')], answer: 0, why: b('Chlorophyll captures sunlight.', 'ക്ലോറോഫിൽ സൂര്യപ്രകാശം പിടിച്ചെടുക്കുന്നു.') },
      { q: b('Which gas do plants give out?', 'ചെടികൾ പുറത്തുവിടുന്ന വാതകം?'), options: [b('Carbon dioxide', 'കാർബൺ ഡൈ ഓക്സൈഡ്'), b('Oxygen', 'ഓക്സിജൻ'), b('Methane', 'മീഥേൻ'), b('Helium', 'ഹീലിയം')], answer: 1, why: b('Oxygen is released during photosynthesis.', 'പ്രകാശസംശ്ലേഷണത്തിൽ ഓക്സിജൻ പുറത്തുവരുന്നു.') },
    ],
  },
  {
    slug: 'solid-liquid-gas', cls: 5, subject: 'Science',
    title: b('Solid, liquid and gas', 'ഖരം, ദ്രാവകം, വാതകം'),
    summary: b('Matter comes in three states, and heating or cooling changes one into another.', 'ദ്രവ്യത്തിന് മൂന്ന് അവസ്ഥകൾ; ചൂടാക്കിയോ തണുപ്പിച്ചോ ഒന്നിൽ നിന്ന് മറ്റൊന്നാക്കാം.'),
    steps: [
      { h: b('Three states', 'മൂന്ന് അവസ്ഥകൾ'), p: b('A solid has its own shape. A liquid takes the shape of its container but keeps its volume. A gas spreads to fill the whole container.', 'ഖരത്തിന് സ്വന്തം ആകൃതി. ദ്രാവകം പാത്രത്തിന്റെ ആകൃതി എടുക്കും, അളവ് മാറില്ല. വാതകം പാത്രം മുഴുവൻ പരക്കും.') },
      { h: b('Heating', 'ചൂടാക്കുമ്പോൾ'), p: b('Ice melts into water (melting). Water turns into vapour (evaporation).', 'ഐസ് ഉരുകി വെള്ളമാകും (ഉരുകൽ). വെള്ളം നീരാവിയാകും (ബാഷ്പീകരണം).') },
      { h: b('Cooling', 'തണുപ്പിക്കുമ്പോൾ'), p: b('Vapour cooling into water is condensation. Water cooling into ice is freezing.', 'നീരാവി തണുത്ത് വെള്ളമാകുന്നത് ഘനീഭവിക്കൽ. വെള്ളം തണുത്ത് ഐസാകുന്നത് ഖരീഭവിക്കൽ.') },
    ],
    quiz: [
      { q: b('Which state has a fixed shape?', 'ഏത് അവസ്ഥയ്ക്കാണ് നിശ്ചിത ആകൃതി?'), options: [b('Solid', 'ഖരം'), b('Liquid', 'ദ്രാവകം'), b('Gas', 'വാതകം'), b('All of them', 'എല്ലാം')], answer: 0, why: b('Only solids keep their own shape.', 'ഖരത്തിന് മാത്രമാണ് സ്വന്തം ആകൃതി.') },
      { q: b('Water turning into vapour is called?', 'വെള്ളം നീരാവിയാകുന്നതിനെ പറയുന്നത്?'), options: [b('Freezing', 'ഖരീഭവിക്കൽ'), b('Condensation', 'ഘനീഭവിക്കൽ'), b('Evaporation', 'ബാഷ്പീകരണം'), b('Melting', 'ഉരുകൽ')], answer: 2, why: b('Liquid to gas is evaporation.', 'ദ്രാവകം വാതകമാകുന്നത് ബാഷ്പീകരണം.') },
      { q: b('Vapour cooling into water drops is called?', 'നീരാവി തണുത്ത് വെള്ളത്തുള്ളിയാകുന്നതിനെ പറയുന്നത്?'), options: [b('Melting', 'ഉരുകൽ'), b('Evaporation', 'ബാഷ്പീകരണം'), b('Freezing', 'ഖരീഭവിക്കൽ'), b('Condensation', 'ഘനീഭവിക്കൽ')], answer: 3, why: b('Gas to liquid is condensation.', 'വാതകം ദ്രാവകമാകുന്നത് ഘനീഭവിക്കൽ.') },
    ],
  },
];

export const lessonBySlug = (slug: string): PublicLesson | undefined => LESSONS.find((l) => l.slug === slug);
