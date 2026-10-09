// Mock data standing in for the backend (no API yet). Figures follow the Figma "Dashboard" frame (337:22218).

export const user = { firstName: "Jane", lastName: "Alvarez", email: "jane.alvarez@gmail.com" };

/** Where "Help & support" in the profile menu goes until a help centre exists. */
export const HELP_URL = "mailto:support@korefi.com";

export const locations = ["Casa Alvarez Kitchen", "Casa Alvarez – Midtown"];

import { PERIOD } from "./period";

export const period = PERIOD;

export type LegendItem = { label: string; tone: "strong" | "soft" };

export type MetricCardData = {
  id: string;
  title: string;
  value: string;
  bar: { fill: number }; // 0..1 share of the strong segment
  legend: LegendItem[];
  available: string;
  footer: string;
};

export const topMetrics: MetricCardData[] = [
  {
    id: "orders",
    title: "Total orders",
    value: "1,025",
    bar: { fill: 0.5 },
    legend: [
      { label: "Instore", tone: "strong" },
      { label: "3PD", tone: "soft" },
    ],
    available: "$21,249 available",
    footer: `Marketplace tickets · ${period.range}`,
  },
  {
    id: "fees",
    title: "3PD Fee",
    value: "$5,202.00",
    bar: { fill: 0.31 },
    legend: [
      { label: "Balance", tone: "strong" },
      { label: "Pending", tone: "soft" },
    ],
    available: "$21,249 available",
    footer: "23.14% of net sales",
  },
];

export const chargeback = {
  stats: [
    { label: "Won", value: "$114.81" },
    { label: "Enabled Customer Refunds", value: "12", extra: "$136K" },
  ],
  footer: `27 disputes won · ${period.range}`,
};

export const totalSales = {
  subtitle: `$22,475.70 net sales · ${period.range}`,
  stats: [
    { label: "Net sales", value: "22,475.70", caption: "Order value before fees and promos" },
    { label: "Net payout", value: "16,145.91", caption: "You keep 71.8% of net sales." },
  ],
  axis: ["Jun 26", "Jul 1", "Jul 6", "Jul 11", "Jul 16"],
};

export type ChannelRow = {
  name: string;
  logo: string;
  sales: string;
  delivery: string;
  pickup: string;
  rate: string;
  total?: boolean;
};

export const commission = {
  subtitle: `$22,475.70 net sales · ${period.range}`,
  split: 323 / 568, // net sales share of the bar
  legend: [
    { label: "Net sales ($22,475.70)", tone: "strong" },
    { label: "Pickup ($2,563.61)", tone: "soft" },
  ] as LegendItem[],
  rows: [
    { name: "Doordash", logo: "/dashboard/doordash.png", sales: "$14,147.35", delivery: "$3,237.94", pickup: "$118.84", rate: "23.7%" },
    { name: "UberEats", logo: "/dashboard/ubereats.png", sales: "$8,328.35", delivery: "$1,810.24", pickup: "$34.98", rate: "22.2%" },
    { name: "Grubhub", logo: "/dashboard/grubhub.png", sales: "-", delivery: "-", pickup: "-", rate: "-" },
    { name: "All channels", logo: "/dashboard/grubhub.png", sales: "$22,475.70", delivery: "$5,048.18", pickup: "$153.82", rate: "23.1%", total: true },
  ] as ChannelRow[],
};

export const bottomMetric: MetricCardData = {
  id: "sales",
  title: "Total sales",
  value: "$22,475.70",
  bar: { fill: 0.31 },
  legend: [
    { label: "Balance", tone: "strong" },
    { label: "Pending", tone: "soft" },
  ],
  available: "$21,249 available",
  footer: `Net sales · ${period.range}`,
};

export const ticketSummary = {
  title: "Total sales",
  value: "1,025",
  stats: [
    { label: "Outstanding", value: "11" },
    { label: "Overdue", value: "1" },
    { label: "Due soon", value: "-" },
  ],
  footer: { label: "Inbox", value: "3 items", extra: "$10K" },
};

export const invoicing = {
  stats: [
    { label: "Overdue", value: "4", extra: "$950.00" },
    { label: "Paid", value: "12", extra: "$6K" },
  ],
  footer: { label: "Open", value: "12 items", extra: "$12.3K" },
};

export const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Always two decimals — for columns of money where "$12" next to "$8.44" reads as a typo. */
export const fmtCents = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
