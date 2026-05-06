"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { ModelRow } from "@/lib/model-snapshot";

const HEADERS = [
  { key: "name", label: "Name" },
  { key: "provider", label: "Provider" },
  { key: "priceInput", label: "Price Input" },
  { key: "priceOutput", label: "Price Output" },
  { key: "weightedAverageCost", label: "Weighted Avg Cost" },
  { key: "closeChangePct", label: "% change" },
  { key: "weightedCostVariationPct", label: "% on frontier" },
  { key: "releaseDate", label: "Release Date" },
] as const;

const WEIGHTED_COST_BASELINE = 18;

const DIVIDER_CLASS = "border-b border-white/5";

type SortKey = (typeof HEADERS)[number]["key"];
type SortDirection = "asc" | "desc";

export function ModelTable({ rows }: { rows: ModelRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    if (sortKey === null) {
      return rows;
    }

    return [...rows].sort((left, right) => {
      const comparison = compareRows(left, right, sortKey);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, sortDirection, sortKey]);

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm leading-5">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-black text-zinc-400">
          <tr className={DIVIDER_CLASS}>
            {HEADERS.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left font-normal"
                aria-sort={
                  sortKey === header.key
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort(header.key)}
                  className="inline-flex items-center gap-1 text-left transition-colors hover:text-zinc-200"
                >
                  <span>{header.label}</span>
                  <SortIndicator
                    active={sortKey === header.key}
                    direction={sortDirection}
                  />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.model} className={`${DIVIDER_CLASS} bg-black`}>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                <div className="flex items-center gap-2">
                  <ModelIcon provider={row.provider} />
                  <span>{row.name}</span>
                  <ModelTags isNew={row.isNew} isLatest={row.isLatest} />
                </div>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                <span className="inline-flex items-center gap-1.5">
                  <ProviderFlag provider={row.provider} />
                  <span>{row.provider}</span>
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                {row.priceInput}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                {row.priceOutput}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                {formatWeightedAverageCost(row.weightedAverageCost)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                <span className={changeClassName(row.closeChangePct)}>
                  {formatChangePct(row.closeChangePct)}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                <span className={changeClassName(
                  computeVariationFromBaseline(row.weightedAverageCost),
                )}>
                  {formatVariationFromBaseline(row.weightedAverageCost)}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                {row.releaseDate ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatWeightedAverageCost(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `$${formatCompactNumber(value)} / 1M tokens`;
}

function ModelIcon({ provider }: { provider: string }) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconSrc = getModelIconSrc(provider);
  const initials = getProviderInitials(provider);

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
      {iconFailed ? (
        <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">
          {initials}
        </span>
      ) : (
        <Image
          src={iconSrc}
          alt=""
          width={20}
          height={20}
          className="h-full w-full object-contain"
          unoptimized
          onError={() => setIconFailed(true)}
        />
      )}
    </span>
  );
}

function ProviderFlag({ provider }: { provider: string }) {
  const country = getProviderFlagCountry(provider);

  if (!country) {
    return null;
  }

  return <CountryFlagIcon country={country} />;
}

function ModelTags({
  isNew,
  isLatest,
}: {
  isNew?: boolean;
  isLatest?: boolean;
}) {
  if (!isNew && !isLatest) {
    return null;
  }

  return (
    <span className="flex items-center gap-1">
      {isNew ? (
        <span className="inline-flex items-center justify-center rounded-sm bg-white/5 p-1 text-[10px] font-medium uppercase leading-none tracking-[0.14em] text-white/40">
          NEW
        </span>
      ) : null}
      {isLatest ? (
        <span className="inline-flex items-center justify-center rounded-sm bg-white/5 p-1 text-[10px] font-medium uppercase leading-none tracking-[0.14em] text-white/40">
          LATEST
        </span>
      ) : null}
    </span>
  );
}

function compareRows(left: ModelRow, right: ModelRow, key: SortKey): number {
  switch (key) {
    case "name":
      return compareText(left.name, right.name);
    case "provider":
      return compareText(left.provider, right.provider);
    case "priceInput":
      return compareNumber(
        parseFormattedPrice(left.priceInput),
        parseFormattedPrice(right.priceInput),
      );
    case "priceOutput":
      return compareNumber(
        parseFormattedPrice(left.priceOutput),
        parseFormattedPrice(right.priceOutput),
      );
    case "weightedAverageCost":
      return compareNumber(left.weightedAverageCost, right.weightedAverageCost);
    case "closeChangePct":
      return compareNumber(left.closeChangePct, right.closeChangePct);
    case "weightedCostVariationPct":
      return compareNumber(
        computeVariationFromBaseline(left.weightedAverageCost),
        computeVariationFromBaseline(right.weightedAverageCost),
      );
    case "releaseDate":
      return compareNumber(left.createdAt, right.createdAt);
  }
}

function getModelIconSrc(provider: string): string {
  const key = normalizeProviderKey(provider);
  if (key === "zai") {
    return "/provider-icons/zai.svg";
  }

  if (key === "inclusionai" || key === "inclusional") {
    return "/provider-icons/inclusionai.svg";
  }

  if (key === "moonshotai") {
    return "/provider-icons/moonshotai.svg";
  }

  if (key === "bytedance") {
    return "/provider-icons/bytedance.svg";
  }

  if (key === "relace") {
    return "/provider-icons/relace.svg";
  }

  if (key === "essentialai") {
    return "/provider-icons/essentialai.svg";
  }

  const domain = getProviderDomain(provider);
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    domain,
  )}&size=256`;
}

function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getProviderDomain(provider: string): string {
  const normalized = provider.trim().toLowerCase();

  switch (normalized) {
    case "anthropic":
      return "https://anthropic.com/";
    case "deepseek":
      return "https://deepseek.com/";
    case "google":
      return "https://google.com/";
    case "bytedance":
      return "https://bytedance.com/";
    case "ibm granite":
      return "https://ibm.com/";
    case "inclusional":
    case "inclusionai":
      return "https://inclusionai.com/";
    case "essential ai":
    case "essentialai":
      return "https://essential.ai/";
    case "minimax":
      return "https://minimax.io/";
    case "mistral ai":
      return "https://mistral.ai/";
    case "moonshot ai":
    case "moonshotai":
    case "moonshot-ai":
      return "https://moonshot.ai/";
    case "relace":
      return "https://relace.ai/";
    case "openai":
      return "https://openai.com/";
    case "qwen":
      return "https://qwenlm.ai/";
    case "xai":
      return "https://x.ai/";
    case "z.ai":
    case "z-ai":
    case "zai":
      return "https://z.ai/";
    case "nvidia":
      return "https://nvidia.com/";
    case "xiaomi":
      return "https://xiaomi.com/";
    case "openrouter":
      return "https://openrouter.ai/";
    default:
      return `https://${normalized.replace(/\s+/g, "")}.com/`;
  }
}

