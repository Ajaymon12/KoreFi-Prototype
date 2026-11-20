import { shortStore } from "@/lib/finance/outlets";
import { snapshot, type AgentReply, type DocRequest, type LaborDoc, type Message } from "./agents";

// Labor leakage in the /mvp3 chat. KoreFi only has sales (Toast + the delivery apps), not hours or pay,
// so the agent can't answer a labor question on its own. It says so, lists the documents it needs, and the
// owner adds them in the chat. Each file is ticked off; once timesheets and payroll are in, it runs.
// Prototype: files are read by name only, and the findings are worked out from Taco Pros sales.

export const LABOR_AGENT = "Labor leakage";
export const LABOR_ASK = "Where am I losing money on labor?";

const DOCS: Omit<DocRequest, "file">[] = [
  { kind: "timesheets", label: "Timesheets", hint: "Clock-in and clock-out times, last 4 weeks.", required: true },
  { kind: "payroll", label: "Payroll", hint: "Hours and pay per person, last 4 weeks.", required: true },
  { kind: "schedule", label: "Schedule", hint: "Planned shifts.", required: false },
];

/** Demo files in public/samples/labor (Taco Pros, 6 outlets, Oct 19 to Nov 15), for "Use sample files" or dragging in. */
export const SAMPLE_FILES: Record<LaborDoc, string> = {
  timesheets: "taco-pros_timesheets_oct19-nov15.csv",
  payroll: "taco-pros_payroll_oct19-nov15.csv",
  schedule: "taco-pros_schedule_oct19-nov15.csv",
};

export const isLaborAsk = (q: string) => /(labou?r|staff(ing)? cost|overstaff|over-?time|payroll|wages?|clock.?ins?|timesheet|hours worked|shifts?)/i.test(q);

/** A chat that asked for labor documents: uploads in it go to this flow. */
export const isLaborThread = (messages: Message[]) => messages.some((m) => m.role === "agent" && "reply" in m && !!m.reply.docs);

/** Every file the owner added in a chat, oldest first. */
export const filesIn = (messages: Message[]) => messages.flatMap((m) => (m.role === "user" ? (m.files ?? []) : []));

const looks: Record<LaborDoc, RegExp> = {
  timesheets: /(time.?sheet|time.?card|clock|punch|attendance|hours|7shifts|homebase|team)/i,
  payroll: /(payroll|pay.?run|pay.?stub|wage|salar|gusto|adp|paychex|register)/i,
  schedule: /(schedul|roster|rota|shift.?plan|shifts)/i,
};
export const looksLabor = (name: string) => Object.values(looks).some((r) => r.test(name));

/** Which document each file is: by its name, else the first one still missing. */
export function sortFiles(files: string[]): Partial<Record<LaborDoc, string>> {
  const got: Partial<Record<LaborDoc, string>> = {};
  const unknown: string[] = [];
  for (const f of files) {
    const kind = (Object.keys(looks) as LaborDoc[]).find((k) => looks[k].test(f));
    if (kind) got[kind] = f;
    else unknown.push(f);
  }
  for (const f of unknown) {
    const next = DOCS.find((d) => !got[d.kind]);
    if (next) got[next.kind] = f;
  }
  return got;
}

const checklist = (got: Partial<Record<LaborDoc, string>>): DocRequest[] => DOCS.map((d) => ({ ...d, file: got[d.kind] }));
const missing = (got: Partial<Record<LaborDoc, string>>) => DOCS.filter((d) => d.required && !got[d.kind]);

/** The first answer: what KoreFi can see, what it can't, and the files it needs. */
export function laborNeedsData(work?: string[]): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: "I need your timesheets and payroll for this",
    lines: ["I only see sales, not hours or pay. Drop the last 4 weeks below."],
    docs: checklist({}),
    work: work ?? ["Looked for labor data in your connected apps", "Found Toast sales by hour, no timesheets or payroll"],
    followUps: ["Where do I find these files?", "Why can't you use my Toast data?"],
  };
}

/** The owner asked how to get the files. */
export function laborHowTo(): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: "Where to export each file",
    lines: [],
    rows: [
      { label: "Timesheets", sub: "7shifts, Homebase or Toast → Employees → Timesheets → Export", value: "Required" },
      { label: "Payroll", sub: "Gusto or ADP → Reports → Payroll register", value: "Required" },
      { label: "Schedule", sub: "Your scheduling app's weekly export", value: "Optional" },
    ],
    work: ["Looked up the usual exports"],
    followUps: ["Why can't you use my Toast data?"],
  };
}

