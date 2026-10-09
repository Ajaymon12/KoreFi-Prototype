import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

const TYPES = ["primary", "default", "secondary", "outline", "dashed", "link", "text", "danger", "warning"] as const;
const SIZES = ["tiny", "small", "medium", "large", "xlarge"] as const;

// Living reference for the ❖ Button page of the Design System – Master File.
function Board({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className={`${theme} space-y-6 rounded-large bg-(--color-background-primary) p-6 text-(--color-text-primary)`}>
      <h2 className="text-sm text-(--color-text-primary)">theme = {theme === "light" ? "Light" : "Dark"}</h2>
      <div className="flex flex-wrap items-center gap-3">
        {TYPES.map((t) => (
          <Button key={t} type={t} size="small">
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {SIZES.map((s) => (
          <Button key={s} size={s}>
            {s}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="small" iconLeft={<Plus />}>Icon left</Button>
        <Button size="small" iconRight={<Plus />}>Icon right</Button>
        <Button size="small" icon={<Plus />} aria-label="Add" />
        <Button type="primary" size="small" loading>Loading</Button>
        <Button size="small" loading>Loading</Button>
        <Button type="primary" size="small" disabled>Disabled</Button>
      </div>
      <div className="w-[360px] space-y-3">
        <Button type="primary" size="medium" block>Continue</Button>
        <Button size="medium" block>Cancel</Button>
      </div>
    </section>
  );
}

export default function ButtonsPage() {
  return (
    <main className="grid gap-6 bg-(--color-background-secondary) p-8 lg:grid-cols-2">
      <Board theme="light" />
      <Board theme="dark" />
    </main>
  );
}
