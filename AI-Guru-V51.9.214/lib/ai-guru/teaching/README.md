# AI Guru Teaching Strategy

The classroom chooses among four strategies without replacing the existing referral-video library:

- `referral_video`: approved concept-matched reference is the primary teaching aid.
- `step_by_step`: solve the student's actual problem through verified math steps.
- `specialized_visual`: use the domain visual engine for graph/geometry/statistics-style explanations.
- `hybrid`: use an approved concept reference and then solve the actual problem with verified steps.

The selector is deterministic and explainable. A referral is eligible only when its registered domain/grade/concept match clears the threshold. The strategy is subsequently checked by Teaching Strategy QA and Math Steps QA before a lesson can be accepted.
