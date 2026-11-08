/**
 * The physics agent. Claims blocks about forces, motion, energy, electricity, light and heat; owns the templates
 * force-diagram and motion-graph, and (V51.9.148) projectile, pendulum, wave, circuit and optics; reads their
 * numbers straight from the text when there is no AI.
 */

import type { BookBlock } from '../../../motion-class/segment';
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { forceTemplate, type ForcePlan, type Dir } from './force-diagram';
import { motionTemplate, type MotionPlan } from './motion-graph';
import { projectileTemplate, type ProjectilePlan } from './projectile';
import { pendulumTemplate, type PendulumPlan } from './pendulum';
import { waveTemplate, type WavePlan } from './wave';
import { circuitTemplate, type CircuitPlan } from './circuit';
import { opticsTemplate, type OpticsPlan, type OptKind } from './optics';

const G = 10;

const WORDS: Array<[RegExp, number]> = [
  [/\b(force|forces|newton|newtons|friction|tension|weight|gravity|gravitational)\b/i, 0.35],
  [/\b(velocity|speed|acceleration|decelerat\w*|displacement|momentum|inertia|motion)\b/i, 0.35],
  [/\b(energy|work done|power|joule|watt|kinetic|potential)\b/i, 0.25],
  [/\b(current|voltage|resistance|circuit|ohm|magnet\w*|electric\w*|charge)\b/i, 0.25],
  [/\b(light|reflection|refraction|lens|mirror|wave|frequency|sound|pressure|heat|temperature)\b/i, 0.2],
  [/\b\d+(?:\.\d+)?\s*(?:N|kg|m\/s|m\/s²|m\/s\^2|J|W|V|A|Hz)\b/, 0.3],
  [/\b(projectile|pendulum|oscillat\w*|wavelength|amplitude|resistor|resistors|convex|concave|focal length|magnification|ray diagram)\b/i, 0.3],
  [/\d+(?:\.\d+)?\s*(?:Ω|ohms?)\b/i, 0.3],
  [/\b(time period|oscillat\w*|swings?|bob|projected|thrown|optical centre|principal axis)\b/i, 0.25],
];

const n1 = (m: RegExpMatchArray | null) => (m ? Number(m[1]) : undefined);
const STEP = (op: string, en: string, ml: string) => ({ op, say: { en, ml } });

function fromOptics(t: string): OpticsPlan | null {
  const k = t.match(/\b(convex|concave)\s+(lens|mirror)\b/i);
  if (!k) return null;
  const f = n1(t.match(/focal length\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)\s*cm/i));
  const u = n1(t.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:in front|from|away|before)/i)) ?? n1(t.match(/(?:object|placed)[^.]*?(?:at|distance(?: of)?)\s*(\d+(?:\.\d+)?)\s*cm/i));
  const h = n1(t.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:tall|high|long|in height)/i)) ?? n1(t.match(/height\s*(?:of|is)?\s*(\d+(?:\.\d+)?)\s*cm/i));
  if (!f || !u) return null;
  const kind = `${k[1].toLowerCase()}-${k[2].toLowerCase()}` as OptKind;
  const lens = k[2].toLowerCase() === 'lens';
  return {
    kind, focalCm: f, objectCm: u, ...(h ? { heightCm: h } : {}),
    steps: [
      STEP('show', `An object ${u} cm in front of a ${kind.replace('-', ' ')} of focal length ${f} cm.`, `ഫോക്കസ് ദൂരം ${f} സെ.മീ. ആയ ${lens ? 'ലെൻസിന്' : 'ദർപ്പണത്തിന്'} മുന്നിൽ ${u} സെ.മീ. അകലെ ഒരു വസ്തു.`),
      STEP('rays', lens ? 'Draw two rays: one parallel to the axis, one through the optical centre.' : 'Draw two rays: one parallel to the axis, one to the pole.', lens ? 'രണ്ടു രശ്മികൾ വരയ്ക്കാം: അക്ഷത്തിന് സമാന്തരമായതും പ്രകാശിക കേന്ദ്രത്തിലൂടെയുള്ളതും.' : 'രണ്ടു രശ്മികൾ വരയ്ക്കാം: അക്ഷത്തിന് സമാന്തരമായതും ധ്രുവത്തിലേക്കുള്ളതും.'),
      STEP('image', 'The image forms where the rays meet, or seem to meet.', 'രശ്മികൾ കൂടിച്ചേരുന്നിടത്തോ, കൂടിച്ചേരുന്നതായി തോന്നുന്നിടത്തോ പ്രതിബിംബം.'),
      STEP('formula', lens ? 'The lens formula gives the image distance.' : 'The mirror formula gives the image distance.', lens ? 'ലെൻസ് സമവാക്യം പ്രതിബിംബ ദൂരം നൽകുന്നു.' : 'ദർപ്പണ സമവാക്യം പ്രതിബിംബ ദൂരം നൽകുന്നു.'),
      STEP('magnification', 'The magnification tells the size of the image and whether it is inverted.', 'ആവർധനം പ്രതിബിംബത്തിന്റെ വലുപ്പവും തലകീഴാണോ എന്നും പറയുന്നു.'),
    ],
  } as OpticsPlan;
}

