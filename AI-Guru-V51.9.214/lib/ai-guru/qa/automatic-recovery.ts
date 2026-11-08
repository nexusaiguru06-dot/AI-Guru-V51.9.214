/**
 * AI Guru — automatic exact-ID recovery for the complete application.
 */
export const AI_GURU_QA_LAYERS = [
  'GENERAL-QA',
  'VISUAL-STEPS-QA',
  'RENDERED-VIDEO-QA',
] as const;

export const AI_GURU_QA_RECOVERY: Record<string,string> = {
  'GENERAL-PAGE-10-BENCHMARK-MISSING':'restorePageBenchmark',
  'GENERAL-PAGE-11-BENCHMARK-MISSING':'restorePageBenchmark',
  'GENERAL-PAGE-10-11-BENCHMARK-MISSING':'restorePageBenchmark',
  'VSQA-01':'restoreSourceBinding',
  'VSQA-02':'restoreParagraphBinding',
  'VSQA-03':'restoreMathematicalStatement',
  'VSQA-04':'restoreOriginalExpression',
  'VSQA-05':'createRequiredVisualPlan',
  'VSQA-06':'addExactObjectMark',
  'VSQA-07':'addSemanticTransformation',
  'VSQA-08':'repairProgressiveConstruction',
  'VSQA-09':'repairVisualHighlight',
  'VSQA-10':'repairCaptionAnchor',
  'VSQA-11':'addLineBoundPause',
  'VSQA-12':'repairEnglishVisualCueSync',
  'VSQA-13':'cloneEnglishSemanticSceneToMalayalam',
  'VSQA-14':'repairAppendOnlyVisualHistory',
  'VSQA-15':'repairUniversalMathDomainMapping',
  'VSQA-16':'repairFinalVisualState',
  'RVQA-01':'repairRenderedSourceParagraph',
  'RVQA-02':'repairWhiteboardRuntimeMount',
  'RVQA-03':'repairReferencePageBinding',
  'RVQA-04':'repairConstructionRenderer',
  'RVQA-05':'repairRenderedObjectMark',
  'RVQA-06':'repairTransformRenderer',
  'RVQA-07':'repairRenderedCaptionAnchor',
  'RVQA-08':'repairAppendOnlyHistory',
  'RVQA-09':'repairRenderedPauseMarker',
  'RVQA-10':'repairPauseInteraction',
  'RVQA-11':'repairEnglishTtsCueSync',
  'RVQA-12':'repairMalayalamTtsSceneParity',
  'RVQA-13':'repairNoDeletionRendering',
  'RVQA-14':'repairPageTransition',
  'RVQA-15':'repairCompletedFinalState',
  'RVQA-RUNTIME-NOT-AVAILABLE':'installAndEnableRuntimeQa',
};

export type QaFailure = {
  qaId?: string;
  id?: string;
  layer?: string;
  status?: string;
  reason?: string;
};

export function exactRepairFor(failure: QaFailure) {
  const qaId=failure.qaId ?? failure.id;
  if(!qaId) return {ok:false, reason:'Missing exact QA ID'};
  const action=AI_GURU_QA_RECOVERY[qaId];
  if(!action) return {ok:false, qaId, reason:`No recovery action registered for ${qaId}`};
  return {ok:true, qaId, layer:failure.layer, action};
}

export async function runAutomaticRecovery({
  lesson,
  runAllQA,
  repair,
  rerender,
  maxAttempts=3,
  onEvent,
}: {
  lesson:any;
  runAllQA:(lesson:any)=>Promise<any>;
  repair:(lesson:any, action:string, failure:QaFailure)=>Promise<any>;
  rerender:(lesson:any)=>Promise<any>;
  maxAttempts?:number;
  onEvent?:(event:any)=>void;
}) {
  let current=lesson;
  const history:any[]=[];

  for(let attempt=1; attempt<=maxAttempts; attempt++){
    const qa=await runAllQA(current);
    const failures=(AI_GURU_QA_LAYERS.flatMap(layer =>
      (qa?.[layer]?.failures ?? []).map((f:any)=>({...f,layer}))
    ));

    if(!failures.length && AI_GURU_QA_LAYERS.every(layer=>qa?.[layer]?.ok===true)){
      onEvent?.({state:'QA_OK',attempt});
      return {ok:true,status:'QA : OK',attempt,lesson:current,qa,history};
    }

    // NOT_EXECUTED is recoverable, never a terminal pass.
    const normalized=failures.length ? failures :
      [{qaId:'RVQA-RUNTIME-NOT-AVAILABLE',layer:'RENDERED-VIDEO-QA',
        status:'FAIL',reason:'Rendered Video QA was not executed.'}];

    for(const failure of normalized){
      const mapped=exactRepairFor(failure);
      if(!mapped.ok) return {ok:false,status:'QA:HUMAN REVIEW',attempt,lesson:current,
        unresolved:[mapped],history};
      onEvent?.({state:'REPAIRING',attempt,qaId:mapped.qaId,action:mapped.action});
      current=await repair(current,mapped.action!,failure);
    }

    current=await rerender(current);
    history.push({attempt,failures:normalized});
    onEvent?.({state:'QA_RECHECKING',attempt});
  }

  return {ok:false,status:'QA:HUMAN REVIEW',lesson:current,history,
    reason:'Maximum automatic recovery attempts reached.'};
}
