"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { Buyer } from "@/lib/buyers";
import { formatDay, todayIST } from "@/lib/format";
import { refreshOrders, type Order } from "@/lib/orders";
import { formatStock, unitFactor, type Product } from "@/lib/products";
import { formatQty, unitShort, type Unit } from "@/lib/stock";
import { useCanEdit } from "@/lib/use-auth";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Segmented, Select, Sheet } from "@/components/ui";

type Status = "open" | "done";

/** Add or edit an order: buyer, product, quantity (+ optional deliver-by date and note). */
function OrderSheet({ order, onClose }: { order?: Order; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { data: buyers } = useSWR<Buyer[]>("/buyers");
  const { data: products } = useSWR<Product[]>("/products");
  const [buyerId, setBuyerId] = useState(order ? String(order.buyer.id) : "");
  const [productId, setProductId] = useState(order ? String(order.product.id) : "");
  const [quantity, setQuantity] = useState(order ? String(Number(order.quantity)) : "");
  const [unit, setUnit] = useState<Unit | "">(order?.unit ?? "");
  const [dueDate, setDueDate] = useState(order?.dueDate ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const product = products?.find((p) => String(p.id) === productId);
  const units = product?.pack.units.map((u) => u.unit) ?? [];

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products?.find((x) => String(x.id) === id);
    setUnit(p ? p.pack.defaultUnit : "");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      buyerId: Number(buyerId),
      productId: Number(productId),
      quantity: Number(quantity),
      ...(unit && { unit }),
      dueDate: dueDate || null,
      note: note.trim() || null,
    };
    try {
      if (order) await api(`/orders/${order.id}`, "PATCH", body);
      else await api("/orders", "POST", body);
      await mutate(refreshOrders);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={order ? "Edit order" : "Add order"} onClose={onClose}>
      {!buyers || !products ? (
        <Loading />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="Buyer">
            <Select required value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              <option value="">Choose buyer…</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product" hint={product ? `In stock: ${formatStock(product, product.currentQty)}` : undefined}>
            <Select required value={productId} onChange={(e) => pickProduct(e.target.value)}>
              <option value="">Choose product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.internalName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input
                type="number"
                inputMode="decimal"
                min={0.001}
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="In">
              {units.length > 1 ? (
                <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {unitShort(u)}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="py-2.5 text-sm">{unit ? unitShort(unit) : "—"}</p>
              )}
            </Field>
            <Field label="Deliver by" hint="Optional">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Note" hint="Optional">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <ErrorBox error={error} />
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? "Saving…" : order ? "Save changes" : "Add order"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Open orders added up per product, next to what's in stock. */
function ToMake({ orders }: { orders: Order[] }) {
  const { data: products } = useSWR<Product[]>("/products");
  if (!products || orders.length === 0) return null;
  const byId = new Map(products.map((p) => [p.id, p]));
  const totals = new Map<number, number>(); // in stock units
  for (const o of orders) {
    const p = byId.get(o.product.id);
    if (!p) continue;
    totals.set(p.id, (totals.get(p.id) ?? 0) + Number(o.quantity) * unitFactor(p, o.unit));
  }
  if (totals.size === 0) return null;
  return (
    <Card className="p-4 text-sm">
      <p className="mb-2 text-xs text-muted">Ordered vs in stock</p>
      <ul className="space-y-1">
        {[...totals].map(([id, qty]) => {
          const p = byId.get(id)!;
          const short = qty > Number(p.currentQty);
          return (
            <li key={id} className="flex justify-between gap-3">
              <span className="truncate">{p.internalName}</span>
              <span className="shrink-0 text-right tabular-nums">
                {formatStock(p, qty)}
                <span className={short ? "text-red-600 dark:text-red-400" : "text-muted"}>
                  {" "}
                  · {formatStock(p, p.currentQty)} in stock
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function OrdersPage() {
  const { mutate } = useSWRConfig();
  const canEdit = useCanEdit();
  const [status, setStatus] = useState<Status>("open");
  const { data, error, isLoading } = useSWR<Order[]>(`/orders?status=${status}`);
  const [editing, setEditing] = useState<Order | "new" | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const today = todayIST();

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id);
    setActionError(null);
    try {
      await fn();
      await mutate(refreshOrders);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader
        title="Orders"
        subtitle="What buyers have ordered, until it's delivered"
        actions={canEdit && <Button onClick={() => setEditing("new")}>+ Add order</Button>}
      />
      <Segmented<Status>
        value={status}
        onChange={setStatus}
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Completed" },
        ]}
      />

      <ErrorBox error={error ?? actionError} />
      {isLoading && <Loading />}
      {data && data.length === 0 && (
        <Empty>{status === "open" ? "No open orders." : "No completed orders yet."}</Empty>
      )}
      {status === "open" && data && <ToMake orders={data} />}

      <ul className="space-y-2">
        {data?.map((o) => (
          <li key={o.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditing(o)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-medium">{o.product.internalName}</p>
                <p className="truncate text-sm">{o.buyer.name}</p>
                <p className="truncate text-xs text-muted">
                  Ordered {formatDay(o.orderDate, { year: false })}
                  {o.completedAt
                    ? ` · completed ${formatDay(o.completedAt.slice(0, 10), { year: false })}`
                    : o.dueDate && ` · deliver by ${formatDay(o.dueDate, { year: false })}`}
                  {o.note && ` · ${o.note}`}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold tabular-nums">{formatQty(o.quantity, o.unit)}</span>
                {o.overdue && <Badge tone="red">Late</Badge>}
                {!o.completedAt && !o.overdue && o.dueDate === today && <Badge tone="amber">Due today</Badge>}
                {o.completedAt && <Badge tone="green">Completed</Badge>}
              </div>
            </div>
            {canEdit && (
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() =>
                    confirm(`Delete this order from ${o.buyer.name}?`) &&
                    act(o.id, () => api(`/orders/${o.id}`, "DELETE"))
                  }
                >
                  Delete
                </Button>
                {o.completedAt ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === o.id}
                    onClick={() => act(o.id, () => api(`/orders/${o.id}/reopen`, "POST"))}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy === o.id}
                    onClick={() => act(o.id, () => api(`/orders/${o.id}/complete`, "POST"))}
                  >
                    ✓ Mark as complete
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing && <OrderSheet order={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
