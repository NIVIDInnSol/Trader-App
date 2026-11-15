import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { postJob } from "@/app/actions";
import { requireMe } from "@/lib/data";
import { TIMINGS, TRADES } from "@/lib/config";
import { BackLink, Notice, one } from "@/components/ui";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  const me = await requireMe();
  if (me.role !== "customer") redirect("/jobs");
  const sp = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/jobs">My jobs</BackLink>
      <h1 className="h1">Post a job</h1>
      <Notice error={one(sp.error)} />
      <form action={postJob} className="card flex flex-col gap-4">
        <div>
          <label htmlFor="trade" className="label">What kind of trade?</label>
          <select id="trade" name="trade" required defaultValue="" className="input">
            <option value="" disabled>Choose a trade</option>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title" className="label">Job title</label>
          <input id="title" name="title" required minLength={3} maxLength={120} className="input" placeholder="e.g. Replace leaking kitchen tap" />
        </div>
        <div>
          <label htmlFor="description" className="label">Describe the job</label>
          <textarea id="description" name="description" required rows={5} maxLength={4000} className="textarea" placeholder="What needs doing, any materials you already have, access details…" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="postcode" className="label">Postcode</label>
            <input id="postcode" name="postcode" required maxLength={10} defaultValue={me.postcode ?? ""} className="input uppercase" />
          </div>
          <div>
            <label htmlFor="timing" className="label">When?</label>
            <select id="timing" name="timing" defaultValue="Within a week" className="input">
              {TIMINGS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
          Tradespeople will see your Customer Trust rating. Paying on time gets you more quotes and better prices.
        </p>
        <button className="btn-primary w-full">Post job &amp; get quotes</button>
      </form>
    </div>
  );
}
