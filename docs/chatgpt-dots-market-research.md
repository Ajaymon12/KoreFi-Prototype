# ChatGPT Dots: Market Research

*Researched 16 Nov 2026. Sources are listed at the end. Where outlets disagree, this doc follows OpenAI's own pages (chatgpt.com, learn.chatgpt.com).*

---

## 1. Summary

- **What it is:** Dots are always-on agents inside ChatGPT. OpenAI announced them at DevDay on 29 Sep 2026. A dot owns an ongoing responsibility, such as "keep the investor deck current," rather than answering one prompt at a time. It keeps working between conversations and contacts you when it needs a decision.
- **How it differs from earlier ChatGPT features:** Each dot has its own cloud computer and browser, its own memory, access to 4,000+ connected apps, and can be reached in ChatGPT, Slack, Teams, by phone, and by text (text is in beta).
- **Who can get it:** Paid plans only: Pro ($100 / $200 / $500), Business Premium, and Enterprise / Edu / Healthcare. Each user gets one dot at launch.
- **How it's been received:** The vision is strong, but early reviews say it is slow and not very autonomous yet, and has trouble keeping permissions. OpenAI's own system card shows scope drift on long chains of tasks.
- **Where the market is going:** "Persistent personal agents" are now a category every major lab competes in: Google Gemini Spark, Anthropic Claude Cowork, Meta Muse, xAI Grok Bot. The contest is shifting from what an agent can do to trust, controls, and how it reaches you.

---

## 2. How Dots work

| Component | What it does |
|---|---|
| **Its own computer** | A cloud VM with a browser. It keeps working while your laptop is closed. You can open it, take over a step, and hand control back. |
| **Your computer (optional)** | You can connect local machines from the desktop app. The dot can then use local files, code, and apps while the ChatGPT app is open. |
| **Memory** | Starts from your ChatGPT memory and the conversation, then builds its own notes on your preferences and ongoing work. The notes carry across chats and channels. |
| **Apps / plugins** | Uses the plugins you've connected (email, calendar, Slack, drive, CRM, and so on) within each service's permissions. Background research uses read-only access. |
| **Channels** | One dot can be reached from ChatGPT (web, desktop, mobile), Slack, Microsoft Teams, phone call, and iMessage/RCS (US Pro, beta). Switching channels does not reset its context. |
| **Background work** | Runs tasks in parallel, starts cloud threads, and hands work off to **ChatGPT Work** (one-off delegated tasks) or **Codex** (software). |
| **Scheduling** | Decides on its own when to follow up. You can also set a fixed schedule; these show up in ChatGPT's Scheduled view. |
| **Sign-ins** | You enter credentials in a private form or take over the login yourself. Saved logins need your confirmation before each reuse. |
| **Model** | GPT-6 Astra. |

### Controls and safety

- **Custom Rules:** let you *allow*, *require approval for*, or *block* specific actions, for example "always show me drafts first."
- **Auto-review:** checks any action that affects an account or shares information. Some actions always need your approval. Sensitive steps, such as changing a password, are always handed back to you.
- **Visibility:** *Activity* shows delegated tasks, *Scheduled* lets you cancel recurring tasks, and *Pause* stops the main task. Pausing does not undo actions already taken.
- OpenAI's own caveat: "dots can still make mistakes and consequential work should be reviewed."

### Setup flow (5 steps)

1. Create the dot in the mobile app, desktop app, or desktop browser. Mobile web is not supported.
2. Name it, pick an avatar, and connect plugins.
3. Optionally connect your computer from the desktop app.
4. Optionally add a messaging channel: Slack, Teams, or text.
5. Describe a responsibility, share source material, and define what should trigger an update to you.

---

## 3. Where Dots sit in OpenAI's lineup

| Product | Unit of work | Lifespan |
|---|---|---|
| ChatGPT chat | A prompt | One turn |
| ChatGPT Work | A delegated task | Until the task is done |
| Codex | A software task | Until the task is done |
| **Dots** | **A responsibility or goal** | **Ongoing; it coordinates Work and Codex tasks itself** |
| ChatGPT Space (also announced at DevDay) | A shared team workspace with ChatGPT and Dots | Ongoing |

OpenAI is also retiring Custom GPTs. New GPTs can no longer be created from 26 Oct 2026, and GPTs are fully retired on 11 Dec 2026 (Enterprise: 11 Feb 2027). Dots and plugins are the replacement: OpenAI is moving from "configured chatbots" to "agents that own outcomes."

---

## 4. Pricing and availability

| Plan | Dots access | Notes |
|---|---|---|
| Free / Plus | No | — |
| **Pro 100 / 200 / 500** | Yes, 1 dot | Adults 18+ only. **Not available in the EEA, UK, or Switzerland.** |
| **Pro 500 ($500/mo)** | Yes | New tier: 25× Plus usage, plus "Ultrafast" GPT-6 Astra (up to 8× faster in Codex). |
| **Business Premium** | Yes | Supported regions, subject to workspace eligibility. |
| **Enterprise / Edu / Healthcare** | Yes | Admin-controlled. **On by default from 18 Nov 2026** unless the workspace opts out. Not available to workspaces with UAE data or inference residency. |

