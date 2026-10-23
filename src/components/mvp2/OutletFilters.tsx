"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, ListFilter, MapPin, Plus, Search, Store as StoreIcon, X, type LucideIcon } from "lucide-react";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { totals } from "@/components/finance/PnlStory";
import { usd } from "@/components/finance/parts";
import { TYPICAL } from "@/lib/finance/costSettings";
import { OUTLETS, STATE_NAME, outletOf, type Store } from "@/lib/finance/outlets";
import {
  FIELDS,
  NO_FILTER,
  OPS,
  QUICK,
  activeCount,
  choices,
  filterStores,
  matches,
  newRule,
  pillRule,
  setPill,
  valueLabel,
  type Field,
  type Op,
  type OutletFilter,
  type OutletStats,
  type Rule,
} from "@/lib/finance/outletFilter";
import { cn } from "@/lib/utils";

// Which outlets a report covers, after Asana's filters (Mobbin: Asana portfolios and project list).
//   pills    State ▾  City ▾  Outlet ▾ beside the date. Each opens a "Find a …" search over its values,
//            narrowed by the other filters and counted; a pick applies at once. A pill in use turns brand orange and
//            names its pick ("Illinois", "Chicago +2"), with × to clear it.
//   Filter   the button before them opens the whole panel: quick filters as toggle chips, then every rule as
//            [field] [is / is not] [values] ×, and "+ Add filter". In use it reads "Filters: n" with × to clear all.
// All of them must hold. The pills edit each field's "is" rule, so the panel and the pills never disagree.

const FIELD_ICON: Record<Field, LucideIcon> = { state: MapPin, city: Building2, outlet: StoreIcon };

/** The filter, each outlet's figures for the range (for the menus and the ranking quick filters) and the outlets it leaves. */
export function useOutletFilter(range: [number, number]) {
  const [filter, setFilter] = useState<OutletFilter>(NO_FILTER);
  const [a, b] = range;
  const stats: OutletStats = useMemo(
    () =>
      new Map(
        OUTLETS.map((o) => {
          const t = totals([o.store], a, b, () => TYPICAL);
          return [o.store, { sales: t.all.sales, appShare: t.all.sales ? 1 - t.cols.instore.sales / t.all.sales : 0 }];
        }),
      ),
    [a, b],
  );
  const stores = useMemo(() => filterStores(filter, stats), [filter, stats]);
  return { filter, setFilter, stats, stores, filtered: activeCount(filter) > 0 };
}
export type OutletScope = ReturnType<typeof useOutletFilter>;

/** The Filter button and the State / City / Outlet pills. */
export function OutletFilters({ scope }: { scope: OutletScope }) {
  return (
    <>
      <FilterPanel scope={scope} />
      {FIELDS.map((f) => (
        <FieldPill key={f.key} field={f.key} scope={scope} />
      ))}
    </>
  );
}

/** "12 of 34 outlets", for the bar's right end while filtered. */
export function OutletCount({ scope }: { scope: OutletScope }) {
  if (!scope.filtered) return null;
  return (
    <span className="text-body-sm text-(--color-text-secondary) tabular-nums">
      {scope.stores.length} of {OUTLETS.length} outlets
    </span>
  );
}

/** In place of a report when the filters leave no outlet. */
export function NoOutlets({ scope }: { scope: OutletScope }) {
  return (
    <div className="mx-4 mt-3 flex flex-col items-center gap-3 rounded-large border border-dashed border-(--color-border-default) px-6 py-16 text-center">
      <ListFilter aria-hidden className="size-6 text-(--color-text-tertiary)" />
      <div>
        <p className="text-subtitle-sm text-(--color-text-primary)">No outlets match these filters</p>
        <p className="mt-1 text-body-sm text-(--color-text-secondary)">Remove a filter, or clear them to see all {OUTLETS.length} outlets.</p>
      </div>
      <button type="button" onClick={() => scope.setFilter(NO_FILTER)} className="h-8 rounded-medium border border-(--color-border-default) px-3 text-menu-sm text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        Clear filters
      </button>
    </div>
  );
}

// ───────────────────────── Pieces ─────────────────────────

