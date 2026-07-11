# Gulugulu Avatar Generator

Local/cloud-ready avatar generation service for Gulugulu custom pets.

## Development

```powershell
npm install
npm run dev
```

- Web UI: `http://127.0.0.1:4177`
- API: `http://127.0.0.1:4178`
- Generated jobs: `.data/jobs/`

## Providers & models

The **Provider** and **Model** are chosen per job from the dropdowns in the web
UI. The list of providers and models comes from
[`projects/config/avatar-providers.json`](../../config/avatar-providers.json)
(see [that folder's README](../../config/README.md) for the full schema and how
to supply API keys). Copy `avatar-providers.example.json` to
`avatar-providers.json` and fill in your key.

`GET /api/providers` returns the (secret-free) provider list the UI renders.
`POST /api/jobs` accepts `provider` and `model` form fields alongside the image;
when omitted it falls back to `defaultProvider` in the config (or the legacy
`AVATAR_IMAGE_PROVIDER` env var). Config changes apply to the next job — no
restart needed.

### `openrouter`

Generates real assets through [OpenRouter](https://openrouter.ai). Each model is
routed to the correct OpenRouter path automatically:

- **GPT Image 2** (`openai/gpt-image-2`) and other `gpt-image-*` models use the
  dedicated `POST /api/v1/images` endpoint.
- Gemini-style image models (e.g. `google/gemini-2.5-flash-image`) use
  `POST /api/v1/chat/completions` with `modalities: ["image", "text"]`.

Override the routing per model with `"api": "images" | "chat"` in the config.
The uploaded reference image is sent for image-to-image generation. The API key
is read from the provider's `apiKey`, or the `OPENROUTER_API_KEY` env var.
Request timeout: `AVATAR_OPENROUTER_TIMEOUT_MS` (default 300000).

### `mock`

`AVATAR_IMAGE_PROVIDER=mock`-style deterministic placeholder assets. No key, no
network — use it to test the full upload → progress → packaging → desktop import
flow without spending image-generation quota.

### `codex-cli`

Runs the local Codex CLI inside each job directory, using the repo-local
`$gulugulu-avatar-imagegen` skill to generate `standard-design.png` and a
16-frame `pose_sheets/idle_normal.png` from the uploaded reference image.

Set `AVATAR_GEN_ORCHESTRATOR=codex` to run a separate Codex CLI preflight in each
job directory before generation (skipped for the `codex-cli` provider itself).

## Output

Every provider produces the same package: the generated package currently
customizes only `idle_normal` (16 frames, 16 fps, 1 second, looped, transparent
PNG frames after local chroma-key cleanup). Other pet states fall back to the
built-in Guluduck animations in the desktop app.
