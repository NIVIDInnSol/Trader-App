import Link from "next/link";
import { APP_TAGLINE } from "@/lib/config";
import { TryAs } from "./try-as";

export default function Home() {
  const steps = [
    ["Post your job", "Describe the work and your postcode. Local tradespeople are notified."],
    ["Compare quotes and ratings", "See each price next to the trader's rating, reviews and jobs done. Pick the one you want."],
    ["Pay in the app", "Card, bank transfer or cash. Automatic reminders mean nothing is forgotten."],
    ["Rate each other", "Customers rate trades. Trades rate customers, so reliable payers get better prices."],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 pt-4">
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">{APP_TAGLINE}</h1>
        <p className="max-w-xl text-lg text-muted">
          The UK trades app where trust works both ways. Customers see who does good work; tradespeople see who pays on time.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup?role=customer" className="btn-primary min-h-14 text-base">
            I need a job done
          </Link>
          <Link href="/signup?role=trader" className="btn-secondary min-h-14 border-ink text-base">
            I&apos;m a tradesperson
          </Link>
        </div>
        <TryAs />
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="eyebrow">How it works</h2>
        <ol className="flex flex-col gap-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
