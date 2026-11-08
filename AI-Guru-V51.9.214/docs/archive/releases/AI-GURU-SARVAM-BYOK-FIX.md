# AI Guru Sarvam BYOK fix

## Root cause
Sarvam 105B enables reasoning by default. The previous AI Guru validation request used `max_tokens: 8`. Sarvam documents that reasoning tokens count against `max_tokens`; with a small budget, the model can finish with no visible `message.content`. AI Guru then incorrectly converted that successful upstream response into HTTP 502 (`returned an empty response`).

## Fix
- Disable reasoning explicitly with `reasoning_effort: null` in the AI Guru Sarvam/OpenAI-compatible adapter.
- Raise the validation request budget from 8 to 64 tokens.
- Keep the normal Sarvam route on `/v1/chat/completions` and authenticate with `api-subscription-key`.
- Cap this adapter's outgoing `max_tokens` at 4096 to remain compatible with Sarvam Starter limits; larger plans can be adjusted later if needed.

The Sarvam key itself does not need to be changed just because the previous test showed 502.
