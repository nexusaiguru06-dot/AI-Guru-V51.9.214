/**
 * DNA cards: what each picture-making DNA is for, in the words a textbook uses, in English and
 * Malayalam. The semantic selector (semantic.ts) embeds these once; a paragraph is compared with
 * every sentence of every card, so a Malayalam paragraph can find its DNA even when none of the
 * English keyword rules fire.
 *
 * The Malayalam sentences were drafted by the assistant. Have a Malayalam teacher read them
 * before they are trusted; wrong words here only weaken retrieval, they cannot break a lesson.
 */

import type { DnaId } from './types';

export interface DnaCard {
  id: DnaId;
  en: string[];
  ml: string[];
}

export const DNA_CARDS: DnaCard[] = [
  {
    id: 'plane-transform',
    en: [
      'A matrix can rotate every vector of the plane by the same angle.',
      'When a shape is reflected in a line, every point moves to the other side of the line at the same distance.',
      'Enlarge the triangle by a scale factor of 2 and shear the square.',
      'Where do the two basis vectors land after the linear transformation?',
    ],
    ml: [
      'ഒരു മാട്രിക്സ് തലത്തിലെ എല്ലാ വെക്ടറുകളെയും ഒരേ കോണിൽ തിരിക്കുന്നു.',
      'ഒരു രൂപത്തെ രേഖയിൽ പ്രതിഫലിപ്പിക്കുമ്പോൾ ഓരോ ബിന്ദുവും രേഖയുടെ മറുവശത്ത് അതേ അകലത്തിൽ എത്തുന്നു.',
      'ത്രികോണത്തെ ഇരട്ടി വലുതാക്കുക, ചതുരത്തെ ചരിക്കുക.',
      'രൂപാന്തരത്തിനു ശേഷം രണ്ട് അടിസ്ഥാന വെക്ടറുകൾ എവിടെ എത്തുന്നു?',
    ],
  },
  {
    id: 'matrix-grid',
    en: [
      'A matrix is a rectangular arrangement of numbers in rows and columns.',
      'The entry a23 lies in the second row and the third column.',
      'A matrix with the same number of rows and columns is a square matrix.',
      'A matrix with m rows and n columns has order m by n.',
    ],
    ml: [
      'വരികളിലും നിരകളിലുമായി സംഖ്യകളെ ചതുരാകൃതിയിൽ ക്രമീകരിച്ചതാണ് മാട്രിക്സ്.',
      'a23 എന്ന എൻട്രി രണ്ടാം വരിയിലും മൂന്നാം നിരയിലുമാണ്.',
      'വരികളുടെയും നിരകളുടെയും എണ്ണം തുല്യമായ മാട്രിക്സ് സമചതുര മാട്രിക്സ് ആണ്.',
      'm വരികളും n നിരകളുമുള്ള മാട്രിക്സിന്റെ ക്രമം m ഗുണം n ആണ്.',
    ],
  },
  {
    id: 'function-graph',
    en: [
      'The graph of the equation y = 2x + 1 is a straight line.',
      'Mark the points on the coordinate plane and join them with a smooth curve.',
      'The curve called a parabola crosses the x-axis at two points.',
      'The slope of a line tells how much y rises when x increases by one.',
    ],
    ml: [
      'y = 2x + 1 എന്ന സമവാക്യത്തിന്റെ ഗ്രാഫ് ഒരു നേർരേഖയാണ്.',
      'നിർദേശാങ്കതലത്തിൽ ബിന്ദുക്കൾ അടയാളപ്പെടുത്തി അവയെ യോജിപ്പിക്കുക.',
      'പരാബോള എന്ന വക്രം x അക്ഷത്തെ രണ്ട് ബിന്ദുക്കളിൽ മുറിക്കുന്നു.',
      'x ഒന്ന് കൂടുമ്പോൾ y എത്ര കൂടുന്നു എന്നതാണ് രേഖയുടെ ചരിവ്.',
    ],
  },
  {
    id: 'fraction-bars',
    en: [
      'Cut a whole into 4 equal parts and take 3 of them: that is the fraction three quarters.',
      'The numerator tells how many parts are taken and the denominator how many equal parts the whole has.',
      'Half of a pizza and two quarters of the same pizza are equivalent fractions.',
      '35 out of 100 squares are coloured, so the part is 35 percent.',
    ],
    ml: [
      'ഒരു വസ്തുവിനെ 4 തുല്യ ഭാഗങ്ങളാക്കി അതിൽ 3 ഭാഗം എടുത്താൽ അത് മുക്കാൽ ഭാഗമാണ്.',
      'അംശം എടുത്ത ഭാഗങ്ങളുടെ എണ്ണവും ഛേദം ആകെ തുല്യ ഭാഗങ്ങളുടെ എണ്ണവും കാണിക്കുന്നു.',
      'ഒരു പിസ്സയുടെ പകുതിയും അതേ പിസ്സയുടെ രണ്ട് കാൽ ഭാഗവും സമഭിന്നസംഖ്യകളാണ്.',
      '100 ചതുരങ്ങളിൽ 35 എണ്ണത്തിന് നിറം നൽകി, അതായത് 35 ശതമാനം.',
    ],
  },
  {
    id: 'histogram',
    en: [
      'The bar graph shows the marks of each child in the class.',
      'Find the mean and the median of the data.',
      'The frequency table lists how many students chose each fruit in the survey.',
      'The mean is the value every item would have if the total were shared equally.',
    ],
    ml: [
      'ബാർ ഗ്രാഫിൽ ക്ലാസിലെ ഓരോ കുട്ടിയുടെയും മാർക്ക് കാണിച്ചിരിക്കുന്നു.',
      'ഈ വിവരങ്ങളുടെ ശരാശരിയും മധ്യമവും കണ്ടെത്തുക.',
      'സർവേയിൽ ഓരോ പഴവും എത്ര കുട്ടികൾ തിരഞ്ഞെടുത്തു എന്ന് ആവൃത്തി പട്ടികയിൽ കാണിക്കുന്നു.',
      'ആകെ തുക തുല്യമായി പങ്കിട്ടാൽ ഓരോന്നിനും കിട്ടുന്ന വിലയാണ് ശരാശരി.',
    ],
  },
  {
    id: 'probability-tree',
    en: [
      'When a coin is tossed, the chance of getting a head is one half.',
      'A die is rolled; list all the possible outcomes.',
      'A bag has 2 red and 3 blue balls; one ball is drawn at random and not put back.',
      'How likely is it that both events happen? Draw a tree diagram.',
    ],
    ml: [
      'ഒരു നാണയം ടോസ് ചെയ്യുമ്പോൾ തല കിട്ടാനുള്ള സാധ്യത പകുതിയാണ്.',
      'ഒരു പകിട ഉരുട്ടുമ്പോൾ ലഭിക്കാവുന്ന എല്ലാ ഫലങ്ങളും എഴുതുക.',
      'ഒരു സഞ്ചിയിൽ 2 ചുവപ്പും 3 നീലയും പന്തുകളുണ്ട്; ഒരു പന്ത് എടുത്ത് തിരികെ ഇടാതെ വീണ്ടും എടുക്കുന്നു.',
      'രണ്ട് സംഭവങ്ങളും നടക്കാനുള്ള സാധ്യത എത്രയാണ്? ട്രീ ഡയഗ്രം വരയ്ക്കുക.',
    ],
  },
  {
    id: 'shape-formula',
    en: [
      'The area of a circle of radius r is pi r squared, and its circumference is two pi r.',
      'The area of a rectangle is its length times its width.',
      'In a right triangle the square on the hypotenuse equals the sum of the squares on the other two sides.',
      'In a 30-60-90 triangle the sides are in the ratio a, a root 3, 2a.',
    ],
    ml: [
      'r ആരമുള്ള വൃത്തത്തിന്റെ വിസ്തീർണം പൈ r വർഗം, ചുറ്റളവ് രണ്ട് പൈ r.',
      'ദീർഘചതുരത്തിന്റെ വിസ്തീർണം നീളം ഗുണം വീതി ആണ്.',
      'മട്ടത്രികോണത്തിൽ കർണത്തിന്റെ വർഗം മറ്റ് രണ്ട് വശങ്ങളുടെ വർഗങ്ങളുടെ തുകയാണ്.',
      '30-60-90 ത്രികോണത്തിൽ വശങ്ങളുടെ അനുപാതം a, a റൂട്ട് 3, 2a ആണ്.',
    ],
  },
  {
    id: 'venn-sets',
    en: [
      'The intersection of two sets A and B contains the elements that are in both sets.',
      'The union of A and B contains everything that is in A or in B or in both.',
      'The complement of A is the set of elements of the universal set that are not in A.',
      'Draw a Venn diagram and shade the region that represents A minus B.',
    ],
    ml: [
      'A, B എന്നീ രണ്ട് ഗണങ്ങളുടെയും ഛേദത്തിൽ രണ്ടിലും ഉള്ള അംഗങ്ങൾ ഉണ്ടായിരിക്കും.',
      'A-യിലോ B-യിലോ രണ്ടിലുമോ ഉള്ള എല്ലാ അംഗങ്ങളുമാണ് A, B എന്നിവയുടെ യോഗം.',
      'സാർവിക ഗണത്തിലെ A-യിൽ ഇല്ലാത്ത അംഗങ്ങളുടെ ഗണമാണ് A-യുടെ പൂരകം.',
      'ഒരു വെൻ ചിത്രം വരച്ച് A − B സൂചിപ്പിക്കുന്ന ഭാഗത്തിന് നിറം നൽകുക.',
    ],
  },
  {
    id: 'unit-circle',
    en: [
      'On a circle of radius 1, the cosine of an angle is the x coordinate of the point and the sine is the y coordinate.',
      'The tangent of an angle is the sine divided by the cosine.',
      'Secant is the reciprocal of cosine and cosecant is the reciprocal of sine.',
      'Sine squared theta plus cosine squared theta equals one.',
    ],
    ml: [
      'ആരം 1 ആയ വൃത്തത്തിൽ ഒരു കോണിന്റെ കോസ് ബിന്ദുവിന്റെ x നിർദേശാങ്കവും സൈൻ y നിർദേശാങ്കവുമാണ്.',
      'ഒരു കോണിന്റെ ടാൻ സൈനിനെ കോസ് കൊണ്ട് ഹരിച്ചതാണ്.',
      'സെക്കന്റ് കോസിന്റെ വ്യുൽക്രമവും കോസെക്കന്റ് സൈനിന്റെ വ്യുൽക്രമവുമാണ്.',
      'സൈൻ സ്ക്വയർ θ കൂടെ കോസ് സ്ക്വയർ θ ഒന്നിന് തുല്യമാണ്.',
    ],
  },
  {
    id: 'linear-system',
    en: [
      'A pair of linear equations in two variables can be solved by the graphical method: the point where the two lines meet is the solution.',
      'To solve the pair by elimination, multiply the equations so that the coefficients of one variable are equal, then add or subtract.',
      'In the substitution method we find one variable and put its value into the other equation.',
      'Write the simultaneous equations in matrix form as A x = b.',
    ],
    ml: [
      'രണ്ട് ചരങ്ങളിലുള്ള ഒരു ജോടി ഏകഘാത സമവാക്യങ്ങൾ ഗ്രാഫ് ഉപയോഗിച്ച് നിർധാരണം ചെയ്യാം: രണ്ട് രേഖകളും കൂടിമുട്ടുന്ന ബിന്ദുവാണ് ഉത്തരം.',
      'ഒരു ചരത്തിന്റെ ഗുണകങ്ങൾ തുല്യമാകുംവിധം സമവാക്യങ്ങളെ ഗുണിച്ച് കൂട്ടുകയോ കുറയ്ക്കുകയോ ചെയ്യുന്നതാണ് ഉന്മൂലന രീതി.',
      'ഒരു ചരത്തിന്റെ വില കണ്ടെത്തി മറ്റേ സമവാക്യത്തിൽ ആദേശം ചെയ്യുന്നതാണ് പ്രതിസ്ഥാപന രീതി.',
    ],
  },
  {
    id: 'arithmetic-sequence',
    en: [
      'In an arithmetic sequence each term is got by adding the same number, the common difference, to the term before it.',
      'The n-th term of an arithmetic sequence with first term a and common difference d is a plus n minus one times d.',
      'The sum of the first n terms is n over two times the sum of the first and last terms.',
      'Is 99 a term of the sequence 3, 7, 11, 15, and so on?',
    ],
    ml: [
      'ഒരു സമാന്തര ശ്രേണിയിൽ ഓരോ പദവും തൊട്ടുമുമ്പത്തെ പദത്തോട് ഒരേ സംഖ്യ, പൊതുവ്യത്യാസം, കൂട്ടിയാണ് കിട്ടുന്നത്.',
      'ആദ്യപദം a-യും പൊതുവ്യത്യാസം d-യും ആയ സമാന്തര ശ്രേണിയുടെ n-ാം പദം a + (n − 1)d ആണ്.',
      'ആദ്യത്തെ n പദങ്ങളുടെ തുക n/2 ഗുണം ആദ്യപദവും അവസാനപദവും കൂട്ടിയതാണ്.',
    ],
  },
  {
    id: 'quadratic-equation',
    en: [
      'A quadratic equation can be solved by factorising: split the middle term and group, so that a product equals zero.',
      'The discriminant b squared minus four a c tells us how many real roots the quadratic equation has.',
      'The roots of a x squared plus b x plus c equal to zero are given by the quadratic formula.',
      'The graph of a quadratic equation is a parabola, and its roots are where it meets the x-axis.',
    ],
    ml: [
      'മധ്യപദത്തെ വിഭജിച്ച് ഗ്രൂപ്പ് ചെയ്ത് ഘടകങ്ങളാക്കി ദ്വിമാന സമവാക്യം നിർധാരണം ചെയ്യാം.',
      'b² − 4ac എന്ന വിവേചകം ദ്വിമാന സമവാക്യത്തിന് എത്ര മൂലങ്ങളുണ്ടെന്ന് പറയുന്നു.',
      'ദ്വിമാന സമവാക്യത്തിന്റെ മൂലങ്ങൾ ദ്വിമാന സൂത്രവാക്യം ഉപയോഗിച്ച് കണ്ടെത്താം.',
    ],
  },
  {
    id: 'polynomial',
    en: [
      'The degree of a polynomial is the highest power of x, and the numbers in front of the powers are its coefficients.',
      'To divide a polynomial by x minus a, we divide term by term, and what is left at the end is the remainder.',
      'By the remainder theorem, the remainder on dividing P of x by x minus a is P of a.',
      'By the factor theorem, if P of a is zero then x minus a is a factor of the polynomial.',
    ],
    ml: [
      'ബഹുപദത്തിന്റെ കൃതി x-ന്റെ ഏറ്റവും വലിയ കൃതിയാണ്, കൃതികൾക്ക് മുന്നിലെ സംഖ്യകൾ ഗുണകങ്ങളാണ്.',
      'ശിഷ്ടപ്രമേയം: P(x)-നെ x − a കൊണ്ട് ഹരിച്ചാലുള്ള ശിഷ്ടം P(a) ആണ്.',
      'ഘടകപ്രമേയം: P(a) പൂജ്യമാണെങ്കിൽ x − a ബഹുപദത്തിന്റെ ഒരു ഘടകമാണ്.',
    ],
  },
  {
    id: 'angle-geometry',
    en: [
      'When a transversal cuts two parallel lines, the corresponding angles are equal and the alternate angles are equal.',
      'The co-interior angles between parallel lines add up to one hundred and eighty degrees.',
      'The three angles of a triangle add up to one hundred and eighty degrees, and an exterior angle equals the sum of the two interior opposite angles.',
      'The angle at the centre of a circle is twice the angle at the circumference on the same arc, and the angle in a semicircle is a right angle.',
      'The opposite angles of a cyclic quadrilateral add up to one hundred and eighty degrees.',
    ],
    ml: [
      'സമാന്തര രേഖകളെ ഒരു ഛേദകരേഖ മുറിച്ചാൽ സംഗത കോണുകളും ഏകാന്തര കോണുകളും തുല്യമാണ്.',
      'ഒരു ത്രികോണത്തിന്റെ മൂന്ന് കോണുകളുടെ തുക 180° ആണ്.',
      'വൃത്തകേന്ദ്രത്തിലെ കോൺ അതേ ചാപത്തിന്റെ വൃത്തപരിധിയിലെ കോണിന്റെ ഇരട്ടിയാണ്.',
    ],
  },
  {
    id: 'solid-figure',
    en: [
      'The volume of a cuboid is its length times its width times its height.',
      'The volume of a cylinder is pi r squared h, and its curved surface area is two pi r h.',
      'The volume of a cone is one third of pi r squared h, and its curved surface area is pi r l, where l is the slant height.',
      'The volume of a sphere is four thirds pi r cubed, and its surface area is four pi r squared.',
      'The surface of a prism opens out into a net of rectangles and two triangles.',
    ],
    ml: [
      'ഒരു ചതുരക്കട്ടയുടെ വ്യാപ്തം നീളം, വീതി, ഉയരം എന്നിവയുടെ ഗുണനഫലമാണ്.',
      'സിലിണ്ടറിന്റെ വ്യാപ്തം π r² h ആണ്, വക്രതല പരപ്പളവ് 2π r h ആണ്.',
      'വൃത്തസ്തൂപികയുടെ വ്യാപ്തം π r² h യുടെ മൂന്നിലൊന്നാണ്.',
      'ഗോളത്തിന്റെ വ്യാപ്തം π r³ യുടെ നാലിൽ മൂന്നിലൊന്ന് ഇരട്ടി ആണ്, പ്രതലപരപ്പളവ് 4π r² ആണ്.',
    ],
  },
  {
    id: 'ratio-percent',
    en: [
      'To share an amount in the ratio three to five, divide it into eight equal parts: three parts for one person and five for the other.',
      'One part is the total divided by the sum of the ratio numbers.',
      'Percent means out of one hundred, so twelve percent of a number is twelve over one hundred times the number.',
      'To increase a number by twenty percent, add twenty percent of it to the number.',
      'A discount of ten percent takes a tenth off the price.',
    ],
    ml: [
      'ഒരു തുക 3 : 5 എന്ന അംശബന്ധത്തിൽ പങ്കിടാൻ അതിനെ 8 തുല്യ ഭാഗങ്ങളാക്കി, 3 ഭാഗം ഒരാൾക്കും 5 ഭാഗം മറ്റൊരാൾക്കും കൊടുക്കുക.',
      'ഒരു ഭാഗം എന്നത് ആകെ തുകയെ അംശബന്ധ സംഖ്യകളുടെ തുക കൊണ്ട് ഹരിച്ചതാണ്.',
      'ശതമാനം എന്നാൽ നൂറിൽ എത്ര എന്നാണ്; ഒരു സംഖ്യയുടെ 12% എന്നത് {12/100} × സംഖ്യ ആണ്.',
      'ഒരു സംഖ്യ 20% കൂട്ടാൻ അതിന്റെ 20% സംഖ്യയോട് കൂട്ടുക.',
    ],
  },
  {
    id: 'pie-chart',
    en: [
      'In a pie chart the whole circle, three hundred and sixty degrees, stands for the total.',
      'The angle of a sector is the value divided by the total, times three hundred and sixty degrees.',
      'The angles of all the sectors add up to three hundred and sixty degrees.',
      'The percentage of a sector is its value divided by the total, times one hundred.',
    ],
    ml: [
      'പൈ ചാർട്ടിൽ 360° ഉള്ള മുഴുവൻ വൃത്തവും ആകെ തുകയെ കാണിക്കുന്നു.',
      'ഒരു സെക്ടറിന്റെ കോൺ അതിന്റെ വില ആകെ തുക കൊണ്ട് ഹരിച്ച് 360° കൊണ്ട് ഗുണിച്ചതാണ്.',
      'എല്ലാ സെക്ടറുകളുടെയും കോണുകൾ കൂട്ടിയാൽ 360° കിട്ടും.',
    ],
  },
  {
    id: 'coordinate-geometry',
    en: [
      'A point is written as an ordered pair: the x coordinate first, then the y coordinate.',
      'The axes divide the plane into four quadrants, numbered one to four anticlockwise from the top right.',
      'The distance between two points is the hypotenuse of a right triangle whose legs are the differences of the x and y coordinates.',
      'The midpoint of a segment has the average of the x coordinates and the average of the y coordinates.',
    ],
    ml: [
      'ഒരു ബിന്ദുവിനെ ക്രമജോടിയായി എഴുതുന്നു: ആദ്യം x, പിന്നെ y.',
      'അക്ഷങ്ങൾ തലത്തെ നാല് ചതുർഥാംശങ്ങളായി (quadrants) വിഭജിക്കുന്നു; മുകളിൽ വലത്തുനിന്ന് ഇടത്തോട്ട് തിരിഞ്ഞ് ഒന്ന് മുതൽ നാല് വരെ.',
      'രണ്ട് ബിന്ദുക്കൾ തമ്മിലുള്ള ദൂരം x, y വ്യത്യാസങ്ങൾ വശങ്ങളായ മട്ടത്രികോണത്തിന്റെ കർണമാണ്.',
      'ഒരു രേഖാഖണ്ഡത്തിന്റെ മധ്യബിന്ദുവിന് x-കളുടെ ശരാശരിയും y-കളുടെ ശരാശരിയും ആയിരിക്കും.',
    ],
  },
  {
    id: 'typeset-chain',
    en: [
      'The roots of the quadratic equation are x equals minus b plus or minus the square root of b squared minus 4ac, all over 2a.',
      'Simplify the square root and write the answer as a fraction.',
      'The determinant of a two by two matrix is ad minus bc.',
      'Square both sides to remove the square root, then solve for x.',
    ],
    ml: [
      'ദ്വിമാന സമവാക്യത്തിന്റെ മൂലങ്ങൾ x = (−b ± √(b² − 4ac)) / 2a ആണ്.',
      'വർഗമൂലം ലഘൂകരിച്ച് ഉത്തരം ഭിന്നസംഖ്യയായി എഴുതുക.',
      'രണ്ട് ഗുണിതം രണ്ട് മാട്രിക്സിന്റെ ഡിറ്റർമിനന്റ് ad − bc ആണ്.',
      'വർഗമൂലം ഒഴിവാക്കാൻ ഇരുവശവും വർഗിക്കുക, എന്നിട്ട് x കണ്ടെത്തുക.',
    ],
  },
  {
    id: 'quadratic-derivation',
    en: [
      'Where does the quadratic formula come from? Derive it by completing the square.',
      'Prove the quadratic formula: write x squared plus b x as a square with a piece missing, and complete it.',
      'We complete the square on x squared plus 6x plus 5 equals 0 and see why the formula works.',
      'Why does the quadratic formula work? Add the missing corner square, b over 2 squared, to both sides.',
    ],
    ml: [
      'ദ്വിമാന സൂത്രവാക്യം എവിടെനിന്ന് വരുന്നു? വർഗം പൂരിപ്പിച്ച് (completing the square) അത് ഉരുത്തിരിച്ചെടുക്കുക.',
      'ദ്വിമാന സൂത്രവാക്യം തെളിയിക്കുക: x² + bx എന്നത് ഒരു മൂല ഒഴിഞ്ഞ സമചതുരമായി കണ്ട് പൂർത്തിയാക്കുക.',
      'x² + 6x + 5 = 0 എന്നതിൽ വർഗം പൂരിപ്പിച്ച് സൂത്രവാക്യം എന്തുകൊണ്ട് ശരിയാകുന്നു എന്ന് കാണുക.',
      'ദ്വിമാന സൂത്രവാക്യം എന്തുകൊണ്ട് പ്രവർത്തിക്കുന്നു? ഒഴിഞ്ഞ മൂലച്ചതുരം (b/2)² ഇരുവശത്തും കൂട്ടുക.',
    ],
  },
  {
    id: 'hcf-lcm',
    en: [
      'Find the HCF and LCM of 12 and 18 using prime factorisation.',
      'The highest common factor is the product of the common prime factors; the lowest common multiple takes every prime the greatest number of times.',
      'Write 36 and 48 as products of primes, then find their HCF and LCM.',
      'HCF times LCM of two numbers equals the product of the numbers.',
    ],
    ml: [
      'അഭാജ്യ ഘടകക്രിയ ഉപയോഗിച്ച് 12, 18 എന്നിവയുടെ ഉസാഘ-യും ലസാഗു-വും കണ്ടെത്തുക.',
      'പൊതുവായ അഭാജ്യ ഘടകങ്ങളുടെ ഗുണനഫലമാണ് ഉസാഘ; എല്ലാ അഭാജ്യങ്ങളും കൂടുതൽ വരുന്ന തവണ എടുത്താൽ ലസാഗു കിട്ടും.',
      '36, 48 എന്നിവ അഭാജ്യ സംഖ്യകളുടെ ഗുണനഫലമായി എഴുതി ഉസാഘ-യും ലസാഗു-വും കണ്ടെത്തുക.',
      'രണ്ട് സംഖ്യകളുടെ ഉസാഘ × ലസാഗു = ആ സംഖ്യകളുടെ ഗുണനഫലം.',
    ],
  },
  {
    id: 'balance-scale',
    en: [
      'Solve 2x + 5 = 25 on a balance scale: the left pan holds two x tiles and 5, the right pan holds 25.',
      'Take 5 from both pans to keep the scale level, then share 20 between the two x tiles.',
      'Whatever you do to one side of an equation, do to the other side.',
      'To find x, undo the added number first, then undo the multiplication.',
    ],
    ml: [
      '2x + 5 = 25 ഒരു ത്രാസിൽ ചെയ്യുക: ഇടത് തട്ടിൽ രണ്ട് x-ഉം 5-ഉം, വലത് തട്ടിൽ 25.',
      'ത്രാസ് തുല്യമായി നിൽക്കാൻ രണ്ട് തട്ടിൽനിന്നും 5 എടുക്കുക; പിന്നെ 20 രണ്ട് x-കൾക്കായി പങ്കിടുക.',
      'സമവാക്യത്തിന്റെ ഒരു വശത്ത് ചെയ്യുന്നത് മറുവശത്തും ചെയ്യണം.',
      'x കണ്ടെത്താൻ കൂട്ടിയ സംഖ്യ ആദ്യം മാറ്റുക, പിന്നെ ഗുണനം മാറ്റുക.',
    ],
  },
  {
    id: 'square-identity',
    en: [
      'The square of the sum of two numbers: (a + b)² = a² + 2ab + b².',
      'Draw a square of side a + b and split it into a square a², two rectangles ab and a square b².',
      '(a − b)² = a² − 2ab + b².',
      'The difference of two squares: a² − b² = (a + b)(a − b).',
    ],
    ml: [
      'രണ്ട് സംഖ്യകളുടെ തുകയുടെ വർഗം: (a + b)² = a² + 2ab + b².',
      'a + b വശമുള്ള ഒരു സമചതുരം വരച്ച് a² സമചതുരം, ab വീതമുള്ള രണ്ട് ചതുരങ്ങൾ, b² സമചതുരം എന്നിങ്ങനെ വിഭജിക്കുക.',
      '(a − b)² = a² − 2ab + b².',
      'രണ്ട് വർഗങ്ങളുടെ വ്യത്യാസം: a² − b² = (a + b)(a − b).',
    ],
  },
  {
    id: 'area-figure',
    en: [
      'The area of a parallelogram is its base times its height.',
      'Cut a triangle off one end of a parallelogram and slide it to the other end to make a rectangle.',
      'The area of a trapezium is half of the sum of the parallel sides, times the height.',
      'Two equal trapeziums, one turned upside down, make a parallelogram.',
    ],
    ml: [
      'സമാന്തരീകത്തിന്റെ പരപ്പളവ് അടിവശം × ഉയരം ആണ്.',
      'സമാന്തരീകത്തിന്റെ ഒരറ്റത്തുനിന്ന് ഒരു ത്രികോണം മുറിച്ച് മറ്റേ അറ്റത്തേക്ക് നീക്കിയാൽ ഒരു ചതുരം കിട്ടും.',
      'ട്രപ്പീസിയത്തിന്റെ പരപ്പളവ് സമാന്തര വശങ്ങളുടെ തുകയുടെ പകുതി × ഉയരം ആണ്.',
      'രണ്ട് തുല്യ ട്രപ്പീസിയങ്ങൾ, ഒന്ന് തലകീഴായി വച്ചാൽ, ഒരു സമാന്തരീകമാകും.',
    ],
  },
  {
    id: 'matrix-ops',
    en: [
      'To multiply two matrices, each entry of the product is a row of the first times a column of the second, added up.',
      'You can multiply two matrices only when the columns of the first equal the rows of the second.',
      'The transpose of a matrix turns its rows into columns.',
      'A matrix with m rows and n columns has a transpose with n rows and m columns.',
    ],
    ml: [
      'രണ്ട് മാട്രിക്സുകൾ ഗുണിക്കാൻ, ഗുണനഫലത്തിലെ ഓരോ എൻട്രിയും ആദ്യത്തേതിലെ ഒരു വരിയും രണ്ടാമത്തേതിലെ ഒരു നിരയും ഗുണിച്ച് കൂട്ടിയതാണ്.',
      'ആദ്യത്തെ മാട്രിക്സിന്റെ നിരകളും രണ്ടാമത്തേതിന്റെ വരികളും തുല്യമാണെങ്കിൽ മാത്രമേ ഗുണിക്കാൻ കഴിയൂ.',
      'ഒരു മാട്രിക്സിന്റെ ട്രാൻസ്പോസ് അതിന്റെ വരികളെ നിരകളാക്കുന്നു.',
      'm വരിയും n നിരയുമുള്ള മാട്രിക്സിന്റെ ട്രാൻസ്പോസിന് n വരിയും m നിരയും ഉണ്ടായിരിക്കും.',
    ],
  },
  {
    id: 'fraction-line',
    en: [
      'On the number line the distance from zero to one is cut into equal parts, and the fraction tells how many parts to count.',
      'Equivalent fractions are the same point on the number line, seen on a line cut into more parts.',
      'To compare two fractions, write them with the same denominator and compare the numerators.',
      'To add fractions on the number line, start at the first and jump the length of the second.',
    ],
    ml: [
      'സംഖ്യാരേഖയിൽ പൂജ്യത്തിൽ നിന്ന് ഒന്നിലേക്കുള്ള ദൂരം തുല്യ ഭാഗങ്ങളാക്കുന്നു; ഭിന്നസംഖ്യ എത്ര ഭാഗം എണ്ണണം എന്ന് പറയുന്നു.',
      'സമാന ഭിന്നസംഖ്യകൾ സംഖ്യാരേഖയിലെ ഒരേ ബിന്ദുവാണ്, കൂടുതൽ ഭാഗങ്ങളായി മുറിച്ച രേഖയിൽ കാണുന്നു.',
      'രണ്ട് ഭിന്നസംഖ്യകൾ താരതമ്യം ചെയ്യാൻ ഛേദം ഒരുപോലെയാക്കി അംശങ്ങൾ താരതമ്യം ചെയ്യുക.',
      'സംഖ്യാരേഖയിൽ ഭിന്നസംഖ്യകൾ കൂട്ടാൻ ആദ്യത്തേതിൽ തുടങ്ങി രണ്ടാമത്തേതിന്റെ നീളം ചാടുക.',
    ],
  },
  {
    id: 'geometry-construction',
    en: [
      'Draw a triangle whose three sides are equal.',
      'Draw a line parallel to the given line through a point outside it.',
      'The diagonals of a rectangle bisect each other.',
    ],
    ml: [
      'മൂന്ന് വശങ്ങളും തുല്യമായ ഒരു ത്രികോണം വരയ്ക്കുക.',
      'തന്നിരിക്കുന്ന രേഖയ്ക്ക് പുറത്തുള്ള ഒരു ബിന്ദുവിലൂടെ അതിന് സമാന്തരമായ രേഖ വരയ്ക്കുക.',
      'ദീർഘചതുരത്തിന്റെ വികർണങ്ങൾ പരസ്പരം സമഭാഗിക്കുന്നു.',
    ],
  },
  {
    id: 'number-line',
    en: [
      'On the number line, negative numbers lie to the left of zero.',
      'Starting at 3 and moving 5 steps to the left, where do we reach?',
    ],
    ml: [
      'സംഖ്യാരേഖയിൽ പൂജ്യത്തിന്റെ ഇടതുവശത്താണ് നെഗറ്റീവ് സംഖ്യകൾ.',
      '3-ൽ നിന്ന് തുടങ്ങി 5 ചുവട് ഇടത്തേക്ക് നീങ്ങിയാൽ എവിടെ എത്തും?',
    ],
  },
];
