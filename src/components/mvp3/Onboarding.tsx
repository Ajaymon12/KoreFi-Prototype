"use client";
import { usePath } from "@/lib/mvp3/usePath";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useDismiss } from "@/components/dashboard/useDismiss";
import { Bot, Check, ChevronRight, CirclePlay, Clock, Plug, Copy, ExternalLink, Eye, EyeOff, Mail, MessagesSquare, MonitorSmartphone, Smartphone, UserRoundCog, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { FOLDERS, type AgentId } from "@/lib/mvp3/agents";
import { AppLogo } from "@/components/onboarding/marks";
import { Button, buttonVariants } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AgentAvatar } from "./AgentAvatar";
import { Composer, ComposerNote } from "./AgentChat";
import { useAccount } from "./AccountSwitcher";
import { DATA_ACCOUNT } from "@/lib/mvp3/accounts";
import { dialogSurface, pill, scrim } from "@/components/mvp3/styles";

// MVP 3's first visit, from sign-up. KoreFi knows nothing about the restaurant yet, and no delivery app is connected:
//  1. Sign up (email + password, or Google). "Log in" skips straight to the app.
//  2. Almost there: name (Google fills it) and restaurant (guessed from the email domain). No location count:
//     KoreFi reads the locations from the delivery apps.
//  3. "Setting up your workspace": a breathing ring.
//  4. The welcome chat, where the agents connect the delivery apps with the owner (Loop's setup checklist, as a
//     conversation): pick apps → copy one email → add it in each portal → "I've added it". Then what the KoreFi
//     team does next, sample data to try, and the tour.
//  5. The tour: a spotlight over the composer, the agents, the sidebar and Integrations/Settings.
// Prototype: in memory on purpose. The flow belongs to the first-time account (Little Pho, lib/mvp3/accounts):
// every refresh, and switching to it in the top bar, opens straight on the welcome chat (steps 1–3 are kept but
// skipped for the demo). "Log in", a ?chat= deep link, or
// switching to a restaurant with data (Taco Pros, Saffron Grill) skips it.

type Stage = "signup" | "about" | "setup" | "welcome" | "done";
export type App = "doordash" | "ubereats" | "grubhub";
type Profile = { email: string; name: string; restaurant: string };

type Ctx = {
  stage: Stage;
  profile: Profile;
  /** Each delivery app's state from the welcome chat; Integrations shows the same. */
  apps: Record<App, AppState>;
  setApp: (a: App, s: AppState) => void;
  /** True once someone signed up in this visit ("Log in" keeps the seeded, fully connected account). */
  isNew: boolean;
  /** Leave the welcome chat for the normal home. */
  finish: () => void;
  /** Once the owner answers, the welcome chat is a chat like any other: listed in Recent chats under this title. */
  welcomeChat: string | null;
  /** Reopen the welcome chat where it was left. */
  openWelcome: () => void;
  /** The welcome chat's conversation, kept here so leaving and reopening it doesn't replay it. */
  welcomeSnap: WelcomeSnap | null;
  saveWelcome: (s: WelcomeSnap) => void;
  startTour: () => void;
  /** Where SMS updates go. Empty until a new owner adds it (welcome chat or Settings). */
  phone: string;
  setPhone: (p: string) => void;
};

/** "3125550148" → "(312) 555-0148"; null unless it's a 10-digit US number (a leading 1 is dropped). */
export function formatPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}
const DEMO_PHONE = "(312) 555-0148";

const OnboardingContext = createContext<Ctx | null>(null);
export function useOnboarding() {
  const c = useContext(OnboardingContext);
  if (!c) throw new Error("useOnboarding must be inside <OnboardingProvider>");
  return c;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
/** "Taco Pros" → "Taco Pros'", "Casa Alvarez" → "Casa Alvarez's". */
const possessive = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);

const EMPTY_PROFILE: Profile = { email: "", name: "", restaurant: "" };
/** The first-time account opens already signed up, straight on the welcome chat (sign-up isn't part of the demo). */
const NEW_OWNER: Profile = { email: "jane@littlepho.com", name: "Jane Nguyen", restaurant: "Little Pho" };
const NO_APPS: Record<App, AppState> = { doordash: "todo", ubereats: "todo", grubhub: "todo" };

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { account, setAccount } = useAccount();
  const [stage, setStage] = useState<Stage>(account.stage === "new" ? "welcome" : "done");
  const [profile, setProfile] = useState<Profile>(account.stage === "new" ? NEW_OWNER : EMPTY_PROFILE);
  const [apps, setApps] = useState<Record<App, AppState>>(NO_APPS);
  const [isNew, setIsNew] = useState(account.stage === "new");
  const [welcomeSnap, setWelcomeSnap] = useState<WelcomeSnap | null>(null);
  const [phone, setPhone] = useState(account.stage === "new" ? "" : DEMO_PHONE);
  // Switching to the first-time account replays the welcome chat from the start; a restaurant with data skips it.
  const [flowFor, setFlowFor] = useState(account.id);
  if (flowFor !== account.id) {
    setFlowFor(account.id);
    const fresh = account.stage === "new";
    setStage(fresh ? "welcome" : "done");
    setProfile(fresh ? NEW_OWNER : EMPTY_PROFILE);
    setApps(NO_APPS);
    setIsNew(fresh);
    setWelcomeSnap(null);
    setPhone(fresh ? "" : DEMO_PHONE);
  }
  const setApp = useCallback((a: App, s: AppState) => setApps((x) => ({ ...x, [a]: s })), []);
  const [touring, setTouring] = useState(false);
  const path = usePath();
  const router = useRouter();

  useEffect(() => {
    // Seeded chats belong to the restaurant with data.
    if (!new URLSearchParams(window.location.search).has("chat")) return;
    const t = window.setTimeout(() => setAccount(DATA_ACCOUNT.id), 0);
    return () => window.clearTimeout(t);
  }, [setAccount]);

  const finish = useCallback(() => setStage("done"), []);
  const openWelcome = useCallback(() => setStage("welcome"), []);
  const saveWelcome = useCallback((x: WelcomeSnap) => setWelcomeSnap(x), []);
  const welcomeChat = welcomeSnap?.log.some((e) => e.kind === "user") ? `Set up ${profile.restaurant}` : null;
  const startTour = useCallback(() => {
    setStage("done");
    // Let the home render first so the tour can find what it points at.
    window.setTimeout(() => setTouring(true), 120);
  }, []);
  const toWelcome = useCallback(() => {
    // The welcome chat lives on the home.
    if (path !== "/mvp3") router.push("/mvp3");
    setStage("welcome");
  }, [path, router]);

  useEffect(() => {
    if (account.stage === "new" && path !== "/mvp3") router.push("/mvp3");
    // Taco Pros and Masa Kitchen (Account.home) land on Home, on switching and on refresh, unless a ?chat= link is
    // opening one of Taco Pros' chats.
    // ?dash= (the demo inbox's email button) opens a pinned dashboard instead.
    else if (account.home && path !== "/mvp3/home" && path !== "/mvp3/pnl" && !/[?&](chat|dash)=/.test(window.location.search)) router.push("/mvp3/home");
    // Only when the account changes, not on every navigation.
  }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ stage, profile, apps, setApp, isNew, finish, startTour, welcomeChat, openWelcome, welcomeSnap, saveWelcome, phone, setPhone }),
    [stage, profile, apps, setApp, isNew, finish, startTour, welcomeChat, openWelcome, welcomeSnap, saveWelcome, phone],
  );
  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {stage === "signup" && (
        <SignUp
          onDone={(a) => {
            setProfile((p) => ({ ...p, ...a, restaurant: p.restaurant || guessRestaurant(a.email) }));
            setIsNew(true);
            setStage("about");
          }}
          onLogin={() => setAccount(DATA_ACCOUNT.id)}
        />
      )}
      {stage === "about" && (
        <About
          initial={profile}
          onDone={(p) => {
            setProfile(p);
            setStage("setup");
          }}
        />
      )}
      {stage === "setup" && <Setup restaurant={profile.restaurant} onDone={toWelcome} />}
      {touring && <Tour onClose={() => setTouring(false)} />}
    </OnboardingContext.Provider>
  );
}

