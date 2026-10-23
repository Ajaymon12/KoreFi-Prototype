"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/primitives";
import { STATUS_META, type Account } from "@/lib/admin/accounts";
import { readRecent, selectClient, useClient } from "@/lib/admin/client";
import { useAccounts } from "@/lib/admin/store";

// Ops header client picker (⌘K / Ctrl+K from any admin page), the dev ops app's "Select a client"
// dropdown made searchable. Shows the client being worked on; picking one switches the workspace and
// stays on the same page (Overview, Chargebacks…), or opens Overview from Clients.

const CLIENT_PAGES = ["/admin/overview", "/admin/chargebacks", "/admin/uploads", "/admin/outlets", "/admin/client", "/admin/as/"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Header trigger: the user being worked on (or "Open a user"); ⌘K from any admin page. */
export function ClientSwitcher() {
  const [open, setOpen] = useState(false);
  const { client } = useClient();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Switch user (⌘K)"
        className="flex h-7 max-w-[320px] min-w-0 items-center gap-2 rounded-medium border border-(--color-border-default) bg-(--color-background-secondary) pr-1.5 pl-1 text-body-sm text-(--color-text-primary) hover:border-(--color-border-darker)"
      >
        {client ? (
          <>
            <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-circle bg-(--color-brand-lightest) text-[10px] font-medium text-(--color-primary)">
              {initials(client.company)}
            </span>
            <span className="truncate">
              {client.company} <span className="hidden text-(--color-text-secondary) md:inline">· {client.name}</span>
            </span>
          </>
        ) : (
          <span className="pl-1 text-(--color-text-secondary)">Open a user</span>
        )}
        <kbd className="hidden shrink-0 rounded-small border border-(--color-border-default) px-1 text-[10px] leading-4 text-(--color-text-secondary) lg:inline">⌘K</kbd>
        <ChevronsUpDown className="size-3.5 shrink-0 text-(--color-text-secondary)" aria-hidden />
      </button>
      {open && <SwitcherDialog current={client?.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function SwitcherDialog({ current: currentId, onClose }: { current?: string; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const accounts = useAccounts();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (q) {
      const hits = accounts.filter((a) => [a.name, a.email, a.company].some((x) => x.toLowerCase().includes(q)));
      return [{ title: `${hits.length} ${hits.length === 1 ? "match" : "matches"}`, items: hits }];
    }
    const recentIds = readRecent();
    const recent = recentIds.map((id) => accounts.find((a) => a.id === id)).filter((a): a is Account => !!a);
    const rest = accounts.filter((a) => !recentIds.includes(a.id)).sort((a, b) => a.company.localeCompare(b.company));
    return [
      ...(recent.length ? [{ title: "Recent", items: recent }] : []),
      { title: "All users", items: rest },
    ];
  }, [accounts, q]);
  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const pick = (a: Account) => {
    selectClient(a.id);
    onClose();
    if (!CLIENT_PAGES.some((p) => pathname.startsWith(p))) router.push("/admin/overview");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + flat.length) % Math.max(1, flat.length));
    } else if (e.key === "Enter" && flat[current]) {
      e.preventDefault();
      pick(flat[current]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let index = -1;
  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-black/30 p-3 pt-[12vh] sm:p-6 sm:pt-[12vh]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Switch user" onKeyDown={onKey} className="flex max-h-[min(520px,76vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-large border border-(--color-border-default) bg-(--color-background-secondary) shadow-[0_16px_48px_rgb(0_0_0/0.18)]">
        <label className="flex h-12 shrink-0 items-center gap-2.5 border-b border-(--color-border-default) px-4 text-(--color-text-secondary)">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="client-switcher-list"
            aria-activedescendant={flat[current] ? `client-switcher-${flat[current].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search by name, email or company…"
            aria-label="Search users"
            className="min-w-0 flex-1 bg-transparent text-body-md text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
          />
          <kbd className="rounded-small border border-(--color-border-default) px-1 text-[10px] leading-4">Esc</kbd>
        </label>
        {flat.length === 0 ? (
          <p className="px-4 py-10 text-center text-body-md text-(--color-text-secondary)">No users match &ldquo;{query.trim()}&rdquo;</p>
        ) : (
          <ul ref={listRef} id="client-switcher-list" role="listbox" aria-label="Users" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {sections.map((s) => (
              <li key={s.title} role="presentation">
                <p className="px-2.5 pt-2 pb-1 text-body-sm text-(--color-text-tertiary)">{s.title}</p>
                <ul role="presentation">
                  {s.items.map((a) => {
                    index += 1;
                    const i = index;
                    const st = STATUS_META[a.status];
                    return (
                      <li
                        key={a.id}
                        id={`client-switcher-${a.id}`}
                        role="option"
                        aria-selected={i === current}
                        data-index={i}
                        onPointerMove={() => i !== current && setActive(i)}
                        onClick={() => pick(a)}
                        className={cn("flex cursor-pointer items-center gap-3 rounded-medium px-2.5 py-2", i === current && "bg-(--color-primary)/10")}
                      >
                        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-circle bg-(--color-brand-lightest) text-body-sm font-medium text-(--color-primary)">
                          {initials(a.company)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-md text-(--color-text-primary)">
                            {a.company} <span className="text-(--color-text-secondary)">· {a.name}</span>
                            {a.id === currentId && <span className="ml-1.5 text-body-sm text-(--color-text-clickable)">Current</span>}
                          </p>
                          <p className="truncate text-body-sm text-(--color-text-secondary)">{a.email}</p>
                        </div>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        <CornerDownLeft className={cn("size-3.5 shrink-0 text-(--color-text-tertiary)", i !== current && "invisible")} aria-hidden />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
