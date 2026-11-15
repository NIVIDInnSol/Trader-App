"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayName, statsFor, switchUser, useDemo } from "@/lib/demo/store";
import { Avatar } from "@/components/ui";

export default function LoginPage() {
  const d = useDemo();
  const router = useRouter();
  if (!d) return <p className="text-muted">Loading…</p>;

  const group = (role: "customer" | "trader", title: string) => (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">{title}</h2>
      <ul className="card flex flex-col divide-y divide-line p-0 sm:p-0">
        {d.profiles
          .filter((p) => p.role === role)
          .map((p) => {
            const s = statsFor(d, p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchUser(p.id);
                    router.push("/jobs");
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50"
                >
                  <Avatar name={displayName(p)} size={36} />
                  <span className="flex-1">
                    <span className="block font-semibold">{displayName(p)}</span>
                    <span className="text-xs text-muted">
                      {p.bot ? "Sample account" : "Your account"} · {role === "trader" ? p.trade : p.postcode}
                      {s.avg_rating != null ? ` · ★ ${s.avg_rating.toFixed(1)}` : ""}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted">→</span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="h1">Log in</h1>
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-dark">
        This is a demo, so there are no passwords. Pick an account to continue.
      </p>
      {group("customer", "Customers")}
      {group("trader", "Tradespeople")}
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand">Create an account</Link>
      </p>
    </div>
  );
}
