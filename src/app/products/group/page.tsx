"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { formatINR } from "@/lib/format";
import { compareSizes, formatStock, perUnit, sizeLabel, type Product, type ProductGroup } from "@/lib/products";
import { Badge, Button, ButtonLink, Card, ErrorBox, Loading, PageHeader, Sheet } from "@/components/ui";

/** A product with sizes: what they share, and every size with its packing, price and stock. */
function GroupView() {
  const id = useSearchParams().get("id");
  const { data: group, error } = useSWR<ProductGroup>(id ? `/product-groups/${id}` : null);
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const [choosing, setChoosing] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!group || !products) return <Loading />;

  const sizes = products.filter((p) => p.groupId === group.id).sort(compareSizes);
  const template = sizes.find((p) => p.active) ?? sizes[0];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={group.name}
        back="/products/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            On invoices: <strong className="text-foreground">{group.publicName}</strong>
            {group.gstRate !== null && <Badge>GST {Number(group.gstRate)}%</Badge>}
            {group.hsnCode && <Badge>HSN {group.hsnCode}</Badge>}
          </span>
        }
        actions={
          <>
            {template && (
              <ButtonLink href={`/products/new/?group=${group.id}&from=${template.id}`}>+ Add size</ButtonLink>
            )}
            <Button variant="secondary" onClick={() => setChoosing(true)}>
              Edit
            </Button>
          </>
        }
      />

      <Card>
        <p className="border-b border-border px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase">
          {sizes.length} size{sizes.length === 1 ? "" : "s"} · by {group.dimensions.join(" · ")}
        </p>
        <ul className="divide-y divide-border">
          {sizes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/detail/?id=${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {sizeLabel(p)} {p.code && <Badge>{p.code}</Badge>} {!p.active && <Badge>Archived</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.pack.description} ·{" "}
                    {p.pack.units
                      .filter((u) => u.priceSet)
                      .map((u) => `${formatINR(u.price ?? 0)} ${perUnit(u.unit)}`)
                      .join(" · ")}
                  </span>
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    Number(p.currentQty) <= 0 ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {formatStock(p, p.currentQty)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Sheet open={choosing} title="What do you want to edit?" onClose={() => setChoosing(false)}>
        <div className="space-y-3">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {sizes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/edit/?id=${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{sizeLabel(p)}</span>
                    <span className="block truncate text-xs text-muted">
                      Packing, price, materials · {p.pack.description}
                    </span>
                  </span>
                  <span className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/products/group/edit/?id=${group.id}`}
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Product details</span>
              <span className="block text-xs text-muted">Name, invoice name, HSN, GST and what varies</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        </div>
      </Sheet>
      <p className="text-xs text-muted">
        Each size has its own packing, price, recipe and stock. Name, invoice name, HSN and GST are shared: change them
        with Edit.
      </p>
    </div>
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <GroupView />
    </Suspense>
  );
}
