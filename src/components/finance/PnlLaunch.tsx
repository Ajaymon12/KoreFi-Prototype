"use client";
import { cn } from "@/lib/utils";
import { LaunchState } from "@/components/mvp2/LaunchState";
import { APPS as apps, AppIcon, Canvas, SOURCES, StoreIcon, UPLOAD_NOTE } from "@/components/mvp2/launch/parts";

// P&L Summary for a restaurant with no reports yet: LaunchState with the page's four ideas. The
// previews are small drawings of the real cards and table, with sample figures, marked "Sample".

const ProfitPreview = () => (
  <Canvas>
    <p className="text-[11px] text-(--color-text-secondary)">Profit after prime cost</p>
    <p className="mt-2 text-jumbo-md text-(--color-text-success) tabular-nums">25%</p>
    <p className="mt-6 text-[12px] text-(--color-text-secondary) tabular-nums">
      <span className="text-(--color-text-primary)">$27,749</span> of $112,767
    </p>
    <p className="mt-1 text-[11px] tabular-nums">
      <span className="text-(--color-text-success)">▲ 1.2 pts</span> <span className="text-(--color-text-tertiary)">vs last 4 weeks</span>
    </p>
    <div className="mt-4 flex h-8 items-end gap-1">
      {[38, 52, 44, 60, 56, 70, 64, 78].map((h, i) => (
        <span key={i} className={cn("flex-1 rounded-t-[2px]", i === 7 ? "bg-(--color-success-default)" : "bg-(--color-success-lightest)")} style={{ height: `${h}%` }} />
      ))}
    </div>
  </Canvas>
);

export const FeesPreview = () => {
  const rows = [
    { name: "In store", icon: <StoreIcon />, c: 3 },
    { name: "DoorDash", icon: <AppIcon app="doordash" />, c: 25 },
    { name: "Uber Eats", icon: <AppIcon app="ubereats" />, c: 28, worst: true },
    { name: "Grubhub", icon: <AppIcon app="grubhub" />, c: 21 },
  ];
  return (
    <Canvas>
      <p className="text-[11px] text-(--color-text-secondary)">Fees taken from each $1 sold</p>
      <ul className="mt-4 space-y-3.5">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[16px_64px_1fr_28px] items-center gap-2 text-[12px]">
            {r.icon}
            <span className="truncate text-(--color-text-primary)">{r.name}</span>
            <span className="relative h-1.5 rounded-circle bg-(--color-neutral-lightest)">
              <span className={cn("absolute inset-y-0 right-0 rounded-circle", r.worst ? "bg-(--color-danger-default)" : "bg-(--gray-600)")} style={{ width: `${(r.c / 30) * 100}%`, minWidth: 6 }} />
            </span>
            <span className={cn("text-right tabular-nums", r.worst ? "text-(--color-text-danger)" : "text-(--color-text-primary)")}>{r.c}¢</span>
          </li>
        ))}
      </ul>
    </Canvas>
  );
};

const TablePreview = () => {
  const cols = [<StoreIcon key="store" size={14} />, ...apps.map((a) => <AppIcon key={a.key} app={a.key} size={14} />)];
  const rows: [string, string[], boolean?][] = [
    ["Sales", ["$73.9k", "$19.8k", "$13.5k", "$5.6k"]],
    ["Commission", ["—", "−$4.6k", "−$3.6k", "−$1.1k"]],
    ["Promos", ["—", "−$226", "−$85", "−$16"]],
    ["Net after fees", ["$72.0k", "$14.9k", "$9.7k", "$4.4k"], true],
  ];
  return (
    <Canvas className="p-0">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-(--color-border-default)">
            <th className="px-3 py-2 text-left font-normal text-(--color-text-secondary)">Line</th>
            {cols.map((c, i) => (
              <th key={i} className="px-2 py-2">
                <span className="flex justify-end">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, vals, total]) => (
            <tr key={label} className={cn("border-b border-(--color-border-default) last:border-0", total && "font-medium")}>
              <td className="px-3 py-2 text-(--color-text-primary)">{label}</td>
              {vals.map((v, i) => (
                <td key={i} className={cn("px-2 py-2 text-right", total ? "text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Canvas>
  );
};

const ClaimPreview = () => (
  <Canvas>
    <p className="text-[11px] text-(--color-text-secondary)">Paid to you</p>
    <p className="mt-2 text-jumbo-sm text-(--color-text-primary) tabular-nums">$101,047</p>
    <p className="mt-1.5 text-[12px] text-(--color-text-secondary) tabular-nums">
      <span className="text-(--color-text-danger)">+$543</span> being claimed from the apps
    </p>
    <ul className="mt-5 space-y-2">
      {[
        { app: "doordash", name: "DoorDash", n: 6 },
        { app: "ubereats", name: "Uber Eats", n: 13 },
      ].map((r) => (
        <li key={r.app} className="flex items-center gap-2 text-[12px] text-(--color-text-primary)">
          <AppIcon app={r.app} />
          {r.name}
          <span className="ml-auto rounded-small bg-(--color-danger-lightest) px-1.5 py-0.5 text-[11px] text-(--color-text-danger)">{r.n} orders differ</span>
        </li>
      ))}
    </ul>
  </Canvas>
);

export function PnlLaunch({ restaurant }: { restaurant: string }) {
  return (
    <LaunchState
      eyebrow="P&L Summary"
      title="Every dollar, by channel"
      body={`${restaurant}'s profit and loss, split by in store and each delivery app. See what every app keeps from each $1 you sell, and what's left after food and staff.`}
      sources={[SOURCES.pos, SOURCES.apps]}
      note={UPLOAD_NOTE}
      features={[
        { title: "Profit after prime cost, at a glance", body: "What you kept from everything you sold, and how it moved against the weeks before.", preview: <ProfitPreview /> },
        { title: "What each app keeps", body: "Fees taken from every $1 sold, side by side, so the costliest channel stands out.", preview: <FeesPreview /> },
        { title: "P&L by channel", body: "Sales, commission, promos and chargebacks for in store and each app, down to Net after fees.", preview: <TablePreview /> },
        { title: "Money the apps owe you", body: "Orders your POS rang up that an app hasn't paid for. KoreFi claims them back for you.", preview: <ClaimPreview /> },
      ]}
    />
  );
}
