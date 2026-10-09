import { chargeback, invoicing, ticketSummary } from "@/lib/mockData";
import { CardActions, CardFooter, CardTitle, CompoundValue, DashCard, Divider, Stat, ViewLink } from "./parts";

// Chargeback (Figma 337:23506): two stats + disputes footer.
export function ChargebackCard() {
  return (
    <DashCard>
      <div className="flex items-center justify-between">
        <CardTitle title="Chargeback" />
        <CardActions add />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 pb-4">
        {chargeback.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
      <Divider />
      <CardFooter>
        <span className="truncate text-body-lg">{chargeback.footer}</span>
        <ViewLink />
      </CardFooter>
    </DashCard>
  );
}

// Ticket summary (Figma 339:23692): three counters + inbox footer.
export function TicketSummaryCard() {
  return (
    <DashCard>
      <div className="flex items-start justify-between">
        <CardTitle title={ticketSummary.title} value={ticketSummary.value} />
        <CardActions />
      </div>
      <div className="grid grid-cols-3 gap-4 pt-6 pb-4">
        {ticketSummary.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
      <Divider />
      <CardFooter>
        <div className="space-y-0.5 pt-3">
          <p className="text-menu-sm text-(--color-text-primary)">{ticketSummary.footer.label}</p>
          <CompoundValue value={ticketSummary.footer.value} extra={ticketSummary.footer.extra} />
        </div>
        <ViewLink />
      </CardFooter>
    </DashCard>
  );
}

// Invoicing (Figma 339:23735): overdue / paid + open footer.
export function InvoicingCard() {
  return (
    <DashCard>
      <div className="flex items-center justify-between">
        <CardTitle title="Invoicing" />
        <CardActions add />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-6 pb-4">
        {invoicing.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
      <Divider />
      <CardFooter>
        <div className="space-y-0.5 pt-3">
          <p className="text-menu-sm text-(--color-text-primary)">{invoicing.footer.label}</p>
          <CompoundValue value={invoicing.footer.value} extra={invoicing.footer.extra} />
        </div>
        <ViewLink />
      </CardFooter>
    </DashCard>
  );
}
