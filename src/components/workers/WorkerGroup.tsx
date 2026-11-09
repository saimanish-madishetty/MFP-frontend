"use client";

import { useState } from "react";
import { searchFilter } from "@/lib/search";
import { Input } from "@/components/ui";

/**
 * Permanent or temporary workers: a heading, its own search box and a list that scrolls on its own,
 * about three workers tall (`heightClass`), so both groups fit on screen together.
 */
export function WorkerGroup<T>({
  title,
  items,
  fields,
  heightClass,
  listClassName = "space-y-2",
  children,
}: {
  title: string;
  items: T[];
  /** What the search box looks in, e.g. name and role */
  fields: (item: T) => (string | null | undefined)[];
  heightClass: string;
  listClassName?: string;
  children: (item: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const shown = searchFilter(items, query, fields);
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {title} · {query ? `${shown.length} of ${items.length}` : items.length}
      </h2>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${title.toLowerCase()} workers`}
        aria-label={`Search ${title.toLowerCase()} workers`}
      />
      <div className={`${heightClass} overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-2 p-2`}>
        {shown.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted">
            {items.length === 0 ? `No ${title.toLowerCase()} workers.` : "No worker matches."}
          </p>
        ) : (
          <ul className={listClassName}>{shown.map(children)}</ul>
        )}
      </div>
    </section>
  );
}
