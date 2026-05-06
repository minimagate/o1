"use client";

import { useMemo, useState } from "react";
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

const WEIGHTED_COST_BASELINE = 9;

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
                {row.name}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                {row.provider}
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
