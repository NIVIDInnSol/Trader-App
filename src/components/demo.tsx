"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayName, resetDemo, switchUser, useDemo } from "@/lib/demo/store";
import type { DemoData } from "@/lib/demo/seed";
import type { Profile } from "@/lib/types";

/** Renders children with the demo data and signed-in user, or a prompt to sign in. */
export function WithMe({ children }: { children: (d: DemoData, me: Profile) => React.ReactNode }) {
  const d = useDemo();
  if (!d) return <p className="text-muted">Loading…</p>;
  const me = d.profiles.find((p) => p.id === d.meId);
  if (!me) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h1 className="h1">Please log in</h1>
        <p className="text-muted">Create an account, or log in as one of the sample customers or tradespeople.</p>
        <div className="flex gap-2">
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/signup" className="btn-primary">Sign up</Link>
        </div>
      </div>
    );
  }
  return <>{children(d, me)}</>;
}

/** Thin bar above the header for presenters: jump between accounts, reset the demo. */
export function DemoBar() {
  const d = useDemo();
  const router = useRouter();
  if (!d) return <div className="h-11 bg-ink" />;
  const customers = d.profiles.filter((p) => p.role === "customer");
  const traders = d.profiles.filter((p) => p.role === "trader");
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs">
        <span className="rounded bg-white/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide">Demo</span>
        <label htmlFor="demo-user" className="text-white/80">Viewing as</label>
        <select
          id="demo-user"
          value={d.meId ?? ""}
          onChange={(e) => {
            switchUser(e.target.value || null);
            router.push(e.target.value ? "/jobs" : "/");
          }}
          className="h-8 max-w-52 rounded-md border-0 bg-white/10 px-2 text-xs text-white [&>*]:text-ink"
        >
          <option value="">Signed out</option>
          <optgroup label="Customers">
            {customers.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </optgroup>
          <optgroup label="Tradespeople">
            {traders.map((p) => (
              <option key={p.id} value={p.id}>{displayName(p)}</option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset the demo to the sample data? Accounts and jobs you created will be removed.")) {
              resetDemo();
              router.push("/");
            }
          }}
          className="ml-auto min-h-8 rounded-md px-2 text-white/80 underline-offset-2 hover:text-white hover:underline"
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}
