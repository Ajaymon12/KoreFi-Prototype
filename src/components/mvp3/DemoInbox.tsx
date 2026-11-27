"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  File,
  Inbox,
  Mail,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  RotateCw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Reply,
  Forward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { user } from "@/lib/mockData";
import { STORES } from "@/lib/finance/outlets";
import { setMasaFixture } from "@/lib/mvp3/masaFixture";
import { chargebackEmail, payoutEmail, type Email } from "@/lib/mvp3/emails";
import { EmailBody } from "./EmailPreview";

// Customer demo, step 1: the owner's mail inbox on Thursday morning. KoreFi's weekly Chargebacks email for Masa Kitchen
// sits unread at the top; opening it shows the same email as the dashboard's "Preview the email", and its button
// signs into KoreFi as Masa Kitchen and opens the Chargebacks chat with the dashboard beside it (/mvp3?dash=).
// A generic webmail look (no real mail product's name or logo). Everything but the KoreFi email is filler.

const ACCOUNT_KEY = "korefi.mvp3.account";
const RESTAURANT = "Agave Kitchen";

type Row = { id: string; from: string; subject: string; snippet: string; at: string; unread?: boolean; starred?: boolean; attach?: boolean; korefi?: boolean };

const FILLER: Row[] = [
  { id: "produce", from: "Valley Produce Co.", subject: "Invoice #48213 for Nov 9 delivery", snippet: "Hi, please find attached the invoice for this week's produce delivery. Payment due in 14 days.", at: "7:42 AM", attach: true },
  { id: "payroll", from: "Payroll", subject: "Payroll for Nov 2 – Nov 8 is ready to review", snippet: "Hours are in from all 34 locations. Review and approve by Friday 5 PM to pay on time.", at: "Wed" },
  { id: "linen", from: "Metro Linen Service", subject: "Holiday schedule: pickups move to Tuesdays", snippet: "Starting Nov 24, our pickup day for your locations changes to Tuesday.", at: "Wed" },
  { id: "inspect", from: "City Health Dept.", subject: "Reminder: annual inspection window opens Dec 1", snippet: "Locations due for inspection this cycle are listed below. No action needed now.", at: "Tue" },
  { id: "team", from: "Maria (Damen GM)", subject: "Re: weekend staffing", snippet: "We're covered Saturday. Still short one line cook Sunday close, I'll post the shift.", at: "Tue" },
  { id: "equip", from: "CoolTech Equipment", subject: "Ice machine service scheduled — Oak Park", snippet: "Your technician will arrive Thursday between 2 and 4 PM.", at: "Mon" },
  { id: "news", from: "Kitchen Trade Weekly", subject: "This week: off-premise sales hit a new high", snippet: "Plus: how operators are cutting delivery errors without adding staff.", at: "Nov 9" },
];

const NAV = [
  { label: "Inbox", Icon: Inbox, count: 3 },
  { label: "Starred", Icon: Star },
  { label: "Snoozed", Icon: Clock },
  { label: "Sent", Icon: Send },
  { label: "Drafts", Icon: File, count: 1 },
];

