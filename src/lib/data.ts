import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Stats } from "@/lib/types";

/** The signed-in user's profile, or null. Cached for the duration of one request. */
export const getMe = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (profile as Profile) ?? null;
});

export async function requireMe(): Promise<Profile> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

/** Reputation numbers for several profiles at once, keyed by profile id. */
export async function getStats(ids: string[]): Promise<Map<string, Stats>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, Stats>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profile_stats", { p_ids: unique });
  for (const row of (data ?? []) as Stats[]) {
    map.set(row.profile_id, {
      ...row,
      avg_rating: row.avg_rating === null ? null : Number(row.avg_rating),
      review_count: Number(row.review_count),
      paid_jobs: Number(row.paid_jobs),
      paid_on_time: Number(row.paid_on_time),
      paid_late_or_overdue: Number(row.paid_late_or_overdue),
    });
  }
  return map;
}

export async function unreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}
