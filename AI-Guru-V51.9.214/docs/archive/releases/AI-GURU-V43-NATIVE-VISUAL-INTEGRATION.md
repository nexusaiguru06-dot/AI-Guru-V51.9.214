# AI Guru Native Visual Integration

## Adopted from the attached Cumulative Derivation v6 work

AI Guru keeps the useful cumulative-derivation behavior from the supplied v6 package: mathematical lines remain persistent, transform actions can retain their source, and the same visual scene can be replayed for English and Malayalam.

## Deliberately not adopted

The OpenMAIC classroom/presentation runtime is not used as the AI Guru whiteboard renderer. AI Guru uses its own `MathLikeAnimBoard` + Action/Playback/Choreography pipeline for the student-facing math canvas.

## Runtime path

`Lesson -> Paragraph State Machine -> Math Agent -> Math Verification -> Universal Math Compiler -> Visual Actions -> MathLikeAnimBoard -> Visual QA`

Voice uses `Sarvam -> Piper -> device speech` fallback for Malayalam. Piper can now run either through `PIPER_TTS_URL` or directly through a downloaded `PIPER_BIN` + `PIPER_MODEL`.

## Acceptance criteria

1. Malayalam text is real Malayalam Unicode and uses Malayalam-capable font fallbacks.
2. Malayalam narration requests `ml-IN` and does not silently fall back to English.
3. Verified math scenes are converted to VisualActions and rendered on the actual classroom whiteboard.
4. Transform actions retain earlier derivation lines by default.
5. Visual QA is paragraph-scoped; rendered-board sanity checks are also performed in the classroom QA button.
6. OpenMAIC is not introduced into the new AI Guru visual path.
