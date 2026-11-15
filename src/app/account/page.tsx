import type { Metadata } from "next";
import Link from "next/link";
import { requireMe } from "@/lib/data";
import { updateProfile } from "@/app/actions";
import { Notice, one } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const me = await requireMe();
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Your account</h1>
        <Link href={`/profile/${me.id}`} className="btn-secondary">View public profile</Link>
      </div>
      <Notice error={one(sp.error)} message={one(sp.saved) ? "Saved." : undefined} />
      <form action={updateProfile} className="card flex flex-col gap-4">
        <p className="text-sm text-muted">
          Account type: <b className="text-ink">{me.role === "trader" ? `Tradesperson · ${me.trade ?? ""}` : "Customer"}</b>
        </p>
        <div>
          <label htmlFor="full_name" className="label">Name</label>
          <input id="full_name" name="full_name" required maxLength={120} defaultValue={me.full_name} className="input" />
        </div>
        {me.role === "trader" && (
          <div>
            <label htmlFor="business_name" className="label">Business name</label>
            <input id="business_name" name="business_name" maxLength={120} defaultValue={me.business_name ?? ""} className="input" />
          </div>
        )}
        <div>
          <label htmlFor="postcode" className="label">Postcode</label>
          <input id="postcode" name="postcode" maxLength={10} defaultValue={me.postcode ?? ""} className="input uppercase" />
        </div>
        <div>
          <label htmlFor="bio" className="label">About {me.role === "trader" ? "your business" : "you"}</label>
          <textarea id="bio" name="bio" rows={4} maxLength={1000} defaultValue={me.bio ?? ""} className="textarea" />
        </div>
        <button className="btn-primary w-full">Save</button>
      </form>
    </div>
  );
}
