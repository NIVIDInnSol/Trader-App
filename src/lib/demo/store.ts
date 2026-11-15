"use client";

// Demo data store. Everything lives in the visitor's browser (localStorage), so the
// demo needs no database. Sample accounts ("bots") reply automatically so one person
// can walk through the whole flow. When Supabase is added, these actions map 1:1 onto
// the database functions on the `supabase-version` branch.

import { useSyncExternalStore } from "react";
import { DEMO_VERSION, seed, type DemoData } from "./seed";
import type { Invoice, Job, PaymentMethod, Profile, Quote, Role, Stats } from "@/lib/types";
import { money } from "@/lib/format";

const KEY = "fixfare-demo";
let state: DemoData | null = null;
const listeners = new Set<() => void>();

function load(): DemoData {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DemoData) : null;
    state = parsed && parsed.version === DEMO_VERSION ? parsed : seed();
  } catch {
    state = seed();
  }
  return state;
}

function update(fn: (d: DemoData) => DemoData) {
  state = fn(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode): demo still works until the tab closes
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The demo data, or null during server rendering / before the browser loads it. */
export function useDemo(): DemoData | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const now = () => new Date().toISOString();
const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

function notify(d: DemoData, userId: string, message: string, link: string | null): DemoData {
  if (d.profiles.find((p) => p.id === userId)?.bot) return d; // nobody reads bots' alerts
  return {
    ...d,
    notifications: [{ id: uid(), user_id: userId, message, link, read: false, created_at: now() }, ...d.notifications],
  };
}

const profile = (d: DemoData, id: string) => d.profiles.find((p) => p.id === id)!;
export const displayName = (p: Pick<Profile, "full_name" | "business_name">) => p.business_name || p.full_name;

// ------------------------------------------------------------------ reputation

export function statsFor(d: DemoData, id: string): Stats {
  const p = profile(d, id);
  const h = p?.history ?? { rating: 0, reviews: 0, jobs: 0, onTime: 0, late: 0 };
  // sample reviews are already counted in the history numbers
  const fresh = d.reviews.filter((r) => r.reviewee_id === id && !r.job_id.startsWith("old-"));
  const count = h.reviews + fresh.length;
  const sum = h.rating * h.reviews + fresh.reduce((s, r) => s + r.rating, 0);
  const paid = d.invoices.filter((i) => (i.trader_id === id || i.customer_id === id) && i.status === "paid");
  const asCustomer = d.invoices.filter((i) => i.customer_id === id);
  const today = new Date().toISOString().slice(0, 10);
  const onTime = asCustomer.filter((i) => i.status === "paid" && i.paid_at!.slice(0, 10) <= i.due_date).length;
  const late = asCustomer.filter(
    (i) => (i.status === "paid" && i.paid_at!.slice(0, 10) > i.due_date) || (i.status === "unpaid" && i.due_date < today),
  ).length;
  return {
    profile_id: id,
    avg_rating: count ? Math.round((sum / count) * 10) / 10 : null,
    review_count: count,
    paid_jobs: h.jobs + paid.length,
    paid_on_time: h.onTime + onTime,
    paid_late_or_overdue: h.late + late,
  };
}

// ------------------------------------------------------------------ accounts

export function register(input: {
  role: Role;
  full_name: string;
  postcode: string;
  trade?: string;
  business_name?: string;
}) {
  const id = uid();
  update((d) => ({
    ...d,
    meId: id,
    profiles: [
      ...d.profiles,
      {
        id,
        role: input.role,
        full_name: input.full_name,
        postcode: input.postcode.toUpperCase() || null,
        trade: input.role === "trader" ? input.trade ?? null : null,
        business_name: input.role === "trader" ? input.business_name || null : null,
        bio: null,
        created_at: now(),
      },
    ],
  }));
  return id;
}

export function switchUser(id: string | null) {
  update((d) => ({ ...d, meId: id }));
}

export function resetDemo() {
  update(() => seed());
}

// ------------------------------------------------------------------ jobs and quotes

export function postJob(customerId: string, input: Pick<Job, "title" | "description" | "trade" | "postcode" | "timing">) {
  const id = uid();
  update((d) => ({
    ...d,
    jobs: [
      { id, customer_id: customerId, ...input, postcode: input.postcode.toUpperCase(), status: "open", accepted_quote_id: null, created_at: now() },
      ...d.jobs,
    ],
  }));

  // Sample traders quote within a few seconds.
  const d = load();
  const traders = d.profiles.filter((p) => p.bot && p.role === "trader");
  const matching = [
    ...traders.filter((t) => t.trade === input.trade),
    ...traders.filter((t) => t.trade === "Handyman" && t.trade !== input.trade),
    ...traders.filter((t) => t.trade !== input.trade && t.trade !== "Handyman"),
  ].slice(0, 3);
  const base = 6000 + Math.round(Math.random() * 8) * 1000;
  const lines = [
    "Happy to help. Price includes all labour; I can start this week.",
    "I've done plenty of these. Fixed price, no surprises.",
    "Can come and look first if you'd like. Price as quoted otherwise.",
  ];
  matching.forEach((t, i) =>
    later(2500 + i * 2500, () =>
      submitQuote(t.id, id, base + [1500, -1000, 3500][i]!, lines[i]!, new Date(Date.now() + (i + 1) * 86400_000).toISOString().slice(0, 10)),
    ),
  );
  return id;
}

export function cancelJob(jobId: string) {
  update((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === jobId && j.status === "open" ? { ...j, status: "cancelled" } : j)) }));
}

