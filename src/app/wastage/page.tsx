"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { addMonths, formatDay, formatMonth, todayIST } from "@/lib/format";
import { formatStock, type Product } from "@/lib/products";
import { searchFilter } from "@/lib/search";
import { formatQty, unitShort } from "@/lib/stock";
import {
  addUp,
  formatTotal,
  measureFor,
  shortTotal,
  type Measure,
  type Total,
  type WastageData,
  type WastageDataLine,
} from "@/lib/wastage";
import { Button, Empty, ErrorBox, Input, Loading, PageHeader, Segmented, Sheet } from "@/components/ui";
import { ProductName } from "@/components/stock/Wastage";

type Tab = "day" | "product";
type Material = WastageData["materials"][number];
const WEEK_HEADER = ["S", "M", "T", "W", "T", "F", "S"];
const OVER = "text-amber-600 dark:text-amber-400";
const UNDER = "text-green-700 dark:text-green-400";

/** What the screen is showing: the chosen materials (none = all) and how they add up. */
type View = { chosen: Set<number>; byId: Map<number, Material>; measure: Measure };

const pick = (lines: WastageDataLine[], view: View) =>
  view.chosen.size === 0 ? lines : lines.filter((l) => view.chosen.has(l.materialId));

/**
 * Wastage: materials used beyond the recipe, from Add production. A material filter (several can
 * be chosen) decides what's added up: in kg / pcs when the chosen materials share a unit, else ₹.
 * By day: a calendar; a day opens each product made. By product: a product opens its days.
 */
function WastageHome() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "product" ? "product" : "day";
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const { data: all, error } = useSWR<WastageData>("/stock/production/wastage/lines");
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  const productById = new Map(products?.map((p) => [p.id, p]));
  const byId = new Map(all?.materials.map((m) => [m.id, m]));
  const view: View = {
    chosen,
    byId,
    measure: measureFor([...chosen].map((id) => byId.get(id)).filter((m): m is Material => !!m)),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Wastage" back="/" subtitle="Materials used beyond the recipe, from Add production" />
      <Segmented<Tab>
        value={tab}
        onChange={(v) => router.replace(v === "product" ? "/wastage/?tab=product" : "/wastage/")}
        options={[
          { value: "day", label: "By day" },
          { value: "product", label: "By product" },
        ]}
      />
      <ErrorBox error={error} />
      {!products || !all ? (
        <Loading />
      ) : (
        <>
          <MaterialFilter materials={all.materials} chosen={chosen} onChange={setChosen} measure={view.measure} />
          {tab === "day" ? (
            <ByDay view={view} productById={productById} />
          ) : (
            <ByProduct data={all} view={view} productById={productById} />
          )}
        </>
      )}
      <p className="px-1 text-xs text-muted">
        ₹ amounts use each material&apos;s latest purchase price, so they are estimates. Supplies are entered for the
        whole day, so they are compared with what that day&apos;s products need and shared out between them. Green
        means less was used than the recipe.
      </p>
    </div>
  );
}

