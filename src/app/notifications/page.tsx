"use client";

import Link from "next/link";
import { WithMe } from "@/components/demo";
import { markAllRead } from "@/lib/demo/store";
import { timeAgo } from "@/lib/format";
import { Empty } from "@/components/ui";

export default function NotificationsPage() {
  return (
    <WithMe>
      {(d, me) => {
        const items = d.notifications.filter((n) => n.user_id === me.id);
        const unread = items.some((n) => !n.read);
        return (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="h1">Alerts</h1>
              {unread && (
                <button type="button" onClick={() => markAllRead(me.id)} className="btn-secondary">Mark all as read</button>
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
      }}
    </WithMe>
  );
}
