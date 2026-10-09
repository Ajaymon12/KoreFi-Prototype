import {
  Banknote,
  ClipboardCheck,
  ChartNoAxesColumnIncreasing,
  Coins,
  ConciergeBell,
  Blocks,
  BookOpenText,
  House,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  NotebookText,
  PiggyBank,
  ReceiptText,
  Repeat2,
  Settings,
  ShieldAlert,
  Star,
  Timer,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for navigation. The global rail lists every module; the sub sidebar
// lists the active module's `children`. A module without children gets no sub sidebar.
export type NavChild = { label: string; href: string; Icon: LucideIcon };
/** How a module "feels": its role as a cowork, a one-line voice, and the illustration that fronts it. */
export type Persona = { role: string; tagline: string; illustration: "coins" | "bell" | "steps" };
export type NavModule = { id: string; label: string; href: string; Icon: LucideIcon; children?: NavChild[]; persona?: Persona };

export const NAV_MODULES: NavModule[] = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    Icon: House,
    children: [
      { label: "Overview", href: "/home/overview", Icon: LayoutDashboard },
      { label: "Weekly notes", href: "/home/weekly-notes", Icon: NotebookText },
      { label: "Tasks", href: "/home/tasks", Icon: ListChecks },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    href: "/finance",
    Icon: Coins,
    persona: { role: "Finance cowork", tagline: "Every dollar, accounted for.", illustration: "coins" },
    children: [
      { label: "Sales", href: "/finance/sales", Icon: ReceiptText },
      { label: "What you keep", href: "/finance/what-you-keep", Icon: PiggyBank },
      { label: "Payout", href: "/finance/payout", Icon: Landmark },
      { label: "Books & Tax", href: "/finance/books-and-tax", Icon: BookOpenText },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    href: "/operations",
    Icon: ConciergeBell,
    persona: { role: "Operations cowork", tagline: "Keeps the line moving.", illustration: "bell" },
    children: [
      { label: "Chargebacks", href: "/operations/chargeback", Icon: ShieldAlert },
      { label: "Order quality", href: "/operations/order-quality", Icon: ClipboardCheck },
      { label: "Wait & downtime", href: "/operations/wait-and-downtime", Icon: Timer },
      { label: "Menu rating", href: "/operations/menu-rating", Icon: Star },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    href: "/growth",
    Icon: ChartNoAxesColumnIncreasing,
    persona: { role: "Growth cowork", tagline: "Finds your next regulars.", illustration: "steps" },
    children: [
      { label: "Promotions & ads", href: "/growth/promotions-and-ads", Icon: Megaphone },
      { label: "Repeat customers", href: "/growth/repeat-customers", Icon: Repeat2 },
    ],
  },
];

// Pinned to the bottom of the rail; no sub modules, so no sub sidebar.
export const FOOTER_MODULES: NavModule[] = [
  { id: "integrations", label: "Integrations", href: "/integrations", Icon: Blocks },
  { id: "settings", label: "Settings", href: "/settings", Icon: Settings },
];

const ALL_MODULES = [...NAV_MODULES, ...FOOTER_MODULES];

export const isInModule = (pathname: string, m: NavModule) => pathname === m.href || pathname.startsWith(m.href + "/");

export const getActiveModule = (pathname: string) => ALL_MODULES.find((m) => isInModule(pathname, m));

/** Where a module's rail icon leads: its first sub page, or itself when it has none. */
export const moduleEntryHref = (m: NavModule) => m.children?.[0]?.href ?? m.href;