/** Raw materials and supplies, several can be chosen, with a search box. */
function MaterialFilter({
  materials,
  chosen,
  onChange,
  measure,
}: {
  materials: Material[];
  chosen: Set<number>;
  onChange: (next: Set<number>) => void;
  measure: Measure;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const list = searchFilter(
    [...materials].sort((a, b) => a.name.localeCompare(b.name)),
    q,
    (m) => [m.name],
  );
  const picked = materials.filter((m) => chosen.has(m.id));
  const showing =
    measure.kind === "qty"
      ? `Showing ${unitShort(measure.unit)}`
      : chosen.size > 1
        ? "Showing ₹ (units differ)"
        : "Showing ₹";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left"
      >
        <span className="min-w-0 truncate">
          <span className="text-sm text-muted">Materials: </span>
          <span className="font-medium">
            {picked.length === 0 ? "All" : picked.length === 1 ? picked[0].name : `${picked.length} chosen`}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">{showing} ▾</span>
      </button>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className="rounded-full border border-brand/50 bg-brand/10 px-2.5 py-1 text-xs font-medium"
            >
              {m.name} ✕
            </button>
          ))}
          <button type="button" onClick={() => onChange(new Set())} className="px-2 py-1 text-xs text-brand">
            Clear
          </button>
        </div>
      )}
      {open && (
        <Sheet open title="Materials" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <Input placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
            {(["RAW", "SUPPLY"] as const).map((type) => {
              const rows = list.filter((m) => m.type === type);
              if (rows.length === 0) return null;
              return (
                <div key={type}>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                    {type === "RAW" ? "Raw materials" : "Packaging & supplies"}
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {rows.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={chosen.has(m.id)}
                            onChange={() => toggle(m.id)}
                            className="h-5 w-5 accent-[var(--brand)]"
                          />
                          <span className="flex-1">{m.name}</span>
                          <span className="text-xs text-muted">{unitShort(m.unit)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {list.length === 0 && <p className="text-sm text-muted">No material matches.</p>}
            <div className="flex justify-between gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={() => onChange(new Set())}>
                Clear all
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function TotalText({ total, measure, className = "" }: { total: Total; measure: Measure; className?: string }) {
  const tone = total.amount > 0 ? OVER : total.amount < 0 ? UNDER : "text-muted";
  return (
    <span className={`tabular-nums ${tone} ${className}`}>
      {formatTotal(total, measure)}
      {total.missing && measure.kind === "value" && <span className="text-muted"> (some prices missing)</span>}
    </span>
  );
}

/** One material for one product on one day: "Atta: 810 kg of 807.2 kg · +2.8 kg (0.3%)". */
function LineRow({ line, material }: { line: WastageDataLine; material?: Material }) {
  const unit = material?.unit;
  const w = line.expected === null ? null : Number(line.used) - Number(line.expected);
  const pct = w !== null && Number(line.expected) > 0 ? Math.round((w / Number(line.expected)) * 1000) / 10 : null;
  return (
    <p className="flex justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-muted">
        {material?.name ?? "?"}: {formatQty(line.used, unit)}
        {line.expected !== null && ` of ${formatQty(line.expected, unit)}`}
        {line.shared && " · shared"}
      </span>
      <span className="shrink-0">
        {w === null ? (
          <span className="text-muted">not in recipe</span>
        ) : Math.abs(w) < 0.0005 ? (
          <span className="text-muted">as recipe</span>
        ) : (
          <span className={w > 0 ? OVER : UNDER}>
            {w > 0 ? "+" : "−"}
            {formatQty(Math.round(Math.abs(w) * 1000) / 1000, unit)}
            {pct !== null && ` (${Math.abs(pct)}%)`}
          </span>
        )}
      </span>
    </p>
  );
}

/** A product made on a day: how much, the chosen materials vs. the recipe, and the total. */
function ProductDay({
  product,
  madeStock,
  lines,
  view,
  title,
}: {
  product?: Product;
  madeStock?: string;
  lines: WastageDataLine[];
  view: View;
  title: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        {title}
        <TotalText total={addUp(lines, view.byId, view.measure)} measure={view.measure} className="shrink-0 text-xs" />
      </div>
      <p className="text-xs">
        Made <strong>{product && madeStock ? formatStock(product, madeStock) : "—"}</strong>
      </p>
      {lines.length === 0 ? (
        <p className="text-xs text-muted">None of the chosen materials.</p>
      ) : (
        lines.map((l) => <LineRow key={l.materialId} line={l} material={view.byId.get(l.materialId)} />)
      )}
    </div>
  );
}

function ByDay({ view, productById }: { view: View; productById: Map<number, Product> }) {
  const today = todayIST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useSWR<WastageData>(`/stock/production/wastage/lines?month=${month}`);

  const lines = pick(data?.lines ?? [], view);
  const days = new Map<string, WastageDataLine[]>();
  for (const d of data?.made ?? []) days.set(d.date, []);
  for (const l of lines) days.set(l.date, [...(days.get(l.date) ?? []), l]);

  const first = new Date(`${month}-01T00:00:00Z`);
  const leadingBlanks = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const monthTotal = addUp(lines, view.byId, view.measure);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          ‹
        </Button>
        <span className="font-medium">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
        >
          ›
        </Button>
      </div>
      <ErrorBox error={error} />
      {!data && <Loading />}

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEK_HEADER.map((d, i) => (
          <div key={i} className="py-1 text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const dayLines = days.get(date);
          const t = dayLines ? addUp(dayLines, view.byId, view.measure) : null;
          const cell = !t
            ? "bg-surface-2/60 text-muted"
            : t.counted === 0
              ? "bg-surface-2 text-foreground"
              : t.amount > 0
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                : "bg-green-600/10 text-green-800 dark:text-green-300";
          return (
            <button
              key={date}
              type="button"
              disabled={!t}
              onClick={() => setOpen(date)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium disabled:opacity-50 ${cell} ${
                date === today ? "ring-2 ring-brand" : ""
              }`}
            >
              {i + 1}
              {t && t.amount !== 0 && (
                <span className="max-w-full truncate px-0.5 text-[10px] leading-none font-normal tabular-nums">
                  {shortTotal(t, view.measure)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500/30" /> More than recipe
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-green-600/25" /> Within recipe
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-surface-2" /> No production
        </span>
      </div>

      {data && (
        <p className="flex justify-between gap-2 border-t border-border pt-3 text-sm">
          <span>
            {formatMonth(month)} · {days.size} production day{days.size === 1 ? "" : "s"}
          </span>
          {days.size > 0 && <TotalText total={monthTotal} measure={view.measure} />}
        </p>
      )}

      {open && data && (
        <Sheet open title={formatDay(open, { weekday: true })} onClose={() => setOpen(null)}>
          <div className="space-y-3">
            <p className="flex justify-between gap-2 text-sm">
              <span className="text-muted">Whole day</span>
              <TotalText total={addUp(days.get(open) ?? [], view.byId, view.measure)} measure={view.measure} />
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {[
                ...new Set([
                  ...data.made.filter((m) => m.date === open).map((m) => m.productId),
                  ...(days.get(open) ?? []).map((l) => l.productId),
                ]),
              ].map((productId) => {
                const product = productById.get(productId);
                return (
                  <li key={productId} className="p-3">
                    <ProductDay
                      product={product}
                      madeStock={data.made.find((m) => m.date === open && m.productId === productId)?.madeStock}
                      lines={(days.get(open) ?? []).filter((l) => l.productId === productId)}
                      view={view}
                      title={<ProductName product={product} />}
                    />
                  </li>
                );
              })}
            </ul>
            <Link href={`/production/?date=${open}`} className="block text-sm font-medium text-brand">
              Open this day&apos;s production ›
            </Link>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ByProduct({
  data,
  view,
  productById,
}: {
  data: WastageData;
  view: View;
  productById: Map<number, Product>;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  if (data.made.length === 0) return <Empty>Nothing made yet. Production entered in Add production shows here.</Empty>;

  const lines = pick(data.lines, view);
  const summary = [...new Set(data.made.map((m) => m.productId))].map((productId) => {
    const dates = data.made.filter((m) => m.productId === productId).map((m) => m.date);
    return {
      productId,
      product: productById.get(productId),
      days: new Set(dates).size,
      lastDate: dates.sort().at(-1) ?? null,
      total: addUp(
        lines.filter((l) => l.productId === productId),
        view.byId,
        view.measure,
      ),
    };
  });
  summary.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
  const rows = searchFilter(summary, q, (r) => [r.product?.internalName ?? ""]);
  const product = open !== null ? productById.get(open) : undefined;
  const productDays =
    open === null
      ? []
      : [
          ...new Set([
            ...data.made.filter((m) => m.productId === open).map((m) => m.date),
            ...lines.filter((l) => l.productId === open).map((l) => l.date),
          ]),
        ]
          .sort()
          .reverse();

  return (
    <div className="space-y-3">
      {summary.length > 6 && <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />}
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.productId}>
            <button
              type="button"
              onClick={() => setOpen(r.productId)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <ProductName product={r.product} />
                <span className="block text-xs text-muted">
                  {r.days} production day{r.days === 1 ? "" : "s"}
                  {r.lastDate && ` · last ${formatDay(r.lastDate, { year: false })}`}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <TotalText total={r.total} measure={view.measure} />
                <span className="block text-xs text-muted">in total ›</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Sheet open title={product?.internalName ?? "Product"} onClose={() => setOpen(null)}>
          <div className="space-y-3">
            <p className="flex justify-between gap-2 text-sm">
              <span className="text-muted">
                {productDays.length} production day{productDays.length === 1 ? "" : "s"}
              </span>
              <TotalText
                total={addUp(
                  lines.filter((l) => l.productId === open),
                  view.byId,
                  view.measure,
                )}
                measure={view.measure}
              />
            </p>
            <ul className="divide-y divide-border">
              {productDays.map((date) => (
                <li key={date} className="py-2">
                  <ProductDay
                    product={product}
                    madeStock={data.made.find((m) => m.date === date && m.productId === open)?.madeStock}
                    lines={lines.filter((l) => l.productId === open && l.date === date)}
                    view={view}
                    title={
                      <Link href={`/production/?date=${date}`} className="text-sm font-medium hover:text-brand">
                        {formatDay(date, { weekday: true })} ›
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>
            {product && (
              <Link href={`/products/detail/?id=${product.id}`} className="block text-sm font-medium text-brand">
                Open product ›
              </Link>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

export default function WastagePage() {
  return (
    <Suspense fallback={<Loading />}>
      <WastageHome />
    </Suspense>
  );
}
