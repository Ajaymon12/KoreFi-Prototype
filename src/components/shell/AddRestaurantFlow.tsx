"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, MapPin, MapPinned, RotateCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { BrandMark } from "@/components/onboarding/marks";
import { branchName, chainFor, MAX_RESULTS, streamChain, suggest, type Place, type Suggestion } from "@/lib/org/places";
import type { Brand } from "@/lib/org/types";
import { LogoField } from "./LogoField";
import { PinMap } from "./PinMap";

// Add a restaurant (or more locations to one) by searching Google Maps instead of typing addresses.
//   1. Find — type the name; suggestions come back in under a second (debounced, stale ones aborted).
//   2. Choose — every store Google has streams in page by page (20 at a time, up to 60, ~2 s apart),
//      all ticked; the owner can untick, filter and carry on before the last page lands.
//   3. Confirm — name and logo (new restaurants only), then everything is added in one go.
// A map on the right fills with pins as results arrive. Stores already in KoreFi are shown but
// can't be added twice. Anything Google doesn't have can still be added by hand.
// It doesn't save anything itself: owners (LocationSwitcher) and ops (admin Users → Outlets) each
// pass their own restaurants and stores in, and commit what onSubmit hands back.

export type FlowMode = { kind: "restaurant" } | { kind: "branches"; brand: Brand };
type Step = "find" | "choose" | "confirm";
type Source = { name: string; chainId: string | null; single?: Place };

/** What's already saved, so those stores show as "Already added". */
export type ExistingStore = { brandId: string | null; placeId?: string; street: string; zip: string };
/** `brand` is new when `isNew`; each store comes with the short name the flow gave it. */
export type FlowResult = { brand: Brand; isNew: boolean; stores: { place: Place; name: string }[] };
/** Owners say "branch", ops say "outlet". */
export type Noun = { one: string; many: string };
const BRANCH: Noun = { one: "branch", many: "branches" };

const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SLOW_MS = 4500;

type Props = { mode: FlowMode; brands: Brand[]; existing: ExistingStore[]; noun?: Noun; onClose: () => void; onManual: () => void; onSubmit: (result: FlowResult) => void };

