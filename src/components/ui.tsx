"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useBackClose } from "@/lib/back-stack";
import { BackLink } from "./BackLink";
import { addDays, formatDay, todayIST } from "@/lib/format";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const VARIANTS = {
  primary: "bg-brand text-brand-fg hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-surface-2",
  ghost: "hover:bg-surface-2",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-border bg-surface ${className}`}>{children}</div>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "green" | "red" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    brand: "bg-brand/15 text-brand",
    green: "bg-green-500/15 text-green-700 dark:text-green-400",
    red: "bg-red-500/15 text-red-700 dark:text-red-400",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const INPUT =
  "rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm";

/** Full width unless the caller sets its own width (e.g. "w-24"). */
const inputClass = (extra = "") => `${INPUT} ${/(^|\s)w-/.test(extra) ? "" : "w-full"} ${extra}`;

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass(props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass(props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={inputClass(props.className)} />;
}

/** Row of mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? "bg-surface shadow-sm" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useBackClose(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface pb-safe-bottom shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <BackLink href={back} />
        )}
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
      {message}
    </div>
  );
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-muted">Loading…</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

/** ‹ date › picker for daily screens. Future dates are not allowed. */
export function DateStepper({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayIST();
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="lg" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        ‹
      </Button>
      <label className="relative flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-center font-medium">
        {date === today ? `Today · ${formatDay(date, { year: false })}` : formatDay(date)}
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Button
        variant="secondary"
        size="lg"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
      >
        ›
      </Button>
    </div>
  );
}

/** Label / value row used in summaries. */
export function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 ${strong ? "font-semibold" : ""} ${muted ? "text-muted" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