export function submitQuote(traderId: string, jobId: string, amountPence: number, message: string | null, earliestStart: string | null) {
  const job = load().jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "open") return;
  update((d) => {
    const existing = d.quotes.find((q) => q.job_id === jobId && q.trader_id === traderId);
    const quote: Quote = {
      id: existing?.id ?? uid(),
      job_id: jobId,
      trader_id: traderId,
      amount_pence: amountPence,
      message,
      earliest_start: earliestStart,
      status: "pending",
      created_at: now(),
    };
    const next = { ...d, quotes: existing ? d.quotes.map((q) => (q.id === existing.id ? quote : q)) : [...d.quotes, quote] };
    return notify(next, job.customer_id, `New quote of ${money(amountPence)} from ${displayName(profile(d, traderId))} for "${job.title}"`, `/jobs/${jobId}`);
  });

  // A sample customer accepts a real trader's quote after a moment.
  const d = load();
  if (profile(d, job.customer_id).bot && !profile(d, traderId).bot) {
    const q = d.quotes.find((x) => x.job_id === jobId && x.trader_id === traderId)!;
    later(4000, () => acceptQuote(q.id));
  }
}

export function withdrawQuote(quoteId: string) {
  update((d) => ({ ...d, quotes: d.quotes.map((q) => (q.id === quoteId && q.status === "pending" ? { ...q, status: "withdrawn" } : q)) }));
}

export function acceptQuote(quoteId: string) {
  const d0 = load();
  const quote = d0.quotes.find((q) => q.id === quoteId);
  const job = quote && d0.jobs.find((j) => j.id === quote.job_id);
  if (!quote || !job || job.status !== "open" || quote.status !== "pending") return;
  update((d) => {
    let next: DemoData = {
      ...d,
      jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, status: "assigned", accepted_quote_id: quoteId } : j)),
      quotes: d.quotes.map((q) =>
        q.job_id !== job.id ? q : q.id === quoteId ? { ...q, status: "accepted" } : q.status === "pending" ? { ...q, status: "declined" } : q,
      ),
    };
    next = notify(next, quote.trader_id, `${profile(d, job.customer_id).full_name} accepted your quote for "${job.title}"`, `/jobs/${job.id}`);
    for (const q of d.quotes.filter((x) => x.job_id === job.id && x.id !== quoteId && x.status === "pending")) {
      next = notify(next, q.trader_id, `The customer chose another quote for "${job.title}"`, `/jobs/${job.id}`);
    }
    return next;
  });

  // A sample trader "does the job" and sends the invoice.
  if (profile(load(), quote.trader_id).bot) {
    later(4000, () => createInvoice(quote.trader_id, job.id, `${job.title}: labour and materials`, quote.amount_pence, false, 7));
  }
}

// ------------------------------------------------------------------ invoices and payment

export function createInvoice(traderId: string, jobId: string, description: string, netPence: number, addVat: boolean, dueDays: number) {
  const d0 = load();
  const job = d0.jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "assigned") return;
  const due = new Date(Date.now() + dueDays * 86400_000).toISOString().slice(0, 10);
  const vat = addVat ? Math.round(netPence * 0.2) : 0;
  const invoice: Invoice = {
    id: uid(),
    job_id: jobId,
    trader_id: traderId,
    customer_id: job.customer_id,
    description,
    net_pence: netPence,
    vat_pence: vat,
    total_pence: netPence + vat,
    due_date: due,
    status: "unpaid",
    payment_method: null,
    paid_at: null,
    last_reminder_at: null,
    created_at: now(),
  };
  update((d) =>
    notify(
      { ...d, invoices: [...d.invoices, invoice], jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, status: "invoiced" } : j)) },
      job.customer_id,
      `Job done! ${displayName(profile(d, traderId))} sent an invoice for ${money(invoice.total_pence)}, due ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. We'll remind you 2 days before.`,
      `/jobs/${jobId}`,
    ),
  );

  // A sample customer pays (Alex pays cash, others by card).
  const customer = profile(load(), job.customer_id);
  if (customer.bot) later(4000, () => payInvoice(invoice.id, customer.id === "c-alex" ? "cash" : "card"));
}

