// Governed metric definitions (the Loop "Definition / Sources" pattern). A number on screen
// should be traceable to exactly one of these.
export type Definition = { name: string; formula: string; scope: string; sources: string[] };

export const DEFINITIONS = {
  netSales: {
    name: "Net sales",
    formula: "Gross sales − discounts − refunds. Taxes and tips excluded.",
    scope: "All channels: dine-in, pickup, direct and marketplace.",
    sources: ["Square"],
  },
  whatYouKeep: {
    name: "What you keep",
    formula: "Marketplace net payout, the amount paid out after commission, fees and promos.",
    scope: "Marketplace channels only (DoorDash, Uber Eats, Grubhub). Dine-in and direct orders are not included. Its % is net payout ÷ marketplace sales.",
    sources: ["DoorDash", "Uber Eats"],
  },
  cash: {
    name: "Cash in bank",
    formula: "Current available balance across connected bank accounts.",
    scope: "Mercury accounts only.",
    sources: ["Mercury"],
  },
  orders: {
    name: "Orders",
    formula: "Completed orders, excluding cancelled and fully refunded orders.",
    scope: "All channels.",
    sources: ["Square"],
  },
} satisfies Record<string, Definition>;
