"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { WithMe } from "@/components/demo";
import * as demo from "@/lib/demo/store";
import { displayName, statsFor } from "@/lib/demo/store";
import type { DemoData } from "@/lib/demo/seed";
import { date, money, timeAgo, toPence } from "@/lib/format";
import { Avatar, BackLink, CustomerTrust, Notice, Stars, StatusPill, TraderRating } from "@/components/ui";
import type { Invoice, Job, PaymentMethod, Profile, Quote, Review } from "@/lib/types";

type Submit = React.FormEvent<HTMLFormElement>;
const fields = (e: Submit) => {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  return (k: string) => String(f.get(k) ?? "").trim();
};

export default function JobPage() {
  return (
    <Suspense>
      <WithMe>{(d, me) => <JobDetail d={d} me={me} />}</WithMe>
    </Suspense>
  );
}

function JobDetail({ d, me }: { d: DemoData; me: Profile }) {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const job = d.jobs.find((j) => j.id === id);
  const customer = job && d.profiles.find((p) => p.id === job.customer_id);
  const isCustomer = !!job && me.id === job.customer_id;
  const visible = job && (isCustomer || me.role === "trader");
  if (!job || !customer || !visible) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h1 className="h1">Job not found</h1>
        <Link href="/jobs" className="btn-primary">Back to jobs</Link>
      </div>
    );
  }

  const quotes = d.quotes.filter((q) => q.job_id === job.id);
  const invoice = d.invoices.find((i) => i.job_id === job.id) ?? null;
  const reviews = d.reviews.filter((r) => r.job_id === job.id);
  const accepted = quotes.find((q) => q.id === job.accepted_quote_id);
  const myQuote = quotes.find((q) => q.trader_id === me.id);
  const isAssignedTrader = !!accepted && accepted.trader_id === me.id;
  const acceptedTrader = accepted && d.profiles.find((p) => p.id === accepted.trader_id);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/jobs">{isCustomer ? "My jobs" : "Jobs"}</BackLink>
      <Notice
        message={
          sp.get("posted") && job.status === "open"
            ? "Your job is live! Local tradespeople have been notified. Quotes will appear below."
            : undefined
        }
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
              <Avatar name={customer.full_name} size={40} />
              <div className="flex-1">
                <Link href={`/profile/${customer.id}`} className="font-semibold hover:underline">{customer.full_name}</Link>
                <p className="text-xs text-muted">Customer · member since {date(customer.created_at)}</p>
              </div>
            </div>
            <CustomerTrust stats={statsFor(d, customer.id)} />
            <LatestComment d={d} about={customer.id} />
          </div>
        )}
      </section>

      {isCustomer ? (
        <CustomerView d={d} job={job} quotes={quotes} accepted={accepted} invoice={invoice} sort={sp.get("sort")} />
      ) : (
        <TraderView me={me} job={job} myQuote={myQuote} isAssigned={isAssignedTrader} invoice={invoice} />
      )}

      {invoice?.status === "paid" && (isCustomer || isAssignedTrader) && (
        <ReviewSection
          me={me}
          jobId={job.id}
          myReview={reviews.find((r) => r.reviewer_id === me.id)}
          theirReview={reviews.find((r) => r.reviewer_id !== me.id)}
          otherName={isCustomer ? (acceptedTrader ? displayName(acceptedTrader) : "your trader") : customer.full_name}
          isCustomer={isCustomer}
        />
      )}
    </div>
  );
}

function LatestComment({ d, about }: { d: DemoData; about: string }) {
  const r = [...d.reviews].filter((x) => x.reviewee_id === about && x.comment).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!r) return null;
  const by = d.profiles.find((p) => p.id === r.reviewer_id);
  return (
    <p className="rounded-lg bg-white/70 p-2 text-sm text-gray-700">
      <span className="block text-xs font-semibold text-muted">Latest comment from a tradesperson</span>“{r.comment}”
      {by ? ` (${by.full_name.split(" ")[0]}, ${by.trade ?? ""})` : ""}
    </p>
  );
}

// ------------------------------------------------------------------ customer

