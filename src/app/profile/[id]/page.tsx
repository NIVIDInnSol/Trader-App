import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMe, getStats } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { date } from "@/lib/format";
import { Avatar, BackLink, CustomerTrust, Stars, TraderRating } from "@/components/ui";
import type { Profile, Review } from "@/lib/types";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const profile = data as Profile;

  const { data: reviewData } = await supabase
    .from("reviews")
    .select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, business_name)")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = (reviewData ?? []) as (Review & { reviewer: { full_name: string; business_name: string | null } })[];
  const stats = (await getStats([id])).get(id);
  const name = profile.business_name || profile.full_name;
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
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">Rating</dt>
            <dd className="font-display text-xl font-bold">{stats?.avg_rating != null ? `★ ${stats.avg_rating.toFixed(1)}` : "–"}</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">Reviews</dt>
            <dd className="font-display text-xl font-bold">{stats?.review_count ?? 0}</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-muted">{isTrader ? "Paid jobs" : "Paid on time"}</dt>
            <dd className="font-display text-xl font-bold">
              {isTrader ? stats?.paid_jobs ?? 0 : `${stats?.paid_on_time ?? 0}/${(stats?.paid_on_time ?? 0) + (stats?.paid_late_or_overdue ?? 0)}`}
            </dd>
          </div>
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="h2">Reviews {isTrader ? "from customers" : "from tradespeople"}</h2>
        {reviews.length === 0 && <p className="card text-sm text-muted">No reviews yet.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars value={r.rating} />
              <span className="text-xs text-muted">
                {r.reviewer.business_name || r.reviewer.full_name} · {date(r.created_at)}
              </span>
            </div>
            {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
