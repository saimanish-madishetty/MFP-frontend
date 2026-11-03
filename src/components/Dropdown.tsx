"use client";

import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackClose } from "@/lib/back-stack";

/**
 * The app's dropdown. Drop-in for `<select>`: same `value` / `onChange(e.target.value)` and
 * `<option>` children, so screens don't change. On phones it opens as a bottom sheet with big
 * rows; on wider screens as a list under the field. Long lists (more than 8) get a search box.
 *
 * An `<option value="">` is the placeholder shown when nothing is chosen. It is also offered in
 * the list as a "none" choice (e.g. "—"), unless it ends with "…" ("Choose buyer…", "+ Add product…")
 * or the dropdown is `required`.
 */
type Opt = { value: string; label: string; node: React.ReactNode; disabled: boolean };

export type DropdownProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value?: string | number | null;
  onChange?: (e: { target: { value: string } }) => void;
  /** Force the search box on (true) or off (false); default: on for more than 8 choices */
  searchable?: boolean;
};

const SEARCH_FROM = 9;

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function readOptions(children: React.ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: React.ReactNode; value?: unknown; disabled?: boolean }>(child)) return;
    if (child.type === Fragment) readOptions(child.props.children, out);
    else if (child.type === "option") {
      const label = textOf(child.props.children).trim();
      out.push({
        value: child.props.value === undefined ? label : String(child.props.value),
        label,
        node: child.props.children,
        disabled: !!child.props.disabled,
      });
    }
  });
  return out;
}

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
    className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4 shrink-0">
    <path
      fillRule="evenodd"
      d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
      clipRule="evenodd"
    />
  </svg>
);

export function Dropdown({
  value,
  onChange,
  children,
  disabled,
  required,
  className = "",
  searchable,
  id,
  name,
  autoFocus,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const options = readOptions(children);
  const current = value === null || value === undefined ? "" : String(value);
  const selected = options.find((o) => o.value === current);
  const placeholder = options.find((o) => o.value === "");
  const listed = options.filter(
    (o) => o.value !== "" || (!required && !o.label.endsWith("…") && o.label !== ""),
  );
  const withSearch = searchable ?? listed.length >= SEARCH_FROM;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number }>();
  const [title, setTitle] = useState("");
  const phone = useIsPhone();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const q = query.trim().toLowerCase();
  const shown = q ? listed.filter((o) => o.label.toLowerCase().includes(q)) : listed;

  const close = (refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  };
  useBackClose(open, () => close());

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const width = Math.max(r.width, 220);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    if (below < 240 && above > below)
      setPos({ left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(above, 360) });
    else setPos({ left, width, top: r.bottom + 4, maxHeight: Math.min(below, 360) });
  };

  const openList = () => {
    if (disabled) return;
    const label = triggerRef.current?.closest("label")?.querySelector("span")?.textContent;
    setTitle(ariaLabel || label || (placeholder?.label.replace(/…$/, "") ?? "") || "Choose");
    place();
    setActive(Math.max(0, listed.findIndex((o) => o.value === current && !o.disabled)));
    setOpen(true);
  };

  const choose = (o: Opt) => {
    if (o.disabled) return;
    close();
    if (o.value !== current) onChange?.({ target: { value: o.value } });
  };

  // Desktop list follows the field; scrolling the page closes it.
  useEffect(() => {
    if (!open || phone) return;
    const onScroll = (e: Event) => {
      if (listRef.current?.parentElement?.contains(e.target as Node)) return;
      close(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, phone]);

  // Search box gets the keys on desktop; on phones it waits for a tap (keyboard would cover the list).
  useEffect(() => {
    if (!open) return;
    if (withSearch && !phone) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, withSearch, phone]);

  useLayoutEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const move = (step: number) => {
    if (shown.length === 0) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(shown.length - 1);
    else if (e.key === "Enter") {
      if (shown[active]) choose(shown[active]);
    }
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return close(false);
    else if (!withSearch && e.key.length === 1) {
      // Type-ahead: jump to the first choice starting with the letters typed.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const i = shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    } else return;
    e.preventDefault();
    e.stopPropagation(); // keep Escape from also closing a sheet underneath
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const hasWidth = /(^|\s)w-/.test(className);
  const empty = !selected || selected.value === "";

  const list = (
    <>
      {withSearch && (
        <div className="border-b border-border p-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onListKey}
            placeholder="Search…"
            aria-controls={listId}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-brand sm:text-sm"
          />
        </div>
      )}
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        onKeyDown={onListKey}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="overflow-y-auto overscroll-contain p-1 outline-none"
      >
        {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">No match</li>}
        {shown.map((o, i) => {
          const isSel = o.value === current;
          return (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={isSel}
              aria-disabled={o.disabled || undefined}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => choose(o)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-base sm:py-2 sm:text-sm ${
                o.disabled ? "cursor-not-allowed opacity-40" : ""
              } ${i === active && !o.disabled ? "bg-surface-2" : ""} ${isSel ? "font-medium text-brand" : ""} ${
                o.value === "" ? "text-muted" : ""
              }`}
            >
              <span className="min-w-0 flex-1">{o.node}</span>
              {isSel && <Check />}
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className={`relative ${hasWidth ? "inline-block" : "block w-full"} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={`flex w-full items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-left text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${
          open ? "border-brand ring-2 ring-brand/20" : "border-border"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${empty ? "text-muted" : ""}`}>
          {selected ? selected.node : (placeholder?.node ?? "Choose…")}
        </span>
        <Chevron open={open} />
      </button>
      {required && (
        // Lets the browser's "please fill in" check work like it does for <select required>.
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={current}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      )}

      {open &&
        createPortal(
          phone ? (
            <div className="fixed inset-0 z-[60] flex items-end">
              <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => close()} />
              <div className="relative flex max-h-[75dvh] w-full flex-col rounded-t-2xl bg-surface pb-safe-bottom shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="font-semibold">{title}</h2>
                  <button
                    type="button"
                    onClick={() => close()}
                    className="rounded-lg p-1 text-muted hover:bg-surface-2"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                {list}
              </div>
            </div>
          ) : (
            <div className="fixed inset-0 z-[60]" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
              <div
                style={{ left: pos?.left, width: pos?.width, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxHeight }}
                className="absolute flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
              >
                {list}
              </div>
            </div>
          ),
          document.body,
        )}
    </div>
  );
}
