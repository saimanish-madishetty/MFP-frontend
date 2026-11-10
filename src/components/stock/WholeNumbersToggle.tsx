"use client";

/** Tick for "supplies in whole numbers": recipe amounts with fractions are rounded down. */
export function WholeNumbersToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className="flex shrink-0 items-center gap-1.5 text-xs text-muted"
      title="Recipe amounts of supplies with fractions are rounded down"
    >
      <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={(e) => onChange(e.target.checked)} />
      Whole numbers only
    </label>
  );
}
