import type { Metadata } from "next";
import Link from "next/link";
import { signUp } from "@/app/actions";
import { Notice, one } from "@/components/ui";
import { TRADES } from "@/lib/config";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const role = one(sp.role) === "trader" ? "trader" : "customer";
  const tab = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`;

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
      <Notice error={one(sp.error)} />
      <form action={signUp} className="card flex flex-col gap-4">
        <input type="hidden" name="role" value={role} />
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
          <input id="postcode" name="postcode" maxLength={10} autoComplete="postal-code" className="input uppercase" placeholder="SE15 4QN" />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        <button className="btn-primary w-full">Create {role === "trader" ? "trader" : "customer"} account</button>
      </form>
      <p className="text-center text-sm text-muted">
        Already registered? <Link href="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  );
}