function CustomerView({
  d,
  job,
  quotes,
  accepted,
  invoice,
  sort,
}: {
  d: DemoData;
  job: Job;
  quotes: Quote[];
  accepted?: Quote;
  invoice: Invoice | null;
  sort: string | null;
}) {
  const trader = (id: string) => d.profiles.find((p) => p.id === id)!;

  if (job.status === "open") {
    const pending = quotes.filter((q) => q.status === "pending");
    const byRating = sort === "rating";
    const sorted = [...pending].sort((a, b) =>
      byRating ? (statsFor(d, b.trader_id).avg_rating ?? 0) - (statsFor(d, a.trader_id).avg_rating ?? 0) : a.amount_pence - b.amount_pence,
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
            <Link href={`/jobs/${job.id}`} className={chip(!byRating)} replace>Cheapest first</Link>
            <Link href={`/jobs/${job.id}?sort=rating`} className={chip(byRating)} replace>Best rated</Link>
          </div>
        </div>
        {sorted.length === 0 && (
          <p className="card flex items-center gap-3 text-sm text-muted">
            <span className="h-3 w-3 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            Waiting for quotes. Tradespeople in your area have been notified.
          </p>
        )}
        {sorted.map((q) => {
          const t = trader(q.trader_id);
          return (
            <article key={q.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={displayName(t)} />
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${t.id}`} className="font-semibold hover:underline">{displayName(t)}</Link>
                  <div><TraderRating stats={statsFor(d, t.id)} /></div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-bold">{money(q.amount_pence)}</div>
                  <div className="text-xs text-muted">quoted price</div>
                </div>
              </div>
              {q.message && <p className="text-sm text-gray-700">“{q.message}”</p>}
              {q.earliest_start && <p className="text-sm text-muted">Can start {date(q.earliest_start)}</p>}
              <div className="flex gap-2">
                <Link href={`/profile/${t.id}`} className="btn-secondary flex-1">View profile</Link>
                <button type="button" onClick={() => demo.acceptQuote(q.id)} className="btn-primary flex-1">
                  Accept quote
                </button>
              </div>
            </article>
          );
        })}
        <div>
          <button type="button" onClick={() => demo.cancelJob(job.id)} className="btn-danger">Cancel this job</button>
        </div>
      </section>
    );
  }

  if (job.status === "cancelled") return <p className="card text-sm text-muted">You cancelled this job.</p>;

  const t = accepted ? trader(accepted.trader_id) : undefined;
  const traderName = t ? displayName(t) : "Your trader";
  return (
    <section className="flex flex-col gap-3">
      {accepted && t && (
        <div className="card flex items-center gap-3">
          <Avatar name={traderName} />
          <div className="flex-1">
            <Link href={`/profile/${t.id}`} className="font-semibold hover:underline">{traderName}</Link>
            <div><TraderRating stats={statsFor(d, t.id)} /></div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">{money(accepted.amount_pence)}</div>
            <div className="text-xs text-muted">accepted quote</div>
          </div>
        </div>
      )}
      {job.status === "assigned" && (
        <p className="card flex items-center gap-3 text-sm text-muted">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
          {traderName} is on the job. The invoice will appear here when the work is finished.
        </p>
      )}
      {invoice && <InvoiceCard invoice={invoice} />}
      {invoice?.status === "unpaid" && (
        <form
          className="card flex flex-col gap-3"
          onSubmit={(e) => {
            const get = fields(e);
            demo.payInvoice(invoice.id, get("method") as PaymentMethod);
          }}
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 font-semibold">How would you like to pay?</legend>
            {[
              ["card", "Debit or credit card", "Visa ending 4821 (simulated)"],
              ["bank_transfer", "Bank transfer", "Open Banking (simulated)"],
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
        <p className="card flex items-center gap-3 text-sm text-muted">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
          You marked this as paid in cash. Waiting for {traderName} to confirm they received it.
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ trader

function TraderView({
  me,
  job,
  myQuote,
  isAssigned,
  invoice,
}: {
  me: Profile;
  job: Job;
  myQuote?: Quote;
  isAssigned: boolean;
  invoice: Invoice | null;
}) {
  if (job.status === "open") {
    return (
      <section className="flex flex-col gap-3">
        {myQuote?.status === "pending" && (
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <p className="flex-1">
              You quoted <b>{money(myQuote.amount_pence)}</b>. Waiting for the customer to choose. You can update your quote below.
            </p>
            <button type="button" onClick={() => demo.withdrawQuote(myQuote.id)} className="btn-danger">Withdraw</button>
          </div>
        )}
        <form
          key={myQuote?.created_at ?? "new"}
          className="card flex flex-col gap-4"
          onSubmit={(e) => {
            const get = fields(e);
            const pence = toPence(get("amount"));
            if (!pence) return alert("Please enter a valid price in pounds.");
            demo.submitQuote(me.id, job.id, pence, get("message") || null, get("earliest_start") || null);
          }}
        >
          <h2 className="h2">{myQuote ? "Update your quote" : "Send a quote"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="amount" className="label">Total price (£)</label>
              <input id="amount" name="amount" required inputMode="decimal" defaultValue={myQuote ? (myQuote.amount_pence / 100).toFixed(2) : ""} className="input" placeholder="95.00" />
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
        <form
          className="card flex flex-col gap-4"
          onSubmit={(e) => {
            const f = new FormData(e.currentTarget);
            const get = fields(e);
            const pence = toPence(get("net_amount"));
            if (!pence) return alert("Please enter a valid amount in pounds.");
            demo.createInvoice(me.id, job.id, get("description") || "Work completed", pence, f.get("add_vat") === "on", Number(get("due_days")));
          }}
        >
          <h2 className="h2">Job complete: raise invoice</h2>
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

  if (!invoice) return null;
  const overdue = invoice.status === "unpaid" && invoice.due_date < new Date().toISOString().slice(0, 10);
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
          <div>
            <button type="button" onClick={() => demo.sendReminder(invoice.id)} className="btn-secondary">Send a reminder now</button>
          </div>
        </div>
      )}
      {invoice.status === "cash_pending" && (
        <div className="card flex flex-col gap-3">
          <p>
            The customer says they paid <b>{money(invoice.total_pence)} in cash</b>. Did you receive it?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => demo.confirmCash(invoice.id, true)} className="btn-primary flex-1">Yes, received</button>
            <button type="button" onClick={() => demo.confirmCash(invoice.id, false)} className="btn-danger flex-1">Not received</button>
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
  me,
  jobId,
  myReview,
  theirReview,
  otherName,
  isCustomer,
}: {
  me: Profile;
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
        <form
          className="card flex flex-col gap-4"
          onSubmit={(e) => {
            const get = fields(e);
            const rating = Number(get("rating"));
            if (!rating) return alert("Please choose a star rating.");
            demo.leaveReview(me.id, jobId, rating, get("comment"));
          }}
        >
          <h2 className="h2">Rate {otherName}</h2>
          <fieldset>
            <legend className="label">
              {isCustomer ? "How was the work?" : "How was it working for this customer? (communication, access, payment)"}
            </legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
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
            <label htmlFor="comment" className="label">{isCustomer ? "Your review" : "Comment for other tradespeople"}</label>
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
