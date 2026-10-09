// One reporting period for the whole app. Every card reads this, so labels can never drift apart.
export const PERIOD = {
  label: "Last 30 days",
  range: "8 Sep – 7 Oct 2026",
  start: "2026-09-08",
  /** Latest complete reporting day (the date picker cannot go past it). */
  end: "2026-10-07",
  /** Sales are bucketed by calendar day in this zone; sync stamps are shown in it too. */
  timezone: "America/Chicago",
  timezoneNote: "Central Time",
  axis: ["Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6"],
};