function fromCircuit(t: string): CircuitPlan | null {
  if (!/(resist|ohm|Ω|circuit)/i.test(t)) return null;
  const V = n1(t.match(/(\d+(?:\.\d+)?)\s*(?:V|volts?)\b/i));
  const rs = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:Ω|ohms?)\b/gi)].map((m) => Number(m[1])).slice(0, 4);
  if (!V || !rs.length) return null;
  const connection = /parallel/i.test(t) ? 'parallel' : 'series';
  return {
    voltage: V, resistors: rs, connection,
    steps: [
      STEP('show', `A ${V} volt battery with ${rs.length > 1 ? `${rs.length} resistors in ${connection}` : 'a resistor'}.`, `${V} വോൾട്ട് ബാറ്ററിയും ${rs.length > 1 ? (connection === 'series' ? 'ശ്രേണിയിൽ' : 'സമാന്തരമായി') : ''} പ്രതിരോധകങ്ങളും.`),
      ...(rs.length > 1 ? [STEP('total', connection === 'series' ? 'In series, the resistances add up.' : 'In parallel, the reciprocals add up, so the total is smaller than each.', connection === 'series' ? 'ശ്രേണിയിൽ പ്രതിരോധങ്ങൾ കൂട്ടുന്നു.' : 'സമാന്തരമായാൽ വ്യുൽക്രമങ്ങൾ കൂട്ടുന്നു; ആകെ പ്രതിരോധം ഓരോന്നിനേക്കാളും കുറവ്.')] : []),
      STEP('current', "Ohm's law: current equals voltage divided by resistance.", 'ഓം നിയമം: കറന്റ് = വോൾട്ടത ÷ പ്രതിരോധം.'),
      ...(rs.length > 1 ? [STEP('share', connection === 'series' ? 'The same current flows through each, so each takes its share of the voltage.' : 'Each branch has the full voltage, so each takes its own current.', connection === 'series' ? 'ഓരോന്നിലൂടെയും ഒരേ കറന്റ്; ഓരോന്നിനും വോൾട്ടതയുടെ പങ്ക്.' : 'ഓരോ ശാഖയിലും മുഴുവൻ വോൾട്ടത; ഓരോന്നിലും സ്വന്തം കറന്റ്.')] : []),
      ...(/power|watt/i.test(t) ? [STEP('power', 'Power is voltage times current.', 'പവർ = വോൾട്ടത × കറന്റ്.')] : []),
    ],
  } as CircuitPlan;
}

function fromWave(t: string): WavePlan | null {
  if (!/(wave|frequency|wavelength)/i.test(t)) return null;
  const khz = n1(t.match(/(\d+(?:\.\d+)?)\s*kHz/i));
  const f = khz !== undefined ? khz * 1000 : n1(t.match(/(\d+(?:\.\d+)?)\s*Hz\b/));
  const lambda = n1(t.match(/wavelength\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)\s*m\b/i)) ?? (() => { const cm = n1(t.match(/wavelength\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)\s*cm\b/i)); return cm !== undefined ? cm / 100 : undefined; })();
  const v = n1(t.match(/(\d+(?:\.\d+)?)\s*m\s*\/\s*s\b/i)) ?? n1(t.match(/(\d+(?:\.\d+)?)\s*m s⁻¹/i));
  const given = [f, lambda, v].filter((x) => x !== undefined).length;
  if (given !== 2) return null;
  const kind = (t.match(/\b(sound|water|light|radio)\b/i) || [])[1];
  return {
    ...(f !== undefined ? { f } : {}), ...(lambda !== undefined ? { lambda } : {}), ...(v !== undefined ? { v } : {}), ...(kind ? { kind: `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} wave` } : {}),
    steps: [
      STEP('show', 'A wave has crests and troughs; the amplitude is the height of a crest.', 'തരംഗത്തിന് ശൃംഗങ്ങളും ഗർത്തങ്ങളും; ശൃംഗത്തിന്റെ ഉയരമാണ് ആയതി.'),
      STEP('wavelength', 'The distance between two crests next to each other is the wavelength.', 'അടുത്തടുത്ത രണ്ടു ശൃംഗങ്ങൾ തമ്മിലുള്ള ദൂരമാണ് തരംഗദൈർഘ്യം.'),
      STEP('frequency', 'The frequency is the number of waves passing each second.', 'ഓരോ സെക്കൻഡിലും കടന്നുപോകുന്ന തരംഗങ്ങളുടെ എണ്ണമാണ് ആവൃത്തി.'),
      STEP('speed', 'Wave speed equals frequency times wavelength.', 'തരംഗവേഗം = ആവൃത്തി × തരംഗദൈർഘ്യം.'),
    ],
  } as WavePlan;
}

