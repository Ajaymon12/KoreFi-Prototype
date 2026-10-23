import {
  ArrowLeftRight,
  Blocks,
  BookOpenText,
  Calculator,
  ChartNoAxesColumnIncreasing,
  ChefHat,
  ClipboardCheck,
  Coins,
  ConciergeBell,
  GitCompare,
  House,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  Percent,
  ReceiptText,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Timer,
  TrendingUp,
  Truck,
  Undo2,
  UtensilsCrossed,
  WandSparkles,
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
  },
  {
    id: "finance",
    label: "Finance",
    href: "/finance",
    Icon: Coins,
    persona: { role: "Finance cowork", tagline: "Every dollar, accounted for.", illustration: "coins" },
    children: [
      { label: "Overview", href: "/finance/overview", Icon: LayoutDashboard },
      { label: "P&L", href: "/finance/pnl", Icon: TrendingUp },
      { label: "Balance Sheet", href: "/finance/balance-summary", Icon: Scale },
      { label: "Payouts", href: "/finance/payout", Icon: Landmark },
      { label: "Reconciliation", href: "/finance/reconciliation", Icon: ArrowLeftRight },
      { label: "Books", href: "/finance/books", Icon: BookOpenText },
      { label: "Tax", href: "/finance/tax", Icon: Calculator },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    href: "/operations",
    Icon: ConciergeBell,
    persona: { role: "Operations cowork", tagline: "Keeps the line moving.", illustration: "bell" },
    children: [
      { label: "Overview", href: "/operations/overview", Icon: LayoutDashboard },
      { label: "Sales", href: "/operations/sales", Icon: ReceiptText },
      { label: "Orders", href: "/operations/orders", Icon: ShoppingBag },
      { label: "Order quality", href: "/operations/order-quality", Icon: ClipboardCheck },
      { label: "Wait & downtime", href: "/operations/wait-and-downtime", Icon: Timer },
      { label: "Fees & commissions", href: "/operations/fees-and-commissions", Icon: Percent },
      { label: "Refunds & adjustments", href: "/operations/refunds-and-adjustments", Icon: Undo2 },
      { label: "Chargebacks", href: "/operations/chargeback", Icon: ShieldAlert },
      { label: "Platform comparison", href: "/operations/platform-comparison", Icon: GitCompare },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    href: "/growth",
    Icon: ChartNoAxesColumnIncreasing,
    persona: { role: "Growth cowork", tagline: "Finds your next regulars.", illustration: "steps" },
    children: [
      { label: "Overview", href: "/growth/overview", Icon: LayoutDashboard },
      { label: "Delivery growth", href: "/growth/delivery-growth", Icon: Truck },
      { label: "Pricing", href: "/growth/pricing", Icon: Tag },
      { label: "Catering", href: "/growth/catering", Icon: UtensilsCrossed },
    ],
  },
  // Sous, the read-only assistant. No sub pages: it opens straight into the full-size chat.
  { id: "ai", label: "Sous", href: "/ai", Icon: ChefHat },
];

// Pinned to the bottom of the rail; no sub modules, so no sub sidebar.
export const FOOTER_MODULES: NavModule[] = [
  { id: "integrations", label: "Integrations", href: "/integrations", Icon: Blocks },
  { id: "settings", label: "Settings", href: "/settings", Icon: Settings },
];

// ---- MVP owner dashboard ----
// The MVP (/mvp) is a flat list, so it gets one Mercury-style sidebar instead of the rail +
// sub-sidebar pair above. The old modules stay reachable until they are retired.
export const OWNER_HOME = "/mvp/overview";

const ICONS: Record<string, LucideIcon> = { "/mvp/profit": TrendingUp, "/mvp/payouts": Landmark, "/mvp/chargebacks": ShieldAlert, "/mvp/promos": Megaphone };

/** Pages above the coworks: Overview, then the brief. */
export const MVP_TOP: NavChild[] = [
  { label: "Overview", href: "/mvp/overview", Icon: LayoutDashboard },
  { label: "Weekly brief", href: "/mvp/brief", Icon: Mail },
];

/** A report under a cowork. `soon` = listed so owners know it's coming, not a link yet. */
export type MvpItem = { label: string; href?: string; soon?: boolean };
/** A cowork and its reports. Shown under one "Coworkers" heading, so the label is just the area. */
export type MvpGroup = { id: "finance" | "operations" | "growth"; label: string; Icon: LucideIcon; items: MvpItem[] };

// The reports grouped by the cowork that produces them, in the order the sidebar shows them.
export const MVP_GROUPS: MvpGroup[] = [
  {
    id: "finance",
    label: "Finance",
    Icon: Coins,
    items: [
      { label: "Profit", href: "/mvp/profit" },
      { label: "Payouts", href: "/mvp/payouts" },
      { label: "Books & tax", soon: true },
    ],
  },
  {
    id: "operations",
    label: "Delivery Apps",
    Icon: Truck,
    items: [
      { label: "Chargebacks", href: "/mvp/chargebacks" },
      { label: "Store health", soon: true },
      { label: "Menu prices", soon: true },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    Icon: ChartNoAxesColumnIncreasing,
    items: [
      { label: "Promos & ads", href: "/mvp/promos" },
      { label: "Reviews", soon: true },
      { label: "Regulars", soon: true },
    ],
  },
];

export const MVP_FOOTER: NavChild[] = FOOTER_MODULES.map(({ label, href, Icon }) => ({ label, href, Icon }));

/** Every linked MVP page, flat; icons only matter where a page is shown on its own. */
export const MVP_NAV: NavChild[] = [
  ...MVP_TOP,
  ...MVP_GROUPS.flatMap((g) => g.items.filter((i): i is MvpItem & { href: string } => !!i.href).map((i) => ({ label: i.label, href: i.href, Icon: ICONS[i.href] ?? LayoutDashboard }))),
];

// ---- MVP 2 (/mvp2) ----
// The founders' second cut (Figma 1514:18163): Overview, then each coworker as a titled section of
// reports (under one "Coworkers" heading, so labels are just the area). An item may point at a ?tab= of a shared page (Chargeback Transactions).
export const MVP2_HOME = "/mvp2/pnl";
export const MVP2_TOP: NavChild[] = [{ label: "Overview", href: "/mvp2/overview", Icon: LayoutDashboard }];
export const MVP2_GROUPS: MvpGroup[] = [
  {
    id: "finance",
    label: "Finance",
    Icon: Coins,
    items: [
      { label: "P&L Summary", href: "/mvp2/pnl" },
      { label: "3PD Payouts", href: "/mvp2/payouts" },
      { label: "Balance Sheet", href: "/mvp2/balance-sheet" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    Icon: ShieldCheck,
    items: [
      { label: "Chargeback Overview", href: "/mvp2/chargebacks" },
      { label: "Chargeback Transactions", href: "/mvp2/chargebacks?tab=transactions" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    Icon: WandSparkles,
    items: [{ label: "Pricing Intelligence", soon: true }],
  },
];

/** Lets `getActiveModule` (page header, assistant) resolve /mvp/* without a persona prefix. */
const MVP_MODULE: NavModule = { id: "mvp", label: "KoreFi", href: "/mvp", Icon: House, children: MVP_NAV };

const ALL_MODULES = [...NAV_MODULES, ...FOOTER_MODULES, MVP_MODULE];

export const isInModule = (pathname: string, m: NavModule) => pathname === m.href || pathname.startsWith(m.href + "/");

export const getActiveModule = (pathname: string) => ALL_MODULES.find((m) => isInModule(pathname, m));

/** Where a module's rail icon leads: its first sub page, or itself when it has none. */
export const moduleEntryHref = (m: NavModule) => m.children?.[0]?.href ?? m.href;
