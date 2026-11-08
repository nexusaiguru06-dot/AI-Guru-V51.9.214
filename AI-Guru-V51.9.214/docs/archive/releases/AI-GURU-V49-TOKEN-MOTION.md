# AI Guru V49 — Mathematical Token Motion

Token-level movement is a required mathematical animation primitive, not a decorative effect.

## Runtime action

```json
{
  "type": "token-move",
  "id": "carry-7",
  "token": "7",
  "fromX": 300,
  "fromY": 180,
  "toX": 420,
  "toY": 120,
  "durationMs": 650,
  "fadeOut": true,
  "fontSize": 34
}
```

The browser renderer creates the actual digit as an independent DOM object, moves it using a timed CSS transition, fades it when requested, and removes it after completion.

The action is propagated through:

`Gemini visual planner → VisualPlan → UniversalMathScene.visualActions → universalSceneToVisualActions → MathLikeAnimBoard.reveal()`

This is intended for carrying/borrowing, cancellation, term movement, sign movement, regrouping, fraction transformations, and other mathematical transformations where the learner should see an individual symbol physically change position.

The mathematical solver remains responsible for correctness. The token action only controls visual motion.