type FlagCountry = "us" | "eu" | "cn";

function CountryFlagIcon({ country }: { country: FlagCountry }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 12"
      className="h-3 w-4 shrink-0 rounded-[2px]"
      fill="none"
    >
      {country === "us" ? (
        <>
          <rect width="16" height="12" rx="2" fill="#fff" />
          <path d="M0 1h16v1H0zM0 3h16v1H0zM0 5h16v1H0zM0 7h16v1H0zM0 9h16v1H0zM0 11h16v1H0z" fill="#b91c1c" />
          <rect width="7" height="6" rx="1.5" fill="#1d4ed8" />
          <circle cx="1.5" cy="1.5" r="0.35" fill="#fff" />
          <circle cx="3" cy="1.5" r="0.35" fill="#fff" />
          <circle cx="4.5" cy="1.5" r="0.35" fill="#fff" />
          <circle cx="2.25" cy="3" r="0.35" fill="#fff" />
          <circle cx="3.75" cy="3" r="0.35" fill="#fff" />
        </>
      ) : null}
      {country === "eu" ? (
        <>
          <rect width="16" height="12" rx="2" fill="#1d4ed8" />
          <circle cx="8" cy="6" r="2.8" fill="none" stroke="#facc15" strokeWidth="1.1" />
          <g fill="#facc15">
            <circle cx="8" cy="2.2" r="0.42" />
            <circle cx="10.2" cy="2.8" r="0.42" />
            <circle cx="11.8" cy="4.4" r="0.42" />
            <circle cx="12.4" cy="6.6" r="0.42" />
            <circle cx="11.8" cy="8.8" r="0.42" />
            <circle cx="10.2" cy="10.4" r="0.42" />
            <circle cx="8" cy="11" r="0.42" />
            <circle cx="5.8" cy="10.4" r="0.42" />
            <circle cx="4.2" cy="8.8" r="0.42" />
            <circle cx="3.6" cy="6.6" r="0.42" />
            <circle cx="4.2" cy="4.4" r="0.42" />
            <circle cx="5.8" cy="2.8" r="0.42" />
          </g>
        </>
      ) : null}
      {country === "cn" ? (
        <>
          <rect width="16" height="12" rx="2" fill="#dc2626" />
          <path
            d="M4.3 3.1l.5 1.4h1.5L5.1 5.4l.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9h1.5z"
            fill="#facc15"
          />
          <circle cx="10.7" cy="2.4" r="0.65" fill="#facc15" />
          <circle cx="12" cy="4" r="0.55" fill="#facc15" />
          <circle cx="12" cy="6.1" r="0.55" fill="#facc15" />
          <circle cx="10.8" cy="7.7" r="0.55" fill="#facc15" />
        </>
      ) : null}
    </svg>
  );
}