- Conversations with a dot **do not count** toward ChatGPT usage limits on Pro and Business Premium.
- Tasks a dot hands off to Work or Codex **do count** toward those products' limits.
- Extended limits apply for the first month after launch.
- **Roadmap:** multiple dots per user, more speed and capacity per dot, and **Specialist Dots** for enterprise. Specialist Dots are in pilot for procurement, invoice processing, customer support, email marketing, and contracting. Each gets its own enterprise ID and credentials, managed through Microsoft Agent 365.

---

## 5. Use cases

### OpenAI's showcased use cases

| Function | Example |
|---|---|
| Finance | Track usage and revenue, flag changes, refresh the investor deck, and share numbers only after you approve. |
| Sales | Check customer requirements against emails and docs, track security and technical reviews, and update proposal figures. |
| Engineering | Map API-migration dependencies, prepare code and tests, and investigate bugs reported in Slack. OpenAI's own teams use dots this way. |
| Product | Turn customer feedback into scoped, built, and tested improvements. |
| Marketing | Flag product changes that affect a campaign, and revise copy and slides. |
| Content | Draft show notes, captions, and clip ideas from transcripts for approval. |
| Research | Update comparison charts as new results arrive and propose next tests. |
| Ops / events | Track offsite decisions, deadlines, and budget from email threads, and draft replies without sending them. |
| Personal | Reschedule meetings around family events and propose food orders for approval. |

### Use cases reported by early users

- **Monitoring loops:** re-run a rental search every 30 minutes and alert only on new matches.
- **Accounts receivable:** in an early external test, a dot prepared an overdue invoice and sent it after the user approved it.
- **Inbox and calendar triage** across Slack, Teams, and email from a single assistant.

### Patterns that work well

Dots are strongest when the work has all of these traits:
1. It runs over **days or weeks**, not minutes.
2. Its inputs **change** (new emails, new data, new feedback).
3. It mostly involves **watching, drafting, and flagging**, with a human approving the final action.
4. Its data lives in **connected SaaS tools** rather than a local system nothing else can reach.

---

## 6. Competitive landscape

| Player | Product | Positioning (as reported) |
|---|---|---|
| **OpenAI** | Dots | A persistent agent with its own computer, many channels, and 4,000+ apps. Bundled into Pro, Business Premium, and Enterprise. |
| **Google** | Gemini Spark (I/O, 19 May 2026) | A 24/7 personal agent on Gemini 3.5 with deep Gmail, Drive, and Chrome integration and MCP for third-party apps. |
| **Anthropic** | Claude Cowork | A persistent agent for knowledge work. One early Dots reviewer judged Claude stronger at launch. |
| **Meta** | Muse (8 Sep 2026) | A consumer-first agent with an estimated 2.3–4.3M downloads in its first 3 weeks. |
| **xAI** | Grok Bot | A persistent consumer agent, often compared directly with Dots. |
| **Microsoft** | Copilot / Agent 365 | Manages identity and security for agents. It is a *partner* for Specialist Dots as well as a competitor. |

**Market signals**
- Analysts size the agentic AI market at about **$9.1B in 2026**, projected to reach **$139B by 2034** (≈40% CAGR).
- A LangChain survey found **71%** of teams running agents in production now run at least one around the clock, up from 28% in 2024.
- ChatGPT has **1.2B weekly users**. That gives OpenAI the largest installed base to sell upgrades to, though Dots are currently limited to the paid tiers starting at $100.

---

## 7. Reception and risks

### What's working
- The concept is clear: one agent owns one responsibility, and you reach it wherever you already work.
- Its controls are stronger than earlier agents: Custom Rules, Auto-review, take-over, and read-only research.
- It has broad reach across many channels and apps.

### Early criticism
- **Not autonomous enough yet:** Reddit users say it needs constant prompting, is slow, gives up quickly on searches, and keeps losing permissions.
- **Rough edges at launch:** one hands-on reviewer said calls didn't connect and that making a simple avatar took 20–30 minutes. Their verdict was "not worth switching to yet."
- **Price:** going from $20 Plus to $100 Pro is a steep step, especially outside the US.
- **The category itself:** Hacker News commenters call a mostly unsupervised agent that's connected to everything "a notorious footgun."

### Safety data (from OpenAI's GPT-6 Astra system card, as reported)

| Metric | Result |
|---|---|
| Moderate permission deviation, 10 related tasks in a row | **19.7%** |
| Same, with 5 intervening tasks | 8.6% |
| Boundary tests passed when permissions or scope changed | 91.8% (45/49); all 4 failures involved ambiguous scope |
| Explicit permission-change cases | 17/17 passed |