export function DemoInbox() {
  const router = useRouter();
  // The Masa Kitchen email is the agent-journey prototype's fixed week (lib/mvp3/masaFixture).
  const mails = useMemo(() => {
    setMasaFixture(true);
    return { korefi: chargebackEmail(STORES, RESTAURANT), "korefi-pay": payoutEmail(STORES, RESTAURANT) } as Record<string, Email>;
  }, []);
  const plain = (t: string) => t.replace(/\*\*/g, "");
  // Friday morning: the payouts email just landed; Thursday's chargebacks email is below it.
  const rows: Row[] = [
    { id: "korefi-pay", from: "KoreFi", subject: mails["korefi-pay"].subject, snippet: plain(mails["korefi-pay"].lead), at: "8:00 AM", unread: true, starred: true, attach: true, korefi: true },
    { id: "korefi", from: "KoreFi", subject: mails.korefi.subject, snippet: plain(mails.korefi.lead), at: "Thu", unread: true, starred: true, attach: true, korefi: true },
    ...FILLER,
  ];
  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const open = rows.find((r) => r.id === openId) ?? null;

  const mail = open?.korefi ? mails[open.id] : null;
  const toKoreFi = () => {
    try {
      window.localStorage.setItem(ACCOUNT_KEY, "masa");
    } catch {}
    router.push(`/?dash=${open?.id === "korefi-pay" ? "report-payouts" : "dash-chargebacks"}`);
  };
  const show = (r: Row) => {
    setOpenId(r.id);
    setRead((x) => (x.includes(r.id) ? x : [...x, r.id]));
  };

  return (
    <div className="flex h-screen flex-col bg-[#f3f5f9] text-[#1f1f1f]">
      {/* top bar: menu, mail mark, search, account */}
      <header className="flex h-16 shrink-0 items-center gap-3 px-3">
        <button type="button" aria-label="Main menu" className={round}>
          <Menu className="size-5" />
        </button>
        <span className="flex w-[180px] items-center gap-2 pl-1 max-md:w-auto">
          <span className="grid size-8 place-items-center rounded-medium bg-[#1f6feb] text-white">
            <Mail className="size-[18px]" aria-hidden />
          </span>
          <span className="text-[22px] text-[#444746] max-md:hidden">Mail</span>
        </span>
        <label className="flex h-12 max-w-[720px] flex-1 items-center gap-3 rounded-full bg-[#e9eef6] px-4 focus-within:bg-white focus-within:shadow-[0_1px_3px_rgb(0_0_0/0.2)]">
          <Search className="size-5 shrink-0 text-[#444746]" aria-hidden />
          <input placeholder="Search mail" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#5f6368]" />
          <SlidersHorizontal className="size-5 shrink-0 text-[#444746]" aria-hidden />
        </label>
        <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-[#7b5ea7] text-[14px] font-medium text-white" title={`${user.firstName} ${user.lastName}`}>
          {user.firstName[0]}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left nav */}
        <nav aria-label="Folders" className="hidden w-[256px] shrink-0 flex-col pr-4 md:flex">
          <button type="button" className="mb-4 ml-2 inline-flex h-14 w-fit items-center gap-3 rounded-2xl bg-[#c2e7ff] pr-6 pl-4 text-[14px] font-medium text-[#001d35] shadow-sm hover:shadow-md">
            <Pencil className="size-5" aria-hidden /> Compose
          </button>
          {NAV.map(({ label, Icon, count }) => {
            const on = label === "Inbox";
            const n = label === "Inbox" ? rows.filter((r) => r.unread && !read.includes(r.id)).length : count;
            return (
              <button key={label} type="button" onClick={() => on && setOpenId(null)} className={cn("flex h-8 items-center gap-4 rounded-r-full pr-3 pl-6 text-[14px]", on ? "bg-[#d3e3fd] font-semibold text-[#001d35]" : "text-[#202124] hover:bg-[#e8eaed]")}>
                <Icon className="size-[18px]" aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                {n ? <span className="text-[12px]">{n}</span> : null}
              </button>
            );
          })}
          <p className="mt-5 mb-1 pl-6 text-[14px] font-medium text-[#202124]">Labels</p>
          {["Suppliers", "Staff", "Reports"].map((l) => (
            <span key={l} className="flex h-8 items-center gap-4 pl-6 text-[14px] text-[#202124]">
              <Tag className="size-[18px]" aria-hidden /> {l}
            </span>
          ))}
        </nav>

        {/* the list, or the open email */}
        <main className="mr-2 mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white max-md:mx-2">
          {open ? (
            <>
              <div className="flex h-12 shrink-0 items-center gap-1 px-2">
                <button type="button" aria-label="Back to Inbox" onClick={() => setOpenId(null)} className={round}>
                  <ArrowLeft className="size-5" />
                </button>
                {[Archive, Trash2, Mail, Clock].map((I, i) => (
                  <span key={i} className={round} aria-hidden>
                    <I className="size-[18px]" />
                  </span>
                ))}
                <span className="ml-auto text-[12px] text-[#5f6368]">1 of {rows.length}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-4 pb-10 sm:pl-[72px] sm:pr-10">
                  <h1 className="flex flex-wrap items-center gap-3 pt-2 pb-5 text-[22px] text-[#1f1f1f]">
                    {open.subject}
                    <span className="rounded-small bg-[#e8eaed] px-1.5 py-0.5 text-[12px] text-[#444746]">Inbox</span>
                  </h1>
                  <div className="flex items-start gap-3 sm:-ml-[56px]">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-[16px] font-medium text-white", open.korefi ? "bg-(--color-primary)" : "bg-[#5f6368]")}>{open.from[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                        <b className="font-semibold">{open.from}</b>
                        <span className="text-[12px] text-[#5f6368]">&lt;{open.korefi ? "reports@korefi.com" : "hello@example.com"}&gt;</span>
                        <span className="ml-auto text-[12px] text-[#5f6368]">{mail ? mail.sentAt : open.at}</span>
                      </p>
                      <p className="text-[12px] text-[#5f6368]">to me</p>
                    </div>
                    <span className="flex shrink-0 items-center text-[#444746]" aria-hidden>
                      <Star className={cn("size-5 p-0.5", open.starred && "fill-[#f4b400] text-[#f4b400]")} />
                      <Reply className="ml-2 size-5 p-0.5" />
                      <MoreVertical className="ml-1 size-5 p-0.5" />
                    </span>
                  </div>
                  <div className="mt-5 max-w-[680px]">
                    {mail ? (
                      <EmailBody mail={mail} to={user.email} onCta={toKoreFi} bare />
                    ) : (
                      <p className="text-[14px] leading-6 text-[#222]">{open.snippet}</p>
                    )}
                  </div>
                  {mail && (
                    <div className="mt-6 flex w-fit items-center gap-3 rounded-large border border-[#dadce0] px-3 py-2.5 text-[13px] text-[#3c4043]">
                      <Paperclip className="size-4 text-[#5f6368]" aria-hidden />
                      {mail.attachment === "PDF" ? "Chargebacks review.pdf" : mail.attachment === "Excel" ? "Payouts.xlsx" : mail.attachment}
                    </div>
                  )}
                  <div className="mt-8 flex gap-3">
                    {[
                      ["Reply", Reply],
                      ["Forward", Forward],
                    ].map(([l, I]) => {
                      const Icon = I as typeof Reply;
                      return (
                        <span key={l as string} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#747775] px-5 text-[14px] font-medium text-[#444746]">
                          <Icon className="size-4" aria-hidden /> {l as string}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[#f1f3f4] px-2">
                <span className="ml-2 size-[18px] rounded-[3px] border-2 border-[#5f6368]" aria-hidden />
                <span className={round} aria-hidden>
                  <RotateCw className="size-[18px]" />
                </span>
                <span className={round} aria-hidden>
                  <MoreVertical className="size-[18px]" />
                </span>
                <span className="ml-auto flex items-center gap-1 text-[12px] text-[#5f6368]">
                  1–{rows.length} of {rows.length}
                  <ChevronLeft className="ml-3 size-5 opacity-40" aria-hidden />
                  <ChevronRight className="size-5 opacity-40" aria-hidden />
                </span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {rows.map((r) => {
                  const unread = r.unread && !read.includes(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => show(r)}
                        className={cn(
                          "group flex h-10 w-full items-center gap-3 border-b border-[#f1f3f4] pr-4 pl-3 text-left text-[14px] hover:z-10 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_rgb(60_64_67/0.3)]",
                          unread ? "bg-white" : "bg-[#f2f6fc]",
                        )}
                      >
                        <span className="size-[18px] shrink-0 rounded-[3px] border-2 border-[#c4c7c5]" aria-hidden />
                        <Star className={cn("size-[18px] shrink-0", r.starred ? "fill-[#f4b400] text-[#f4b400]" : "text-[#c4c7c5]")} aria-hidden />
                        <span className={cn("w-[180px] shrink-0 truncate max-sm:w-[100px]", unread ? "font-bold text-[#1f1f1f]" : "text-[#444746]")}>{r.from}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className={unread ? "font-bold text-[#1f1f1f]" : "text-[#444746]"}>{r.subject}</span>
                          <span className="text-[#5f6368]"> – {r.snippet}</span>
                        </span>
                        {r.attach && <Paperclip className="size-4 shrink-0 text-[#5f6368]" aria-hidden />}
                        <span className={cn("w-16 shrink-0 text-right text-[12px]", unread ? "font-bold text-[#1f1f1f]" : "text-[#5f6368]")}>{r.at}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const round = "grid size-10 shrink-0 place-items-center rounded-full text-[#444746] hover:bg-[#e8eaed]";