export function AddRestaurantFlow({ mode, brands, existing: saved, noun = BRANCH, onClose, onManual, onSubmit }: Props) {
  const forBrand = mode.kind === "branches" ? mode.brand : null;
  const steps: Step[] = forBrand ? ["find", "choose"] : ["find", "choose", "confirm"];

  // An existing restaurant opens straight on its stores when Google knows the name.
  const known = forBrand ? chainFor(forBrand.name) : null;
  const [step, setStep] = useState<Step>(known ? "choose" : "find");
  const [source, setSource] = useState<Source | null>(known && forBrand ? { name: forBrand.name, chainId: known } : null);

  // ── Results (step 2) ────────────────────────────────────────────────────────────────────────
  const [places, setPlaces] = useState<Place[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const autoSelect = useRef(true);
  const [hovered, setHovered] = useState<string | null>(null);

  // A store is "already added" when its place id matches, or its street + ZIP matches a branch of
  // the same restaurant (another restaurant at that address is a different business, e.g. a ghost kitchen).
  const targetId = forBrand?.id ?? brands.find((b) => source && norm(b.name) === norm(source.name))?.id;
  const existing = useMemo(() => {
    const own = saved.filter((l) => targetId && l.brandId === targetId);
    return { ids: new Set(saved.map((l) => l.placeId).filter(Boolean)), addr: new Set(own.map((l) => `${norm(l.street)}|${l.zip}`)) };
  }, [saved, targetId]);
  const already = useMemo(() => new Set(places.filter((p) => existing.ids.has(p.placeId) || existing.addr.has(`${norm(p.address.street)}|${p.address.zip}`)).map((p) => p.placeId)), [places, existing]);

  // Starts (or restarts) a lookup. Called from event handlers, so the effect below only listens.
  const load = (s: Source | null) => {
    autoSelect.current = true;
    setSelected(new Set());
    setPlaces(s?.single ? [s.single] : []);
    setTotal(s?.single ? 1 : 0);
    setStatus(s?.single ? "done" : "loading");
    setSlow(false);
    setSource(s);
  };

  useEffect(() => {
    if (!source || source.single) return;
    const ctrl = new AbortController();
    let timer = setTimeout(() => setSlow(true), SLOW_MS);
    streamChain(
      source.chainId ?? "",
      (page) => {
        clearTimeout(timer);
        setSlow(false);
        if (!page.done) timer = setTimeout(() => setSlow(true), SLOW_MS);
        setTotal(page.total);
        setPlaces((prev) => [...prev, ...page.places]);
      },
      ctrl.signal,
    )
      .then(() => setStatus("done"))
      .catch(() => !ctrl.signal.aborted && setStatus("error"));
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [source, attempt]);

  // New arrivals start ticked (unless the owner cleared everything); already-added ones never are.
  useEffect(() => {
    if (!autoSelect.current) return;
    setSelected((prev) => {
      const next = new Set(prev);
      places.forEach((p) => !already.has(p.placeId) && next.add(p.placeId));
      return next.size === prev.size ? prev : next;
    });
  }, [places, already]);

  // ── Confirm (step 3) ────────────────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | undefined>();
  const [tried, setTried] = useState(false);
  const twin = !forBrand ? brands.find((b) => norm(b.name) === norm(name)) : undefined;

  const picked = places.filter((p) => selected.has(p.placeId));
  const add = () => {
    const brand: Brand = forBrand ?? twin ?? { id: `b_${uid()}`, name: name.trim(), ...(logo ? { logo } : {}) };
    onSubmit({ brand, isNew: !forBrand && !twin, stores: picked.map((p) => ({ place: p, name: branchName(p, places) })) });
  };

  const next = () => {
    if (step === "choose" && forBrand) return add();
    if (step === "choose") {
      if (!name) setName(source?.name ?? "");
      return setStep("confirm");
    }
    setTried(true);
    if (name.trim()) add();
  };
  const back = () => {
    if (step === "confirm") return setStep("choose");
    setStep("find");
    load(null);
  };

  // Escape closes; there is no click-outside, so a stray click can't throw away a long pick.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const index = steps.indexOf(step);
  const title = step === "find" ? (forBrand ? `Add ${noun.many} to ${forBrand.name}` : "Add a restaurant") : step === "choose" ? `Choose ${source?.name ?? ""} ${noun.many}` : "Name your restaurant";
  const ctaCount = picked.length;
  const cta = step === "confirm" ? `Add ${name.trim() || "restaurant"} · ${plural(ctaCount, noun.one, noun.many)}` : forBrand ? `Add ${plural(ctaCount, noun.one, noun.many)}` : "Continue";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex h-dvh w-full max-w-[900px] flex-col overflow-hidden bg-(--color-background-secondary) shadow-[0_16px_48px_rgb(0_0_0/0.18)] sm:h-[min(680px,calc(100dvh-32px))] sm:rounded-large sm:border sm:border-(--color-border-default)">
        {/* Mercury-style progress line along the top edge. */}
        <div className="h-0.5 bg-(--color-neutral-light)">
          <div className="h-full bg-(--color-primary) transition-[width] duration-500 ease-out" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>

        <header className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm text-(--color-text-tertiary) tabular-nums">
              Step {index + 1} of {steps.length}
            </p>
            <h2 className="truncate text-subtitle-lg text-(--color-text-primary)">{title}</h2>
          </div>
          <Button type="text" size="small" icon={<X className="size-4" />} aria-label="Close" onClick={onClose} />
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col border-(--color-border-default) md:border-r">
            {step === "find" && (
              <FindStep
                initial={forBrand?.name ?? ""}
                onPick={(s) => {
                  load(s.kind === "chain" ? { name: s.name, chainId: s.id } : { name: s.name, chainId: null, single: s.place });
                  setStep("choose");
                }}
                onManual={onManual}
              />
            )}
            {step === "choose" && (
              <ChooseStep
                places={places}
                total={total}
                status={status}
                slow={slow}
                selected={selected}
                already={already}
                hovered={hovered}
                noun={noun}
                onHover={setHovered}
                onRetry={() => {
                  // A failed stream was never cached, so this fetches the chain again from page 1.
                  load(source);
                  setAttempt((a) => a + 1);
                }}
                onManual={onManual}
                onChange={(ids, on) => {
                  if (!on && ids.length >= places.length - already.size) autoSelect.current = false;
                  setSelected((prev) => {
                    const n = new Set(prev);
                    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
                    return n;
                  });
                }}
              />
            )}
            {step === "confirm" && (
              <div className="flex flex-col gap-5 overflow-y-auto px-5 py-2 sm:px-6">
                <p className="text-body-md text-(--color-text-secondary)">This is how the restaurant shows in KoreFi. Each {noun.one} keeps its own name, like “Midtown · 5th Ave”.</p>
                <TextField label="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Enter the restaurant’s name" : undefined} autoFocus />
                {twin ? (
                  <p className="rounded-medium bg-(--color-info-lightest) p-3 text-body-sm text-(--color-text-primary)">
                    <b className="font-medium">{twin.name}</b> is already in KoreFi, so these {noun.many} will be added to it.
                  </p>
                ) : (
                  <LogoField value={logo} onChange={setLogo} />
                )}
              </div>
            )}
          </div>

          <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto bg-(--color-neutral-lightest) p-5 md:flex">
            <PinMap
              places={step === "confirm" ? picked : places}
              selected={selected}
              already={already}
              hovered={hovered}
              searching={step === "choose" && status === "loading"}
              onHover={setHovered}
              onToggle={(id) => setSelected((prev) => (prev.has(id) ? (prev.delete(id), new Set(prev)) : new Set(prev.add(id))))}
            />
            <Summary step={step} brand={forBrand ?? twin} brands={brands} noun={noun} name={step === "confirm" ? name : source?.name} picked={picked} found={places.length} already={already.size} />
          </aside>
        </div>

        {step !== "find" && (
          <footer className="flex items-center gap-2 border-t border-(--color-border-default) px-5 py-3 sm:px-6">
            {(step === "confirm" || !known) && (
              <Button type="outline" size="small" iconLeft={<ArrowLeft className="size-4" />} onClick={back}>
                Back
              </Button>
            )}
            <span className="flex-1 truncate text-body-sm text-(--color-text-secondary) md:invisible">{step === "choose" && `${picked.length} selected`}</span>
            <Button type="primary" size="small" disabled={picked.length === 0} onClick={next} iconRight={step === "choose" && !forBrand ? <ChevronRight className="size-4" /> : undefined}>
              {cta}
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Step 1: search Google Maps ────────────────────────────────────────────────────────────────

const EXAMPLES = ["Casa Alvarez", "Halal Corner", "Nonna's Slice"];

function FindStep({ initial, onPick, onManual }: { initial: string; onPick: (s: Suggestion) => void; onManual: () => void }) {
  const [q, setQ] = useState(initial);
  // The last answer and the query it was for; "loading" is simply "the box has moved on since".
  const [answer, setAnswer] = useState<{ q: string; hits: Suggestion[] | null; failed: boolean }>({ q: "", hits: null, failed: false });
  const [active, setActive] = useState(0);
  const short = q.trim().length < 2;
  const hits = short ? null : answer.hits;
  const loading = !short && answer.q !== q;
  const failed = !short && !loading && answer.failed;

  // 250 ms debounce, and every keystroke aborts the request before it so an old answer can never
  // land on top of a newer one. Old results stay up (dimmed) while the next ones load: no flicker.
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      suggest(q, ctrl.signal)
        .then((r) => {
          setAnswer({ q, hits: r, failed: false });
          setActive(0);
        })
        .catch(() => !ctrl.signal.aborted && setAnswer((a) => ({ ...a, q, failed: true })));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!hits?.length) return;
    const len = hits.length;
    if (e.key === "ArrowDown") setActive((a) => (a + 1) % len);
    else if (e.key === "ArrowUp") setActive((a) => (a - 1 + len) % len);
    else if (e.key === "Enter") onPick(hits[Math.min(active, len - 1)]);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 sm:px-6">
      <p className="text-body-md text-(--color-text-secondary)">Search by name. We’ll find every location on Google Maps, so there are no addresses to type.</p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--color-text-tertiary)" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Restaurant name, e.g. Casa Alvarez"
          role="combobox"
          aria-expanded={Boolean(hits?.length)}
          aria-controls="kf-place-results"
          aria-activedescendant={hits?.length ? `kf-place-${active}` : undefined}
          className="h-12 w-full rounded-large border border-(--color-border-default) bg-(--color-background-secondary) pr-28 pl-10 text-body-lg text-(--color-text-primary) shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none placeholder:text-(--color-text-tertiary) focus-visible:border-(--color-focus-primary) focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-primary)_18%,transparent)]"
        />
        <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 text-body-sm text-(--color-text-tertiary)">
          {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
          Google Maps
        </span>
      </div>

      <div id="kf-place-results" role="listbox" aria-busy={loading} className={cn("mt-3 flex flex-col gap-1 transition-opacity", loading && hits && "opacity-60")}>
        {loading && !hits && [0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        {hits?.map((s, i) => (
          <button
            key={s.id}
            id={`kf-place-${i}`}
            role="option"
            aria-selected={i === active}
            type="button"
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(s)}
            className={cn("kf-row-in flex items-center gap-3 rounded-large border px-3 py-2.5 text-left outline-none transition-colors", i === active ? "border-(--color-border-darker) bg-(--color-neutral-lightest)" : "border-transparent")}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-medium", s.kind === "chain" ? "bg-(--color-brand-lightest) text-(--color-primary)" : "bg-(--color-neutral-light) text-(--color-text-secondary)")}>
              {s.kind === "chain" ? <MapPinned className="size-4.5" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{s.name}</span>
              <span className="block truncate text-body-sm text-(--color-text-secondary)">
                {s.kind === "chain" ? `${plural(s.estimate, "location")} · ${s.cities.slice(0, 2).join(", ")}${s.cities.length > 2 ? ` +${s.cities.length - 2}` : ""}` : `Only this one · ${s.place.address.street}, ${s.place.address.city}`}
              </span>
            </span>
            {s.kind === "chain" && <span className="shrink-0 rounded-full bg-(--color-neutral-light) px-2 py-0.5 text-body-sm text-(--color-text-secondary)">All locations</span>}
            <ChevronRight className="size-4 shrink-0 text-(--color-text-tertiary)" aria-hidden />
          </button>
        ))}
        {hits?.length === 0 && !loading && (
          <p className="rounded-large border border-dashed border-(--color-border-default) p-4 text-body-md text-(--color-text-secondary)">
            Nothing on Google Maps matches “{q.trim()}”. Check the spelling, or{" "}
            <button type="button" onClick={onManual} className="text-(--color-text-clickable) underline-offset-2 hover:underline">
              add it by hand
            </button>
            .
          </p>
        )}
        {failed && (
          <p className="rounded-large bg-(--color-warning-lightest) p-3 text-body-sm text-(--color-text-primary)">Google Maps didn’t answer. Keep typing to try again, or add the restaurant by hand.</p>
        )}
      </div>

      {!hits && !loading && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-(--color-text-tertiary)">
          Try
          {EXAMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setQ(x)} className="rounded-full border border-(--color-border-default) px-2.5 py-1 text-(--color-text-secondary) hover:border-(--color-border-darker) hover:text-(--color-text-primary)">
              {x}
            </button>
          ))}
        </div>
      )}

      <p className="mt-auto pt-6 text-body-sm text-(--color-text-secondary)">
        Not on Google Maps?{" "}
        <button type="button" onClick={onManual} className="text-(--color-text-clickable) underline-offset-2 hover:underline">
          Add it by hand
        </button>
      </p>
    </div>
  );
}