function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  return { open, setOpen, root, close };
}

const chip = (on: boolean) =>
  cn(
    "flex h-8 items-center gap-1.5 rounded-medium border text-menu-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
    on ? "border-(--brand-700) bg-(--brand-300) text-(--color-text-clickable) hover:bg-(--brand-400)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary) hover:bg-(--color-neutral-lightest)",
  );
const menu = "absolute top-full left-0 z-30 mt-1.5 overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_8px_24px_rgb(0_0_0/0.12)]";

/** Values the other filters leave, counted, plus anything already picked. */
function optionsFor(field: Field, scope: OutletScope, skip?: Rule) {
  const within = OUTLETS.filter((o) => matches(o, scope.filter, scope.stats, skip));
  const picked = skip?.values ?? [];
  return choices(field, within).filter((c) => c.count > 0 || picked.includes(c.value));
}

/** Asana's assignee menu: "Find a …" on top, then the values; a click picks or unpicks at once. */
function OptionList({ field, options, value, onChange, stats }: { field: Field; options: { value: string; count: number }[]; value: string[]; onChange: (v: string[]) => void; stats: OutletStats }) {
  const [query, setQuery] = useState("");
  const meta = FIELDS.find((f) => f.key === field)!;
  const q = query.trim().toLowerCase();
  const sub = (v: string) => {
    if (field !== "outlet") return null;
    const o = outletOf(v as Store);
    return `${o.city}, ${o.state}`;
  };
  const shown = options.filter((o) => !q || `${valueLabel(field, o.value)} ${sub(o.value) ?? ""} ${field === "state" ? o.value : ""}`.toLowerCase().includes(q));
  const flip = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="w-72">
      <div className="p-2">
        <label className="flex h-8 items-center gap-2 rounded-medium border border-(--color-focus-primary) px-2.5 outline-2 -outline-offset-1 outline-(--color-focus-primary)/30">
          <Search aria-hidden className="size-3.5 shrink-0 text-(--color-text-secondary)" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && shown[0] && flip(shown[0].value)}
            placeholder={`${meta.find}…`}
            aria-label={meta.find}
            className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary)"
          />
        </label>
      </div>
      <ul role="listbox" aria-multiselectable aria-label={meta.label} className="max-h-72 overflow-y-auto px-1 pb-1">
        {shown.map((o) => {
          const on = value.includes(o.value);
          return (
            <li key={o.value} role="option" aria-selected={on}>
              <button type="button" onClick={() => flip(o.value)} className="flex min-h-9 w-full items-center gap-2.5 rounded-medium px-2 py-1.5 text-left outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)">
                <span className={cn("grid size-4 shrink-0 place-items-center rounded-small border", on ? "border-(--color-primary-solid) bg-(--color-primary-solid) text-white" : "border-(--color-border-darker)")}>{on && <Check aria-hidden className="size-3" strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-md text-(--color-text-primary)">{valueLabel(field, o.value)}</span>
                  {sub(o.value) && <span className="block truncate text-body-sm text-(--color-text-tertiary)">{sub(o.value)}</span>}
                </span>
                <span className="shrink-0 text-body-sm text-(--color-text-tertiary) tabular-nums">{field === "outlet" ? usd(stats.get(o.value as Store)?.sales ?? 0) : `${o.count} ${o.count === 1 ? "outlet" : "outlets"}`}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2 py-6 text-center text-body-sm text-(--color-text-secondary)">No {meta.noun} match &ldquo;{query}&rdquo;.</li>}
      </ul>
    </div>
  );
}

/** "Illinois", "Chicago +2": the first pick, then how many more. */
const pickText = (field: Field, values: string[]) => `${valueLabel(field, values[0])}${values.length > 1 ? ` +${values.length - 1}` : ""}`;

/** A toolbar pill: grey "State ▾" until used, then blue with its pick and ×. */
function FieldPill({ field, scope }: { field: Field; scope: OutletScope }) {
  const { open, setOpen, root } = usePopover();
  const meta = FIELDS.find((f) => f.key === field)!;
  const rule = pillRule(scope.filter, field);
  const values = rule?.values ?? [];
  const on = values.length > 0;
  const Icon = FIELD_ICON[field];
  const set = (v: string[]) => scope.setFilter((f) => setPill(f, field, v));
  return (
    <div ref={root} className="relative">
      <div className={cn(chip(on || open), !on && open && "bg-(--color-neutral-lightest)", "pr-0 pl-0")}>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("flex h-full items-center gap-1.5 rounded-medium pl-3 outline-none", on ? "pr-1" : "pr-2.5")}>
          <Icon aria-hidden className="size-3.5" />
          <span className="sr-only">{meta.label}: </span>
          {on ? pickText(field, values) : meta.label}
          {on && values.length > 1 && <span className="sr-only">: {values.map((v) => valueLabel(field, v)).join(", ")}</span>}
          {!on && <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />}
        </button>
        {on && (
          <button type="button" aria-label={`Clear ${meta.label.toLowerCase()} filter`} onClick={() => set([])} className="mr-1 grid size-6 place-items-center rounded-small outline-none hover:bg-(--brand-500) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div role="dialog" aria-label={meta.label} className={menu}>
          <OptionList field={field} options={optionsFor(field, scope, rule)} value={values} onChange={set} stats={scope.stats} />
        </div>
      )}
    </div>
  );
}

/** Asana's Filters panel: quick filters, then all the rules, then Add filter. */
function FilterPanel({ scope }: { scope: OutletScope }) {
  const { open, setOpen, root } = usePopover();
  const [adding, setAdding] = useState(false);
  const { filter, setFilter } = scope;
  const n = activeCount(filter);
  const toggleQuick = (k: string) => setFilter((f) => ({ ...f, quick: f.quick.includes(k) ? f.quick.filter((x) => x !== k) : [...f.quick, k] }));
  const patch = (id: string, change: Partial<Rule>) => setFilter((f) => ({ ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, ...change } : r)) }));
  const remove = (id: string) => setFilter((f) => ({ ...f, rules: f.rules.filter((r) => r.id !== id) }));
  const add = (field: Field) => {
    setFilter((f) => ({ ...f, rules: [...f.rules, newRule(field)] }));
    setAdding(false);
  };
  return (
    <div ref={root} className="relative">
      <div className={cn(chip(n > 0), "pr-0 pl-0", open && n === 0 && "bg-(--color-neutral-lightest)")}>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("flex h-full items-center gap-1.5 rounded-medium pl-3 outline-none", n ? "pr-1" : "pr-3")}>
          <ListFilter aria-hidden className="size-3.5" />
          {n ? `Filters: ${n}` : "Filter"}
        </button>
        {n > 0 && (
          <button type="button" aria-label="Clear all filters" onClick={() => setFilter(NO_FILTER)} className="mr-1 grid size-6 place-items-center rounded-small outline-none hover:bg-(--brand-500) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div role="dialog" aria-label="Filters" className={cn(menu, "w-[min(560px,calc(100vw-32px))] overflow-visible p-4")}>
          <div className="flex items-center justify-between">
            <h3 className="text-subtitle-sm text-(--color-text-primary)">Filters</h3>
            <button type="button" disabled={!n && !filter.rules.length} onClick={() => setFilter(NO_FILTER)} className="rounded-small text-body-sm text-(--color-text-secondary) outline-none enabled:hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:opacity-40">
              Clear
            </button>
          </div>

          <p className="mt-3 mb-2 text-body-sm text-(--color-text-secondary)">Quick filters</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => {
              const on = filter.quick.includes(q.key);
              return (
                <button key={q.key} type="button" aria-pressed={on} onClick={() => toggleQuick(q.key)} className={cn(chip(on), "h-7 px-2.5 text-body-sm")}>
                  {on && <Check aria-hidden className="size-3.5" />}
                  {q.label}
                </button>
              );
            })}
          </div>

          <p className="mt-4 mb-2 text-body-sm text-(--color-text-secondary)">All filters</p>
          {filter.rules.length === 0 && <p className="mb-2 text-body-sm text-(--color-text-tertiary)">No filters yet. Add one to narrow the outlets by state, city or name.</p>}
          <ul className="flex flex-col gap-2">
            {filter.rules.map((r) => (
              <RuleRow key={r.id} rule={r} scope={scope} onChange={(c) => patch(r.id, c)} onRemove={() => remove(r.id)} />
            ))}
          </ul>

          <div className="relative mt-2">
            <button type="button" aria-expanded={adding} onClick={() => setAdding((a) => !a)} className="flex h-8 items-center gap-1 rounded-medium px-1.5 text-menu-sm text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              <Plus aria-hidden className="size-3.5" />
              Add filter
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
            {adding && (
              <ul className={cn(menu, "w-44 p-1")}>
                {FIELDS.map((f) => {
                  const Icon = FIELD_ICON[f.key];
                  return (
                    <li key={f.key}>
                      <button type="button" onClick={() => add(f.key)} className="flex h-8 w-full items-center gap-2 rounded-medium px-2 text-left text-body-md text-(--color-text-primary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)">
                        <Icon aria-hidden className="size-3.5 text-(--color-text-secondary)" />
                        {f.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 border-t border-(--color-border-default) pt-3 text-body-sm text-(--color-text-secondary) tabular-nums">
            Showing {scope.stores.length} of {OUTLETS.length} outlets
            {scope.stores.length > 0 && scope.stores.length < OUTLETS.length && <> · {summary(scope.stores)}</>}
          </p>
        </div>
      )}
    </div>
  );
}

/** "Illinois 9, Wisconsin 2": where the outlets left are. */
function summary(stores: Store[]) {
  const by = new Map<string, number>();
  for (const s of stores) by.set(outletOf(s).state, (by.get(outletOf(s).state) ?? 0) + 1);
  return [...by].map(([st, n]) => `${STATE_NAME[st as keyof typeof STATE_NAME]} ${n}`).join(", ");
}

const select =
  "h-8 appearance-none rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_8px_center] bg-no-repeat pr-7 pl-2.5 text-body-md text-(--color-text-primary) outline-none focus-visible:border-(--color-focus-primary)";

/** One rule: [field] [is / is not] [values] ×. Changing the field drops its values. */
function RuleRow({ rule, scope, onChange, onRemove }: { rule: Rule; scope: OutletScope; onChange: (c: Partial<Rule>) => void; onRemove: () => void }) {
  const { open, setOpen, root } = usePopover();
  const meta = FIELDS.find((f) => f.key === rule.field)!;
  return (
    <li className="flex items-center gap-2">
      <select aria-label="Filter by" value={rule.field} onChange={(e) => onChange({ field: e.target.value as Field, values: [] })} className={cn(select, "w-28 shrink-0")}>
        {FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <select aria-label="Condition" value={rule.op} onChange={(e) => onChange({ op: e.target.value as Op })} className={cn(select, "w-24 shrink-0")}>
        {OPS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <div ref={root} className="relative min-w-0 flex-1">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-medium border border-(--color-border-default) px-1.5 py-1 text-left outline-none focus-visible:border-(--color-focus-primary)"
        >
          {rule.values.length === 0 && <span className="px-1 text-body-md text-(--color-text-tertiary)">Any {meta.label.toLowerCase()}</span>}
          {rule.values.map((v) => (
            <span key={v} className="flex h-6 items-center gap-1 rounded-small bg-(--color-neutral-light) pr-0.5 pl-1.5 text-body-sm text-(--color-text-primary)">
              {valueLabel(rule.field, v)}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${valueLabel(rule.field, v)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ values: rule.values.filter((x) => x !== v) });
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ values: rule.values.filter((x) => x !== v) });
                }}
                className="grid size-4 place-items-center rounded-small text-(--color-text-secondary) hover:bg-(--gray-400) hover:text-(--color-text-primary)"
              >
                <X aria-hidden className="size-3" />
              </span>
            </span>
          ))}
        </button>
        {open && (
          <div role="dialog" aria-label={meta.label} className={menu}>
            <OptionList field={rule.field} options={optionsFor(rule.field, scope, rule)} value={rule.values} onChange={(values) => onChange({ values })} stats={scope.stats} />
          </div>
        )}
      </div>
      <button type="button" aria-label="Remove filter" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-medium text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) hover:text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}
