import { redirect } from "next/navigation";
import { OWNER_HOME } from "@/lib/nav";

export default function Page() {
  redirect(OWNER_HOME);
}
