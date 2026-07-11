import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is <service>/src (dev via tsx) or <service>/dist (built). Either way "../.." is projects/.
const SERVICE_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG_PATH = path.resolve(SERVICE_ROOT, "..", "..", "config", "avatar-providers.json");

export type ProviderKind = "mock" | "codex-cli" | "openrouter";

/**
 * Which OpenRouter image path a model uses:
 * - "images": dedicated POST /api/v1/images (e.g. openai/gpt-image-2); response at data[0].b64_json.
 * - "chat":   POST /api/v1/chat/completions with modalities:["image","text"] (e.g. gemini image models);
 *             response at choices[0].message.images[0].image_url.url.
 */
export type ImageApi = "images" | "chat";

export type ProviderModel = {
  id: string;
  label?: string;
  /** Override the endpoint routing. Defaults from the model id (see defaultImageApi). */
  api?: ImageApi;
  /** Extra body params merged into a /api/v1/images request (e.g. size, quality, background). */
  params?: Record<string, unknown>;
};

export type ProviderDef = {
  id: string;
  label: string;
  kind: ProviderKind;
  models: ProviderModel[];
  defaultModel?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  referer?: string;
  title?: string;
};

export type ProviderConfig = {
  defaultProvider: string;
  providers: ProviderDef[];
};

/** A fully resolved selection ready to hand to createImageProvider(). */
export type ResolvedProvider = {
  id: string;
  kind: ProviderKind;
  label: string;
  model: string;
  modelApi: ImageApi;
  modelParams?: Record<string, unknown>;
  apiKey?: string;
  baseUrl?: string;
  referer?: string;
  title?: string;
};

/** Provider info safe to send to the browser (no secrets). */
export type ClientProvider = {
  id: string;
  label: string;
  kind: ProviderKind;
  models: ProviderModel[];
  defaultModel?: string;
  requiresApiKey: boolean;
  apiKeyConfigured: boolean;
};

export type ClientProviderConfig = {
  defaultProvider: string;
  providers: ClientProvider[];
};

export class ProviderSelectionError extends Error {}

const VALID_KINDS: ReadonlySet<ProviderKind> = new Set(["mock", "codex-cli", "openrouter"]);
const KINDS_REQUIRING_KEY: ReadonlySet<ProviderKind> = new Set(["openrouter"]);

export function providerConfigPath(): string {
  return process.env.AVATAR_PROVIDERS_CONFIG ?? DEFAULT_CONFIG_PATH;
}