export function payInvoice(invoiceId: string, method: PaymentMethod) {
  const inv = load().invoices.find((i) => i.id === invoiceId);
  if (!inv || inv.status === "paid") return;
  const cash = method === "cash";
  update((d) => {
    const next: DemoData = {
      ...d,
      invoices: d.invoices.map((i) =>
        i.id === invoiceId ? { ...i, status: cash ? "cash_pending" : "paid", payment_method: method, paid_at: now() } : i,
      ),
      jobs: cash ? d.jobs : d.jobs.map((j) => (j.id === inv.job_id ? { ...j, status: "paid" } : j)),
    };
    return notify(
      next,
      inv.trader_id,
      cash
        ? `${profile(d, inv.customer_id).full_name} says they paid ${money(inv.total_pence)} in cash. Please confirm you received it.`
        : `${profile(d, inv.customer_id).full_name} paid ${money(inv.total_pence)} by ${method === "card" ? "card" : "bank transfer"}. Please rate your customer.`,
      `/jobs/${inv.job_id}`,
    );
  });

  const d = load();
  const trader = profile(d, inv.trader_id);
  const customer = profile(d, inv.customer_id);
  if (trader.bot) {
    if (cash) later(3000, () => confirmCash(invoiceId, true));
    else later(3000, () => leaveReview(trader.id, inv.job_id, 5, "Great customer: clear about the job and paid straight away."));
  } else if (customer.bot && !cash) {
    later(3000, () => leaveReview(customer.id, inv.job_id, 5, "Excellent work, tidy and on time. Would book again."));
  }
}

export function confirmCash(invoiceId: string, received: boolean) {
  const inv = load().invoices.find((i) => i.id === invoiceId);
  if (!inv || inv.status !== "cash_pending") return;
  update((d) => {
    const next: DemoData = {
      ...d,
      invoices: d.invoices.map((i) =>
        i.id !== invoiceId ? i : received ? { ...i, status: "paid" } : { ...i, status: "unpaid", payment_method: null, paid_at: null },
      ),
      jobs: received ? d.jobs.map((j) => (j.id === inv.job_id ? { ...j, status: "paid" } : j)) : d.jobs,
    };
    return notify(
      next,
      inv.customer_id,
      received ? "Cash payment confirmed. Please rate your trader." : "Your trader hasn't received the cash payment. Please check.",
      `/jobs/${inv.job_id}`,
    );
  });

  const d = load();
  if (received && profile(d, inv.trader_id).bot) {
    later(2000, () => leaveReview(inv.trader_id, inv.job_id, 5, "Paid in cash on the day. Easy to work with."));
  }
  if (received && profile(d, inv.customer_id).bot) {
    later(2500, () => leaveReview(inv.customer_id, inv.job_id, 5, "Excellent work, tidy and on time. Would book again."));
  }
}

export function sendReminder(invoiceId: string) {
  const inv = load().invoices.find((i) => i.id === invoiceId);
  if (!inv || inv.status !== "unpaid") return;
  update((d) =>
    notify(
      { ...d, invoices: d.invoices.map((i) => (i.id === invoiceId ? { ...i, last_reminder_at: now() } : i)) },
      inv.customer_id,
      `Payment reminder from ${displayName(profile(d, inv.trader_id))}: ${money(inv.total_pence)} due ${new Date(inv.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
      `/jobs/${inv.job_id}`,
    ),
  );
}

// ------------------------------------------------------------------ reviews and alerts

export function leaveReview(reviewerId: string, jobId: string, rating: number, comment: string) {
  const d0 = load();
  const inv = d0.invoices.find((i) => i.job_id === jobId);
  if (!inv || inv.status !== "paid") return;
  if (d0.reviews.some((r) => r.job_id === jobId && r.reviewer_id === reviewerId)) return;
  const revieweeId = reviewerId === inv.customer_id ? inv.trader_id : inv.customer_id;
  update((d) =>
    notify(
      {
        ...d,
        reviews: [
          ...d.reviews,
          { id: uid(), job_id: jobId, reviewer_id: reviewerId, reviewee_id: revieweeId, rating, comment: comment.trim() || null, created_at: now() },
        ],
      },
      revieweeId,
      `${displayName(profile(d, reviewerId))} gave you ${rating} ${rating === 1 ? "star" : "stars"}`,
      `/profile/${revieweeId}`,
    ),
  );
}

export function markAllRead(userId: string) {
  update((d) => ({ ...d, notifications: d.notifications.map((n) => (n.user_id === userId ? { ...n, read: true } : n)) }));
}
