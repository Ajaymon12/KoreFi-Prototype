import type { MetricCardData } from "@/lib/mockData";
import { CardActions, CardFooter, CardTitle, DashCard, Divider, Legend, SplitBar, ViewLink } from "./parts";

// Metric card with split bar (Figma "Total orders" 337:23413, "3PD Fee" 339:23574).
export function MetricCard({ data }: { data: MetricCardData }) {
  return (
    <DashCard>
      <div className="flex items-start justify-between">
        <CardTitle title={data.title} value={data.value} />
        <CardActions />
      </div>
      <div className="space-y-4 pt-3 pb-3">
        <SplitBar fill={data.bar.fill} />
        <Legend items={data.legend} trailing={data.available} />
      </div>
      <Divider />
      <CardFooter>
        <span className="truncate">{data.footer}</span>
        <ViewLink />
      </CardFooter>
    </DashCard>
  );
}
