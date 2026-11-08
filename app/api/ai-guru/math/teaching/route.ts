import { NextResponse } from 'next/server';
import { detectMathDomain } from '@/lib/ai-guru/math/universal';
import { generateTeachingLesson } from '@/lib/ai-guru/math/teaching';
import { compileAIGuruTeachingLesson } from '@/lib/ai-guru/math/animation';
import { evaluateTeachingLesson } from '@/lib/ai-guru/math/teaching/quality';
import { buildLocalTeacherLesson, buildTemplateTeacherLesson, recoverMissingVisualTeaching, repairTeacherVisualLayout } from '@/lib/ai-guru/math/teaching/lesson-planner';
import { buildSolverLesson } from '@/lib/ai-guru/math/teaching/offline-template-lesson';
import {
  selectTeachingTemplate,
  applyTemplateSelectionGrammar,
  buildMandatoryTemplateLesson,
} from '@/lib/ai-guru/math/teaching/template-selector';

/**
 * Compile + QA a lesson without throwing away the QA report. The teaching route
 * uses this assessment object to implement QA -> repair -> recompile -> QA.
 */
async function assessLesson(lesson: import('@/lib/ai-guru/math/teaching/types').AIGuruTeachingLesson, language: 'english' | 'malayalam', requireBoard = false) {
  const quality = await evaluateTeachingLesson(lesson);
  lesson.quality = quality;
  lesson.segments.forEach(segment => { segment.mathematics.verified = quality.checks['math-correctness'] === true; });
  const compiled = compileAIGuruTeachingLesson(lesson, { teachingLanguage: language, id: `3b1b:qa:${lesson.id}` });
  const creates = lesson.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => a.type === 'create')));
  const motions = lesson.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => ['recolor','highlight','transform','move','draw'].includes(a.type))));
  const transforms = lesson.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => a.type === 'transform')));
  const boardGate = !requireBoard || (creates.length >= 2 && motions.length >= 1 && transforms.length >= 1);
  const boardError = boardGate ? '' : `Mandatory 3B1B template board missing: creates=${creates.length} motions=${motions.length} transforms=${transforms.length}.`;
  return { quality, compiled, passed: boardGate && quality.passed && compiled.warnings.length === 0, boardError };
}

/**
 * QA -> repair -> recompile -> QA. Three repair passes are allowed. A failed
 * scene is never returned to the browser; 422 is emitted only after exhaustion.
 */