function fromPendulum(t: string): PendulumPlan | null {
  if (!/pendulum/i.test(t)) return null;
  const mm = n1(t.match(/(\d+(?:\.\d+)?)\s*m\b(?!\s*\/)/));
  const cm = n1(t.match(/(\d+(?:\.\d+)?)\s*cm\b/));
  const L = mm ?? (cm !== undefined ? cm / 100 : undefined);
  if (!L) return null;
  return {
    lengthM: L, ...(/9\.8/.test(t) ? { g: 9.8 } : {}),
    steps: [
      STEP('show', `A simple pendulum ${L} metre${L === 1 ? '' : 's'} long.`, `${L} മീറ്റർ നീളമുള്ള ഒരു ലഘു പെൻഡുലം.`),
      STEP('swing', 'Let it go: it swings there and back again and again.', 'വിട്ടാൽ അത് ആവർത്തിച്ച് ആടുന്നു.'),
      STEP('period', 'The time for one full swing is the period: two pi root L over g.', 'ഒരു പൂർണ ദോലനത്തിനുള്ള സമയമാണ് പീരിയഡ്.'),
      STEP('compare', 'A pendulum four times as long takes twice as long for each swing.', 'നാലു മടങ്ങ് നീളമുള്ള പെൻഡുലത്തിന് ഇരട്ടി സമയം.'),
    ],
  } as PendulumPlan;
}

function fromProjectile(t: string): ProjectilePlan | null {
  if (!/(projectile|thrown|projected|launched|kicked|fired)/i.test(t)) return null;
  const u = n1(t.match(/(\d+(?:\.\d+)?)\s*m\s*\/\s*s\b/i));
  const a = n1(t.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)\b/i));
  if (!u || !a) return null;
  return {
    u, angle: a, ...(/9\.8/.test(t) ? { g: 9.8 } : {}),
    steps: [
      STEP('show', `Thrown at ${u} metres per second, ${a} degrees above the ground.`, `${u} m/s വേഗത്തിൽ, ${a}° കോണിൽ എറിയുന്നു.`),
      STEP('split', 'Split the velocity into sideways and upward parts.', 'പ്രവേഗത്തെ തിരശ്ചീനവും ലംബവുമായ ഭാഗങ്ങളാക്കുക.'),
      STEP('path', 'Gravity bends the path into a parabola.', 'ഗുരുത്വം പാതയെ ഒരു പരാബോളയാക്കുന്നു.'),
      STEP('time', 'Time of flight: up and back down.', 'പറക്കൽ സമയം: മുകളിലേക്കും തിരിച്ചും.'),
      STEP('height', 'The greatest height is reached halfway.', 'പകുതി സമയത്ത് ഏറ്റവും കൂടിയ ഉയരം.'),
      STEP('range', 'Range is sideways speed times time of flight.', 'പരിധി = തിരശ്ചീന വേഗം × പറക്കൽ സമയം.'),
    ],
  } as ProjectilePlan;
}

