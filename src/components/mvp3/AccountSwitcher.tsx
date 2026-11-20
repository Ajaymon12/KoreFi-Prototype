"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { BrandMark } from "@/components/onboarding/marks";
import type { Brand } from "@/lib/org/types";
import { ACCOUNTS, DEFAULT_ACCOUNT, type Account } from "@/lib/mvp3/accounts";

// /mvp3's top-bar switcher: which restaurant account is open (lib/mvp3/accounts). Just the restaurant name,
// no branch step: agents always look across every outlet. Switching resets the chats to that account's.
// Prototype: the pick is kept for the browser tab (sessionStorage), so a refresh or a link stays on that restaurant.
// A tab's first visit opens Little Pho at sign-up (DEFAULT_ACCOUNT), or Taco Pros on its own Home link.
// Little Pho still replays its welcome flow on every refresh: that lives in memory (Onboarding).

type Ctx = { account: Account; setAccount: (id: string) => void };
const AccountContext = createContext<Ctx | null>(null);

export function useAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("useAccount must be inside <AccountProvider>");
  return c;
}

const KEY = "korefi.mvp3.account";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const noop = () => () => {};
const HOME_ID = ACCOUNTS.find((a) => a.home)?.id ?? null;

export function AccountProvider({ children }: { children: React.ReactNode }) {
  // The static site renders before it can read the tab's pick, so the pages wait for the browser: otherwise they
  // mount as Little Pho for a moment and its redirects (new account → the welcome chat) throw Taco Pros off its Home.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [picked, setPicked] = useState<string | null>(null);
  // Worked out once, on load: the tab's saved pick, else Taco Pros when the link was its Home.
  const restored = useMemo(() => (hydrated ? (read() ?? (/\/mvp3\/home\/?$/.test(window.location.pathname) ? HOME_ID : null)) : null), [hydrated]);
  const account = ACCOUNTS.find((a) => a.id === (picked ?? restored)) ?? DEFAULT_ACCOUNT;
  const setAccount = useCallback((id: string) => {
    const next = ACCOUNTS.find((a) => a.id === id) ?? DEFAULT_ACCOUNT;
    setPicked(next.id);
    try {
      window.localStorage.setItem(KEY, next.id);
    } catch {
      // Storage blocked (private mode): the pick lasts until the next refresh.
    }
  }, []);
  return <AccountContext.Provider value={{ account, setAccount }}>{hydrated ? children : null}</AccountContext.Provider>;
}

const asBrand = (a: Account) => ({ id: a.id, name: a.name, logo: a.logo }) as Brand;
const BRANDS = ACCOUNTS.map(asBrand);

export function AccountSwitcher() {
  const { account, setAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 max-w-[48vw] items-center gap-1.5 rounded-medium border border-(--color-border-default) bg-(--color-neutral-lightest) pr-2 pl-1.5 text-body-md text-(--color-text-primary) hover:bg-(--color-neutral-light) sm:max-w-[280px]"
      >
        <BrandMark brand={asBrand(account)} brands={BRANDS} size="sm" />
        <span className="min-w-0 flex-1 truncate text-left">{account.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-(--color-text-secondary)" />
      </button>

      {open && (
        <div role="dialog" aria-label="Switch restaurant" className="absolute top-full right-0 z-50 mt-1.5 w-[min(300px,calc(100vw-16px))] overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-1 shadow-[0_12px_32px_rgb(0_0_0/0.14)]">
          <h3 className="px-2.5 pt-1 pb-1.5 text-subtitle-xs tracking-wide text-(--color-text-tertiary) uppercase">Restaurants</h3>
          <div role="radiogroup" aria-label="Restaurants">
            {ACCOUNTS.map((a) => {
              const on = a.id === account.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setAccount(a.id);
                    close();
                  }}
                  className={cn("flex w-full items-center gap-2.5 rounded-medium px-2.5 py-1.5 text-left outline-none hover:bg-(--color-neutral-lightest) focus-visible:bg-(--color-neutral-lightest)", on && "bg-(--color-neutral-lightest)")}
                >
                  <BrandMark brand={asBrand(a)} brands={BRANDS} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-body-md text-(--color-text-primary)", on && "font-medium")}>{a.name}</span>
                    <span className="block truncate text-body-sm text-(--color-text-secondary)">{a.history}</span>
                  </span>
                  {on && <Check className="size-4 shrink-0 text-(--color-text-primary)" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
