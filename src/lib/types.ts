export type Role = "customer" | "trader";
export type JobStatus = "open" | "assigned" | "invoiced" | "paid" | "cancelled";
export type QuoteStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type InvoiceStatus = "unpaid" | "cash_pending" | "paid";
export type PaymentMethod = "card" | "bank_transfer" | "cash";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  postcode: string | null;
  trade: string | null;
  business_name: string | null;
  bio: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  trade: string;
  postcode: string;
  timing: string;
  status: JobStatus;
  accepted_quote_id: string | null;
  created_at: string;
};

export type Quote = {
  id: string;
  job_id: string;
  trader_id: string;
  amount_pence: number;
  message: string | null;
  earliest_start: string | null;
  status: QuoteStatus;
  created_at: string;
};

export type Invoice = {
  id: string;
  job_id: string;
  trader_id: string;
  customer_id: string;
  description: string;
  net_pence: number;
  vat_pence: number;
  total_pence: number;
  due_date: string;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Stats = {
  profile_id: string;
  avg_rating: number | null;
  review_count: number;
  paid_jobs: number;
  paid_on_time: number;
  paid_late_or_overdue: number;
};
