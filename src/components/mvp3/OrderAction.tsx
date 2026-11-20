"use client";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrderAnswer } from "@/lib/mvp3/orderAnswer";
import { pill } from "@/components/mvp3/styles";

// Masa Kitchen's payout week: the one order KoreFi can't verify, for the owner to answer. Shown in the chat, the
// email and (as a status) the dashboard's unmatched orders; the answer is shared (lib/mvp3/orderAnswer).

export function OrderAction({ className }: { className?: string }) {
  const [answer, setAnswer] = useOrderAnswer();
  return (
    <section aria-label="1 order needs you" className={cn("max-w-md rounded-large border border-(--color-warning-default) bg-(--color-warning-lightest) p-3.5", className)}>
      {answer ? (
        <p className="flex items-start gap-2 text-body-md text-(--color-text-primary)">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--color-text-success)" aria-hidden />
          {answer === "yes" ? "Thanks. KoreFi has claimed $24.10 from Uber Eats." : "Thanks. Marked as not made."}
        </p>
      ) : (
        <>
          <p className="text-body-md font-semibold text-(--color-text-primary)">1 order needs you</p>
          <p className="mt-1 text-body-md text-(--color-text-primary)">Oak Park: Toast shows a $24.10 Uber Eats order on Sat, Nov 7 (UE 9QX4), but Uber Eats did not pay for it. Was it handed to the driver?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setAnswer("yes")} className={cn(pill, "bg-(--color-background-secondary) px-3 py-1.5")}>
              Yes, it was made
            </button>
            <button type="button" onClick={() => setAnswer("no")} className={cn(pill, "bg-(--color-background-secondary) px-3 py-1.5")}>
              No
            </button>
          </div>
        </>
      )}
    </section>
  );
}
