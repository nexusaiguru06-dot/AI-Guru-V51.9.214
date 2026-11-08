# AI Guru V2 — OpenMAIC Adoption Layer

This implementation deliberately uses OpenMAIC v1.0.1 as the classroom/runtime base.

## Adopted
- OpenMAIC DSL `Action` contract
- OpenMAIC playback/action engine through `TeachingControllerPort`
- OpenMAIC whiteboard actions (`wb_draw_text`, `wb_draw_latex`, shapes, lines, charts)
- OpenMAIC spotlight action for reference/visual focus
- OpenMAIC document model as the normalization input
- Existing OpenMAIC TTS/audio assets through `SpeechAction.audioId`
- Existing OpenMAIC timeline/choreography remains the runtime timing layer

## AI Guru additions
- `AIGuruLesson` and `ParagraphTeachingUnit`
- explicit paragraph teaching state machine
- fixed reference-page model with paragraph bounding box
- English/Malayalam tracks
- word/phrase/time cue model
- lesson validator
- Math verifier adapter boundary
- Docling-compatible normalization boundary

## Deliberately not duplicated
- a second playback engine
- a second whiteboard framework
- a second media renderer
- a second TTS framework
- a second video timeline

## Integration rule
`AIGuruTeachingController` emits OpenMAIC `Action[]`; the existing OpenMAIC player/action engine executes them. The controller owns pedagogical sequencing, not rendering.
