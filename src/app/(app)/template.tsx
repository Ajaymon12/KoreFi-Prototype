// Templates remount on every navigation (layouts don't), so the incoming page fades in under the
// fixed shell. Keeps the page's flex-column contract with <main>.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-page-in">{children}</div>;
}