export function laborWhyNotSquare(): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: "Toast shows sales, not shifts",
    lines: ["It knows when orders came in, not who was on shift or what they were paid."],
    work: ["Checked what your Toast account shares"],
    followUps: ["Where do I find these files?"],
  };
}

/** After an upload: what's ticked off, what's still missing, or the findings when it has enough. */
export function laborAfterUpload(allFiles: string[], added: string[]): AgentReply {
  const got = sortFiles(allFiles);
  const still = missing(got);
  const named = added.length === 1 ? added[0] : `${added.length} files`;
  if (still.length)
    return {
      agent: "operations",
      by: LABOR_AGENT,
      title: `Got ${named}. Now your ${still.map((d) => d.label.toLowerCase()).join(" and ")}`,
      lines: [],
      docs: checklist(got),
      work: added.map((f) => `Read ${f}`),
      followUps: ["Where do I find these files?"],
    };
  return laborResults(got, added);
}

function laborResults(got: Partial<Record<LaborDoc, string>>, added: string[]): AgentReply {
  const { month, outlets } = snapshot();
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const sales = month.all.sales;
  const target = 0.3;
  const actual = 0.324;
  const leak = sales * (actual - target);
  const wage = 17.5;
  const hours = (share: number) => Math.round((leak * share) / wage).toLocaleString("en-US");
  const worst = outlets.slice(0, 3).map((o) => shortStore(o.store));
  const withSchedule = !!got.schedule;
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: `About ${usd(leak)} went on hours you didn't need over the last 4 weeks`,
    lines: ["Mostly too many staff on weekday afternoons, 2 to 5 PM."],
    stats: [
      { label: "Labor % of sales", value: "32.4%", tone: "danger", sub: "target 30%" },
      { label: "Extra labor cost", value: usd(leak), tone: "danger", sub: "last 4 weeks" },
      { label: "Extra hours", value: hours(1), sub: `at ~$${wage}/hr` },
    ],
    rows: [
      { label: "Overstaffed slow hours", value: usd(leak * 0.52), tone: "danger" },
      { label: "Overtime", sub: `${hours(0.28)} hrs at 1.5×`, value: usd(leak * 0.28), tone: "danger" },
      { label: withSchedule ? "Worked past scheduled shifts" : "Early clock-ins", value: usd(leak * 0.2), tone: "danger" },
    ],
    look: { tone: "warning", text: `${worst.join(", ")} are furthest over target.` },
    cover: `From ${[got.timesheets, got.payroll, got.schedule].filter(Boolean).join(", ")} and Toast sales`,
    work: [...added.map((f) => `Read ${f}`), "Matched hours worked to Toast sales by hour", "Compared labor cost with your 30% target", "Ranked outlets by labor %"],
    followUps: [`Why is ${worst[0]} over target?`, ...(withSchedule ? [] : ["Add my staff schedule"]), "Run this every Monday and email me"],
  };
}

/** The checklist as it stands in a chat, for "add my staff schedule". */
export function laborAddSchedule(allFiles: string[]): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: "Drop your schedule below",
    lines: [],
    docs: checklist(sortFiles(allFiles)),
    work: ["Checked which files are in"],
  };
}

/** "Why is Damen over target?" after the findings. */
export function laborOutletWhy(outlet: string): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: `${outlet} ran 3 people on most weekday afternoons when sales needed 2`,
    lines: ["Ending one shift at 2 PM would bring it near your 30% target."],
    rows: [
      { label: "Weekday 2 to 5 PM", sub: "3 on shift, sales needed 2", value: "+60 hrs", tone: "danger" },
      { label: "Overtime", sub: "2 people over 40 hours most weeks", value: "+18 hrs", tone: "danger" },
    ],
    work: [`Read ${outlet}'s timesheets`, `Matched ${outlet}'s shifts to its Toast sales by hour`],
    followUps: ["Run this every Monday and email me"],
  };
}

export function laborScheduled(): AgentReply {
  return {
    agent: "operations",
    by: LABOR_AGENT,
    title: "Done. Every Monday at 8:00 AM",
    lines: ["I'll email you the result. Connect 7shifts or Gusto in Integrations to skip the weekly upload."],
    work: ["Set the schedule on Labor leakage", "Turned on the Monday email"],
  };
}
