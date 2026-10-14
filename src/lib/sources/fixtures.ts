// Raw, provider-shaped payloads, deliberately different per provider so the adapters have real
// mapping work to do. Amounts follow each provider's own convention (dollars vs cents).

export const RAW = {
  square: {
    location: "Casa Alvarez Kitchen",
    summary: { net_sales_money: { amount: 4132040, currency: "USD" }, prior_period_net_sales_money: { amount: 3837120, currency: "USD" }, order_count: 1025, prior_period_order_count: 958 },
    weekly_net_sales: [
      { label: "8 – 14 Sep", amount: 9412.3 },
      { label: "15 – 21 Sep", amount: 9988.75 },
      { label: "22 – 28 Sep", amount: 10730.6 },
      { label: "29 Sep – 5 Oct", amount: 11188.75 },
    ],
    sold_out_items: [
      { name: "Birria tacos", location: "Casa Alvarez Kitchen" },
      { name: "Horchata", location: "Casa Alvarez – Midtown" },
    ],
  },
  toast: { restaurantGuid: "toast-demo", netSales: 0, orders: 0 },
  clover: { merchantId: "clover-demo", total: 0, count: 0 },

  zoho: {
    bills: [
      { vendor_name: "Sysco", total: 4820.5, status: "open", due_date: "2026-10-20" },
      { vendor_name: "Fresh Produce Co", total: 1260, status: "overdue", due_date: "2026-10-01" },
      { vendor_name: "City Utilities", total: 910.25, status: "paid", due_date: "2026-09-28" },
      { vendor_name: "Linen Service", total: 340, status: "overdue", due_date: "2026-09-30" },
    ],
  },
  xero: { Invoices: [] as unknown[] },
  quickbooks: { QueryResponse: { Bill: [] as unknown[] } },

  doordash: {
    payouts: [
      {
        period: "8 Sep – 7 Oct", subtotal: 14147.35, commission: 3356.78, net_payout: 10790.57,
        by_store: [
          { store_name: "Casa Alvarez Kitchen", subtotal: 8912.83, commission: 2114.77, net_payout: 6798.06 },
          { store_name: "Casa Alvarez – Midtown", subtotal: 5234.52, commission: 1242.01, net_payout: 3992.51 },
        ],
      },
    ],
    error_charges: [
      { order_id: "#QW88NB03X", store_name: "Casa Alvarez Kitchen", error_charge: 8.44, resolution: "pending", date: "2026-09-30", category: "Quality complaint", detail: "Churros came back stale" },
      { order_id: "#B20TT59CD", store_name: "Casa Alvarez Kitchen", error_charge: 19.33, resolution: "pending", date: "2026-09-27", category: "Missing item", detail: "Horchata missing" },
      { order_id: "#123WK82LO", store_name: "Casa Alvarez Kitchen", error_charge: 43.75, resolution: "won", date: "2026-09-29", resolved_on: "2026-10-03", category: "Missing item", detail: "Birria tacos missing" },
      { order_id: "#DX4PL92QW", store_name: "Casa Alvarez – Midtown", error_charge: 9.49, resolution: "pending", date: "2026-09-23", category: "Missing item", detail: "Elote missing" },
      { order_id: "#4D9X2KQ1A", store_name: "Casa Alvarez – Midtown", error_charge: 28.4, resolution: "won", date: "2026-09-20", resolved_on: "2026-09-27", category: "Wrong order", detail: "Entirely wrong order delivered" },
      { order_id: "#5TRX02MLK", store_name: "Casa Alvarez – Midtown", error_charge: 12.0, resolution: "auto_refunded", date: "2026-09-18", category: "Missing item", detail: "Agua fresca missing — DoorDash refunded the customer" },
      { order_id: "#77PL03ZMB", store_name: "Casa Alvarez Kitchen", error_charge: 61.2, resolution: "lost", date: "2026-09-12", category: "Made wrong", detail: "Carne asada burrito made wrong" },
      { order_id: "#Z12MK09RT", store_name: "Casa Alvarez Kitchen", error_charge: 17.32, resolution: "lost", date: "2026-09-08", category: "Wrong order", detail: "Wrong order delivered" },
    ],
    ops: [
      { store_name: "Casa Alvarez Kitchen", subtotal: 8912.83, prior_subtotal: 8260.1, orders: 318, prior_orders: 296, cancelled: 14, prior_cancelled: 11, store_cancelled: 6, prior_store_cancelled: 5, items: 742, prior_items: 690, wait_min: 4.2, prior_wait_min: 4.8, prior_inaccurate: 4, prior_error_charges: 70, open_minutes: 19800, offline_by_weekday: [0, 0, 0, 0, 0, 0, 0], prior_offline_minutes: 22, top_items: [["Birria tacos", 168, 5], ["Carne asada burrito", 131, 4], ["Quesabirria", 96, 2], ["Churros", 74, 1], ["Horchata", 88, 2]] },
      { store_name: "Casa Alvarez – Midtown", subtotal: 5234.52, prior_subtotal: 4980.4, orders: 187, prior_orders: 176, cancelled: 9, prior_cancelled: 10, store_cancelled: 3, prior_store_cancelled: 4, items: 441, prior_items: 418, wait_min: 5.6, prior_wait_min: 5.1, prior_inaccurate: 4, prior_error_charges: 55, open_minutes: 19800, offline_by_weekday: [0, 5, 0, 0, 0, 0, 0], prior_offline_minutes: 18, top_items: [["Birria tacos", 97, 3], ["Elote", 61, 2], ["Carne asada burrito", 84, 2], ["Agua fresca", 52, 1], ["Quesabirria", 58, 1]] },
    ],
    stores: [{ name: "Casa Alvarez Kitchen", is_open: true, offline_minutes: 0, offline_reason: null }, { name: "Casa Alvarez – Midtown", is_open: true, offline_minutes: 5, offline_reason: "Credential error" }],
    // Promotions and Sponsored Listings, as the merchant portal's "Marketing" export reports them.
    promotions: [
      { name: "BOGO Birria tacos", kind: "BOGO", store_name: "Casa Alvarez Kitchen", merchant_funded: 486.0, ad_spend: 0, orders: 81, new_customer_orders: 14, order_subtotal: 2187.4, weekly_cost: [104.5, 118.2, 131.7, 131.6] },
      { name: "20% off, first order", kind: "PERCENT_OFF", store_name: "Casa Alvarez Kitchen", merchant_funded: 236.1, ad_spend: 0, orders: 46, new_customer_orders: 46, order_subtotal: 1180.5, weekly_cost: [52.3, 57.9, 61.4, 64.5] },
      { name: "20% off, first order", kind: "PERCENT_OFF", store_name: "Casa Alvarez – Midtown", merchant_funded: 148.8, ad_spend: 0, orders: 29, new_customer_orders: 29, order_subtotal: 744.0, weekly_cost: [31.2, 36.0, 39.8, 41.8] },
      { name: "Sponsored Listing", kind: "SPONSORED", store_name: "Casa Alvarez Kitchen", merchant_funded: 0, ad_spend: 320.0, orders: 58, new_customer_orders: 9, order_subtotal: 1624.3, weekly_cost: [80, 80, 80, 80] },
    ],
  },
  ubereats: {
    payouts: [
      {
        period: "8 Sep – 7 Oct", gross_cents: 832835, fees_cents: 184522, net_cents: 648313,
        restaurants: [
          { name: "Casa Alvarez Kitchen", gross_cents: 549671, fees_cents: 121785, net_cents: 427886 },
          { name: "Casa Alvarez – Midtown", gross_cents: 283164, fees_cents: 62737, net_cents: 220427 },
        ],
      },
    ],
    incidents: [
      { ticket: "UE-88340", restaurant: "Casa Alvarez Kitchen", amount_cents: 0, outcome: "auto_refunded", date: "2026-09-19", category: "Wrong order", detail: "Wrong order — Uber Eats refunded the customer" },
      { ticket: "UE-88221", restaurant: "Casa Alvarez Kitchen", amount_cents: 1044, outcome: "lost", date: "2026-09-19", category: "Wrong order", detail: "Wrong item delivered" },
      { ticket: "UE-88190", restaurant: "Casa Alvarez – Midtown", amount_cents: 2349, outcome: "pending", date: "2026-09-19", category: "Made wrong", detail: "Carne asada burrito made wrong" },
      { ticket: "UE-88123", restaurant: "Casa Alvarez Kitchen", amount_cents: 1330, outcome: "won", date: "2026-09-19", resolved_on: "2026-09-24", category: "Missing item", detail: "Quesabirria missing" },
      { ticket: "UE-88305", restaurant: "Casa Alvarez – Midtown", amount_cents: 0, outcome: "auto_refunded", date: "2026-09-10", category: "Missing item", detail: "Missing item — Uber Eats refunded the customer" },
    ],
    ops: [
      { restaurant: "Casa Alvarez Kitchen", subtotal_cents: 549671, prior_subtotal_cents: 512000, delivered: 214, prior_delivered: 201, cancelled: 9, prior_cancelled: 8, restaurant_cancelled: 4, prior_restaurant_cancelled: 3, units: 498, prior_units: 466, avoidable_wait_min: 6.1, prior_avoidable_wait_min: 5.4, prior_inaccurate: 2, prior_error_cents: 2850, open_minutes: 19800, offline_by_weekday: [0, 0, 0, 0, 7, 5, 0], prior_offline_minutes: 9, top_items: [["Birria tacos", 112, 3], ["Quesabirria", 87, 2], ["Carne asada burrito", 79, 2], ["Churros", 51, 1], ["Horchata", 60, 1]] },
      { restaurant: "Casa Alvarez – Midtown", subtotal_cents: 283164, prior_subtotal_cents: 299020, delivered: 112, prior_delivered: 118, cancelled: 5, prior_cancelled: 6, restaurant_cancelled: 2, prior_restaurant_cancelled: 3, units: 262, prior_units: 275, avoidable_wait_min: 4.9, prior_avoidable_wait_min: 5.2, prior_inaccurate: 3, prior_error_cents: 3000, open_minutes: 19800, offline_by_weekday: [0, 0, 0, 0, 0, 0, 0], prior_offline_minutes: 0, top_items: [["Birria tacos", 58, 2], ["Carne asada burrito", 49, 1], ["Elote", 33, 1], ["Quesabirria", 41, 1], ["Agua fresca", 27, 0]] },
    ],
    restaurants: [{ name: "Casa Alvarez Kitchen", status: "PAUSED", minutes_offline: 12, reason: "Server error", lost_sales_cents: 18400 }, { name: "Casa Alvarez – Midtown", status: "ONLINE", minutes_offline: 0, reason: null, lost_sales_cents: 0 }],
    // Offers and ads from Uber Eats Manager, in cents.
    offers: [
      { title: "Free delivery on $25+", offer_type: "FREE_DELIVERY", restaurant: "Casa Alvarez Kitchen", cost_cents: 31240, ad_cents: 0, redemptions: 97, first_time_redemptions: 22, basket_cents: 329800, weekly_cost_cents: [7010, 7480, 8120, 8630] },
      { title: "Free delivery on $25+", offer_type: "FREE_DELIVERY", restaurant: "Casa Alvarez – Midtown", cost_cents: 14650, ad_cents: 0, redemptions: 44, first_time_redemptions: 8, basket_cents: 146400, weekly_cost_cents: [3480, 3600, 3720, 3850] },
      { title: "15% off, new customers", offer_type: "PERCENT_OFF", restaurant: "Casa Alvarez – Midtown", cost_cents: 9870, ad_cents: 0, redemptions: 23, first_time_redemptions: 23, basket_cents: 65800, weekly_cost_cents: [2210, 2380, 2560, 2720] },
    ],
  },
  grubhub: {
    payouts: [] as unknown[],
    adjustments: [] as { id: string; location: string; amt: string; state: string; date: string; resolved_on?: string; why: string; what: string }[],
    venues: [] as unknown[],
  },

  mercury: {
    balance: 48215.33,
    prior_balance: 41870.1,
    transactions: [
      { id: "mrc_001", postedAt: "2026-10-06", amount: 10790.57, counterparty: "DoorDash", note: "DOORDASH PAYOUT" },
      { id: "mrc_002", postedAt: "2026-10-07", amount: 6310.42, counterparty: "Uber Eats", note: "UBER EATS PAYOUT" },
    ],
  },
};
