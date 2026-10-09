import { BookCheck, Gavel, Landmark, Receipt } from "lucide-react";
import { AMBER, BLUE, GREEN, GlassShowcase } from "./GlassShowcase";

// Log-in flavour of the glass panel: what KoreFi handled since the owner was last here.
export function LoginShowcase() {
  return (
    <GlassShowcase
      windowTitle="Since you last logged in"
      ariaLabel="Since your last login: $1,240 recovered, 14 payouts matched, 2 disputes in progress"
      stats={[
        { label: "Recovered", value: "$1,240", ...GREEN },
        { label: "Payouts", value: "14", ...BLUE },
        { label: "In progress", value: "2", ...AMBER },
      ]}
      flow={[
        { label: "Filed", ...AMBER },
        { label: "Matched", ...BLUE },
        { label: "Paid out", ...GREEN },
      ]}
      pills={[
        { icon: Gavel, label: "Disputes in progress" },
        { icon: Landmark, label: "Payouts matched" },
        { icon: Receipt, label: "Tax credit filed" },
        { icon: BookCheck, label: "Books in sync" },
      ]}
      heading="Welcome back."
      body="Here’s what KoreFi handled while you were away."
    />
  );
}