async function qaRepairRecompileLoop(
  initialLesson: import('@/lib/ai-guru/math/teaching/types').AIGuruTeachingLesson,
  input: Parameters<typeof generateTeachingLesson>[0],
  selection: Awaited<ReturnType<typeof selectTeachingTemplate>>,
  language: 'english' | 'malayalam',
  source: string,
  extraWarnings: string[] = [],
  requireBoard = false,
  allowAiRegeneration = true,
) {
  let lesson = initialLesson;
  const attempts: Array<{pass:number;stage:string;passed:boolean;issues:string[]}> = [];
  // Deterministic mandatory templates do not need three identical repair cycles.
  // One deterministic repair is enough; if it still fails, reject immediately.
  const maxRepairs = allowAiRegeneration ? 3 : (requireBoard ? 1 : 3);

  const recordAndReturn = async (stage: string, pass: number, candidate: typeof lesson) => {
    candidate = applyTemplateSelectionGrammar(repairTeacherVisualLayout(candidate), selection);
    const assessment = await assessLesson(candidate, language, requireBoard);
    const issues = [assessment.boardError, ...assessment.quality.issues, ...assessment.compiled.warnings].filter(Boolean).slice(0,12);
    attempts.push({ pass, stage, passed: assessment.passed, issues });
    console.info('[AI Guru][3B1B][QA]', { source, pass, stage, passed: assessment.passed, issues });
    return { candidate, assessment, issues };
  };

  // Initial compilation + QA. No scene reaches the browser before this gate.
  let checked = await recordAndReturn('initial-qa', 0, lesson);
  lesson = checked.candidate;
  if (checked.assessment.passed) {
    return NextResponse.json({
      ok: true, source, lesson, scene: checked.assessment.compiled.scene,
      sceneGraph: { persistentIds: [...checked.assessment.compiled.sceneGraph.persistentIds], objectIds: [...checked.assessment.compiled.sceneGraph.objects.keys()] },
      quality: checked.assessment.quality,
      warnings: [...new Set([...checked.assessment.compiled.warnings, ...checked.assessment.quality.issues, ...extraWarnings])],
      template: { archetype: lesson.visualGrammar?.archetype, dnaIds: lesson.visualGrammar?.dnaIds, constructionPattern: lesson.visualGrammar?.constructionPattern, motifs: lesson.visualGrammar?.motifs },
      regeneration: { required: false, attempts },
    }, { status: 200 });
  }

  for (let repairPass = 1; repairPass <= maxRepairs; repairPass++) {
    console.warn('[AI Guru][3B1B][QA] FAIL -> REPAIR', { source, repairPass, issues: checked.issues });

    // Step 1: deterministic repair. This preserves source cues, verified math and DNA.
    lesson = repairTeacherVisualLayout(recoverMissingVisualTeaching(lesson, input));

    // Step 2: recompile + QA the repair BEFORE asking an AI to regenerate anything.
    checked = await recordAndReturn(`repair-${repairPass}-qa`, repairPass, lesson);
    lesson = checked.candidate;
    if (checked.assessment.passed) {
      return NextResponse.json({
        ok: true, source, lesson, scene: checked.assessment.compiled.scene,
        sceneGraph: { persistentIds: [...checked.assessment.compiled.sceneGraph.persistentIds], objectIds: [...checked.assessment.compiled.sceneGraph.objects.keys()] },
        quality: checked.assessment.quality,
        warnings: [...new Set([...checked.assessment.compiled.warnings, ...checked.assessment.quality.issues, ...extraWarnings])],
        template: { archetype: lesson.visualGrammar?.archetype, dnaIds: lesson.visualGrammar?.dnaIds, constructionPattern: lesson.visualGrammar?.constructionPattern, motifs: lesson.visualGrammar?.motifs },
        regeneration: { required: false, attempts },
      }, { status: 200 });
    }

    // Step 3: fresh AI regeneration using the exact post-repair QA report. The new
    // lesson is then compiled and QA'd at the top of the next repair iteration.
    if (allowAiRegeneration && (input.byokKey || input.openaiKey || process.env.GEMINI_API_KEY)) {
      try {
        const regenerated = await generateTeachingLesson({
          ...input,
          repairInstructions: [
            `REPAIR PASS ${repairPass}/${maxRepairs}.`,
            'The repaired scene still failed QA. Generate a COMPLETE replacement lesson, not a patch.',
            'Required pipeline: repair -> recompile -> QA. Never weaken, bypass, or delete QA rules.',
            ...checked.issues.map(issue => `QA FAILURE: ${issue}`),
            'Fix text/LaTeX overlap by changing positions or staging with erase/transform; never leave colliding live nodes.',
            'Preserve the selected Video-DNA grammar and Teacher-Reading source cues.',
            'Use full-board 3B1B visuals: token-level equation transforms, moving terms/digits, highlights and colour changes. Detailed prose belongs in narration, not the board.',
          ].join('\n'),
        });
        lesson = applyTemplateSelectionGrammar(regenerated, selection);
        // Loop immediately re-enters at the compile+QA gate. Nothing is returned yet.
        console.info('[AI Guru][3B1B][QA] fresh regeneration complete', { source, repairPass });
        checked = await recordAndReturn(`regenerated-${repairPass}-qa`, repairPass, lesson);
        lesson = checked.candidate;
        if (checked.assessment.passed) {
          return NextResponse.json({
            ok: true, source, lesson, scene: checked.assessment.compiled.scene,
            sceneGraph: { persistentIds: [...checked.assessment.compiled.sceneGraph.persistentIds], objectIds: [...checked.assessment.compiled.sceneGraph.objects.keys()] },
            quality: checked.assessment.quality,
            warnings: [...new Set([...checked.assessment.compiled.warnings, ...checked.assessment.quality.issues, ...extraWarnings])],
            template: { archetype: lesson.visualGrammar?.archetype, dnaIds: lesson.visualGrammar?.dnaIds, constructionPattern: lesson.visualGrammar?.constructionPattern, motifs: lesson.visualGrammar?.motifs },
            regeneration: { required: false, attempts },
          }, { status: 200 });
        }
      } catch (error) {
        console.warn('[AI Guru][3B1B][QA] fresh regeneration failed:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  const finalLesson = repairTeacherVisualLayout(lesson);
  const finalAssessment = await assessLesson(finalLesson, language, requireBoard);
  const failures = [finalAssessment.boardError, ...finalAssessment.quality.issues, ...finalAssessment.compiled.warnings].filter(Boolean);
  console.error('[AI Guru][3B1B][QA] REJECT after regeneration', { source, attempts, failures });
  return NextResponse.json({
    ok: false,
    error: `Visual QA failed after ${maxRepairs} repair/regeneration passes: ${failures.slice(0,12).join(' | ')}`,
    source: `${source}-qa-rejected-after-regeneration`,
    quality: finalAssessment.quality,
    warnings: finalAssessment.compiled.warnings,
    regeneration: { required: false, exhausted: true, attempts },
  }, { status: 422 });
}

export async function POST(req: Request) {
  let baseInput: Parameters<typeof generateTeachingLesson>[0] | undefined;
  let language: 'english' | 'malayalam' = 'english';
  try {
    const body = await req.json();
    const question = String(body?.question ?? body?.expression ?? '').trim();
    const grade = Number(body?.grade ?? 12);
    if (!question) return NextResponse.json({ ok: false, error: 'question is required' }, { status: 400 });
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) return NextResponse.json({ ok: false, error: 'grade must be 1-12' }, { status: 400 });

    const domain = detectMathDomain(question);
    language = body?.language === 'malayalam' ? 'malayalam' : 'english';
    const byokKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : undefined;
    const input = {
      question, grade, domain, language,
      expression: typeof body?.expression === 'string' ? body.expression : undefined,
      learningGoal: typeof body?.learningGoal === 'string' ? body.learningGoal : undefined,
      byokKey,
      openaiKey: typeof body?.openaiKey === 'string' ? body.openaiKey.trim() || undefined : undefined,
      chapterTitle: typeof body?.chapterTitle === 'string' ? body.chapterTitle : undefined,
      chapterSummary: typeof body?.chapterSummary === 'string' ? body.chapterSummary : undefined,
      chapterTopics: Array.isArray(body?.chapterTopics) ? body.chapterTopics.map(String).slice(0, 20) : undefined,
      textbookContext: typeof body?.textbookContext === 'string' ? body.textbookContext.slice(0, 12000) : undefined,
      textbookPageJson: typeof body?.textbookPageJson === 'string' ? body.textbookPageJson.slice(0, 30000) : undefined,
      teacherReadingMode: body?.teacherReadingMode === true || typeof body?.textbookPageJson === 'string',
      teacherSourceMalayalam: typeof body?.teacherSourceMalayalam === 'string' ? body.teacherSourceMalayalam.slice(0, 6000) : undefined,
      teacherExplanationEnglish: typeof body?.teacherExplanationEnglish === 'string' ? body.teacherExplanationEnglish.slice(0, 6000) : undefined,
      teacherExplanationMalayalam: typeof body?.teacherExplanationMalayalam === 'string' ? body.teacherExplanationMalayalam.slice(0, 6000) : undefined,
    };
    baseInput = input;

    // ─── 1. MANDATORY template selection (Video-DNA + solver family) ───
    // This runs whether or not Gemini is available. It is what forces the 3B1B board.
    const sourceText = [input.textbookContext, input.question].filter(Boolean).join('\n');
    const selection = await selectTeachingTemplate({
      question: input.question,
      grade: input.grade,
      domain: input.domain,
      chapterTitle: input.chapterTitle,
      chapterSummary: input.chapterSummary,
      chapterTopics: input.chapterTopics,
      learningGoal: input.learningGoal,
      sourceText,
    });
    console.info('[AI Guru][template-select]', selection.reason, {
      family: selection.family,
      mandatoryBoard: selection.mandatoryBoard,
      dna: selection.primaryDnaId,
      style: selection.styleReferenceId,
      problem: selection.problem?.slice(0, 80),
    });

    // ─── 2. If a worked-solution template is mandatory, build it offline first ───
    if (selection.mandatoryBoard) {
      // Prefer full teacher-reading wrapper (cues + solver board)
      let lesson = repairTeacherVisualLayout(
        recoverMissingVisualTeaching(buildTemplateTeacherLesson(input), input),
      );
      lesson = applyTemplateSelectionGrammar(lesson, selection);

      // Guarantee solver rows exist: if template path lost them, rebuild from mandatory solver
      const creates = lesson.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => a.type === 'create')));
      if (creates.length < 2) {
        const mandatory = buildMandatoryTemplateLesson(input, selection);
        if (mandatory) {
          lesson = applyTemplateSelectionGrammar(
            repairTeacherVisualLayout(mandatory),
            selection,
          );
        }
      }

      const finalized = await qaRepairRecompileLoop(lesson, input, selection, language, 'mandatory-worked-solution-template', [selection.reason, selection.primaryDnaId ? `Video-DNA: ${selection.primaryDnaId}` : 'Video-DNA: default'], true, false);
      // Mandatory worked-solution templates are deterministic and must never
      // fall through into a slow Gemini regeneration loop.  If their QA gate
      // fails, fail closed immediately rather than turning a local template
      // problem into a 50-second browser timeout.
      return finalized;
    }

    // ─── 3. No API key → offline path only (never invent text-only for solvable problems) ───
    if (!input.byokKey && !input.openaiKey && !process.env.GEMINI_API_KEY) {
      if (selection.mandatoryBoard) {
        const pure = buildMandatoryTemplateLesson(input, selection);
        if (pure) {
          return qaRepairRecompileLoop(applyTemplateSelectionGrammar(repairTeacherVisualLayout(pure), selection), input, selection, language, 'offline-mandatory-template-no-key', ['No AI key; taught from deterministic worked-solution template + Video-DNA grammar'], true, false);
        }
      }
      // Non-equation page: local teacher with DNA grammar
      let local = applyTemplateSelectionGrammar(
        repairTeacherVisualLayout(recoverMissingVisualTeaching(buildLocalTeacherLesson(input), input)),
        selection,
      );
      return qaRepairRecompileLoop(local, input, selection, language, 'offline-local-teacher-no-key', [selection.reason], false);
    }

    // ─── 4. Gemini / OpenAI planner (Video-DNA already in generateTeachingLesson) ───
    try {
      const lesson = await generateTeachingLesson(input);
      const withGrammar = applyTemplateSelectionGrammar(lesson, selection);
      // If planner returned no board but we have a mandatory template, overlay solver board
      const creates = withGrammar.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => a.type === 'create')));
      if (selection.mandatoryBoard && creates.length < 2) {
        const pure = buildMandatoryTemplateLesson(input, selection);
        if (pure) {
          return qaRepairRecompileLoop(applyTemplateSelectionGrammar(repairTeacherVisualLayout(pure), selection), input, selection, language, 'planner-empty-board-mandatory-template-override', ['Planner produced no board actions; mandatory worked-solution template applied'], true, false);
        }
      }
      return qaRepairRecompileLoop(withGrammar, input, selection, language, input.teacherReadingMode ? 'gemini-3b1b-video-dna-teacher-reading-qa' : 'gemini-3b1b-video-dna-qa', [selection.reason], selection.mandatoryBoard);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AI Guru][3B1B teaching] planner failure; template fallback:', message);

      if (selection.mandatoryBoard) {
        const pure = buildMandatoryTemplateLesson(input, selection)
          || repairTeacherVisualLayout(recoverMissingVisualTeaching(buildTemplateTeacherLesson(input), input));
        if (pure) {
          return qaRepairRecompileLoop(applyTemplateSelectionGrammar(pure, selection), input, selection, language, 'local-teacher-reading-fallback-mandatory-template', [`Gemini unavailable: ${message.slice(0, 120)}`, selection.reason], true, false);
        }
      }

      let fallbackLesson = applyTemplateSelectionGrammar(
        repairTeacherVisualLayout(recoverMissingVisualTeaching(buildLocalTeacherLesson(input), input)),
        selection,
      );
      return qaRepairRecompileLoop(fallbackLesson, input, selection, language, 'local-teacher-fallback', [`Gemini unavailable: ${message.slice(0, 120)}`], false);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AI Guru][3B1B teaching] route error:', message);
    return NextResponse.json({ ok: false, error: message, source: '3b1b-route' }, { status: 500 });
  }
}
