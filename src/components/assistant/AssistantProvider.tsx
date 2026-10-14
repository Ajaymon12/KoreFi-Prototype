"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getDashboardData, type DashboardData } from "@/lib/sources/dashboard";
import { answer, suggestionsFor, SUGGESTIONS, type Answer } from "@/lib/assistant/engine";

// Sous lives in the app layout (not template.tsx) so the conversation survives navigation. It
// loads the mock data once, on first use, and answers client-side so it also works on the static
// GitHub Pages export.

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "sous"; pending: true }
  | { id: string; role: "sous"; pending?: false; answer: Answer; requested?: boolean; rating?: "up" | "down" };

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: Message[];
  suggestions: string[];
  busy: boolean;
  ask: (question: string) => void;
  /** Passes a note to the KoreFi ops team (stored locally in the prototype). */
  requestTeam: (id: string) => void;
  rate: (id: string, rating: "up" | "down") => void;
  reset: () => void;
};

const AssistantContext = createContext<Ctx | null>(null);

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return ctx;
}

const REQUESTS_KEY = "korefi-sous-requests";
let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${seq++}`;

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const loading = useRef<Promise<DashboardData> | null>(null);
  const timers = useRef<number[]>([]);

  const load = useCallback(() => (loading.current ??= getDashboardData().then((d) => (setData(d), d))), []);

  // Warm the data the first time Sous is opened, so suggestions are real and answers are instant.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // ⌘K / Ctrl+K toggles the panel.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      const pendingId = nextId();
      setMessages((m) => [...m, { id: nextId(), role: "user", text }, { id: pendingId, role: "sous", pending: true }]);
      void load().then((d) => {
        // A short beat, so the reply reads as thinking rather than a page flash.
        const t = window.setTimeout(() => setMessages((m) => m.map((x) => (x.id === pendingId ? { id: pendingId, role: "sous", answer: answer(text, d, pathname) } : x))), 650);
        timers.current.push(t);
      });
    },
    [load, pathname],
  );

  const requestTeam = useCallback((id: string) => {
    setMessages((all) => {
      const msg = all.find((x) => x.id === id);
      if (msg && msg.role === "sous" && !msg.pending) {
        try {
          const prev = JSON.parse(localStorage.getItem(REQUESTS_KEY) ?? "[]") as unknown[];
          localStorage.setItem(REQUESTS_KEY, JSON.stringify([...prev, { at: new Date().toISOString(), title: msg.answer.title, page: pathname }]));
        } catch {
          /* storage can be blocked; the confirmation still shows */
        }
      }
      return all.map((x) => (x.id === id && x.role === "sous" && !x.pending ? { ...x, requested: true } : x));
    });
  }, [pathname]);

  const rate = useCallback((id: string, rating: "up" | "down") => setMessages((all) => all.map((x) => (x.id === id && x.role === "sous" && !x.pending ? { ...x, rating: x.rating === rating ? undefined : rating } : x))), []);
  const reset = useCallback(() => setMessages([]), []);

  const value = useMemo<Ctx>(
    () => ({
      open,
      setOpen,
      messages,
      suggestions: data ? suggestionsFor(data) : SUGGESTIONS.slice(0, 4),
      busy: messages.some((m) => m.role === "sous" && m.pending),
      ask,
      requestTeam,
      rate,
      reset,
    }),
    [open, messages, data, ask, requestTeam, rate, reset],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
