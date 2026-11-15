import type { Metadata } from "next";
import Link from "next/link";
import { logIn } from "@/app/actions";
import { Notice, one } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="h1">Log in</h1>
      <Notice error={one(sp.error)} message={one(sp.message)} />
      <form action={logIn} className="card flex flex-col gap-4">
        <input type="hidden" name="next" value={one(sp.next) ?? ""} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn-primary w-full">Log in</button>
      </form>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand">Create an account</Link>
      </p>
    </div>
  );
}
