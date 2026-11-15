import type { Invoice, Job, Notification, Profile, Quote, Review } from "@/lib/types";

export type DemoData = {
  version: number;
  meId: string | null;
  profiles: Profile[];
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
  reviews: Review[];
  notifications: Notification[];
};

export const DEMO_VERSION = 1;

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600_000).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

const person = (p: Partial<Profile> & Pick<Profile, "id" | "role" | "full_name">): Profile => ({
  postcode: null,
  trade: null,
  business_name: null,
  bio: null,
  created_at: ago(400),
  bot: true,
  ...p,
});

// Sample accounts. IDs are readable so the demo is easy to follow.
export function seed(): DemoData {
  const profiles: Profile[] = [
    person({
      id: "c-sarah", role: "customer", full_name: "Sarah Mitchell", postcode: "SE15 4QN",
      bio: "Homeowner in Peckham. Clear briefs and easy access.",
      history: { rating: 4.9, reviews: 8, jobs: 8, onTime: 8, late: 0 },
    }),
    person({
      id: "c-james", role: "customer", full_name: "James Kahn", postcode: "SE15 3AB",
      history: { rating: 4.6, reviews: 5, jobs: 6, onTime: 6, late: 0 },
    }),
    person({
      id: "c-alex", role: "customer", full_name: "Alex Reed", postcode: "SE5 8RS",
      history: { rating: 2.8, reviews: 4, jobs: 5, onTime: 3, late: 2 },
    }),
    person({
      id: "t-dan", role: "trader", full_name: "Dan Okafor", business_name: "Dan Okafor Plumbing",
      trade: "Plumbing", postcode: "SE15",
      bio: "Plumber with 12 years' experience. Fully insured (£2m public liability), DBS checked. Leaks, taps, toilets, radiators and bathroom installs.",
      history: { rating: 4.9, reviews: 212, jobs: 340, onTime: 0, late: 0 },
    }),
    person({
      id: "t-priya", role: "trader", full_name: "Priya Shah", business_name: "Priya Shah Plumbing & Heating",
      trade: "Plumbing", postcode: "SE22",
      bio: "Gas Safe registered engineer. Boilers, heating and plumbing.",
      history: { rating: 5.0, reviews: 41, jobs: 52, onTime: 0, late: 0 },
    }),
    person({
      id: "t-hughes", role: "trader", full_name: "Mark Hughes", business_name: "Hughes & Son",
      trade: "Handyman", postcode: "SE4",
      bio: "Family handyman business. Shelves, flat-pack, small repairs, plumbing odd jobs.",
      history: { rating: 4.7, reviews: 88, jobs: 130, onTime: 0, late: 0 },
    }),
    person({
      id: "t-ella", role: "trader", full_name: "Ella Brooks", business_name: "Brooks Electrical",
      trade: "Electrical", postcode: "SE15",
      bio: "NICEIC approved electrician. Sockets, lighting, rewires, EV chargers.",
      history: { rating: 4.8, reviews: 63, jobs: 97, onTime: 0, late: 0 },
    }),
    person({
      id: "t-quickfix", role: "trader", full_name: "Tom Quinn", business_name: "Quickfix Handyman",
      trade: "Handyman", postcode: "SE14", created_at: ago(30),
      history: { rating: 4.1, reviews: 19, jobs: 23, onTime: 0, late: 0 },
    }),
  ];

  const jobs: Job[] = [
    {
      id: "j-tap", customer_id: "c-sarah", title: "Replace leaking kitchen mixer tap",
      description: "Tap drips constantly and the base is loose. I've already bought a replacement tap.",
      trade: "Plumbing", postcode: "SE15 4QN", timing: "Within a week", status: "open",
      accepted_quote_id: null, created_at: ago(0, 5),
    },
    {
      id: "j-radiator", customer_id: "c-james", title: "Radiator not heating upstairs",
      description: "Back bedroom radiator stays cold even after bleeding it. Combi boiler, about 6 years old.",
      trade: "Plumbing", postcode: "SE15 3AB", timing: "Urgent (48 hours)", status: "open",
      accepted_quote_id: null, created_at: ago(0, 2),
    },
    {
      id: "j-fan", customer_id: "c-alex", title: "Fit new bathroom extractor fan",
      description: "Old fan is broken. New fan bought, needs fitting to the existing wiring.",
      trade: "Electrical", postcode: "SE5 8RS", timing: "Flexible", status: "open",
      accepted_quote_id: null, created_at: ago(1),
    },
    {
      id: "j-shelves", customer_id: "c-sarah", title: "Put up three floating shelves",
      description: "Living room, plasterboard wall. Shelves and fixings supplied.",
      trade: "Handyman", postcode: "SE15 4QN", timing: "Flexible", status: "open",
      accepted_quote_id: null, created_at: ago(2),
    },
  ];

  const quotes: Quote[] = [
    { id: "q-tap-dan", job_id: "j-tap", trader_id: "t-dan", amount_pence: 9500, message: "Includes fitting your tap and two new isolation valves. About 1.5 hours.", earliest_start: inDays(2), status: "pending", created_at: ago(0, 4) },
    { id: "q-tap-hughes", job_id: "j-tap", trader_id: "t-hughes", amount_pence: 8500, message: "Can do Thursday morning.", earliest_start: inDays(4), status: "pending", created_at: ago(0, 3) },
    { id: "q-tap-priya", job_id: "j-tap", trader_id: "t-priya", amount_pence: 12000, message: "Will also check your water pressure and stopcock.", earliest_start: inDays(1), status: "pending", created_at: ago(0, 2) },
    { id: "q-tap-quick", job_id: "j-tap", trader_id: "t-quickfix", amount_pence: 7000, message: null, earliest_start: inDays(3), status: "pending", created_at: ago(0, 1) },
    { id: "q-shelves-hughes", job_id: "j-shelves", trader_id: "t-hughes", amount_pence: 6000, message: "Will use heavy-duty plasterboard fixings.", earliest_start: inDays(5), status: "pending", created_at: ago(1) },
  ];

  const reviews: Review[] = [
    { id: "r1", job_id: "old-1", reviewer_id: "c-james", reviewee_id: "t-dan", rating: 5, comment: "Fixed a burst pipe the same evening. Tidy, fair price, invoice in the app straight away.", created_at: ago(14) },
    { id: "r2", job_id: "old-2", reviewer_id: "c-sarah", reviewee_id: "t-dan", rating: 5, comment: "Replaced our bathroom basin and taps. Turned up exactly when he said.", created_at: ago(35) },
    { id: "r3", job_id: "old-3", reviewer_id: "t-ella", reviewee_id: "c-sarah", rating: 5, comment: "Clear brief, easy access, paid the same day. Would happily work for her again.", created_at: ago(20) },
    { id: "r4", job_id: "old-4", reviewer_id: "t-hughes", reviewee_id: "c-alex", rating: 2, comment: "Job changed on the day and the invoice was paid 3 weeks late.", created_at: ago(40) },
    { id: "r5", job_id: "old-5", reviewer_id: "c-alex", reviewee_id: "t-hughes", rating: 5, comment: "Quick and friendly.", created_at: ago(41) },
    { id: "r6", job_id: "old-6", reviewer_id: "c-james", reviewee_id: "t-priya", rating: 5, comment: "Diagnosed our boiler fault in 20 minutes. Excellent.", created_at: ago(9) },
    { id: "r7", job_id: "old-7", reviewer_id: "c-sarah", reviewee_id: "t-ella", rating: 5, comment: "New outdoor lights, neat job and certificate emailed the same day.", created_at: ago(20) },
    { id: "r8", job_id: "old-8", reviewer_id: "c-james", reviewee_id: "t-quickfix", rating: 4, comment: "Got the job done, a bit late arriving.", created_at: ago(12) },
  ];

  return { version: DEMO_VERSION, meId: null, profiles, jobs, quotes, invoices: [], reviews, notifications: [] };
}
