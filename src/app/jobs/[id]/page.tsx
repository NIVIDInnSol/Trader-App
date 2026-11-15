import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe, getStats } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { date, money, timeAgo } from "@/lib/format";
import {
  acceptQuote,
  cancelJob,
  confirmCash,
  createInvoice,
  leaveReview,
  payInvoice,
  sendReminder,
  submitQuote,
  withdrawQuote,
} from "@/app/actions";
import { Avatar, BackLink, CustomerTrust, Notice, Stars, StatusPill, TraderRating, one } from "@/components/ui";
import type { Invoice, Job, Profile, Quote, Review, Stats } from "@/lib/types";

export const metadata: Metadata = { title: "Job" };

type QuoteRow = Quote & { trader: Pick<Profile, "id" | "full_name" | "business_name" | "trade"> };

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireMe();
  const supabase = await createClient();

  const { data: jobData } = await supabase
    .from("jobs")
    .select("*, customer:profiles!jobs_customer_id_fkey(id, full_name, postcode)")
    .eq("id", id)
    .maybeSingle();
  if (!jobData) notFound();
  const job = jobData as Job & { customer: Pick<Profile, "id" | "full_name" | "postcode"> };

  const [{ data: quoteData }, { data: invoiceData }, { data: reviewData }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, trader:profiles!quotes_trader_id_fkey(id, full_name, business_name, trade)")
      .eq("job_id", id)
      .order("amount_pence"),
    supabase.from("invoices").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("reviews").select("*").eq("job_id", id),
  ]);
  const quotes = (quoteData ?? []) as QuoteRow[];
  const invoice = invoiceData as Invoice | null;
  const reviews = (reviewData ?? []) as Review[];
  const stats = await getStats([job.customer_id, ...quotes.map((q) => q.trader_id)]);

  const isCustomer = me.id === job.customer_id;
  const accepted = quotes.find((q) => q.id === job.accepted_quote_id);
  const myQuote = quotes.find((q) => q.trader_id === me.id);
  const isAssignedTrader = !!accepted && accepted.trader_id === me.id;
  const myReview = reviews.find((r) => r.reviewer_id === me.id);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/jobs">{isCustomer ? "My jobs" : "Jobs"}</BackLink>
      <Notice
        error={one(sp.error)}
        message={one(sp.posted) ? "Your job is live. We'll let you know as quotes come in." : undefined}
      />

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="h1">{job.title}</h1>
          <StatusPill status={job.status} />
        </div>
        <p className="text-sm text-muted">
          {job.trade} · {job.postcode} · {job.timing} · posted {timeAgo(job.created_at)}
        </p>
        <p className="whitespace-pre-line">{job.description}</p>
        {!isCustomer && (
          <div className="mt-1 flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand-soft/40 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={job.customer.full_name} size={40} />
              <div className="flex-1">
                <Link href={`/profile/${job.customer_id}`} className="font-semibold hover:underline">{job.customer.full_name}</Link>
                <p className="text-xs text-muted">Customer</p>
              </div>
            </div>
            <CustomerTrust stats={stats.get(job.customer_id)} />
          </div>
        )}
      </section>

      {isCustomer ? (
        <CustomerView job={job} quotes={quotes} accepted={accepted} invoice={invoice} stats={stats} sort={one(sp.sort)} />
      ) : (
        <TraderView job={job} myQuote={myQuote} isAssigned={isAssignedTrader} invoice={invoice} />
      )}

      {invoice?.status === "paid" && (isCustomer || isAssignedTrader) && (
        <ReviewSection
          jobId={job.id}
          myReview={myReview}
          theirReview={reviews.find((r) => r.reviewer_id !== me.id)}
          otherName={isCustomer ? (accepted?.trader.business_name || accepted?.trader.full_name || "your trader") : job.customer.full_name}
          isCustomer={isCustomer}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ customer

function CustomerView({
  job,
  quotes,
  accepted,
  invoice,
  stats,
  sort,
}: {
  job: Job;
  quotes: QuoteRow[];
  accepted?: QuoteRow;
  invoice: Invoice | null;
  stats: Map<string, Stats>;
  sort?: string;
}) {
  if (job.status === "open") {
    const pending = quotes.filter((q) => q.status === "pending");
    const byRating = sort === "rating";
    const sorted = [...pending].sort((a, b) =>
      byRating
        ? (stats.get(b.trader_id)?.avg_rating ?? 0) - (stats.get(a.trader_id)?.avg_rating ?? 0)
        : a.amount_pence - b.amount_pence,
    );
    const chip = (active: boolean) =>
      `inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${active ? "border-2 border-brand bg-brand-soft text-brand" : "border border-gray-300 bg-white"}`;
    return (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">
            {pending.length} {pending.length === 1 ? "quote" : "quotes"} received
          </h2>
          <div className="flex gap-2">
            <Link href={`/jobs/${job.id}`} className={chip(!byRating)}>Cheapest first</Link>
            <Link href={`/jobs/${job.id}?sort=rating`} className={chip(byRating)}>Best rated</Link>
          </div>
        </div>
        {sorted.length === 0 && (
          <p className="card text-sm text-muted">No quotes yet. Tradespeople in your area have been notified.</p>
        )}
        {sorted.map((q) => (
          <article key={q.id} className="card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={q.trader.business_name || q.trader.full_name} />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${q.trader_id}`} className="font-semibold hover:underline">
                  {q.trader.business_name || q.trader.full_name}
                </Link>
                <div><TraderRating stats={stats.get(q.trader_id)} /></div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold">{money(q.amount_pence)}</div>
                <div className="text-xs text-muted">quoted price</div>
              </div>
            </div>
            {q.message && <p className="text-sm text-gray-700">“{q.message}”</p>}
            {q.earliest_start && <p className="text-sm text-muted">Can start {date(q.earliest_start)}</p>}
            <div className="flex gap-2">
              <Link href={`/profile/${q.trader_id}`} className="btn-secondary flex-1">View profile</Link>
              <form action={acceptQuote} className="flex-1">
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="quote_id" value={q.id} />
                <button className="btn-primary w-full">Accept quote</button>
              </form>
            </div>
          </article>
        ))}
        <form action={cancelJob}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="btn-danger">Cancel this job</button>
        </form>
      </section>
    );
  }

  if (job.status === "cancelled") return <p className="card text-sm text-muted">You cancelled this job.</p>;

  const traderName = accepted ? accepted.trader.business_name || accepted.trader.full_name : "Your trader";
  return (
    <section className="flex flex-col gap-3">
      {accepted && (
        <div className="card flex items-center gap-3">
          <Avatar name={traderName} />
          <div className="flex-1">
            <Link href={`/profile/${accepted.trader_id}`} className="font-semibold hover:underline">{traderName}</Link>
            <div><TraderRating stats={stats.get(accepted.trader_id)} /></div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">{money(accepted.amount_pence)}</div>
            <div className="text-xs text-muted">accepted quote</div>
          </div>
        </div>
      )}
      {job.status === "assigned" && (
        <p className="card text-sm text-muted">
          {traderName} will do the job and send the invoice here when it&apos;s finished. You&apos;ll get an alert.
        </p>
      )}
      {invoice && <InvoiceCard invoice={invoice} />}
      {invoice?.status === "unpaid" && (
        <form action={payInvoice} className="card flex flex-col gap-3">
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 font-semibold">How would you like to pay?</legend>
            {[
              ["card", "Debit or credit card", "Simulated in this prototype"],
              ["bank_transfer", "Bank transfer", "Simulated in this prototype"],
              ["cash", "Cash", "Pay the trader in person; they confirm they received it"],
            ].map(([value, label, hint], i) => (
              <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-gray-50">
                <input type="radio" name="method" value={value} defaultChecked={i === 0} className="h-5 w-5 accent-brand" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted">Paying by the due date keeps your Customer Trust rating high.</p>
          <button className="btn-primary w-full">Pay {money(invoice.total_pence)}</button>
        </form>
      )}
      {invoice?.status === "cash_pending" && (
        <p className="card text-sm text-muted">
          You marked this as paid in cash. Waiting for {traderName} to confirm they received it.
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ trader

function TraderView({
  job,
  myQuote,
  isAssigned,
  invoice,
}: {
  job: Job;
  myQuote?: QuoteRow;
  isAssigned: boolean;
  invoice: Invoice | null;
}) {
  if (job.status === "open") {
    return (
      <section className="flex flex-col gap-3">
        {myQuote?.status === "pending" && (
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <p>
              You quoted <b>{money(myQuote.amount_pence)}</b>. The customer hasn&apos;t decided yet. You can update your quote below.
            </p>
            <form action={withdrawQuote}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="quote_id" value={myQuote.id} />
              <button className="btn-danger">Withdraw</button>
            </form>
          </div>
        )}
        <form action={submitQuote} className="card flex flex-col gap-4">
          <h2 className="h2">{myQuote ? "Update your quote" : "Send a quote"}</h2>
          <input type="hidden" name="job_id" value={job.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="amount" className="label">Total price (£)</label>
              <input
                id="amount"
                name="amount"
                required
                inputMode="decimal"
                defaultValue={myQuote ? (myQuote.amount_pence / 100).toFixed(2) : ""}
                className="input"
                placeholder="95.00"
              />
              <p className="mt-1 text-xs text-muted">Include VAT if you charge it.</p>
            </div>
            <div>
              <label htmlFor="earliest_start" className="label">Earliest start</label>
              <input id="earliest_start" name="earliest_start" type="date" defaultValue={myQuote?.earliest_start ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="message" className="label">Message to the customer</label>
            <textarea id="message" name="message" rows={3} maxLength={2000} defaultValue={myQuote?.message ?? ""} className="textarea" placeholder="What's included, how long it will take…" />
          </div>
          <button className="btn-primary w-full">{myQuote ? "Update quote" : "Send quote"}</button>
        </form>
      </section>
    );
  }

  if (!isAssigned) {
    return (
      <p className="card text-sm text-muted">
        {myQuote?.status === "withdrawn"
          ? "You withdrew your quote."
          : job.status === "cancelled"
            ? "The customer cancelled this job."
            : "The customer chose another quote for this job."}
      </p>
    );
  }

  if (job.status === "assigned") {
    return (
      <section className="flex flex-col gap-3">
        <p className="card text-sm">
          <b>You won this job</b> at {money(myQuote!.amount_pence)}. When the work is done, raise the invoice here.
        </p>
        <form action={createInvoice} className="card flex flex-col gap-4">
          <h2 className="h2">Job complete: raise invoice</h2>
          <input type="hidden" name="job_id" value={job.id} />
          <div>
            <label htmlFor="description" className="label">Work done</label>
            <textarea id="description" name="description" rows={3} maxLength={2000} className="textarea" defaultValue={job.title} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="net_amount" className="label">Amount before VAT (£)</label>
              <input id="net_amount" name="net_amount" required inputMode="decimal" className="input" defaultValue={(myQuote!.amount_pence / 100).toFixed(2)} />
            </div>
            <div>
              <label htmlFor="due_days" className="label">Payment due</label>
              <select id="due_days" name="due_days" defaultValue="7" className="input">
                <option value="0">On completion (today)</option>
                <option value="3">In 3 days</option>
                <option value="7">In 7 days</option>
                <option value="14">In 14 days</option>
                <option value="30">In 30 days</option>
              </select>
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="add_vat" className="h-5 w-5 accent-brand" />
            <span>Add VAT at 20% (only if you are VAT registered)</span>
          </label>
          <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
            The customer can pay by card, bank transfer or cash. We send automatic reminders before and after the due date.
          </p>
          <button className="btn-primary w-full">Send invoice</button>
        </form>
      </section>
    );
  }

  // invoiced or paid
  if (!invoice) return null;
  const overdue = invoice.status === "unpaid" && new Date(invoice.due_date) < new Date(new Date().toDateString());
  return (
    <section className="flex flex-col gap-3">
      <InvoiceCard invoice={invoice} />
      {invoice.status === "unpaid" && (
        <div className="card flex flex-col gap-3">
          <p className="text-sm">
            {overdue ? <b className="text-warn">This invoice is overdue. </b> : null}
            Automatic reminders go out 2 days before the due date, on the day, and every 3 days after.
            {invoice.last_reminder_at && ` Last reminder: ${timeAgo(invoice.last_reminder_at)}.`}
          </p>
          <form action={sendReminder}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="btn-secondary">Send a reminder now</button>
          </form>
        </div>
      )}
      {invoice.status === "cash_pending" && (
        <div className="card flex flex-col gap-3">
          <p>
            The customer says they paid <b>{money(invoice.total_pence)} in cash</b>. Did you receive it?
          </p>
          <div className="flex gap-2">
            {[
              ["yes", "Yes, received", "btn-primary"],
              ["no", "Not received", "btn-danger"],
            ].map(([value, label, cls]) => (
              <form key={value} action={confirmCash} className="flex-1">
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <input type="hidden" name="received" value={value} />
                <button className={`${cls} w-full`}>{label}</button>
              </form>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ shared

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const methods = { card: "card", bank_transfer: "bank transfer", cash: "cash" };
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Invoice</h2>
        <StatusPill status={invoice.status} />
      </div>
      <p className="whitespace-pre-line text-sm">{invoice.description}</p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd>{money(invoice.net_pence)}</dd></div>
        {invoice.vat_pence > 0 && (
          <div className="flex justify-between"><dt className="text-muted">VAT 20%</dt><dd>{money(invoice.vat_pence)}</dd></div>
        )}
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-2xl font-bold">{money(invoice.total_pence)}</dd>
        </div>
        <div className="flex justify-between"><dt className="text-muted">Due</dt><dd>{date(invoice.due_date)}</dd></div>
        {invoice.paid_at && invoice.payment_method && (
          <div className="flex justify-between">
            <dt className="text-muted">Paid</dt>
            <dd>{date(invoice.paid_at)} by {methods[invoice.payment_method]}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function ReviewSection({
  jobId,
  myReview,
  theirReview,
  otherName,
  isCustomer,
}: {
  jobId: string;
  myReview?: Review;
  theirReview?: Review;
  otherName: string;
  isCustomer: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      {myReview ? (
        <div className="card">
          <p className="eyebrow mb-1">Your review of {otherName}</p>
          <Stars value={myReview.rating} />
          {myReview.comment && <p className="mt-1 text-sm">{myReview.comment}</p>}
        </div>
      ) : (
        <form action={leaveReview} className="card flex flex-col gap-4">
          <h2 className="h2">Rate {otherName}</h2>
          <input type="hidden" name="job_id" value={jobId} />
          <fieldset>
            <legend className="label">
              {isCustomer ? "How was the work?" : "How was it working for this customer? (communication, access, payment)"}
            </legend>
            <div className="flex flex-row-reverse justify-end gap-1">
              {[5, 4, 3, 2, 1].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} required className="peer sr-only" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold peer-checked:border-star peer-checked:bg-amber-50 peer-checked:text-star peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                    {n}★
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="comment" className="label">
              {isCustomer ? "Your review" : "Comment for other tradespeople"}
            </label>
            <textarea id="comment" name="comment" rows={3} maxLength={2000} className="textarea" />
            <p className="mt-1 text-xs text-muted">Shown on their public profile. Keep it factual.</p>
          </div>
          <button className="btn-primary w-full">Submit review</button>
        </form>
      )}
      {theirReview && (
        <div className="card">
          <p className="eyebrow mb-1">{otherName}&apos;s review of you</p>
          <Stars value={theirReview.rating} />
          {theirReview.comment && <p className="mt-1 text-sm">{theirReview.comment}</p>}
        </div>
      )}
    </section>
  );
}
