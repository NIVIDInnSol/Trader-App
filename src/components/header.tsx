import Link from "next/link";
import { getMe, unreadCount } from "@/lib/data";
import { logOut } from "@/app/actions";
import { APP_NAME } from "@/lib/config";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold">{APP_NAME}</span>
    </Link>
  );
}

export async function Header() {
  const me = await getMe();
  const unread = me ? await unreadCount(me.id) : 0;
  const link = "flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-muted hover:bg-gray-100 hover:text-ink";

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Logo />
        {me ? (
          <nav className="flex flex-wrap items-center gap-0.5" aria-label="Main">
            <Link href="/jobs" className={link}>
              {me.role === "trader" ? "Find jobs" : "My jobs"}
            </Link>
            {me.role === "customer" && (
              <Link href="/jobs/new" className={link}>
                Post a job
              </Link>
            )}
            <Link href="/notifications" className={link}>
              Alerts
              {unread > 0 && (
                <span className="ml-1 rounded-full bg-warn px-1.5 text-xs text-white" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
            </Link>
            <Link href="/account" className={link}>
              Account
            </Link>
            <form action={logOut}>
              <button className={link}>Log out</button>
            </form>
          </nav>
        ) : (
          <nav className="flex items-center gap-2" aria-label="Main">
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