const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fromForces(text: string): ForcePlan | null {
  const mass = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  const obj = text.match(/\b(block|box|trolley|cart|car|ball|crate|body|object|book|stone)\b/i);
  const forces: ForcePlan['forces'] = [];
  const re = /(\d+(?:\.\d+)?)\s*N\b/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text))) {
    const n = Number(mm[1]);
    const before = text.slice(Math.max(0, mm.index - 45), mm.index).toLowerCase();
    const after = text.slice(mm.index, mm.index + 20).toLowerCase();
    const ctx = `${before} ${after}`;
    let f: ForcePlan['forces'][number] | null = null;
    if (/friction|resist|drag|oppos|brak/.test(ctx)) f = { sym: 'f', name: { en: 'friction', ml: 'ഘർഷണം' }, dir: 'left', n };
    else if (/weight/.test(ctx)) f = { sym: 'W', name: { en: 'weight', ml: 'ഭാരം' }, dir: 'down', n };
    else if (/normal|reaction/.test(ctx)) f = { sym: 'N', name: { en: 'normal force', ml: 'ലംബബലം' }, dir: 'up', n };
    else if (/tension/.test(ctx)) f = { sym: 'T', name: { en: 'tension', ml: 'വലിവ്' }, dir: 'up', n };
    else if (/push|pull|appl|force of|force|pressed|dragged/.test(ctx)) f = { sym: 'F', name: { en: 'applied force', ml: 'പ്രയോഗിച്ച ബലം' }, dir: 'right', n };
    if (f && !forces.some((x) => x.sym === f!.sym)) forces.push(f);
  }
  if (!forces.length || !forces.some((f) => f.dir === 'left' || f.dir === 'right')) return null;
  const massKg = mass ? Number(mass[1]) : undefined;
  if (massKg && !forces.some((f) => f.sym === 'W') && !forces.some((f) => f.sym === 'T')) {
    forces.push({ sym: 'W', name: { en: 'weight', ml: 'ഭാരം' }, dir: 'down', n: massKg * G }, { sym: 'N', name: { en: 'normal force', ml: 'ലംബബലം' }, dir: 'up', n: massKg * G });
  }
  const label = pretty(obj ? obj[1].toLowerCase() : 'Object');
  const steps: ForcePlan['steps'] = [{ op: 'show', say: { en: `Here is the ${label.toLowerCase()}${massKg ? ` (${massKg} kg)` : ''}. Let us find every force on it.`, ml: `ഇതാ ${label}${massKg ? ` (${massKg} kg)` : ''}. അതിലുള്ള ബലങ്ങളെല്ലാം കണ്ടെത്താം.` } }];
  forces.forEach((f, i) => {
    const dirEn: Record<Dir, string> = { up: 'up', down: 'down', left: 'to the left', right: 'to the right' };
    const dirMl: Record<Dir, string> = { up: 'മുകളിലേക്ക്', down: 'താഴേക്ക്', left: 'ഇടത്തേക്ക്', right: 'വലത്തേക്ക്' };
    steps.push({ op: 'force', i, say: { en: `${pretty(f.name.en)}: ${f.n} N ${dirEn[f.dir]}.`, ml: `${f.name.ml}: ${f.n} N ${dirMl[f.dir]}.` } });
  });
  steps.push({ op: 'net', say: { en: 'Add the forces along each line. Forces that balance cancel; the rest is the net force.', ml: 'ഓരോ രേഖയിലെയും ബലങ്ങൾ കൂട്ടുക. തുല്യമായവ ഇല്ലാതാകും; ബാക്കിയാണ് ആകെ ബലം.' } });
  if (massKg) {
    steps.push({ op: 'accel', say: { en: 'Acceleration is the net force divided by the mass.', ml: 'ത്വരണം = ആകെ ബലം ÷ പിണ്ഡം.' } });
    steps.push({ op: 'answer', say: { en: 'That is how fast the speed changes every second.', ml: 'ഓരോ സെക്കൻഡിലും വേഗം മാറുന്ന അളവാണിത്.' } });
  }
  return { object: { label, ...(massKg ? { massKg } : {}) }, forces: forces.slice(0, 5), steps };
}

function fromMotion(text: string): MotionPlan | null {
  const t1 = text.replace(/,/g, ' ');
  const rest = /\b(from rest|at rest|starts? from rest|starts? at rest)\b/i.test(t1);
  const u = t1.match(/\b(?:initial (?:velocity|speed)|u)\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)/i);
  const a = t1.match(/\b(?:uniform )?(?:acceleration|a)\s*(?:of|is|=)?\s*(-?\d+(?:\.\d+)?)/i);
  const tm = t1.match(/\b(?:for|in|time|t)\s*(?:=|of|is)?\s*(\d+)\s*(?:s|sec|seconds)\b/i) || t1.match(/\bt\s*=\s*(\d+)/i);
  if (!a || !tm || (!u && !rest)) return null;
  let av = Number(a[1]);
  if (/decelerat|retard|slows? down|brak/i.test(t1) && av > 0) av = -av;
  const uv = u ? Number(u[1]) : 0;
  const tv = Number(tm[1]);
  const v = uv + av * tv;
  const s = ((uv + v) / 2) * tv;
  const plan: MotionPlan = {
    u: uv, a: av, t: tv,
    steps: [
      { op: 'show', say: { en: `Starting speed ${uv} m/s, acceleration ${av} m/s², for ${tv} s.`, ml: `ആദ്യവേഗം ${uv} m/s, ത്വരണം ${av} m/s², ${tv} സെക്കൻഡ് നേരം.` } },
      { op: 'graph', say: { en: 'On a speed–time graph the motion is a straight line.', ml: 'വേഗം–സമയ ഗ്രാഫിൽ ഈ ചലനം ഒരു നേർരേഖയാണ്.' } },
      { op: 'slope', say: { en: 'The slope of the line is the acceleration.', ml: 'രേഖയുടെ ചരിവ് ത്വരണമാണ്.' } },
      { op: 'area', say: { en: 'The area under the line is the distance travelled.', ml: 'രേഖയ്ക്ക് താഴെയുള്ള പരപ്പളവ് സഞ്ചരിച്ച ദൂരമാണ്.' } },
      { op: 'answer', say: { en: `So the distance is ${s} metres.`, ml: `അതിനാൽ ദൂരം ${s} മീറ്റർ.` } },
    ],
  };
  return plan;
}

