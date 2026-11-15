import type { Metadata } from "next";
import Link from "next/link";
import { requireMe, getStats } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { money, timeAgo } from "@/lib/format";
import { TRADES } from "@/lib/config";
import { CustomerTrust, Empty, StatusPill, one } from "@/components/ui";
import type { Job, Profile, Quote } from "@/lib/types";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const me = await requireMe();
  const sp = await searchParams;
  return me.role === "customer" ? <CustomerJobs me={me} /> : <TraderJobs me={me} tab={one(sp.tab)} trade={one(sp.trade)} />;
}

async function CustomerJobs({ me }: { me: Profile }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("*, quotes!quotes_job_id_fkey(count)")
    .eq("customer_id", me.id)
    .order("created_at", { ascending: false });
  const jobs = (data ?? []) as (Job & { quotes: { count: number }[] })[];

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
          {jobs.map((job) => (
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
                    {job.quotes[0]?.count ?? 0} {job.quotes[0]?.count === 1 ? "quote" : "quotes"} received
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function TraderJobs({ me, tab, trade }: { me: Profile; tab?: string; trade?: string }) {
  const supabase = await createClient();
  const mine = tab === "mine";
  const tradeFilter = trade === "all" ? undefined : (trade ?? me.trade ?? undefined);

  const { data: myQuotesData } = await supabase.from("quotes").select("*").eq("trader_id", me.id);
  const myQuotes = new Map(((myQuotesData ?? []) as Quote[]).map((q) => [q.job_id, q]));

  let query = supabase
    .from("jobs")
    .select("*, customer:profiles!jobs_customer_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (mine) {
    query = query.in("id", [...myQuotes.keys()].length ? [...myQuotes.keys()] : ["00000000-0000-0000-0000-000000000000"]);
  } else {
    query = query.eq("status", "open");
    if (tradeFilter) query = query.eq("trade", tradeFilter);
  }
  const { data } = await query;
  const jobs = (data ?? []) as (Job & { customer: { id: string; full_name: string } })[];
  const stats = await getStats(jobs.map((j) => j.customer_id));

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
      <div className="flex gap-1 rounded-xl bg-gray-200 p-1">
        <Link href="/jobs" className={tabCls(!mine)} aria-current={!mine ? "page" : undefined}>Open jobs</Link>
        <Link href="/jobs?tab=mine" className={tabCls(mine)} aria-current={mine ? "page" : undefined}>My quotes &amp; work</Link>
      </div>
      {!mine && (
        <form className="flex items-end gap-2" action="/jobs">
          <div className="flex-1">
            <label htmlFor="trade" className="label">Trade</label>
            <select id="trade" name="trade" defaultValue={tradeFilter ?? "all"} className="input">
              <option value="all">All trades</option>
              {TRADES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <button className="btn-secondary">Filter</button>
        </form>
      )}
      {jobs.length === 0 ? (
        <Empty>
          {mine
            ? "You haven't quoted for any jobs yet."
            : "No open jobs for this trade right now. Try “All trades” or check back soon."}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => {
            const q = myQuotes.get(job.id);
            const won = job.accepted_quote_id && q && job.accepted_quote_id === q.id;
            return (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="card flex flex-col gap-2 hover:border-brand">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{job.title}</span>
                    {mine && q ? <StatusPill status={won ? job.status : q.status} /> : <span className="shrink-0 text-xs text-muted">{timeAgo(job.created_at)}</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {job.trade} · {job.postcode} · {job.timing}
                  </span>
                  <span className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <span className="text-sm">Customer <b>{job.customer.full_name}</b></span>
                    <CustomerTrust stats={stats.get(job.customer_id)} compact />
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