// ───────── Shared frame ─────────

function Wordmark() {
  return <Image src={asset("/dashboard/korefi-logo.svg")} alt="KoreFi" width={100.66} height={24} unoptimized className="shrink-0 [.dark_&]:invert" />;
}

function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("fixed inset-0 z-[80] overflow-y-auto bg-(--color-background-primary) kf-fade", className)}>{children}</div>;
}

/** A centred card under the wordmark, the look of /get-started. */
function AuthCard({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Screen>
      <div className="flex min-h-full flex-col items-center px-4 py-8">
        <Wordmark />
        <div className="my-auto w-full max-w-[420px] py-8">
          <div className="rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-6 sm:p-8">
            <h1 className="text-subtitle-lg font-medium text-(--color-text-primary)">{title}</h1>
            {sub && <p className="mt-1 text-body-md text-(--color-text-secondary)">{sub}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-body-sm text-(--color-text-secondary)">{footer}</div>}
        </div>
      </div>
    </Screen>
  );
}

// ───────── 1. Sign up ─────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function SignUp({ onDone, onLogin }: { onDone: (a: { email: string; name: string }) => void; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const emailBad = !EMAIL.test(email.trim());
  const passwordBad = password.length < 8;
  const wait = (kind: "email" | "google", a: { email: string; name: string }) => {
    setBusy(kind);
    window.setTimeout(() => onDone(a), 700);
  };
  return (
    <AuthCard
      title="Create your KoreFi account"
      sub="Your agents watch sales, payouts and chargebacks across every delivery app."
      footer={
        <>
          Already have an account?{" "}
          <button type="button" onClick={onLogin} className="text-(--color-text-clickable) underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
            Log in
          </button>
        </>
      }
    >
      <Button size="medium" block iconLeft={<GoogleMark />} loading={busy === "google"} disabled={busy !== null} onClick={() => wait("google", { email: "jane@littlepho.com", name: "Jane Nguyen" })}>
        Continue with Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-body-sm text-(--color-text-tertiary)">
        <span className="h-px flex-1 bg-(--color-border-default)" />
        or
        <span className="h-px flex-1 bg-(--color-border-default)" />
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
          if (!emailBad && !passwordBad) wait("email", { email: email.trim().toLowerCase(), name: "" });
        }}
        className="space-y-4"
      >
        <TextField label="Work email" type="email" autoComplete="email" placeholder="jane@yourrestaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} error={sent && emailBad && "Enter a valid email, like jane@yourrestaurant.com"} />
        <TextField
          label="Create password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters"
          error={sent && passwordBad && "Use at least 8 characters"}
          suffix={
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} className="grid size-8 place-items-center rounded-small text-(--color-text-secondary) outline-none hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          }
        />
        <Button type="primary" size="medium" htmlType="submit" block loading={busy === "email"} disabled={busy !== null}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

// ───────── 2. Almost there ─────────

// The one thing KoreFi asks after the account: who's signing up and the restaurant's name (it names the KoreFi
// emails the owner adds to each delivery app). Locations aren't asked: the team reads them from the apps.
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|gmx|zoho)$/;
const KNOWN: Record<string, string> = { tacopros: "Taco Pros", littlepho: "Little Pho" };

/** "jane@tacopros.com" → "Taco Pros"; a personal address (gmail…) gives nothing. */
export function guessRestaurant(email: string) {
  const domain = email.split("@")[1]?.split(".")[0]?.toLowerCase() ?? "";
  if (!domain || FREE_MAIL.test(domain)) return "";
  return KNOWN[domain] ?? domain.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function About({ initial, onDone }: { initial: Profile; onDone: (p: Profile) => void }) {
  const [name, setName] = useState(initial.name);
  const [restaurant, setRestaurant] = useState(initial.restaurant);
  const [sent, setSent] = useState(false);
  const guessed = !!initial.restaurant && restaurant === initial.restaurant;
  return (
    <AuthCard title="Almost there" sub="Next you'll connect your delivery apps. KoreFi finds your locations from them.">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
          if (name.trim() && restaurant.trim()) onDone({ ...initial, name: name.trim(), restaurant: restaurant.trim() });
        }}
        className="space-y-4"
      >
        <TextField label="Your name" autoComplete="name" placeholder="Jane Alvarez" autoFocus={!initial.name} value={name} onChange={(e) => setName(e.target.value)} error={sent && !name.trim() && "Enter your name"} />
        <TextField
          label="Restaurant name"
          autoComplete="organization"
          placeholder="Taco Pros"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          hint={guessed ? `From ${initial.email.split("@")[1]}. Change it if it's wrong.` : "If you run several brands, use the group's name."}
          error={sent && !restaurant.trim() && "Enter your restaurant's name"}
        />
        <Button type="primary" size="medium" htmlType="submit" block>
          Continue
        </Button>
      </form>
    </AuthCard>
  );
}

