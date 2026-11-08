# AI Guru V51.6.9 — Multi-provider BYOK fallback

## Provider order
1. Gemini key pool (existing 5-slot rotation)
2. Agnes AI — `https://apihub.agnes-ai.com/v1`, default `agnes-3.0-flash`
3. Sarvam AI — `https://api.sarvam.ai/v1`, default `sarvam-105b`

## Scope
- Material Studio study-material generation uses the fallback chain.
- General Classroom visual planning can fall back to provider-generated structured plans while retaining local Visual-DNA. A fallback provider is never falsely reported as having watched a physical reference video.
- Gemini remains preferred for actual reference-video grounding.
- Keys are browser-local and never stored in AI Guru's database.
- Gemini 'Get a key' links were removed; the user pastes existing keys directly.

## Provider capability review
- Agnes AI exposes OpenAI-compatible `/v1/chat/completions`, text/vision models, long-context models and video/image APIs. AI Guru uses the text chat endpoint for curriculum/material JSON; it does not depend on Agnes video generation for normal General Class.
- Sarvam exposes `/v1/chat/completions` with `sarvam-105b`, 128K context, reasoning and official JSON-object structured output. This is suitable for curriculum planning, explanations, question generation and structured material generation.
- Both providers are treated as fallback text planners/authors. AI Guru's own QA, source grounding, Visual-DNA and renderer remain authoritative.
