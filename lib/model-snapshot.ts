import "server-only";

import { get, put } from "@vercel/blob";

const SNAPSHOT_PATH = "model-table/latest.json";
const CLOSE_SNAPSHOT_PATH = "model-table/close.json";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models?output_modalities=text";
const OPENROUTER_MODELS_PAGE_URL = "https://openrouter.ai/models?q=pricing";

type OpenRouterPricing = {
  prompt?: string | number | null;
  completion?: string | number | null;
};

type OpenRouterModel = {
  id: string;
  canonical_slug?: string | null;
  name?: string | null;
  created?: number | null;
  context_length?: number | null;
  description?: string | null;
  pricing?: OpenRouterPricing | null;
  top_provider?: {
    name?: string | null;
  } | null;
};

export type ModelRow = {
  name: string;
  provider: string;
  priceInput: string;
  priceOutput: string;
  weightedAverageCost: number | null;
  closeChangePct: number | null;
  releaseDate: string | null;
  model: string;
  createdAt: number | null;
  contextLength: number | null;
  source: "openrouter" | "scraped";
};

export type ModelSnapshot = {
  generatedAt: string;
  counts: {
    api: number;
    scraped: number;
    total: number;
  };
  rows: ModelRow[];
};

type SnapshotPayload = {
  generatedAt: string;
  counts: ModelSnapshot["counts"];
  rows: ModelRow[];
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  minimax: "MiniMax",
  mistralai: "Mistral AI",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  qwen: "Qwen",
  "x-ai": "xAI",
  zai: "Z.ai",
};

export async function getLatestModelSnapshot({
  bootstrapIfMissing = false,
}: {
  bootstrapIfMissing?: boolean;
} = {}): Promise<ModelSnapshot> {
  const cached = await readSnapshotFromBlob();
  if (cached) {
    return cached;
  }

  const snapshot = await refreshModelSnapshot({ persist: bootstrapIfMissing });
  return snapshot;
}

