import { FreshnessStamp } from "./primitives";

// Delivery data is uploaded by KoreFi's ops team, so there is no live connection to report on.
// Just say how fresh the data is and where days end.
export function DataSources({ syncedAt, timezoneNote }: { syncedAt: string; timezoneNote: string }) {
  return (
    <p title={`Days end at midnight ${timezoneNote}.`} className="flex h-9 items-center rounded-medium px-1 text-body-md">
      <FreshnessStamp at={syncedAt} label="Data updated" />
    </p>
  );
}
