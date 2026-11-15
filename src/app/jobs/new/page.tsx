"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WithMe } from "@/components/demo";
import { postJob } from "@/lib/demo/store";
import { TIMINGS, TRADES } from "@/lib/config";
import { BackLink, Notice } from "@/components/ui";

export default function NewJobPage() {
  return (
    <Suspense>
      <NewJob />
    </Suspense>
  );
}

function NewJob() {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome");
  return (
    <WithMe>
      {(_d, me) =>
        me.role !== "customer" ? (
          <p className="card text-muted">Only customers can post jobs.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <BackLink href="/jobs">My jobs</BackLink>
            <h1 className="h1">Post a job</h1>
            <Notice message={welcome ? `Welcome, ${me.full_name.split(" ")[0]}! Post your first job and local tradespeople will start quoting.` : undefined} />
            <form
              className="card flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const get = (k: string) => String(f.get(k) ?? "").trim();
                const id = postJob(me.id, {
                  title: get("title"),
                  description: get("description"),
                  trade: get("trade"),
                  postcode: get("postcode"),
                  timing: get("timing"),
                });
                router.push(`/jobs/${id}?posted=1`);
              }}
            >
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
        )
      }
    </WithMe>
  );
}
