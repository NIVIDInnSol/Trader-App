import type { Metadata } from "next";
import Link from "next/link";
import { requireMe } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { markAllRead } from "@/app/actions";
import { Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Alerts" };

type Notification = { id: string; message: string; link: string | null; read: boolean; created_at: string };

export default async function NotificationsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Alerts</h1>
        {unread && (
          <form action={markAllRead}>
            <button className="btn-secondary">Mark all as read</button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <Empty>No alerts yet. New quotes, invoices, payment reminders and reviews will appear here.</Empty>
      ) : (
        <ul className="card flex flex-col divide-y divide-line p-0 sm:p-0">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "#"} className="flex min-h-14 items-start gap-3 px-4 py-3 hover:bg-gray-50">
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-warn"}`} />
                <span className="flex-1">
                  <span className={`block text-sm ${n.read ? "" : "font-semibold"}`}>{n.message}</span>
                  <span className="text-xs text-muted">{timeAgo(n.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
