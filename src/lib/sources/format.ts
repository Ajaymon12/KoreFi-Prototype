// Small text helpers shared by the marketplace report pages.

export const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
export const pct2 = (n: number) => `${(n * 100).toFixed(2)}%`;

/** "+7.7% vs previous 30 days" for a relative change. */
export const vsPrev = (change: number) => `${change >= 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)}% vs previous period`;

/** "+0.4 pts vs previous period" for a change between two rates (both 0–1). */
export const ptsVsPrev = (now: number, before: number) => {
  const d = (now - before) * 100;
  return `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} pts vs previous period`;
};

/** "+0.6 min vs previous period". */
export const minVsPrev = (now: number, before: number) => `${now >= before ? "+" : "−"}${Math.abs(now - before).toFixed(1)} min vs previous period`;
