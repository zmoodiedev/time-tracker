import { Check, Minus, Plus } from "lucide-react";
import type { Project } from "@/lib/types";
import { fx } from "@/lib/fx";
import { cn } from "@/lib/utils";

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Tinted background for a project color. */
export const tint = (color: string, pct = 16) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {right}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        fx.tap();
        onChange(!checked);
      }}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-input")}
    >
      <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => {
            fx.tap();
            onChange(o.value);
          }}
          className={cn(
            "min-h-9 flex-1 rounded-lg px-2 text-sm font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step, min, max, format }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; format: (v: number) => string }) {
  const btn = "grid size-10 place-items-center rounded-full bg-muted active:scale-90 disabled:opacity-40";
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Less" className={btn} disabled={value <= min} onClick={() => (fx.tap(), onChange(Math.max(min, value - step)))}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-16 text-center font-semibold tabular-nums">{format(value)}</span>
      <button type="button" aria-label="More" className={btn} disabled={value >= max} onClick={() => (fx.tap(), onChange(Math.min(max, value + step)))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {projects.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              fx.tap();
              onChange(p.id);
            }}
            className={cn("flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-medium", !active && "border-transparent bg-muted")}
            style={active ? { borderColor: p.color, background: tint(p.color) } : undefined}
          >
            <Dot color={p.color} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {active && <Check className="size-4 shrink-0" style={{ color: p.color }} />}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