export const physicsAgent: SubjectAgent = {
  id: 'physics',
  name: 'Physics agent',
  templates: [forceTemplate, motionTemplate, projectileTemplate, pendulumTemplate, waveTemplate, circuitTemplate, opticsTemplate],
  claim: (b: BookBlock, ctx) => score(b, ctx, WORDS, 'physics'),
  fromText(b) {
    const text = b.text.replace(/\s+/g, ' ');
    const op = fromOptics(text);
    if (op) return { template: 'optics', teach: op };
    const ci = fromCircuit(text);
    if (ci) return { template: 'circuit', teach: ci };
    const pe = fromPendulum(text);
    if (pe) return { template: 'pendulum', teach: pe };
    const pr = fromProjectile(text);
    if (pr) return { template: 'projectile', teach: pr };
    const wa = fromWave(text);
    if (wa) return { template: 'wave', teach: wa };
    const mo = fromMotion(text);
    if (mo && !/\d+\s*N\b/.test(text)) return { template: 'motion-graph', teach: mo };
    const fo = fromForces(text);
    if (fo) return { template: 'force-diagram', teach: fo };
    return mo ? { template: 'motion-graph', teach: mo } : null;
  },
  system: `You are the PHYSICS planning agent of a school classroom (Kerala / CBSE, classes 8–10). You turn ONE textbook block into a plan for ONE of seven fixed picture templates. The app draws everything and computes every number written on the board; you choose the template, give the data from the block and write the captions.
Reply with ONE JSON object: {"template":"<id>","teach":{...},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}.
Every teach has "steps": [{"op":"...","say":{"en":"...","ml":"..."}}] — the ops listed for its template, in that order, each at most once, starting with "show".
- "force-diagram": forces on an object: {"object":{"label":"Block","massKg":5},"forces":[{"sym":"F","name":{"en":"push","ml":"..."},"dir":"right"|"left"|"up"|"down","n":20}],"steps":[show, force (one per force, with "i"), net, accel, answer]}. 1–5 forces; accel/answer need massKg.
- "motion-graph": uniform acceleration: {"u":4,"a":2,"t":6,"steps":[show, graph, slope, area, answer]}; v = u + a t must stay ≥ 0.
- "projectile": {"u":20,"angle":30,"g":10,"steps":[show, split, path, time, height, range]}: speed m/s, angle 10–80° above the ground, g 10 or 9.8.
- "pendulum": {"lengthM":1,"g":10,"steps":[show, swing, period, compare]} ("period" required): T = 2π√(L/g); compare shows a pendulum 4× as long.
- "wave": exactly two of {"f":Hz,"lambda":metres,"v":m/s}, optional "kind":"Sound wave", "steps":[show, wavelength, frequency, period, speed] ("speed" required; it computes the missing one).
- "circuit": {"voltage":12,"resistors":[2,4],"connection":"series"|"parallel","steps":[show, total, current, share, power]} ("current" required): 1–4 resistors in ohms.
- "optics": {"kind":"convex-lens"|"concave-lens"|"concave-mirror"|"convex-mirror","focalCm":10,"objectCm":30,"heightCm":3,"steps":[show, rays, image, formula, magnification]} ("image" required): focal length and object distance as POSITIVE cm (the app applies the sign convention).
Captions are spoken: one idea, 6–22 words, bilingual {"en","ml"} (natural Malayalam; keep symbols and digits). Do not write computed results in captions unless you are sure: the board shows them.
If the block is not a problem any template can draw, reply {"template":null}.`,
};
