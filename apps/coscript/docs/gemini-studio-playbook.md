# Gemini Studio Playbook (Co-Script / Co-Edit / Co-Deliver)

This maps AI Studio-style setup to the new API route:

- Route: `POST /api/ai/gemini-orchestrate`
- Stage values: `script`, `edit`, `deliver`
- Optional Claude handoff function call: `force_claude_handoff: true`

## 1) Co-Script Window

Recommended AI Studio cards:
- `Use Google Search data`
- `Think more when needed`
- `Video understanding` (only when analyzing source footage)
- `Analyze images` (only when visual evidence matters)

System direction:
- Evidence-first, source-grounded, retention-driven script design.

API body:

```json
{
  "stage": "script",
  "objective": "Create a high-retention AI science script",
  "audience": "Founders and operators",
  "platform": "youtube",
  "content": "Topic and notes...",
  "force_claude_handoff": true
}
```

## 2) Co-Edit Window

Recommended AI Studio cards:
- `Fast AI responses`
- `Transcribe audio`
- `Video understanding`

System direction:
- Preserve meaning, tighten pacing, flag risk language, output exact edits.

API body:

```json
{
  "stage": "edit",
  "objective": "Tighten pacing and clarity without changing intent",
  "content": "Draft script/transcript...",
  "enable_search": false,
  "force_claude_handoff": true
}
```

## 3) Co-Deliver Window

Recommended AI Studio cards:
- `Use Google Search data`
- `Generate images`
- `Control image aspect ratios`
- `Generate speech`

System direction:
- Honest high-CTR packaging, thumbnail/title testing, channel-ready deliverables.

API body:

```json
{
  "stage": "deliver",
  "objective": "Package this for YouTube and Shorts",
  "platform": "youtube",
  "content": "Final script + constraints...",
  "force_claude_handoff": true
}
```

## Function-Calling Contract

When `force_claude_handoff` is enabled, Gemini is constrained to call:
- `handoff_to_claude`

Arguments schema:
- `pipeline_stage`: `script | edit | deliver`
- `objective`: string
- `inputs`: object
- `constraints`: string[]
- `required_outputs`: string[]
- `quality_checks`: string[]

This payload can be sent directly to Claude to execute deterministic implementation.