// ───────── 3. Setting up ─────────

const SETUP_MS = 900;

function Setup({ restaurant, onDone }: { restaurant: string; onDone: () => void }) {
  const lines = [`Creating ${possessive(restaurant)} workspace`, "Getting your Finance, Operations and Growth agents ready", "Saying hello"];
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLine((l) => l + 1), SETUP_MS);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (line >= lines.length) onDone();
  }, [line, lines.length, onDone]);

  return (
    <Screen className="flex flex-col items-center px-4">
      <div role="status" aria-live="polite" className="contents">
        <div className="flex flex-1 items-center justify-center">
          <span className="relative grid size-48 place-items-center sm:size-56">
            <span className="absolute inset-0 rounded-circle bg-(--brand-400) motion-safe:animate-[kf-breathe_2.4s_ease-in-out_infinite]" />
            <span className="relative grid size-[38%] place-items-center rounded-circle bg-(--color-background-primary)">
              <ThinkingOrb state="working" size={64} aria-hidden />
            </span>
          </span>
        </div>
        <div className="space-y-2 pb-20 text-center">
          <p className="text-subtitle-lg font-medium text-(--color-text-primary)">Setting up your workspace</p>
          <p key={line} className="text-body-lg text-(--color-text-tertiary) motion-safe:animate-page-in">
            {lines[Math.min(line, lines.length - 1)]}
          </p>
        </div>
      </div>
    </Screen>
  );
}

// ───────── 4. Welcome chat (connecting the delivery apps happens here) ─────────

// Loop's setup checklist, done as a conversation so the owner does as little as possible:
//  - One question ("Which apps do you sell on?"), answered with a tap or in words ("DoorDash and Grubhub").
//  - One email for every app, copied with one tap (two spares if an app rejects it).
//  - A card per app: open its portal, the steps, then "I've added it" (one tap, no form). "I can't add users"
//    gets an answer in the chat. Typing "done" or "added it in Uber Eats" works too.
//  - Then the agents say what the KoreFi team does next (map stores, check the first reports) and offer
//    sample data and the tour.

/** `video`: a short screen recording of the steps in /public/guides (shown from "Watch how" on the card). */
export type Guide = { name: string; portal: string; portalLabel: string; steps: React.ReactNode[]; video: string; videoLength: string };

export const GUIDE: Record<App, Guide> = {
  doordash: {
    name: "DoorDash",
    portal: "https://merchant-portal.doordash.com",
    portalLabel: "Open DoorDash Merchant Portal",
    video: "/guides/doordash-add-user.mp4",
    videoLength: "1 min",
    steps: [
      <>Choose <b>Manage users</b> in the left panel, then <b>Add user</b></>,
      <>Name: <b>KoreFi Reports</b>, email: the one above</>,
      <>Role: <b>Business Admin</b>, or <b>Business Group Admin</b> with every brand ticked if you run several</>,
    ],
  },
  ubereats: {
    name: "Uber Eats",
    portal: "https://merchants.ubereats.com/manager",
    portalLabel: "Open Uber Eats Manager",
    video: "/guides/ubereats-add-user.mp4",
    videoLength: "1 min",
    steps: [
      <>Go to <b>Users</b> in the left panel and pick a store</>,
      <>Click <b>Add user</b>: first name <b>KoreFi</b>, last name <b>Reports</b>, email: the one above</>,
      <>More than one store? Pick the next store and repeat</>,
    ],
  },
  grubhub: {
    name: "Grubhub",
    portal: "https://restaurant.grubhub.com",
    portalLabel: "Open Grubhub for Restaurants",
    video: "/guides/grubhub-add-user.mp4",
    videoLength: "1 min",
    steps: [
      <>Open <b>Settings</b>, then <b>Users</b>, then <b>Add user</b></>,
      <>Name: <b>KoreFi Reports</b>, email: the one above</>,
      <>Give it access to <b>Financials</b> for every location, then <b>Save</b></>,
    ],
  },
};
const APP_ORDER: App[] = ["doordash", "ubereats", "grubhub"];
const appsIn = (q: string) => APP_ORDER.filter((a) => (a === "doordash" ? /door ?dash/i : a === "ubereats" ? /uber/i : /grub ?hub/i).test(q));
const names = (as: App[]) => {
  const n = as.map((a) => GUIDE[a].name);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : (n[0] ?? "");
};

/** KoreFi-managed inboxes the owner adds as a user. The first is the one to use; the others are spares. */
export function emailsFor(restaurant: string) {
  const slug = (restaurant.toLowerCase().replace(/[^a-z0-9]+/g, "") || "restaurant").slice(0, 16);
  return [`${slug}-reports@korefiops.com`, `${slug}-reports@restaurantledger.co`, `${slug}-reports@kitchenbooks.io`];
}

/** The agents a new restaurant can turn on in the welcome chat: every live one, with the data it reads. */
const STARTERS = FOLDERS.flatMap((f) => f.skills.filter((s) => s.state === "live" && s.thread).map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, access: s.access, agent: f.agent })));
const starter = (id: string) => STARTERS.find((x) => x.id === id)!;
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
const needsApps = (ids: string[]) => ids.some((id) => starter(id).access.some((a) => a !== "POS"));
const needsPos = (ids: string[]) => ids.filter((id) => starter(id).access.includes("POS"));
/** Typed agent names: "chargebacks and payouts", "all of them". */
const agentsIn = (q: string) =>
  /\b(all|every|both)\b/i.test(q) ? STARTERS.map((x) => x.id) : STARTERS.filter((x) => (x.id === "chargebacks" ? /charge ?back|dispute/i : x.id === "payouts" ? /payout|reconcil/i : /p ?& ?l|profit|channel/i).test(q)).map((x) => x.id);

export type AppState = "todo" | "verifying";
type Entry =
  | { id: number; kind: "text"; text: string }
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "agents" }
  | { id: number; kind: "pick" }
  | { id: number; kind: "email" }
  | { id: number; kind: "guide"; app: App }
  | { id: number; kind: "settings"; label?: string }
  | { id: number; kind: "phone" }
  | { id: number; kind: "reach" }
  | { id: number; kind: "summary" }
    | { id: number; kind: "tour" };
