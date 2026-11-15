"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toPence } from "@/lib/format";
import { TIMINGS, TRADES } from "@/lib/config";

function str(form: FormData, key: string, max = 4000) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function back(path: string, error: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(error)}`);
}

/** Turn a database exception into a message a person can read. */
function friendly(message: string) {
  if (message.includes("reviews_job_id_reviewer_id_key")) return "You have already left a review for this job.";
  if (message.includes("violates check constraint")) return "Some details were too long or missing.";
  return message;
}

// ------------------------------------------------------------------ auth

export async function signUp(form: FormData) {
  const role = str(form, "role") === "trader" ? "trader" : "customer";
  const email = str(form, "email", 200);
  const password = String(form.get("password") ?? "");
  const full_name = str(form, "full_name", 120);
  const postcode = str(form, "postcode", 10);
  const trade = role === "trader" ? str(form, "trade", 60) : "";
  const business_name = role === "trader" ? str(form, "business_name", 120) : "";
  const retry = `/signup?role=${role}`;

  if (!full_name || !email) back(retry, "Please enter your name and email.");
  if (password.length < 8) back(retry, "Password must be at least 8 characters.");
  if (role === "trader" && !TRADES.includes(trade as (typeof TRADES)[number])) back(retry, "Please choose your trade.");

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { role, full_name, postcode, trade, business_name },
    },
  });
  if (error) back(retry, error.message);
  if (!data.session) redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account, then log in."));
  redirect("/jobs");
}

export async function logIn(form: FormData) {
  const next = str(form, "next", 200);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email", 200),
    password: String(form.get("password") ?? ""),
  });
  if (error) back("/login", error.message);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/jobs");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(form: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(form, "full_name", 120),
      postcode: str(form, "postcode", 10).toUpperCase() || null,
      business_name: str(form, "business_name", 120) || null,
      bio: str(form, "bio", 1000) || null,
    })
    .eq("id", id);
  if (error) back("/account", friendly(error.message));
  revalidatePath("/", "layout");
  redirect("/account?saved=1");
}

// ------------------------------------------------------------------ jobs and quotes

export async function postJob(form: FormData) {
  const trade = str(form, "trade", 60);
  const timing = str(form, "timing", 60);
  if (!TRADES.includes(trade as (typeof TRADES)[number])) back("/jobs/new", "Please choose a trade.");
  if (!TIMINGS.includes(timing as (typeof TIMINGS)[number])) back("/jobs/new", "Please choose when you need it done.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_job", {
    p_title: str(form, "title", 120),
    p_description: str(form, "description", 4000),
    p_trade: trade,
    p_postcode: str(form, "postcode", 10),
    p_timing: timing,
  });
  if (error) back("/jobs/new", friendly(error.message));
  redirect(`/jobs/${data}?posted=1`);
}

async function jobAction(jobId: string, fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) back(`/jobs/${jobId}`, friendly(error.message));
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

export async function cancelJob(form: FormData) {
  const job = str(form, "job_id");
  await jobAction(job, "cancel_job", { p_job: job });
}

export async function submitQuote(form: FormData) {
  const job = str(form, "job_id");
  const pence = toPence(form.get("amount"));
  if (!pence) back(`/jobs/${job}`, "Please enter a valid price in pounds.");
  const start = str(form, "earliest_start", 10);
  await jobAction(job, "submit_quote", {
    p_job: job,
    p_amount_pence: pence,
    p_message: str(form, "message", 2000) || null,
    p_earliest_start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
  });
}

export async function withdrawQuote(form: FormData) {
  await jobAction(str(form, "job_id"), "withdraw_quote", { p_quote: str(form, "quote_id") });
}

export async function acceptQuote(form: FormData) {
  await jobAction(str(form, "job_id"), "accept_quote", { p_quote: str(form, "quote_id") });
}

// ------------------------------------------------------------------ invoices and payment

export async function createInvoice(form: FormData) {
  const job = str(form, "job_id");
  const pence = toPence(form.get("net_amount"));
  if (!pence) back(`/jobs/${job}`, "Please enter a valid amount in pounds.");
  const days = Number(str(form, "due_days"));
  await jobAction(job, "create_invoice", {
    p_job: job,
    p_description: str(form, "description", 2000) || "Work completed",
    p_net_pence: pence,
    p_add_vat: form.get("add_vat") === "on",
    p_due_days: Number.isInteger(days) ? days : 7,
  });
}

export async function payInvoice(form: FormData) {
  const method = str(form, "method");
  if (!["card", "bank_transfer", "cash"].includes(method)) back(`/jobs/${str(form, "job_id")}`, "Choose how you are paying.");
  await jobAction(str(form, "job_id"), "pay_invoice", { p_invoice: str(form, "invoice_id"), p_method: method });
}

export async function confirmCash(form: FormData) {
  await jobAction(str(form, "job_id"), "confirm_cash", {
    p_invoice: str(form, "invoice_id"),
    p_received: str(form, "received") === "yes",
  });
}

export async function sendReminder(form: FormData) {
  await jobAction(str(form, "job_id"), "send_reminder", { p_invoice: str(form, "invoice_id") });
}

// ------------------------------------------------------------------ reviews and notifications

export async function leaveReview(form: FormData) {
  const job = str(form, "job_id");
  const rating = Number(str(form, "rating"));
  if (!(rating >= 1 && rating <= 5)) back(`/jobs/${job}`, "Please choose a star rating.");
  await jobAction(job, "leave_review", { p_job: job, p_rating: rating, p_comment: str(form, "comment", 2000) });
}

export async function markAllRead() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    await supabase.from("notifications").update({ read: true }).eq("user_id", data.claims.sub).eq("read", false);
  }
  revalidatePath("/", "layout");
  redirect("/notifications");
}
