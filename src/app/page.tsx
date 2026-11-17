import { redirect } from "next/navigation";

// The prototype opens on MVP 3, whose first visit is the sign-up (components/mvp3/Onboarding.tsx).
export default function Root() {
  redirect("/mvp3");
}