export async function loadProviderConfig(): Promise<ProviderConfig> {
  const configPath = providerConfigPath();
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    return builtinFallbackConfig();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Provider config ${configPath} is not valid JSON: ${(error as Error).message}`);
  }
  return normalizeConfig(parsed);
}

function normalizeConfig(parsed: unknown): ProviderConfig {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Provider config must be a JSON object.");
  }
  const record = parsed as Record<string, unknown>;
  const rawProviders = Array.isArray(record.providers) ? record.providers : [];
  const providers = rawProviders
    .map((item) => normalizeProvider(item))
    .filter((item): item is ProviderDef => item !== null);

  if (providers.length === 0) {
    return builtinFallbackConfig();
  }

  const requestedDefault = typeof record.defaultProvider === "string" ? record.defaultProvider : undefined;
  const defaultProvider = providers.some((provider) => provider.id === requestedDefault)
    ? (requestedDefault as string)
    : providers[0].id;

  return { defaultProvider, providers };
}

function normalizeProvider(item: unknown): ProviderDef | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const kind = record.kind;
  if (!id || typeof kind !== "string" || !VALID_KINDS.has(kind as ProviderKind)) {
    return null;
  }

  const models = Array.isArray(record.models)
    ? record.models
        .map((model) => normalizeModel(model))
        .filter((model): model is ProviderModel => model !== null)
    : [];

  const defaultModel =
    typeof record.defaultModel === "string" && models.some((model) => model.id === record.defaultModel)
      ? record.defaultModel
      : models[0]?.id;

  return {
    id,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : id,
    kind: kind as ProviderKind,
    models,
    defaultModel,
    baseUrl: optionalString(record.baseUrl),
    apiKey: optionalString(record.apiKey),
    apiKeyEnv: optionalString(record.apiKeyEnv),
    referer: optionalString(record.referer),
    title: optionalString(record.title),
  };
}

function normalizeModel(model: unknown): ProviderModel | null {
  if (typeof model === "string") {
    const id = model.trim();
    return id ? { id } : null;
  }
  if (typeof model === "object" && model !== null) {
    const record = model as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) return null;
    const api = record.api === "images" || record.api === "chat" ? (record.api as ImageApi) : undefined;
    const params =
      typeof record.params === "object" && record.params !== null && !Array.isArray(record.params)
        ? (record.params as Record<string, unknown>)
        : undefined;
    return { id, label: optionalString(record.label), api, params };
  }
  return null;
}

/** Route openai/gpt-image-* to the dedicated Images API; everything else to the chat path. */
export function defaultImageApi(modelId: string): ImageApi {
  return /(^|\/)gpt-image-/i.test(modelId) ? "images" : "chat";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Resolve the API key for a provider from its inline value or environment variable. */
export function resolveApiKey(def: ProviderDef): string | undefined {
  if (def.apiKey && def.apiKey.trim()) return def.apiKey.trim();
  const envName = def.apiKeyEnv ?? "OPENROUTER_API_KEY";
  const fromEnv = process.env[envName];
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : undefined;
}

export function providerRequiresApiKey(def: ProviderDef): boolean {
  return KINDS_REQUIRING_KEY.has(def.kind);
}

/**
 * Resolve a requested provider/model against the config. Falls back to the
 * configured defaults when the request omits or misnames a provider/model.
 * Throws ProviderSelectionError for an unknown provider id or missing API key.
 */
export function resolveSelection(
  config: ProviderConfig,
  requestedProviderId?: string | null,
  requestedModelId?: string | null,
): ResolvedProvider {
  const providerId = requestedProviderId?.trim() || config.defaultProvider;
  const def = config.providers.find((provider) => provider.id === providerId);
  if (!def) {
    throw new ProviderSelectionError(`Unknown provider "${providerId}".`);
  }

  const requestedModel = requestedModelId?.trim();
  const modelEntry =
    (requestedModel && def.models.find((entry) => entry.id === requestedModel)) ||
    def.models.find((entry) => entry.id === def.defaultModel) ||
    def.models[0];
  const model = modelEntry?.id ?? "";

  const apiKey = resolveApiKey(def);
  if (providerRequiresApiKey(def) && !apiKey) {
    throw new ProviderSelectionError(
      `Provider "${def.id}" has no API key. Set it in projects/config/avatar-providers.json or the ${def.apiKeyEnv ?? "OPENROUTER_API_KEY"} environment variable.`,
    );
  }
  if ((def.models.length > 0 || providerRequiresApiKey(def)) && !model) {
    throw new ProviderSelectionError(
      `Provider "${def.id}" has no usable model configured. Add at least one entry to its "models" list.`,
    );
  }

  return {
    id: def.id,
    kind: def.kind,
    label: def.label,
    model,
    modelApi: modelEntry?.api ?? defaultImageApi(model),
    modelParams: modelEntry?.params,
    apiKey,
    baseUrl: def.baseUrl,
    referer: def.referer,
    title: def.title,
  };
}

export function toClientConfig(config: ProviderConfig): ClientProviderConfig {
  return {
    defaultProvider: config.defaultProvider,
    providers: config.providers.map((def) => ({
      id: def.id,
      label: def.label,
      kind: def.kind,
      models: def.models,
      defaultModel: def.defaultModel,
      requiresApiKey: providerRequiresApiKey(def),
      apiKeyConfigured: Boolean(resolveApiKey(def)),
    })),
  };
}

function builtinFallbackConfig(): ProviderConfig {
  return {
    defaultProvider: "mock",
    providers: [
      { id: "mock", label: "Mock (offline placeholder)", kind: "mock", models: [] },
      { id: "codex-cli", label: "Codex CLI", kind: "codex-cli", models: [] },
      {
        id: "openrouter",
        label: "OpenRouter",
        kind: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
        defaultModel: "openai/gpt-image-2",
        models: [
          { id: "openai/gpt-image-2", label: "GPT Image 2" },
          { id: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Image" },
        ],
      },
    ],
  };
}
