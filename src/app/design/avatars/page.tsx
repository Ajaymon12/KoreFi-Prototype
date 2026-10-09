import { CoworkAvatar } from "@/components/module/CoworkAvatar";
import { NAV_MODULES } from "@/lib/nav";

const COWORKS = NAV_MODULES.filter((m) => m.persona).map((m) => m.persona!);
const SIZES = ["size-5", "size-6", "size-8", "size-10", "size-16", "size-24"];

// Living reference for the cowork avatars, at every size they're used, in both themes.
function Board({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className={`${theme} space-y-6 rounded-large bg-(--color-background-secondary) p-6 text-(--color-text-primary)`}>
      <h2 className="text-sm">theme = {theme === "light" ? "Light" : "Dark"}</h2>
      {COWORKS.map((p) => (
        <div key={p.role} className="flex flex-wrap items-center gap-5">
          <span className="w-40 text-body-md">{p.role}</span>
          {SIZES.map((s) => (
            <CoworkAvatar key={s} kind={p.illustration} className={s} title={p.role} />
          ))}
        </div>
      ))}
    </section>
  );
}

export default function AvatarsPage() {
  return (
    <main className="light min-h-screen space-y-6 bg-(--color-background-primary) p-8">
      <h1 className="text-page-title text-(--color-text-primary)">Cowork avatars</h1>
      <Board theme="light" />
      <Board theme="dark" />
    </main>
  );
}
