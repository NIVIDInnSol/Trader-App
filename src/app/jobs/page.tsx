"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WithMe } from "@/components/demo";
import { statsFor } from "@/lib/demo/store";
import type { DemoData } from "@/lib/demo/seed";
import { money, timeAgo } from "@/lib/format";
import { TRADES } from "@/lib/config";
import { CustomerTrust, Empty, Notice, StatusPill } from "@/components/ui";
import type { Profile } from "@/lib/types";

export default function JobsPage() {
  return (
    <Suspense>
      <WithMe>{(d, me) => (me.role === "customer" ? <CustomerJobs d={d} me={me} /> : <TraderJobs d={d} me={me} />)}</WithMe>
    </Suspense>
  );
}

function CustomerJobs({ d, me }: { d: DemoData; me: Profile }) {
  const jobs = d.jobs.filter((j) => j.customer_id === me.id);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Hi {me.full_name.split(" ")[0]}</p>
          <h1 className="h1">My jobs</h1>
        </div>
        <Link href="/jobs/new" className="btn-primary">+ Post a job</Link>
      </div>
      {jobs.length === 0 ? (
        <Empty>
          You haven&apos;t posted any jobs yet.{" "}
          <Link href="/jobs/new" className="font-semibold text-brand">Post your first job</Link> and local tradespeople will quote.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => {
            const count = d.quotes.filter((q) => q.job_id === job.id && q.status === "pending").length;
            return (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="card flex flex-col gap-2 hover:border-brand">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{job.title}</span>
                    <StatusPill status={job.status} />
                  </span>
                  <span className="text-sm text-muted">
                    {job.trade} · {job.postcode} · posted {timeAgo(job.created_at)}
                  </span>
                  {job.status === "open" && (
                    <span className="text-sm font-semibold text-brand">
                      {count} {count === 1 ? "quote" : "quotes"} received
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TraderJobs({ d, me }: { d: DemoData; me: Profile }) {
  const sp = useSearchParams();
  const router = useRouter();
  const mine = sp.get("tab") === "mine";
  const tradeParam = sp.get("trade");
  const tradeFilter = tradeParam === "all" ? undefined : (tradeParam ?? me.trade ?? undefined);
  const myQuotes = new Map(d.quotes.filter((q) => q.trader_id === me.id).map((q) => [q.job_id, q]));
  const jobs = mine
    ? d.jobs.filter((j) => myQuotes.has(j.id))
    : d.jobs.filter((j) => j.status === "open" && (!tradeFilter || j.trade === tradeFilter));
  const tabCls = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          Hi {me.full_name.split(" ")[0]} · {me.trade ?? "Tradesperson"}
          {me.postcode ? ` · ${me.postcode}` : ""}
        </p>
        <h1 className="h1">{mine ? "My quotes & work" : "Jobs to quote for"}</h1>
      </div>
      <Notice message={sp.get("welcome") ? "Welcome! Here are local jobs you can quote for. Customers see your rating next to your price." : undefined} />
      <div className="flex gap-1 rounded-xl bg-gray-200 p-1">
        <Link href="/jobs" className={tabCls(!mine)} aria-current={!mine ? "page" : undefined}>Open jobs</Link>
        <Link href="/jobs?tab=mine" className={tabCls(mine)} aria-current={mine ? "page" : undefined}>My quotes &amp; work</Link>
      </div>
      {!mine && (
        <div>
          <label htmlFor="trade" className="label">Trade</label>
          <select
            id="trade"
            value={tradeFilter ?? "all"}
            onChange={(e) => router.push(`/jobs?trade=${encodeURIComponent(e.target.value)}`)}
            className="input"
          >
            <option value="all">All trades</option>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      )}
      {jobs.length === 0 ? (
        <Empty>
          {mine ? "You haven't quoted for any jobs yet." : "No open jobs for this trade right now. Try “All trades”."}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => {
            const q = myQuotes.get(job.id);
            const won = !!q && job.accepted_quote_id === q.id;
            const customer = d.profiles.find((p) => p.id === job.customer_id)!;
            return (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="card flex flex-col gap-2 hover:border-brand">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{job.title}</span>
                    {mine && q ? (
                      <StatusPill status={won ? job.status : q.status} />
                    ) : (
                      <span className="shrink-0 text-xs text-muted">{timeAgo(job.created_at)}</span>
                    )}
                  </span>
                  <span className="text-sm text-muted">
                    {job.trade} · {job.postcode} · {job.timing}
                  </span>
                  <span className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <span className="text-sm">Customer <b>{customer.full_name}</b></span>
                    <CustomerTrust stats={statsFor(d, customer.id)} compact />
                  </span>
                  {q && <span className="text-sm font-semibold text-brand">Your quote: {money(q.amount_pence)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
