import Link from "next/link";
import { initials } from "@/lib/format";
import type { Stats, JobStatus, QuoteStatus, InvoiceStatus } from "@/lib/types";

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value, label }: { value: number; label?: string }) {
  const full = Math.round(value);
  return (
    <span role="img" aria-label={label ?? `${value} out of 5 stars`} className="tracking-tight">
      <span className="text-star">{"★".repeat(full)}</span>
      <span className="text-gray-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/** How customers see a trader. */
export function TraderRating({ stats }: { stats?: Stats }) {
  if (!stats || stats.review_count === 0) {
    return <span className="text-sm text-muted">New on the app · no reviews yet</span>;
  }
  return (
    <span className="text-sm text-muted">
      <span className="text-star">★</span> <b className="text-ink">{stats.avg_rating?.toFixed(1)}</b> · {stats.review_count}{" "}
      {stats.review_count === 1 ? "review" : "reviews"} · {stats.paid_jobs} {stats.paid_jobs === 1 ? "job" : "jobs"} done
    </span>
  );
}

/** How traders see a customer: rating from traders plus payment record. */
export function CustomerTrust({ stats, compact = false }: { stats?: Stats; compact?: boolean }) {
  const paidCount = (stats?.paid_on_time ?? 0) + (stats?.paid_late_or_overdue ?? 0);
  const late = stats?.paid_late_or_overdue ?? 0;
  const hasHistory = !!stats && (stats.review_count > 0 || paidCount > 0);
  const tone = !hasHistory
    ? "bg-gray-100 text-gray-700"
    : late > 0
      ? "bg-warn-soft text-warn"
      : "bg-brand-soft text-brand-dark";
  const rating = stats?.avg_rating != null ? `★ ${stats.avg_rating.toFixed(1)}` : "No ratings";
  const payment = !hasHistory
    ? "new customer"
    : late > 0
      ? `${late} late ${late === 1 ? "payment" : "payments"}`
      : paidCount > 0
        ? `${stats!.paid_on_time}/${paidCount} paid on time`
        : "no invoices yet";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {compact ? "Trust" : "Customer trust"}: {hasHistory ? rating : "–"} · {payment}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-brand-soft text-brand-dark",
  pending: "bg-brand-soft text-brand-dark",
  assigned: "bg-amber-100 text-amber-900",
  accepted: "bg-amber-100 text-amber-900",
  invoiced: "bg-orange-100 text-orange-900",
  unpaid: "bg-orange-100 text-orange-900",
  cash_pending: "bg-orange-100 text-orange-900",
  paid: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-gray-100 text-gray-700",
  declined: "bg-gray-100 text-gray-700",
  withdrawn: "bg-gray-100 text-gray-700",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Taking quotes",
  assigned: "In progress",
  invoiced: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  pending: "Pending",
  accepted: "Accepted",
  declined: "Not chosen",
  withdrawn: "Withdrawn",
  unpaid: "Unpaid",
  cash_pending: "Cash: awaiting confirmation",
};

export function StatusPill({ status }: { status: JobStatus | QuoteStatus | InvoiceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Notice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
        {error}
      </p>
    );
  }
  if (message) {
    return <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-dark">{message}</p>;
  }
  return null;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand hover:underline">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-sm text-muted">{children}</div>;
}

export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
