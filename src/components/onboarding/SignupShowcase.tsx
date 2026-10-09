import { Layers, LayoutGrid, RefreshCw, ShieldCheck } from "lucide-react";
import { AMBER, BLUE, GREEN, GlassShowcase, RED } from "./GlassShowcase";

export function SignupShowcase() {
  return (
    <GlassShowcase
      windowTitle="Chargeback Overview"
      ariaLabel="Chargeback overview: $4,820 claimable, $3,110 won, $640 declined"
      stats={[
        { label: "Claimable", value: "$4,820", ...BLUE },
        { label: "Won", value: "$3,110", ...GREEN },
        { label: "Declined", value: "$640", ...RED },
      ]}
      flow={[
        { label: "Claimable", ...BLUE },
        { label: "Claimed", ...AMBER },
        { label: "Won", ...GREEN },
      ]}
      pills={[
        { icon: LayoutGrid, label: "Real-time P&L" },
        { icon: RefreshCw, label: "Chargeback recovery" },
        { icon: Layers, label: "3PD reconciliation" },
        { icon: ShieldCheck, label: "Automated disputes" },
      ]}
      heading="Every dollar, accounted for."
      body="Our team recovers chargebacks and reconciles every delivery payout."
    />
  );
}
