import { cn } from "@/lib/utils";

// Money figure in the Mercury style: whole dollars at full size, cents raised and smaller, so
// the eye reads the magnitude first. `signed` prefixes +/−; `tone="auto"` greens money in.
export function Money({
  value,
  signed = false,
  tone = "default",
  className,
}: {
  value: number;
  signed?: boolean;
  tone?: "default" | "auto" | "muted" | "danger" | "success";
  className?: string;
}) {
  const abs = Math.abs(value);
  const [whole, cents] = abs.toFixed(2).split(".");
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const color =
    tone === "auto"
      ? value > 0
        ? "text-(--color-text-success)"
        : undefined
      : { default: undefined, muted: "text-(--color-text-secondary)", danger: "text-(--color-text-danger)", success: "text-(--color-text-success)" }[tone];
  return (
    <span className={cn("whitespace-nowrap tabular-nums", color, className)}>
      {sign}${Number(whole).toLocaleString("en-US")}
      <span className="relative -top-[0.45em] ml-px text-[0.58em]">.{cents}</span>
    </span>
  );
}
