import { UploadsView } from "@/components/admin/UploadsView";

// Ops uploads 3PD and POS exports here instead of Google Drive. The page is the upload history;
// "Upload report" opens the two-pane upload dialog. All data is dummy
// (src/lib/admin/data.ts, src/lib/admin/mock.ts).
export default function Page() {
  return <UploadsView />;
}
