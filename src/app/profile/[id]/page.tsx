"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WithMe } from "@/components/demo";
import { displayName, statsFor } from "@/lib/demo/store";
import { date } from "@/lib/format";
import { Avatar, BackLink, CustomerTrust, Stars, TraderRating } from "@/components/ui";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <WithMe>
      {(d) => {
        const profile = d.profiles.find((p) => p.id === id);
        if (!profile) {
          return (
            <div className="card flex flex-col items-start gap-3">
              <h1 className="h1">Profile not found</h1>
              <Link href="/jobs" className="btn-primary">Back to jobs</Link>
            </div>
          );
        }
        const stats = statsFor(d, id);
        const reviews = d.reviews.filter((r) => r.reviewee_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const name = displayName(profile);
        const isTrader = profile.role === "trader";
        return (
          <div className="flex flex-col gap-5">
            <BackLink href="/jobs">Back</BackLink>
            <section className="card flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={name} size={64} />
                <div>
                  <h1 className="h1">{name}</h1>
                  <p className="text-sm text-muted">
                    {isTrader ? profile.trade ?? "Tradesperson" : "Customer"}
                    {profile.postcode ? ` · ${profile.postcode}` : ""} · joined {date(profile.created_at)}
                  </p>
                </div>
              </div>
              {isTrader ? <TraderRating stats={stats} /> : <CustomerTrust stats={stats} />}
              {profile.bio && <p className="whitespace-pre-line text-sm">{profile.bio}</p>}
              {isTrader && profile.bot && (
                <div className="flex flex-wrap gap-1.5">
                  {["✓ ID verified", "✓ Insured", "✓ DBS checked"].map((b) => (
                    <span key={b} className="rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-dark">{b}</span>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-xs text-muted">Rating</dt>
                  <dd className="font-display text-xl font-bold">{stats.avg_rating != null ? `★ ${stats.avg_rating.toFixed(1)}` : "–"}</dd>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-xs text-muted">Reviews</dt>
                  <dd className="font-display text-xl font-bold">{stats.review_count}</dd>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-xs text-muted">{isTrader ? "Jobs done" : "Paid on time"}</dt>
                  <dd className="font-display text-xl font-bold">
                    {isTrader ? stats.paid_jobs : `${stats.paid_on_time}/${stats.paid_on_time + stats.paid_late_or_overdue}`}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="h2">Recent reviews {isTrader ? "from customers" : "from tradespeople"}</h2>
              {reviews.length === 0 && <p className="card text-sm text-muted">No reviews yet.</p>}
              {reviews.map((r) => {
                const by = d.profiles.find((p) => p.id === r.reviewer_id);
                return (
                  <article key={r.id} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-muted">{by ? displayName(by) : ""} · {date(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                  </article>
                );
              })}
            </section>
          </div>
        );
      }}
    </WithMe>
  );
}
