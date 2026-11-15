"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/demo/store";
import { Notice } from "@/components/ui";
import { TRADES } from "@/lib/config";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}

function SignUp() {
  const router = useRouter();
  const role = useSearchParams().get("role") === "trader" ? "trader" : "customer";
  const [error, setError] = useState<string>();
  const tab = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (get("password").length < 8) return setError("Password must be at least 8 characters.");
    register({
      role,
      full_name: get("full_name"),
      postcode: get("postcode"),
      trade: get("trade"),
      business_name: get("business_name"),
    });
    router.push(role === "customer" ? "/jobs/new?welcome=1" : "/jobs?welcome=1");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="h1">Create your account</h1>
      <div className="flex gap-1 rounded-xl bg-gray-200 p-1" role="tablist" aria-label="Account type">
        <Link href="/signup?role=customer" role="tab" aria-selected={role === "customer"} className={tab(role === "customer")}>
          I need work done
        </Link>
        <Link href="/signup?role=trader" role="tab" aria-selected={role === "trader"} className={tab(role === "trader")}>
          I&apos;m a tradesperson
        </Link>
      </div>
      <Notice error={error} />
      <form onSubmit={onSubmit} className="card flex flex-col gap-4" key={role}>
        <div>
          <label htmlFor="full_name" className="label">Your name</label>
          <input id="full_name" name="full_name" required maxLength={120} autoComplete="name" className="input" />
        </div>
        {role === "trader" && (
          <>
            <div>
              <label htmlFor="business_name" className="label">Business name <span className="font-normal text-muted">(optional)</span></label>
              <input id="business_name" name="business_name" maxLength={120} autoComplete="organization" className="input" />
            </div>
            <div>
              <label htmlFor="trade" className="label">Main trade</label>
              <select id="trade" name="trade" required className="input" defaultValue="">
                <option value="" disabled>Choose your trade</option>
                {TRADES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="postcode" className="label">{role === "trader" ? "Base postcode" : "Postcode"}</label>
          <input id="postcode" name="postcode" required maxLength={10} autoComplete="postal-code" className="input uppercase" placeholder="SE15 4QN" />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          <p className="mt-1 text-xs text-muted">At least 8 characters. In this demo, details stay in your browser.</p>
        </div>
        <button className="btn-primary w-full">Create {role === "trader" ? "trader" : "customer"} account</button>
      </form>
      <p className="text-center text-sm text-muted">
        Already registered? <Link href="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  );
}
