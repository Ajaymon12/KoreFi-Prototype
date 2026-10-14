import { getDashboardData } from "@/lib/sources/dashboard";
import { HomeView } from "./HomeView";

// Static: loads the mock data once, so it works on any static host such as GitHub Pages.
export default async function Page() {
  return <HomeView data={await getDashboardData()} />;
}