const SkeletonRow = () => (
  <div className="flex items-center gap-3 px-3 py-2.5" aria-hidden>
    <span className="kf-shimmer size-9 shrink-0 rounded-medium" />
    <span className="flex flex-1 flex-col gap-1.5">
      <span className="kf-shimmer h-3 w-2/5 rounded-full" />
      <span className="kf-shimmer h-2.5 w-3/5 rounded-full" />
    </span>
  </div>
);

// ── Step 2: choose which stores ───────────────────────────────────────────────────────────────

type ChooseProps = {
  places: Place[];
  total: number;
  status: "loading" | "done" | "error";
  slow: boolean;
  selected: Set<string>;
  already: Set<string>;
  hovered: string | null;
  noun: Noun;
  onHover: (id: string | null) => void;
  onChange: (ids: string[], on: boolean) => void;
  onRetry: () => void;
  onManual: () => void;
};

function ChooseStep({ places, total, status, slow, selected, already, hovered, noun, onHover, onChange, onRetry, onManual }: ChooseProps) {
  const [filter, setFilter] = useState("");
  const f = norm(filter);
  const shown = f ? places.filter((p) => norm(`${p.neighborhood} ${p.address.street} ${p.address.city} ${p.address.zip}`).includes(f)) : places;
  // Group by city, biggest first, so 50 stores read as five short lists.
  const groups = useMemo(() => {
    const m = new Map<string, Place[]>();
    shown.forEach((p) => m.set(p.address.city, [...(m.get(p.address.city) ?? []), p]));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  const open = shown.filter((p) => !already.has(p.placeId));
  const allOn = open.length > 0 && open.every((p) => selected.has(p.placeId));
  const someOn = open.some((p) => selected.has(p.placeId));
  const pct = total ? Math.round((places.length / total) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Live status: how much of the chain has come back so far. */}
      <div className="px-5 sm:px-6">
        <div className="flex items-center gap-2 text-body-sm text-(--color-text-secondary)" aria-live="polite">
          {status === "loading" ? <Loader2 className="size-3.5 animate-spin text-(--color-primary)" aria-hidden /> : <MapPin className="size-3.5 text-(--color-text-tertiary)" aria-hidden />}
          {status === "loading" && (places.length ? `Found ${places.length}${total ? ` of ${total}` : ""} on Google Maps · loading more` : "Searching Google Maps…")}
          {status === "done" && `${plural(places.length, "location")} found on Google Maps`}
          {status === "error" && "Google Maps stopped answering"}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--color-neutral-light)">
          {status === "loading" && !places.length ? (
            <div className="kf-indeterminate h-full w-2/5 rounded-full bg-(--color-primary)" />
          ) : (
            <div className={cn("h-full rounded-full transition-[width] duration-500", status === "error" ? "bg-(--color-warning-default)" : "bg-(--color-primary)")} style={{ width: `${status === "done" ? 100 : pct}%` }} />
          )}
        </div>
        {slow && status === "loading" && <p className="mt-2 text-body-sm text-(--color-text-tertiary)">Large chains take a few seconds. You can start choosing now.</p>}
        {status === "error" && (
          <div className="mt-2 flex items-center gap-2 rounded-medium bg-(--color-warning-lightest) p-2.5 text-body-sm text-(--color-text-primary)">
            <span className="flex-1">{places.length ? `We got ${places.length} before the connection dropped.` : "We couldn’t reach Google Maps."}</span>
            <Button type="outline" size="tiny" iconLeft={<RotateCw className="size-3.5" />} onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 pt-3 pb-2 sm:px-6">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filter {noun.many}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-(--color-text-tertiary)" aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by area, street or ZIP"
            className="h-8 w-full rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) pr-2 pl-8 text-body-md outline-none placeholder:text-(--color-text-tertiary) focus-visible:border-(--color-focus-primary)"
          />
        </label>
        <Checkbox
          checked={allOn}
          mixed={!allOn && someOn}
          disabled={!open.length}
          onChange={() => onChange(open.map((p) => p.placeId), !allOn)}
          label={<span className="text-body-sm whitespace-nowrap text-(--color-text-secondary)">{f ? "All shown" : "All"}</span>}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4">
        {groups.map(([city, rows]) => {
          const free = rows.filter((p) => !already.has(p.placeId));
          const on = free.filter((p) => selected.has(p.placeId)).length;
          return (
            <section key={city} className="mt-1">
              <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-(--color-background-secondary) px-2 py-1.5">
                <Checkbox checked={free.length > 0 && on === free.length} mixed={on > 0 && on < free.length} disabled={!free.length} onChange={() => onChange(free.map((p) => p.placeId), on < free.length)} aria-label={`All in ${city}`} />
                <h3 className="flex-1 text-subtitle-xs tracking-wide text-(--color-text-tertiary) uppercase">{city}</h3>
                <span className="text-body-sm text-(--color-text-tertiary) tabular-nums">
                  {on}/{free.length}
                </span>
              </div>
              {rows.map((p, i) => {
                const old = already.has(p.placeId);
                return (
                  <label
                    key={p.placeId}
                    onMouseEnter={() => onHover(p.placeId)}
                    onMouseLeave={() => onHover(null)}
                    className={cn("kf-row-in flex items-center gap-2.5 rounded-medium px-2 py-1.5", old ? "cursor-default" : "cursor-pointer hover:bg-(--color-neutral-lightest)", hovered === p.placeId && "bg-(--color-neutral-lightest)")}
                    style={{ animationDelay: `${(i % 20) * 25}ms` }}
                  >
                    <Checkbox checked={old || selected.has(p.placeId)} disabled={old} onChange={() => onChange([p.placeId], !selected.has(p.placeId))} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-body-md", old ? "text-(--color-text-secondary)" : "text-(--color-text-primary)")}>{branchName(p, places)}</span>
                      <span className="block truncate text-body-sm text-(--color-text-secondary)">
                        {p.address.street} · {p.address.zip}
                      </span>
                    </span>
                    {old && <span className="shrink-0 rounded-full bg-(--color-neutral-light) px-2 py-0.5 text-body-sm text-(--color-text-secondary)">Already added</span>}
                  </label>
                );
              })}
            </section>
          );
        })}
        {status === "loading" && [0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        {f && !shown.length && <p className="px-2 py-6 text-center text-body-md text-(--color-text-secondary)">No {noun.many} match “{filter.trim()}”.</p>}
        {status === "done" && (
          <p className="px-2 pt-4 text-body-sm text-(--color-text-secondary)">
            {total >= MAX_RESULTS ? "Google Maps lists up to 60 locations per search; the rest come in when your POS is connected. " : "Missing one? "}
            <button type="button" onClick={onManual} className="text-(--color-text-clickable) underline-offset-2 hover:underline">
              Add {noun.one === "outlet" ? "an" : "a"} {noun.one} by hand
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Right-hand summary under the map ──────────────────────────────────────────────────────────

function Summary({ step, brand, brands, noun, name, picked, found, already }: { step: Step; brand?: Brand; brands: Brand[]; noun: Noun; name?: string; picked: Place[]; found: number; already: number }) {
  if (step === "find")
    return <p className="text-body-sm text-(--color-text-secondary)">Every location Google Maps has for your restaurant will appear on this map. You choose which ones to add.</p>;
  const cities = [...picked.reduce((m, p) => m.set(p.address.city, (m.get(p.address.city) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const mark: Brand = brand ?? { id: "_new", name: name || "?" };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <BrandMark brand={mark} brands={brand ? brands : [...brands, mark]} />
        <span className="min-w-0">
          <span className="block truncate text-body-md font-medium text-(--color-text-primary)">{name || mark.name}</span>
          <span className="block text-body-sm text-(--color-text-secondary)">{already ? `${already} already in KoreFi` : `${found} found`}</span>
        </span>
      </div>
      <p className="text-[32px] font-medium leading-none tracking-tight text-(--color-text-primary) tabular-nums">
        {picked.length}
        <span className="ml-1.5 text-body-md text-(--color-text-secondary)">{picked.length === 1 ? noun.one : noun.many} to add</span>
      </p>
      {cities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cities.map(([c, n]) => (
            <span key={c} className="rounded-full border border-(--color-border-default) bg-(--color-background-secondary) px-2 py-0.5 text-body-sm text-(--color-text-secondary)">
              {c} <span className="text-(--color-text-tertiary) tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
