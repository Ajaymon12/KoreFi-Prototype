import { redirect } from "next/navigation";
import { MVP2_HOME } from "@/lib/nav";

export default function Page() {
  redirect(MVP2_HOME);
}