export async function refreshModelSnapshot({
  persist = true,
}: {
  persist?: boolean;
} = {}): Promise<ModelSnapshot> {
  const previousClose = await readSnapshotFromBlob(CLOSE_SNAPSHOT_PATH);
  const [apiModels, scrapedIds] = await Promise.all([
    fetchOpenRouterModels(),
    scrapeOpenRouterModelIds(),
  ]);

  let rows = mergeModelSources(apiModels, scrapedIds);
  rows = applyCloseComparison(rows, previousClose?.rows ?? []);
  rows = sortRows(rows);

  const snapshot: ModelSnapshot = {
    generatedAt: new Date().toISOString(),
    counts: {
      api: apiModels.length,
      scraped: scrapedIds.length,
      total: rows.length,
    },
    rows,
  };

  if (persist && hasBlobToken()) {
    await writeSnapshotToBlob(SNAPSHOT_PATH, snapshot);
    await writeSnapshotToBlob(CLOSE_SNAPSHOT_PATH, snapshot);
  }

  return snapshot;
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(OPENROUTER_API_URL, {
    cache: "no-store",
    headers: process.env.OPENROUTER_API_KEY
      ? {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter model fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    data?: OpenRouterModel[];
  };

  return Array.isArray(payload.data)
    ? payload.data.filter(
        (model) =>
          !isLatestAlias(model.id, model.canonical_slug) &&
          !isAutoRouterModel(model) &&
          !isFreeModel(model),
      )
    : [];
}

async function scrapeOpenRouterModelIds(): Promise<string[]> {
  try {
    const response = await fetch(OPENROUTER_MODELS_PAGE_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const ids = new Set<string>();

    for (const match of html.matchAll(/href="\/models\/([^"]+)"/g)) {
      const rawId = match[1];
      const decoded = decodeURIComponent(rawId).replace(/\/$/, "");

      if (decoded.includes("/") && !isLatestAlias(decoded) && !isAutoRouterModel({ id: decoded })) {
        ids.add(decoded);
      }
    }

    return [...ids];
  } catch {
    return [];
  }
}

function mergeModelSources(
  apiModels: OpenRouterModel[],
  scrapedIds: string[],
): ModelRow[] {
  const merged = new Map<string, ModelRow>();

  for (const model of apiModels) {
    const row = toModelRow(model, "openrouter");
    merged.set(row.model, row);
  }

  for (const id of scrapedIds) {
    if (merged.has(id)) {
      continue;
    }

    merged.set(id, {
      name: modelNameFromId(id),
      provider: providerLabelFromId(id),
      priceInput: "—",
      priceOutput: "—",
      weightedAverageCost: null,
      closeChangePct: null,
      releaseDate: null,
      model: id,
      createdAt: null,
      contextLength: null,
      source: "scraped",
    });
  }

  return [...merged.values()];
}

function isLatestAlias(id: string, canonicalSlug?: string | null): boolean {
  const value = `${canonicalSlug ?? id}`.toLowerCase();
  return value.startsWith("~") || value.includes("-latest");
}

function isAutoRouterModel(model: Pick<OpenRouterModel, "id" | "canonical_slug" | "name">): boolean {
  const values = [model.id, model.canonical_slug, model.name]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return values.some(
    (value) =>
      value === "openrouter/auto" ||
      value === "openrouter-auto" ||
      value.includes("openrouter/auto") ||
      value.includes("openrouter-auto"),
  );
}

function applyCloseComparison(rows: ModelRow[], previousRows: ModelRow[]): ModelRow[] {
  const previousByModel = new Map(
    previousRows
      .filter((row) => typeof row.weightedAverageCost === "number")
      .map((row) => [row.model, row.weightedAverageCost as number]),
  );

  return rows.map((row) => {
    const previousClose = previousByModel.get(row.model);

    if (typeof row.weightedAverageCost !== "number") {
      return {
        ...row,
        closeChangePct: null,
      };
    }

    const baseline = typeof previousClose === "number" ? previousClose : 0;

    if (baseline === 0) {
      return {
        ...row,
        closeChangePct: row.weightedAverageCost === 0 ? 0 : Infinity,
      };
    }

    return {
      ...row,
      closeChangePct:
        ((row.weightedAverageCost - baseline) / baseline) * 100,
    };
  });
}

function isFreeModel(model: OpenRouterModel): boolean {
  const prompt = model.pricing?.prompt;
  const completion = model.pricing?.completion;

  return isZeroPrice(prompt) && isZeroPrice(completion);
}

function isZeroPrice(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed === 0;
}

function toModelRow(model: OpenRouterModel, source: ModelRow["source"]): ModelRow {
  return {
    name: modelNameFromId(model.id),
    provider: sanitizeLabel(
      model.top_provider?.name ?? providerLabelFromId(model.id),
    ),
    priceInput: formatPricePerMillion(model.pricing?.prompt),
    priceOutput: formatPricePerMillion(model.pricing?.completion),
    weightedAverageCost: computeWeightedAverageCost(
      model.pricing?.prompt,
      model.pricing?.completion,
    ),
    closeChangePct: null,
    releaseDate: formatReleaseDate(model.created),
    model: model.canonical_slug ?? model.id,
    createdAt: model.created ?? null,
    contextLength: model.context_length ?? null,
    source,
  };
}

function sortRows(rows: ModelRow[]): ModelRow[] {
  return [...rows].sort((left, right) => {
    const leftCreated = left.createdAt ?? -1;
    const rightCreated = right.createdAt ?? -1;
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    const leftName = left.name.toLowerCase();
    const rightName = right.name.toLowerCase();
    if (leftName !== rightName) {
      return leftName.localeCompare(rightName);
    }

    return left.model.localeCompare(right.model);
  });
}

function formatPricePerMillion(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "—";
  }

  const perMillion = parsed * 1_000_000;
  return `$${formatCompactNumber(perMillion)} / 1M tokens`;
}

function formatCompactNumber(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return formatted.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatReleaseDate(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function computeWeightedAverageCost(
  prompt: string | number | null | undefined,
  completion: string | number | null | undefined,
): number | null {
  const input = toNumber(prompt);
  const output = toNumber(completion);

  if (input === null || output === null) {
    return null;
  }

  return ((input + output) / 2) * 1_000_000;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function modelNameFromId(id: string): string {
  return id.replaceAll("/", "-");
}

function providerLabelFromId(id: string): string {
  const providerSlug = id.split("/")[0] ?? id;
  return PROVIDER_LABELS[providerSlug] ?? titleCase(providerSlug);
}

function sanitizeLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  return value.trim();
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readSnapshotFromBlob(
  pathname = SNAPSHOT_PATH,
): Promise<ModelSnapshot | null> {
  if (!hasBlobToken()) {
    return null;
  }

  const result = await get(pathname, { access: "public" });
  if (!result) {
    return null;
  }

  const text = await new Response(result.stream).text();

  try {
    return parseSnapshot(text);
  } catch {
    return null;
  }
}

async function writeSnapshotToBlob(
  pathname: string,
  snapshot: ModelSnapshot,
): Promise<void> {
  await put(pathname, JSON.stringify(snapshot), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

function parseSnapshot(text: string): ModelSnapshot {
  const payload = JSON.parse(text) as SnapshotPayload;

  if (!Array.isArray(payload.rows)) {
    throw new Error("Invalid snapshot payload");
  }

  return {
    generatedAt: typeof payload.generatedAt === "string"
      ? payload.generatedAt
      : new Date().toISOString(),
    counts: normalizeCounts(payload.counts, payload.rows.length),
    rows: payload.rows.map(normalizeRow),
  };
}

function normalizeCounts(
  counts: SnapshotPayload["counts"] | undefined,
  rowCount: number,
): SnapshotPayload["counts"] {
  return {
    api: Number.isFinite(counts?.api ?? NaN) ? Number(counts?.api) : rowCount,
    scraped: Number.isFinite(counts?.scraped ?? NaN)
      ? Number(counts?.scraped)
      : 0,
    total: Number.isFinite(counts?.total ?? NaN) ? Number(counts?.total) : rowCount,
  };
}

function normalizeRow(row: ModelRow): ModelRow {
  return {
    name: sanitizeLabel(row.name),
    provider: sanitizeLabel(row.provider),
    priceInput: sanitizeLabel(row.priceInput),
    priceOutput: sanitizeLabel(row.priceOutput),
    weightedAverageCost:
      typeof row.weightedAverageCost === "number"
        ? row.weightedAverageCost
        : deriveWeightedAverageCostFromPrices(row.priceInput, row.priceOutput),
    closeChangePct:
      typeof row.closeChangePct === "number" ? row.closeChangePct : null,
    releaseDate: typeof row.releaseDate === "string" ? row.releaseDate : formatReleaseDate(row.createdAt),
    model: sanitizeLabel(row.model),
    createdAt: Number.isFinite(row.createdAt ?? NaN) ? row.createdAt : null,
    contextLength: Number.isFinite(row.contextLength ?? NaN)
      ? row.contextLength
      : null,
    source: row.source === "scraped" ? "scraped" : "openrouter",
  };
}

function deriveWeightedAverageCostFromPrices(
  priceInput: string,
  priceOutput: string,
): number | null {
  const input = parseFormattedPrice(priceInput);
  const output = parseFormattedPrice(priceOutput);

  if (input === null || output === null) {
    return null;
  }

  return (input + output) / 2;
}

function parseFormattedPrice(value: string): number | null {
  const match = value.match(/\$([0-9,.]+)\s*\/\s*1M tokens/i);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