function getProviderFlagCountry(provider: string): FlagCountry | null {
  const key = normalizeProviderKey(provider);

  switch (key) {
    case "anthropic":
    case "openai":
    case "google":
    case "xai":
    case "ibmgranite":
    case "nvidia":
    case "essentialai":
    case "relace":
      return "us";
    case "mistralai":
      return "eu";
    case "deepseek":
    case "qwen":
    case "xiaomi":
    case "moonshotai":
    case "inclusionai":
    case "inclusional":
    case "bytedance":
    case "zai":
      return "cn";
    case "minimax":
      return "cn";
    default:
      return null;
  }
}

function getProviderInitials(provider: string): string {
  const parts = provider
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .split(/[\s.]+/g)
    .filter(Boolean);

  if (parts.length === 0) {
    return "•";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatChangePct(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? "+∞%" : "-∞%";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatVariationFromBaseline(value: number | null): string {
  const variation = computeVariationFromBaseline(value);

  if (variation === null) {
    return "—";
  }

  if (!Number.isFinite(variation)) {
    return variation > 0 ? "+∞%" : "-∞%";
  }

  const sign = variation > 0 ? "+" : "";
  return `${sign}${variation.toFixed(2)}%`;
}

function computeVariationFromBaseline(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return ((value - WEIGHTED_COST_BASELINE) / WEIGHTED_COST_BASELINE) * 100;
}

function changeClassName(value: number | null): string {
  if (value === null) {
    return "text-zinc-300";
  }

  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-500";
  }

  return "text-zinc-300";
}

function formatCompactNumber(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return formatted.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function compareText(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function compareNumber(left: number | null, right: number | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    if (!Number.isFinite(left) && !Number.isFinite(right)) {
      return 0;
    }

    if (!Number.isFinite(left)) {
      return left > 0 ? 1 : -1;
    }

    return right > 0 ? -1 : 1;
  }

  return left - right;
}

function parseFormattedPrice(value: string): number | null {
  const match = value.match(/\$([0-9,.]+)\s*\/\s*1M tokens/i);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <span className="w-4 text-zinc-500">
      {active ? (direction === "asc" ? "↑" : "↓") : "—"}
    </span>
  );
}
