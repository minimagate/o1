import type { ModelRow } from "@/lib/model-snapshot";

const HEADERS = [
  { key: "name", label: "Name" },
  { key: "provider", label: "Provider" },
  { key: "priceInput", label: "Price Input" },
  { key: "priceOutput", label: "Price Output" },
  { key: "weightedAverageCost", label: "Weighted Avg Cost" },
  { key: "closeChangePct", label: "% change" },
  { key: "releaseDate", label: "Release Date" },
] as const;

const DIVIDER_CLASS = "border-b border-white/5";

export function ModelTable({ rows }: { rows: ModelRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm leading-5">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
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
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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

function changeClassName(value: number | null): string {
  if (value === null) {
    return "text-zinc-300";
  }

  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-zinc-300";
}

function formatCompactNumber(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return formatted.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}
