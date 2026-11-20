"use client";
import { usePath } from "@/lib/mvp3/usePath";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_BUCKETS, chatBucket, type Message, type Thread } from "@/lib/mvp3/agents";
import { useAgents } from "./AgentsProvider";
import { AgentAvatar } from "./AgentAvatar";
import { useAccount } from "./AccountSwitcher";
import { dialogSurface, iconButton, scrim } from "@/components/mvp3/styles";

// "Search chats", as in ChatGPT: a centred dialog with the search field on top, "New chat" first, then every chat
// grouped by when it was last active. Typing filters on titles and on what was said; a match inside a chat shows
// the line it was found in. ↑/↓ move, Enter opens, Esc closes. Opens from the sidebar or with ⌘K / Ctrl+K.
// Open/closed lives in a tiny store so the wide sidebar, the icon column and the phone drawer share one dialog.

const listeners = new Set<() => void>();
let isOpen = false;
const setOpen = (v: boolean) => {
  isOpen = v;
  listeners.forEach((l) => l());
};
export const openChatSearch = () => setOpen(true);
const useOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => isOpen,
    () => false,
  );

const bucket = chatBucket;
const ORDER: readonly string[] = CHAT_BUCKETS;

const textOf = (m: Message) => ("text" in m ? m.text : "reply" in m ? [m.reply.title, ...m.reply.lines].join(" ") : "");

/** The words around the first match, so the row shows why it matched. */
function snippet(t: Thread, q: string) {
  for (const m of t.messages) {
    const s = textOf(m);
    const i = s.toLowerCase().indexOf(q);
    if (i < 0) continue;
    const from = Math.max(0, i - 30);
    return { pre: (from > 0 ? "…" : "") + s.slice(from, i), hit: s.slice(i, i + q.length), post: s.slice(i + q.length, i + q.length + 60) };
  }
  return null;
}

export function ChatSearch() {
  const open = useOpen();

  // ⌘K / Ctrl+K toggles it from anywhere in MVP 3.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  // Closed on the server (the store's server value is false), so `document` is always there when this renders.
  if (!open) return null;
  return createPortal(<Dialog onClose={() => setOpen(false)} />, document.body);
}

type Row = { kind: "new" } | { kind: "chat"; t: Thread; hit: ReturnType<typeof snippet> };

function Dialog({ onClose }: { onClose: () => void }) {
  const { threads, open, newChat } = useAgents();
  // A `limited` account (Masa Kitchen) can't start a new chat.
  const noNew = !!useAccount().account.limited;
  const path = usePath();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const query = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const out = new Map<string, Row[]>();
    for (const t of threads) {
      const inTitle = t.title.toLowerCase().includes(query);
      const hit = query && !inTitle ? snippet(t, query) : null;
      if (query && !inTitle && !hit) continue;
      const g = bucket(t.at);
      out.set(g, [...(out.get(g) ?? []), { kind: "chat", t, hit }]);
    }
    return ORDER.filter((g) => out.has(g)).map((g) => ({ label: g, rows: out.get(g)! }));
  }, [threads, query]);
  // "New chat" leads the list until a search is typed.
  const rows: Row[] = [...(query || noNew ? [] : [{ kind: "new" } as Row]), ...groups.flatMap((g) => g.rows)];
  const cur = Math.min(sel, Math.max(rows.length - 1, 0));

  const choose = (r: Row) => {
    if (r.kind === "new") newChat();
    else open(r.t.id);
    onClose();
    if (path !== "/mvp3") router.push("/mvp3");
  };

  useEffect(() => {
    list.current?.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") setSel(Math.min(cur + 1, rows.length - 1));
    else if (e.key === "ArrowUp") setSel(Math.max(cur - 1, 0));
    else if (e.key === "Enter" && rows[cur]) choose(rows[cur]);
    else return;
    e.preventDefault();
  };

  const rowCls = (on: boolean) => cn("flex w-full items-center gap-3 rounded-large px-3 py-2.5 text-left outline-none", on ? "bg-(--color-neutral-light)" : "hover:bg-(--color-neutral-lightest)");
  let i = query || noNew ? 0 : 1;

  return (
    <div data-module="mvp" className={cn(scrim, "z-[60] flex items-start justify-center px-4 pt-[12vh] motion-safe:animate-page-in")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search chats" onKeyDown={onKey} className={cn(dialogSurface, "flex max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden")}>
        <div className="flex items-center gap-3 border-b border-(--color-border-default) px-4">
          <Search className="size-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Search chats…"
            aria-label="Search chats"
            role="combobox"
            aria-expanded="true"
            aria-controls="chat-search-list"
            aria-activedescendant={rows.length ? `chat-search-${cur}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-body-lg text-(--color-text-primary) outline-none placeholder:text-(--color-text-secondary)"
          />
          <button type="button" aria-label="Close search" onClick={onClose} className={cn(iconButton, "size-8")}>
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <ul ref={list} id="chat-search-list" role="listbox" aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto p-2">
          {!query && !noNew && (
            <li role="option" id="chat-search-0" data-i={0} aria-selected={cur === 0} onMouseEnter={() => setSel(0)} onClick={() => choose({ kind: "new" })} className={cn(rowCls(cur === 0), "cursor-pointer")}>
              <span className="grid size-7 place-items-center rounded-circle border border-(--color-border-default) text-(--color-text-primary)">
                <SquarePen className="size-3.5" aria-hidden />
              </span>
              <span className="text-body-md text-(--color-text-primary)">New chat</span>
            </li>
          )}
          {groups.map((g) => (
            <li key={g.label} role="presentation">
              <p className="px-3 pt-4 pb-1.5 text-body-sm text-(--color-text-secondary)">{g.label}</p>
              <ul role="presentation">
                {g.rows.map((r) => {
                  if (r.kind !== "chat") return null;
                  const n = i++;
                  return (
                    <li key={r.t.id} role="option" id={`chat-search-${n}`} data-i={n} aria-selected={cur === n} onMouseEnter={() => setSel(n)} onClick={() => choose(r)} className={cn(rowCls(cur === n), "cursor-pointer")}>
                      <AgentAvatar agent={r.t.agent} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-body-md text-(--color-text-primary)", r.t.unread && "font-medium")}>{r.t.title}</span>
                        {r.hit && (
                          <span className="block truncate text-body-sm text-(--color-text-secondary)">
                            {r.hit.pre}
                            <mark className="rounded-small bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-(--color-text-primary)">{r.hit.hit}</mark>
                            {r.hit.post}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-body-sm text-(--color-text-tertiary)">{r.t.at}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {query && rows.length === 0 && <li className="px-3 py-10 text-center text-body-md text-(--color-text-secondary)">No chats match “{q.trim()}”</li>}
        </ul>
      </div>
    </div>
  );
}
