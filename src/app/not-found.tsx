import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card flex flex-col items-start gap-3">
      <h1 className="h1">Not found</h1>
      <p className="text-muted">This page doesn&apos;t exist.</p>
      <Link href="/jobs" className="btn-primary">Go to jobs</Link>
    </div>
  );
}
