# projects/config

Runtime configuration for the buildable projects under `projects/`.

## `avatar-providers.json`

Controls which image-generation providers the **avatar generator** service
(`projects/services/avatar-gen`) offers, and the models available under each
provider. The desktop app's avatar generator UI reads this list to populate the
**Provider** and **Model** dropdowns.

- `avatar-providers.example.json` — template, committed to git.
- `avatar-providers.json` — your real config with API keys. **Git-ignored** so
  keys are never committed. Copy the example if it is missing:

  ```powershell
  Copy-Item projects/config/avatar-providers.example.json projects/config/avatar-providers.json
  ```

### Fields

| Field | Meaning |
| --- | --- |
| `defaultProvider` | `id` of the provider used when a request does not specify one. |
| `providers[]` | Available providers. |
| `providers[].id` | Stable identifier sent by the UI. |
| `providers[].label` | Display name in the dropdown. |
| `providers[].kind` | Implementation: `openrouter`, `mock`, or `codex-cli`. |
| `providers[].models[]` | `{ id, label, api?, params? }` entries shown in the Model dropdown. |
| `providers[].models[].api` | OpenRouter path override: `images` (dedicated `/api/v1/images`, e.g. `openai/gpt-image-2`) or `chat` (`/api/v1/chat/completions` + `modalities`, e.g. Gemini image models). Defaults from the model id (`gpt-image-*` → `images`, otherwise `chat`). |
| `providers[].models[].params` | Optional extra body params merged into an `images`-path request (e.g. `{ "size": "1024x1024", "quality": "high", "background": "opaque" }`). |
| `providers[].defaultModel` | Model `id` pre-selected for this provider. |
| `providers[].baseUrl` | API base URL (OpenRouter: `https://openrouter.ai/api/v1`). |
| `providers[].apiKey` | API key. Leave `""` to fall back to the env var below. |
| `providers[].apiKeyEnv` | Env var to read the key from when `apiKey` is empty (default `OPENROUTER_API_KEY`). |
| `providers[].referer` / `title` | Optional OpenRouter attribution headers (`HTTP-Referer`, `X-Title`). |

The API key is read from `apiKey` first, then from the `apiKeyEnv` environment
variable. Prefer the env var if you do not want the key on disk:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-..."
```

`mock` and `codex-cli` need no key and take no models. `mock` produces
deterministic placeholder art (offline). `codex-cli` runs the local Codex CLI.

Config changes take effect on the **next generation job** — no server restart
needed. Set `AVATAR_PROVIDERS_CONFIG` to point at a different file path.

### Current default & availability

The default model is **`openai/gpt-5-image-mini`** (routed via the `chat` path).
The older `openai/gpt-image-1` / `gpt-image-2` ids are no longer served by
OpenRouter and have been removed.

> **Region note:** OpenAI's GPT-5 image models (and some Gemini image models)
> are geo-restricted on OpenRouter and return `403 "This model is not available
> in your region."` from blocked regions/networks. If you hit that, switch the
> model dropdown to one available in your region (e.g. a Gemini image model your
> account can reach) — the fusion and smoothness pipeline is identical for any
> image-capable model.