- Deviations included carrying information into unrelated tasks and editing shared documents the user hadn't asked about. TechTimes headlined this as "fails 1 in 5 long tasks," but the figure measures **scope drift**, not task failure.
- OpenAI shelved GPT-6.1 Astra one day before launch over scope and authorization regressions. Dots run on the earlier GPT-6 Astra.
- **Enterprise identity gap:** CSA/Okta research says 78% of organizations lack lifecycle policies for non-human identities. That means Specialist Dot credentials could outlive the projects they were created for.

---

## 8. What this means for KoreFi

KoreFi helps restaurant owners understand their money: channel P&L, 3PD fees, chargebacks, and tax credits. Its key decisions are to show owners reports only and to have the KoreFi ops team do every fix.

- **Expectations are rising.** Owners on paid ChatGPT tiers will start expecting software that watches things for them and pings them only when a decision is needed. KoreFi's report-only, backend-does-the-fix model already fits that well. The gap is the *pinging*. Today owners have to log in to see what changed.
- **An alternative KoreFi could face:** a multi-unit operator could point a dot at their DoorDash, Uber Eats, and Square emails plus Google Drive and say "track my delivery fees and flag disputes." Dots can't easily get to KoreFi's real advantages: structured POS and 3PD report data, an ops team that actually files the chargebacks, and tax-credit expertise.
- **Channel lesson:** Dots reach users in Slack, Teams, SMS, and calls. For restaurant owners, **SMS or WhatsApp alerts** like "3 disputes won this week, $412 recovered" may matter more than another dashboard.
- **Possible integration:** if OpenAI's plugin ecosystem (4,000+ apps) opens to third parties, a read-only KoreFi plugin would let an owner's dot answer "how did Outlet 12 do on Uber Eats last month?" from KoreFi data. That is distribution for KoreFi, not competition.
- **Trust as a feature:** the 19.7% scope-drift figure is a reminder that in money workflows, an **approval step is the product**. This supports KoreFi's ops-team-in-the-loop model over full automation.

---

## Sources

- [Dots: Always-on agents built to handle everything — chatgpt.com](https://chatgpt.com/features/dots/)
- [Meet dots — learn.chatgpt.com](https://learn.chatgpt.com/docs/dots)
- [OpenAI unveils always-on Dots agent, $500 monthly ChatGPT plan — Anadolu Agency](https://www.aa.com.tr/en/science-technology/openai-unveils-always-on-dots-agent-500-monthly-chatgpt-plan/4073095)
- [OpenAI Dots: Always-On ChatGPT Agents Keep Working but Fail 1 in 5 Long Tasks — TechTimes](https://www.techtimes.com/articles/329462/20261026/openai-dots-always-chatgpt-agents-keep-working-fail-1-5-long-tasks.htm)
- [OpenAI Unveils Dots, GPT-6.1 Sol, $500 Pro Tier — Pulse 2.0](https://pulse2.com/openai-unveils-dots-gpt-6-1-sol-500-pro-tier-and-new-enterprise-ai-tools/)
- [OpenAI launches Dots at DevDay — AI Weekly](https://aiweekly.co/alerts/openai-launches-dots-always-on-chatgpt-agents-at-devday)
- [OpenAI launches Dots across 4,000+ apps — T2 Online](https://t2online.in/tech/tech-news/openai-launches-dots--always-on-ai-agents-that-work-in-the-background-across-more-than-4-000-apps/2008337)
- [OpenAI launches Dots AI assistants — IT Brief UK](https://itbrief.co.uk/story/openai-launches-dots-ai-assistants-for-chatgpt-users)
- [What Are ChatGPT Dots? — Zapier](https://zapier.com/blog/chatgpt-dots/)
- [ChatGPT Dots Explained — MindStudio](https://www.mindstudio.ai/blog/chatgpt-dots-explained)
- [How to Use ChatGPT Dots as an Always-On AI Assistant — MindStudio](https://www.mindstudio.ai/blog/chatgpt-dots-how-to-use)
- [ChatGPT Dots: Pricing & How to Get One — Lindy](https://www.lindy.ai/blog/chatgpt-dots)
- [OpenAI Dots: What They Can't Do Yet — Emergent](https://emergent.sh/learn/openai-dots)
- [ChatGPT Dots Review 2026 — Emergent](https://emergent.sh/learn/chatgpt-dots-review)
- [Dots vs Muse vs Grok Bot — Emergent](https://emergent.sh/learn/dots-vs-muse-vs-grok-bot)
- [How to Use ChatGPT Dots: Setup Guide — TechNerdiness](https://www.technerdiness.com/chatgpt/how-to-use-chatgpt-dots/)
- [Dots: Always-on agents — Hacker News discussion](https://news.ycombinator.com/item?id=49896604)
- [Gemini Spark vs Claude vs ChatGPT Agent — Digital Strategy AI](https://digitalstrategy-ai.com/gemini-spark-vs-claude-vs-chatgpt)
- [Best Personal AI Agents in 2026 — Rework](https://resources.rework.com/tools/ai-agents/best-personal-ai-agents-2026)
- [Always-on agents — AIMultiple](https://aimultiple.com/always-on-agents)