type Draft = Entry extends infer E ? (E extends Entry ? Omit<E, "id"> : never) : never;
type WelcomeSnap = { log: Entry[]; queue: Draft[]; agents?: string[] | null; picked: App[] | null; reach: Reach | null; email: string; tourDismissed: boolean; wrapped: boolean; nextId: number; time: string };

/** One-tap answers to "how should we reach you?". */
const REACH = [
  { label: "Text", Icon: Smartphone },
  { label: "Email", Icon: Mail },
  { label: "Just here", Icon: MessagesSquare },
] as const;
type Reach = (typeof REACH)[number]["label"];

// Styles shared with AgentChat's replies, so the welcome chat reads like every other thread.
const line = "text-body-md text-(--color-text-primary)";
const card = "w-full max-w-[560px] rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-3.5 motion-safe:animate-page-in";
const chipLink = cn(pill, "inline-flex items-center gap-1.5 px-3 py-1.5");
/** The welcome chat's face; the sidebar shows the same one beside "Set up …". */
const SPEAKER: AgentId = "operations";

function Typing() {
  return (
    <span role="status" aria-label="Typing" className="inline-flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-circle bg-(--color-text-tertiary) motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export function Welcome() {
  const { profile, apps, setApp, finish, startTour, welcomeSnap: snap, saveWelcome, phone, setPhone } = useOnboarding();
  const emails = useMemo(() => emailsFor(profile.restaurant), [profile.restaurant]);
  // Reopened from Recent chats: pick up the conversation where it was left.
  const [log, setLog] = useState<Entry[]>(snap?.log ?? []);
  const [queue, setQueue] = useState<Draft[]>(snap?.queue ?? []);
  // Which agents the owner turned on (null: not answered yet). Older saved chats skipped this step.
  const [agents, setAgents] = useState<string[] | null>(snap ? (snap.agents ?? STARTERS.map((x) => x.id)) : null);
  const [picked, setPicked] = useState<App[] | null>(snap?.picked ?? null);
  const [reach, setReach] = useState<Reach | null>(snap?.reach ?? null);
  const [email, setEmail] = useState(snap?.email ?? emails[0]);
  const [tourDismissed, setTourDismissed] = useState(snap?.tourDismissed ?? false);
  const wrapped = useRef(snap?.wrapped ?? false);
  const nextId = useRef(snap?.nextId ?? 0);
  const end = useRef<HTMLDivElement>(null);
  const [time] = useState(() => snap?.time ?? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
  useEffect(() => {
    saveWelcome({ log, queue, agents, picked, reach, email, tourDismissed, wrapped: wrapped.current, nextId: nextId.current, time });
  }, [log, queue, agents, picked, reach, email, tourDismissed, time, saveWelcome]);

  const say = useCallback((...d: Draft[]) => setQueue((q) => [...q, ...d]), []);
  const post = useCallback((d: Draft) => setLog((l) => [...l, { ...d, id: nextId.current++ } as Entry]), []);

  // The agents' opening lines.
  const opened = useRef(snap !== null);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    say(
      { kind: "text", text: `Hey ${firstName(profile.name)}! We're your KoreFi agents. We watch sales, payouts and chargebacks across your delivery apps, and check in when something changes.` },
      { kind: "text", text: `Which agents do you want to turn on? We've picked ${STARTERS.length > 1 ? "both" : "it"} to start; you can change this any time.` },
      { kind: "agents" },
    );
  }, [say, profile.name]);

  // The owner's own words post at once; the agents' lines arrive one at a time behind a typing bubble.
  useEffect(() => {
    if (!queue.length) return;
    const [head, ...rest] = queue;
    const wait = head.kind === "user" ? 0 : head.kind === "text" ? 450 : 200;
    const t = window.setTimeout(() => {
      post(head);
      setQueue(rest);
    }, log.length === 0 ? 250 : wait);
    return () => window.clearTimeout(t);
  }, [queue, log.length, post]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [log.length]);

  const wrapUp = useCallback(
    (lead: string) => {
      if (wrapped.current) return;
      wrapped.current = true;
      say(
        { kind: "text", text: lead },
        { kind: "text", text: "How should we reach you when something changes?" },
        { kind: "reach" },
        { kind: "tour" },
      );
    },
    [say],
  );

  /** The agents to turn on → the data they need: delivery apps for all of them, Square for some. */
  const chooseAgents = useCallback(
    (ids: string[]) => {
      if (agents || !ids.length) return;
      setAgents(ids);
      post({ kind: "user", text: list(ids.map((id) => starter(id).name)) });
      const pos = needsPos(ids).map((id) => starter(id).name);
      const posLine = pos.length ? ` ${list(pos)} also ${pos.length > 1 ? "match" : "matches"} them to your Square sales. The KoreFi team sets Square up with you once your apps are in.` : "";
      if (!needsApps(ids)) {
        wrapUp(`Done. The KoreFi team will set up ${list(ids.map((id) => starter(id).name))} with you.`);
        return;
      }
      say(
        { kind: "text", text: `Good choice. ${ids.length > 1 ? "They read" : "It reads"} your delivery-app reports.${posLine}` },
        { kind: "text", text: `First we need to see ${possessive(profile.restaurant)} reports. Which delivery apps do you sell on?` },
        { kind: "pick" },
      );
    },
    [agents, post, say, wrapUp, profile.restaurant],
  );

  const choose = useCallback(
    (as: App[]) => {
      if (picked || !as.length) return;
      setPicked(as);
      post({ kind: "user", text: names(as) });
      say(
        { kind: "text", text: `Great. In ${as.length > 1 ? "each app" : names(as)}, add this email as a user. It's a KoreFi inbox that can only read reports, never change orders, menus or payouts.` },
        { kind: "email" },
        ...as.map((app) => ({ kind: "guide", app }) as Draft),
      );
    },
    [picked, post, say],
  );

  /** The owner picks where updates go. The tour offer moves below the answer so it stays last. */
  const chooseReach = useCallback(
    (r: Reach) => {
      if (reach) return;
      setReach(r);
      setLog((l) => l.filter((e) => e.kind !== "tour"));
      setQueue((q) => q.filter((d) => d.kind !== "tour"));
      post({ kind: "user", text: r });
      const after = " You can change this any time in Settings.";
      say(
        ...((r === "Text"
          ? [
              { kind: "text", text: "Done. We'll text you when something changes. What's your mobile number?" },
              { kind: "phone" },
            ]
          : r === "Email"
            ? [{ kind: "text", text: `Done. We'll email ${profile.email} when something changes.${after}` }]
            : [{ kind: "text", text: `Done. Updates will stay right here in your chats.${after}` }]) as Draft[]),
        ...(r === "Text" ? [] : ([{ kind: "text", text: "Here's where things stand." }, { kind: "summary" }] as Draft[])),
        { kind: "tour" },
      );
    },
    [reach, post, say, profile.email],
  );

  /** The number from the phone card: posted as the owner's answer, confirmed, and the tour offer kept last. */
  const savePhone = useCallback(
    (p: string) => {
      setPhone(p);
      setLog((l) => l.filter((e) => e.kind !== "tour"));
      setQueue((q) => q.filter((d) => d.kind !== "tour"));
      post({ kind: "user", text: p });
      // A number can be changed later; only the first save adds the summary.
      const first = !log.some((e) => e.kind === "summary") && !queue.some((d) => d.kind === "summary");
      say(
        { kind: "text", text: `Saved. We'll text ${p} when something changes. You can change it any time in Settings.` },
        ...(first ? ([{ kind: "text", text: "Here's where things stand." }, { kind: "summary" }] as Draft[]) : []),
        { kind: "tour" },
      );
    },
    [setPhone, post, say, log, queue],
  );

  const skip = useCallback(() => {
    if (picked) return;
    setPicked([]);
    post({ kind: "user", text: "I'll do this later" });
    wrapUp(`No problem. Say "connect DoorDash" here whenever you're ready, and we'll walk you through it.`);
  }, [picked, post, wrapUp]);

  /** Add an app after the first answer ("connect Grubhub"). */
  const addApps = useCallback(
    (as: App[]) => {
      const fresh = as.filter((a) => !picked?.includes(a));
      if (!fresh.length) return;
      setPicked((p) => [...(p ?? []), ...fresh]);
      wrapped.current = false;
      say({ kind: "text", text: `Sure. Same email as before (${email}).` }, ...fresh.map((app) => ({ kind: "guide", app }) as Draft));
    },
    [picked, email, say],
  );

  const added = useCallback(
    (app: App) => {
      if (apps[app] !== "todo") return;
      const next = { ...apps, [app]: "verifying" as AppState };
      setApp(app, "verifying");
      post({ kind: "user", text: `Added KoreFi in ${GUIDE[app].name}` });
      const left = (picked ?? []).filter((a) => next[a] === "todo");
      say({ kind: "text", text: `Thanks! We'll accept the invite at ${email} and check we can see every ${GUIDE[app].name} store.${left.length ? ` ${names(left)} next?` : ""}` });
      if (!left.length)
        wrapUp(`That's everything we need. The KoreFi team usually takes about 1 business day: we map your stores to your locations, check your first reports, and message you here when they're in.`);
    },
    [apps, setApp, picked, email, post, say, wrapUp],
  );

  const stuck = useCallback(
    (app: App) => {
      const n = GUIDE[app].name;
      post({ kind: "user", text: `I can't add users in ${n}` });
      say({ kind: "text", text: `That's common for franchise operators and accountants. Ask whoever owns the ${n} account to add ${email}, or ask ${n} merchant support to add it as an admin on all your stores. Tap "I've added it" once it's done.` });
    },
    [email, post, say],
  );

  /** Typed answers: "DoorDash and Grubhub", "later", "connect Uber Eats", "done", "added it in DoorDash". */
  const intercept = (q: string) => {
    if (!agents) {
      const ids = agentsIn(q);
      if (ids.length) return chooseAgents(ids), true;
      return false;
    }
    const found = appsIn(q);
    if (!picked) {
      if (found.length) return choose(found), true;
      if (/\b(later|skip|not now)\b/i.test(q)) return skip(), true;
      return false;
    }
    if (/\b(connect|add|set ?up)\b/i.test(q) && found.some((a) => !picked.includes(a))) return addApps(found), true;
    if (/\b(done|added|did it|finished)\b/i.test(q)) {
      const todo = picked.filter((a) => apps[a] === "todo");
      const target = found.find((a) => todo.includes(a)) ?? (todo.length === 1 ? todo[0] : undefined);
      if (target) return added(target), true;
    }
    return false;
  };

  const typing = queue.length > 0 && queue[0].kind !== "user";
  const verifying = APP_ORDER.some((a) => apps[a] === "verifying");

  // Same layout as every agent thread (AgentChat's ThreadView): a header bar, agent turns as avatar + name +
  // time over plain text, the owner's words in a grey bubble, the composer with its note underneath.
  // Consecutive agent entries share one avatar row, like one reply.
  const turns: { user: boolean; items: Entry[] }[] = [];
  for (const e of log) {
    const u = e.kind === "user";
    const last = turns[turns.length - 1];
    if (last && last.user === u && !u) last.items.push(e);
    else turns.push({ user: u, items: [e] });
  }
  // Says where setup is right now, step by step, never ahead of it.
  const status = typing ? "Typing…" : !agents ? "Choosing your agents" : !picked ? "Choosing your apps" : verifying ? "Waiting on your first reports" : "Connecting your delivery apps";
  const item = (e: Entry) => {
    switch (e.kind) {
      case "text":
        return (
          <p key={e.id} className={line}>
            {e.text}
          </p>
        );
      case "agents":
        return <PickAgents key={e.id} answered={agents} onPick={chooseAgents} />;
      case "pick":
        return <PickApps key={e.id} answered={picked} onPick={choose} onSkip={skip} />;
      case "email":
        return <EmailCard key={e.id} emails={emails} email={email} onUse={setEmail} />;
      case "guide":
        return <AppCard key={e.id} app={e.app} state={apps[e.app]} onAdded={() => added(e.app)} onStuck={() => stuck(e.app)} />;
      case "settings":
        return (
          <Link key={e.id} href="/mvp3/settings" onClick={finish} className={chipLink}>
            <UserRoundCog className="size-4 text-(--color-text-secondary)" aria-hidden />
            {e.label ?? "Customize your agents"}
            <ChevronRight className="size-3.5 text-(--color-text-secondary)" aria-hidden />
          </Link>
        );
      case "phone":
        return <PhoneCard key={e.id} saved={phone} onSave={savePhone} />;
      case "reach":
        return (
          <div key={e.id} role="group" aria-label="How should we reach you?" className="flex flex-wrap gap-1.5 motion-safe:animate-page-in">
            {REACH.map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                disabled={reach !== null}
                aria-pressed={reach === label}
                onClick={() => chooseReach(label)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-circle border px-3 py-1.5 text-body-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)",
                  reach === label ? "border-(--color-primary) bg-(--brand-200) text-(--brand-1100)" : "border-(--color-border-default) bg-(--color-background-secondary) text-(--color-text-primary)",
                  reach === null ? "hover:bg-(--color-neutral-lightest)" : reach !== label && "opacity-50",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        );
      case "summary":
        return <SetupSummary key={e.id} agents={agents ?? []} apps={(picked ?? []).filter((a) => apps[a] === "verifying")} todo={(picked ?? []).filter((a) => apps[a] === "todo")} reach={reach} phone={phone} email={profile.email} onLeave={finish} />;
      case "tour":
        if (tourDismissed) return null;
        return (
          <div key={e.id} className={cn(card, "flex flex-wrap items-center gap-x-4 gap-y-2")}>
            <span className="flex flex-1 items-center gap-2 text-body-md text-(--color-text-primary)">
              <MonitorSmartphone className="size-4 text-(--color-text-secondary)" aria-hidden />
              New here? We can show you around in under a minute.
            </span>
            <span className="flex gap-1.5">
              <Button type="primary" size="small" onClick={startTour}>
                Take the tour
              </Button>
              <Button type="text" size="small" onClick={() => setTourDismissed(true)}>
                Not now
              </Button>
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section aria-label="Welcome" className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-(--color-border-default) px-4 py-2">
        <AgentAvatar agent={SPEAKER} size={24} mood={typing ? "working" : "default"} animate />
        <h1 className="min-w-0 truncate text-body-md font-medium text-(--color-text-primary)">Set up {profile.restaurant}</h1>
        <span className="hidden shrink-0 text-body-sm text-(--color-text-secondary) sm:inline">· {status}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 sm:px-6">
          {turns.map((t, i) =>
            t.user ? (
              <div key={t.items[0].id} className="flex justify-end motion-safe:animate-page-in">
                <p className="max-w-[80%] rounded-[18px] bg-(--color-neutral-light) px-3.5 py-2 text-body-md text-(--color-text-primary)">{(t.items[0] as { text: string }).text}</p>
              </div>
            ) : (
              <div key={t.items[0].id} className="flex gap-3 motion-safe:animate-page-in">
                <AgentAvatar agent={SPEAKER} size={32} animate />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="flex items-center gap-2 pt-1 text-body-sm text-(--color-text-secondary)">
                    <span className="font-medium text-(--color-text-primary)">Your agents</span>
                    {i === 0 && <span>{time}</span>}
                  </p>
                  {t.items.map(item)}
                  {typing && i === turns.length - 1 && <Typing />}
                </div>
              </div>
            ),
          )}
          {typing && (turns.length === 0 || turns[turns.length - 1].user) && (
            <div className="flex gap-3" role="status" aria-label="Your agents are typing">
              <AgentAvatar agent={SPEAKER} size={32} mood="working" animate />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="pt-1 text-body-sm font-medium text-(--color-text-primary)">Your agents</p>
                <Typing />
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[720px] shrink-0 px-4 pb-4 sm:px-6">
        <Composer placeholder={!agents ? "Or type, like “both”" : picked ? "Send a message" : "Or type them, like “DoorDash and Grubhub”"} onSend={finish} intercept={intercept} />
        <ComposerNote />
      </div>
    </section>
  );
}

/** "Which delivery apps do you sell on?" — tap the apps, then Continue. Frozen once answered. */
/** The wrap-up: what's set up, what the KoreFi team does next, and where to go from here. */
function SetupSummary({ agents, apps, todo, reach, phone, email, onLeave }: { agents: string[]; apps: App[]; todo: App[]; reach: Reach | null; phone: string; email: string; onLeave: () => void }) {
  const reachText = reach === "Email" ? `Email to ${email}` : reach === "Text" ? `Text to ${phone}` : "Here in your chats";
  const setup = [
    { label: "Agents on", value: agents.length ? list(agents.map((id) => starter(id).name)) : "None yet" },
    { label: "Delivery apps", value: apps.length ? `${names(apps)} · KoreFi is verifying` : "Not connected yet", sub: todo.length ? `${names(todo)} still to add` : undefined },
    { label: "Updates", value: reachText },
  ];
  const next = [
    "The KoreFi team accepts the invite and maps each app's stores to your locations.",
    "We check your first reports. This usually takes about 1 business day.",
    "Each agent posts its first update here, then runs on its schedule.",
  ];
  const explore = [
    { href: "/mvp3/agents", label: "Edit your agents", sub: "Change steps, schedules and what they email you", Icon: Bot },
    { href: "/mvp3/integrations", label: "Integrations", sub: "Check what's connected, or add an app", Icon: Plug },
    { href: "/mvp3/settings", label: "Settings", sub: "Where updates reach you", Icon: UserRoundCog },
  ];
  return (
    <div className={cn(card, "space-y-4 p-4")}>
      <section aria-label="Your setup">
        <h3 className="text-body-sm font-medium text-(--color-text-secondary)">Your setup</h3>
        <dl className="mt-2 divide-y divide-(--color-border-default) rounded-medium border border-(--color-border-default)">
          {setup.map((x) => (
            <div key={x.label} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2 text-body-md">
              <dt className="text-(--color-text-secondary)">{x.label}</dt>
              <dd className="min-w-0 text-(--color-text-primary)">
                {x.value}
                {x.sub && <span className="block text-body-sm text-(--color-text-secondary)">{x.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label="What happens next">
        <h3 className="text-body-sm font-medium text-(--color-text-secondary)">What happens next</h3>
        <ol className="mt-2 space-y-1.5">
          {next.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-body-md text-(--color-text-primary)">
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-circle bg-(--color-neutral-light) text-[11px] font-medium text-(--color-text-secondary)">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="While you wait">
        <h3 className="text-body-sm font-medium text-(--color-text-secondary)">While you wait</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {explore.map(({ href, label, sub, Icon }) => (
            <li key={href}>
              <Link href={href} onClick={onLeave} className="flex h-full flex-col gap-1 rounded-medium border border-(--color-border-default) p-3 outline-none transition-colors hover:bg-(--color-neutral-lightest) focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
                <span className="flex items-center gap-1.5 text-body-md font-medium text-(--color-text-primary)">
                  <Icon className="size-4 text-(--color-text-secondary)" aria-hidden />
                  {label}
                </span>
                <span className="text-body-sm text-(--color-text-secondary)">{sub}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-body-sm text-(--color-text-secondary)">Or ask your agents anything below.</p>
      </section>
    </div>
  );
}

/** One row per live agent: its face, name, what it does and what it reads. Multi-select, then Continue. */
function PickAgents({ answered, onPick }: { answered: string[] | null; onPick: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(() => STARTERS.map((x) => x.id));
  const done = answered !== null;
  const on = (id: string) => (done ? answered.includes(id) : sel.includes(id));
  const allOn = sel.length === STARTERS.length;
  return (
    <div className={card}>
      <ul className="space-y-2">
        {STARTERS.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              disabled={done}
              aria-pressed={on(x.id)}
              onClick={() => setSel((s) => (s.includes(x.id) ? s.filter((v) => v !== x.id) : [...s, x.id]))}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-large border p-3 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:cursor-default",
                on(x.id) ? "border-(--color-focus-primary) bg-(--brand-100)" : "border-(--color-border-default) enabled:hover:border-(--color-border-darker)",
                done && !on(x.id) && "opacity-50",
              )}
            >
              <AgentAvatar agent={x.agent} size={28} />
              <span className="min-w-0 flex-1 pr-6">
                <span className="block text-body-md font-medium text-(--color-text-primary)">{x.name}</span>
                <span className="block text-body-sm text-(--color-text-secondary)">{x.blurb}</span>
                <span className="mt-1 block text-body-sm text-(--color-text-tertiary)">Reads {list(x.access.map((a) => (a === "POS" ? "Square" : a)))}</span>
              </span>
              {on(x.id) && <Check className="absolute top-3 right-3 size-4 text-(--color-primary)" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {!done && (
        <div className="mt-3 flex justify-end gap-2">
          <Button type="text" size="small" onClick={() => setSel(allOn ? [] : STARTERS.map((x) => x.id))}>
            {allOn ? "Clear" : "Select all"}
          </Button>
          <Button type="primary" size="small" disabled={!sel.length} onClick={() => onPick(STARTERS.filter((x) => sel.includes(x.id)).map((x) => x.id))}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

function PickApps({ answered, onPick, onSkip }: { answered: App[] | null; onPick: (as: App[]) => void; onSkip: () => void }) {
  const [sel, setSel] = useState<App[]>([]);
  const done = answered !== null;
  const on = (a: App) => (done ? answered.includes(a) : sel.includes(a));
  return (
    <div className={card}>
      <div className="grid grid-cols-3 gap-2">
        {APP_ORDER.map((a) => (
          <button
            key={a}
            type="button"
            disabled={done}
            aria-pressed={on(a)}
            onClick={() => setSel((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-large border px-2 py-3 text-button-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-(--color-focus-primary) disabled:cursor-default",
              on(a) ? "border-(--color-focus-primary) bg-(--brand-100) text-(--color-text-primary)" : "border-(--color-border-default) text-(--color-text-secondary) enabled:hover:border-(--color-border-darker)",
              done && !on(a) && "opacity-50",
            )}
          >
            {on(a) && <Check className="absolute top-2 right-2 size-4 text-(--color-primary)" aria-hidden />}
            <AppLogo app={a} size={28} />
            {GUIDE[a].name}
          </button>
        ))}
      </div>
      {!done && (
        <div className="mt-3 flex justify-end gap-2">
          <Button type="text" size="small" onClick={onSkip}>
            I&apos;ll do this later
          </Button>
          <Button type="primary" size="small" disabled={!sel.length} onClick={() => onPick(APP_ORDER.filter((a) => sel.includes(a)))}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

/** The one email to add, with a copy button. Two spares in case an app turns the first one down. */
/** Asks for the owner's mobile number in the chat. Once saved it shows the number, done. */
function PhoneCard({ saved, onSave }: { saved: string; onSave: (p: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (saved)
    return (
      <p className={cn(card, "flex items-center gap-2 text-body-md text-(--color-text-primary)")}>
        <Check className="size-4 text-(--color-text-success)" aria-hidden />
        {saved}
      </p>
    );
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const p = formatPhone(value);
    if (!p) return setError("Enter a 10-digit US mobile number, like (312) 555-0148.");
    onSave(p);
  };
  return (
    <form onSubmit={submit} className={cn(card, "flex flex-wrap items-start gap-2")} noValidate>
      <TextField
        label="Mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        placeholder="(312) 555-0148"
        value={value}
        error={error ?? undefined}
        onChange={(ev) => {
          setValue(ev.target.value);
          setError(null);
        }}
        containerClassName="min-w-[200px] flex-1"
      />
      <Button htmlType="submit" type="primary" size="medium" disabled={!value.trim()} className="mt-[22px]">
        Save number
      </Button>
    </form>
  );
}

export function EmailCard({ emails, email, onUse }: { emails: string[]; email: string; onUse: (e: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [spares, setSpares] = useState(false);
  const copy = (e: string) => {
    navigator.clipboard?.writeText(e).catch(() => {});
    onUse(e);
    setCopied(e);
    window.setTimeout(() => setCopied((c) => (c === e ? null : c)), 1500);
  };
  const row = (e: string) => (
    <div key={e} className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-body-md text-(--color-text-primary)">{e}</span>
      <Button size="small" iconLeft={copied === e ? <Check /> : <Copy />} onClick={() => copy(e)}>
        {copied === e ? "Copied" : "Copy"}
      </Button>
    </div>
  );
  return (
    <div className={cn(card, "space-y-2")}>
      {row(emails[0])}
      {spares ? (
        <>
          <p className="pt-1 text-body-sm text-(--color-text-secondary)">If an app says that email can&apos;t be used, try one of these:</p>
          {emails.slice(1).map(row)}
        </>
      ) : (
        <button type="button" onClick={() => setSpares(true)} className="text-body-sm text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)">
          App won&apos;t accept it?
        </button>
      )}
      {email !== emails[0] && !spares && <p className="text-body-sm text-(--color-text-secondary)">Using {email}</p>}
    </div>
  );
}

/** One app: open its portal, the three steps, then one tap to say it's done. */
export function AppCard({ app, state, onAdded, onStuck }: { app: App; state: AppState; onAdded: () => void; onStuck: () => void }) {
  const g = GUIDE[app];
  const done = state === "verifying";
  const [watching, setWatching] = useState(false);
  return (
    <div className={card}>
      {watching && <GuideVideo g={g} onClose={() => setWatching(false)} />}
      <div className="flex items-center gap-3">
        <AppLogo app={app} size={28} />
        <p className="min-w-0 flex-1 text-subtitle-sm font-medium text-(--color-text-primary)">{g.name}</p>
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-body-sm text-(--color-text-secondary)">
            <Clock className="size-4" aria-hidden />
            KoreFi is verifying
          </span>
        ) : (
          <a href={g.portal} target="_blank" rel="noreferrer" className={cn(buttonVariants({ type: "default", size: "small" }))}>
            <ExternalLink aria-hidden />
            {g.portalLabel}
          </a>
        )}
      </div>
      {!done && (
        <>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-body-md text-(--color-text-secondary) marker:text-(--color-text-primary) [&_b]:font-medium [&_b]:text-(--color-text-primary)">
            {g.steps.map((s, i) => (
              <li key={i} className="pl-1">
                {s}
              </li>
            ))}
          </ol>
          {/* "Watch how" sits in the button row's empty left side, so the card doesn't grow. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWatching(true)}
              className="mr-auto inline-flex items-center gap-1.5 rounded-medium py-1 text-body-sm font-medium text-(--color-text-clickable) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus-primary)"
            >
              <CirclePlay className="size-4" aria-hidden />
              Watch how
              <span className="font-normal text-(--color-text-secondary)">· {g.videoLength}</span>
            </button>
            <Button type="text" size="small" onClick={onStuck}>
              I can&apos;t add users
            </Button>
            <Button type="primary" size="small" iconLeft={<Check />} onClick={onAdded}>
              I&apos;ve added it
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The guide's screen recording in a lightbox over everything (also over the Integrations dialog). If the
 *  recording can't load, the steps are shown in its place so the owner is never left with a broken player. */
function GuideVideo({ g, onClose }: { g: Guide; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useDismiss(panel, true, onClose);
  return createPortal(
    <div className={cn(scrim, "z-[70] grid place-items-center p-4 motion-safe:animate-page-in")}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`How to add KoreFi in ${g.name}`} className={cn(dialogSurface, "w-full max-w-[880px] overflow-hidden")}>
        <div className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-body-md font-medium text-(--color-text-primary)">Add the KoreFi user in {g.name}</p>
          <Button type="text" size="small" icon={<X aria-hidden />} aria-label="Close video" onClick={onClose} />
        </div>
        {failed ? (
          <div className="grid aspect-video place-items-center bg-(--color-neutral-lightest) p-6">
            <div className="max-w-[420px] space-y-3">
              <p className="text-body-md text-(--color-text-secondary)">The video isn&apos;t available right now. These are the same steps:</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-body-md text-(--color-text-secondary) marker:text-(--color-text-primary) [&_b]:font-medium [&_b]:text-(--color-text-primary)">
                {g.steps.map((s, i) => (
                  <li key={i} className="pl-1">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <video src={asset(g.video)} controls autoPlay playsInline onError={() => setFailed(true)} className="block aspect-video w-full bg-black" />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ───────── 5. Guided tour ─────────

type Step = { target: string; title: string; body: string };

const STEPS: Step[] = [
  { target: "composer", title: "Ask anything", body: "Type a question about sales, payouts or chargebacks. An agent answers with the numbers and opens the report beside the chat." },
  { target: "agents", title: "Your agents", body: "Finance, Operations and Growth each watch one part of the business. Open one to see its steps, its runs and when it checks in." },
  { target: "workspace", title: "Chats and agents", body: "Start a new chat, find an old one with ⌘K, or open Agents to change what each one does and when it runs." },
  { target: "chats", title: "Updates land here", body: "Every agent update is a chat. Unread ones are bold with a dot. Dashboards you pin show up above them." },
  { target: "settings", title: "Integrations and Settings", body: "See what's connected, and choose where agents reach you: in the app, SMS or email." },
];

const PAD = 6;
const CARD_W = 320;

const find = (target: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)).find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

function Tour({ onClose }: { onClose: () => void }) {
  // Only the steps whose target is on screen (phones have no sidebar).
  const [steps] = useState(() => STEPS.filter((s) => find(s.target)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    if (!step) return;
    find(step.target)?.scrollIntoView({ block: "nearest" });
    const measure = () => setRect(find(step.target)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 250);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x < steps.length - 1 ? x + 1 : x));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  useEffect(() => {
    if (!steps.length) onClose();
  }, [steps.length, onClose]);
  if (!step || !rect) return null;

  // Beside the target if there's room on the right (the sidebar), else below or above it.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const right = rect.right + PAD + 12 + CARD_W < vw && rect.width < vw / 3;
  let left: number;
  let top: number;
  if (right) {
    left = rect.right + PAD + 12;
    top = Math.min(Math.max(12, rect.top), vh - 220);
  } else {
    left = Math.min(Math.max(12, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - 12);
    top = rect.bottom + PAD + 12 + 200 < vh ? rect.bottom + PAD + 12 : Math.max(12, rect.top - PAD - 12 - 200);
  }
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-large shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] ring-2 ring-(--color-primary) transition-all duration-300 ease-out"
        style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
      />
      <div key={i} className="absolute rounded-large border border-(--color-border-default) bg-(--color-background-secondary) p-4 shadow-[0_8px_32px_rgb(0_0_0/0.18)] kf-pop" style={{ left, top, width: CARD_W }}>
        <div className="flex items-start justify-between gap-2">
          <p id="tour-title" className="text-subtitle-sm font-medium text-(--color-text-primary)">
            {step.title}
          </p>
          <Button type="text" size="tiny" icon={<X />} aria-label="End tour" onClick={onClose} className="-mt-1 -mr-1" />
        </div>
        <p className="mt-1 text-body-md text-(--color-text-secondary)">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex gap-1" aria-label={`Step ${i + 1} of ${steps.length}`}>
            {steps.map((s, n) => (
              <span key={s.target} className={cn("h-1.5 rounded-circle transition-all", n === i ? "w-4 bg-(--color-primary)" : "w-1.5 bg-(--color-border-darker)")} />
            ))}
          </span>
          <span className="flex gap-1.5">
            {i > 0 && (
              <Button type="text" size="small" onClick={() => setI(i - 1)}>
                Back
              </Button>
            )}
            <Button type="primary" size="small" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
