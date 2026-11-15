-- Fixfare: initial schema
-- Customers post jobs, traders quote, customer accepts a quote, trader invoices,
-- customer pays (card, bank transfer or cash), then both sides review each other.
-- All state changes go through SECURITY DEFINER functions that check the caller,
-- so table policies only need to grant reads.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------- types
create type public.user_role as enum ('customer', 'trader');
create type public.job_status as enum ('open', 'assigned', 'invoiced', 'paid', 'cancelled');
create type public.quote_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.invoice_status as enum ('unpaid', 'cash_pending', 'paid');
create type public.payment_method as enum ('card', 'bank_transfer', 'cash');

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  postcode text check (char_length(postcode) <= 10),
  trade text check (char_length(trade) <= 60),            -- traders only
  business_name text check (char_length(business_name) <= 120),
  bio text check (char_length(bio) <= 1000),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  trade text not null check (char_length(trade) <= 60),
  postcode text not null check (char_length(postcode) <= 10),
  timing text not null default 'Within a week' check (char_length(timing) <= 60),
  status public.job_status not null default 'open',
  accepted_quote_id uuid,
  created_at timestamptz not null default now()
);
create index jobs_customer_idx on public.jobs (customer_id);
create index jobs_status_idx on public.jobs (status);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  trader_id uuid not null references public.profiles (id) on delete cascade,
  amount_pence integer not null check (amount_pence > 0 and amount_pence <= 100000000),
  message text check (char_length(message) <= 2000),
  earliest_start date,
  status public.quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (job_id, trader_id)
);
create index quotes_trader_idx on public.quotes (trader_id);

alter table public.jobs
  add constraint jobs_accepted_quote_fk foreign key (accepted_quote_id)
  references public.quotes (id) on delete set null;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  trader_id uuid not null references public.profiles (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  description text not null check (char_length(description) <= 2000),
  net_pence integer not null check (net_pence > 0),
  vat_pence integer not null default 0 check (vat_pence >= 0),
  total_pence integer generated always as (net_pence + vat_pence) stored,
  due_date date not null,
  status public.invoice_status not null default 'unpaid',
  payment_method public.payment_method,
  paid_at timestamptz,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now()
);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_trader_idx on public.invoices (trader_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (job_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- reputation
-- Aggregate numbers only. For traders: rating from customers.
-- For customers: rating from traders plus their payment record (Customer Trust).
-- SECURITY DEFINER so a trader can see a customer's record across all their jobs,
-- without being able to read the underlying invoices.
create or replace function public.get_profile_stats(p_ids uuid[])
returns table (
  profile_id uuid, avg_rating numeric, review_count bigint, paid_jobs bigint,
  paid_on_time bigint, paid_late_or_overdue bigint)
language sql stable security definer set search_path = ''
as $$
  select
    p.id,
    (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
    (select count(*) from public.reviews r where r.reviewee_id = p.id),
    (select count(*) from public.invoices i
       where (i.trader_id = p.id or i.customer_id = p.id) and i.status = 'paid'),
    (select count(*) from public.invoices i
       where i.customer_id = p.id and i.status = 'paid'
         and (i.paid_at at time zone 'Europe/London')::date <= i.due_date),
    (select count(*) from public.invoices i
       where i.customer_id = p.id
         and ((i.status = 'paid' and (i.paid_at at time zone 'Europe/London')::date > i.due_date)
           or (i.status = 'unpaid' and i.due_date < current_date)))
  from public.profiles p
  where p.id = any (p_ids) and (select auth.uid()) is not null
$$;
revoke execute on function public.get_profile_stats(uuid[]) from public, anon;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

-- Profiles and reviews are public to signed-in users (that's the point: reputation).
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = public.my_role());

create policy "reviews readable" on public.reviews
  for select to authenticated using (true);

create or replace function public.has_quoted(p_job uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.quotes where job_id = p_job and trader_id = (select auth.uid())) $$;

create or replace function public.owns_job(p_job uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.jobs where id = p_job and customer_id = (select auth.uid())) $$;

-- Jobs: customer sees own; traders see open jobs and jobs they quoted on.
create policy "jobs visible" on public.jobs
  for select to authenticated using (
    customer_id = (select auth.uid())
    or (status = 'open' and public.my_role() = 'trader')
    or public.has_quoted(id)
  );

-- Quotes: trader sees own; customer sees quotes on own jobs.
create policy "quotes visible" on public.quotes
  for select to authenticated using (
    trader_id = (select auth.uid())
    or public.owns_job(job_id)
  );

create policy "invoices visible to parties" on public.invoices
  for select to authenticated using (
    trader_id = (select auth.uid()) or customer_id = (select auth.uid())
  );

create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers
create or replace function public.notify(p_user uuid, p_message text, p_link text)
returns void language sql security definer set search_path = ''
as $$ insert into public.notifications (user_id, message, link) values (p_user, p_message, p_link) $$;
revoke execute on function public.notify(uuid, text, text) from public, anon, authenticated;

-- Create a profile row when someone signs up (role and name come from sign-up metadata).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, postcode, trade, business_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'customer'),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(upper(new.raw_user_meta_data ->> 'postcode'), ''),
    nullif(new.raw_user_meta_data ->> 'trade', ''),
    nullif(new.raw_user_meta_data ->> 'business_name', '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- actions
create or replace function public.post_job(
  p_title text, p_description text, p_trade text, p_postcode text, p_timing text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if public.my_role() is distinct from 'customer' then
    raise exception 'Only customers can post jobs';
  end if;
  insert into public.jobs (customer_id, title, description, trade, postcode, timing)
  values ((select auth.uid()), trim(p_title), trim(p_description), p_trade, upper(trim(p_postcode)), p_timing)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_job(p_job uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs set status = 'cancelled'
  where id = p_job and customer_id = (select auth.uid()) and status = 'open';
  if not found then raise exception 'Job cannot be cancelled'; end if;
end;
$$;

-- Trader submits (or updates) a quote on an open job.
create or replace function public.submit_quote(
  p_job uuid, p_amount_pence integer, p_message text, p_earliest_start date)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_job public.jobs;
begin
  if public.my_role() is distinct from 'trader' then
    raise exception 'Only traders can quote';
  end if;
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or v_job.status <> 'open' then
    raise exception 'This job is no longer taking quotes';
  end if;
  insert into public.quotes (job_id, trader_id, amount_pence, message, earliest_start)
  values (p_job, (select auth.uid()), p_amount_pence, p_message, p_earliest_start)
  on conflict (job_id, trader_id) do update
    set amount_pence = excluded.amount_pence,
        message = excluded.message,
        earliest_start = excluded.earliest_start,
        status = 'pending',
        created_at = now();
  perform public.notify(v_job.customer_id,
    'New quote of £' || to_char(p_amount_pence / 100.0, 'FM999999990.00') || ' for "' || v_job.title || '"',
    '/jobs/' || p_job);
end;
$$;

create or replace function public.withdraw_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.quotes set status = 'withdrawn'
  where id = p_quote and trader_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'Quote cannot be withdrawn'; end if;
end;
$$;

-- Customer accepts one quote; the others are declined.
create or replace function public.accept_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_quote public.quotes; v_job public.jobs; r record;
begin
  select * into v_quote from public.quotes where id = p_quote;
  select * into v_job from public.jobs where id = v_quote.job_id for update;
  if v_job.id is null or v_job.customer_id <> (select auth.uid()) then
    raise exception 'Not your job';
  end if;
  if v_job.status <> 'open' or v_quote.status <> 'pending' then
    raise exception 'This quote can no longer be accepted';
  end if;
  update public.quotes set status = 'accepted' where id = p_quote;
  update public.jobs set status = 'assigned', accepted_quote_id = p_quote where id = v_job.id;
  perform public.notify(v_quote.trader_id,
    'Your quote for "' || v_job.title || '" was accepted', '/jobs/' || v_job.id);
  for r in select id, trader_id from public.quotes
           where job_id = v_job.id and id <> p_quote and status = 'pending' loop
    update public.quotes set status = 'declined' where id = r.id;
    perform public.notify(r.trader_id,
      'The customer chose another quote for "' || v_job.title || '"', '/jobs/' || v_job.id);
  end loop;
end;
$$;

-- Trader marks the job done and raises the invoice.
create or replace function public.create_invoice(
  p_job uuid, p_description text, p_net_pence integer, p_add_vat boolean, p_due_days integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_job public.jobs; v_quote public.quotes;
begin
  select * into v_job from public.jobs where id = p_job for update;
  select * into v_quote from public.quotes where id = v_job.accepted_quote_id;
  if v_quote.trader_id is distinct from (select auth.uid()) then
    raise exception 'Only the assigned trader can invoice this job';
  end if;
  if v_job.status <> 'assigned' then
    raise exception 'This job has already been invoiced';
  end if;
  if p_due_days not between 0 and 60 then
    raise exception 'Due date must be within 60 days';
  end if;
  insert into public.invoices (job_id, trader_id, customer_id, description, net_pence, vat_pence, due_date)
  values (p_job, v_quote.trader_id, v_job.customer_id, p_description, p_net_pence,
          case when p_add_vat then round(p_net_pence * 0.2) else 0 end,
          current_date + p_due_days);
  update public.jobs set status = 'invoiced' where id = p_job;
  perform public.notify(v_job.customer_id,
    'Invoice received for "' || v_job.title || '"', '/jobs/' || p_job);
end;
$$;

-- Customer pays. Card and bank transfer are simulated for now (marked paid immediately);
-- cash needs the trader to confirm they received it.
create or replace function public.pay_invoice(p_invoice uuid, p_method public.payment_method)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if v_inv.customer_id is distinct from (select auth.uid()) then
    raise exception 'Not your invoice';
  end if;
  if v_inv.status = 'paid' then raise exception 'Already paid'; end if;
  if p_method = 'cash' then
    update public.invoices set status = 'cash_pending', payment_method = 'cash', paid_at = now()
    where id = p_invoice;
    perform public.notify(v_inv.trader_id,
      'Customer says they paid cash. Please confirm you received it.', '/jobs/' || v_inv.job_id);
  else
    update public.invoices set status = 'paid', payment_method = p_method, paid_at = now()
    where id = p_invoice;
    update public.jobs set status = 'paid' where id = v_inv.job_id;
    perform public.notify(v_inv.trader_id, 'Invoice paid. Please rate your customer.', '/jobs/' || v_inv.job_id);
  end if;
end;
$$;

-- Trader confirms (or rejects) a cash payment.
create or replace function public.confirm_cash(p_invoice uuid, p_received boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if v_inv.trader_id is distinct from (select auth.uid()) or v_inv.status <> 'cash_pending' then
    raise exception 'Nothing to confirm';
  end if;
  if p_received then
    update public.invoices set status = 'paid' where id = p_invoice;  -- paid_at = when customer paid
    update public.jobs set status = 'paid' where id = v_inv.job_id;
    perform public.notify(v_inv.customer_id, 'Cash payment confirmed. Please rate your trader.', '/jobs/' || v_inv.job_id);
  else
    update public.invoices set status = 'unpaid', payment_method = null, paid_at = null where id = p_invoice;
    perform public.notify(v_inv.customer_id,
      'Your trader has not received the cash payment. Please check.', '/jobs/' || v_inv.job_id);
  end if;
end;
$$;

-- Trader nudges the customer (max once every 24 hours).
create or replace function public.send_reminder(p_invoice uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if v_inv.trader_id is distinct from (select auth.uid()) or v_inv.status <> 'unpaid' then
    raise exception 'No reminder needed';
  end if;
  if v_inv.last_reminder_at > now() - interval '24 hours' then
    raise exception 'You already sent a reminder in the last 24 hours';
  end if;
  update public.invoices set last_reminder_at = now() where id = p_invoice;
  perform public.notify(v_inv.customer_id,
    'Payment reminder: £' || to_char(v_inv.total_pence / 100.0, 'FM999999990.00') ||
    ' due ' || to_char(v_inv.due_date, 'DD Mon YYYY'), '/jobs/' || v_inv.job_id);
end;
$$;

-- Automatic reminders: 2 days before due, on the due date, then every 3 days overdue.
create or replace function public.send_auto_reminders()
returns void language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in
    select * from public.invoices
    where status = 'unpaid'
      and (due_date - current_date = 2 or due_date = current_date
           or (current_date > due_date and (current_date - due_date) % 3 = 0))
      and (last_reminder_at is null or last_reminder_at < now() - interval '20 hours')
  loop
    update public.invoices set last_reminder_at = now() where id = r.id;
    perform public.notify(r.customer_id,
      case when r.due_date < current_date
        then 'Overdue: £' || to_char(r.total_pence / 100.0, 'FM999999990.00') || ' was due ' || to_char(r.due_date, 'DD Mon') || '. Late payment lowers your Trust Score.'
        else 'Reminder: £' || to_char(r.total_pence / 100.0, 'FM999999990.00') || ' due ' || to_char(r.due_date, 'DD Mon') end,
      '/jobs/' || r.job_id);
    if r.due_date < current_date then
      perform public.notify(r.trader_id, 'Invoice overdue. We have reminded the customer.', '/jobs/' || r.job_id);
    end if;
  end loop;
end;
$$;
revoke execute on function public.send_auto_reminders() from public, anon, authenticated;
select cron.schedule('fixfare-payment-reminders', '0 9 * * *', $$select public.send_auto_reminders()$$);

-- Either party reviews the other once the invoice is paid.
create or replace function public.leave_review(p_job uuid, p_rating integer, p_comment text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices; v_me uuid := (select auth.uid()); v_other uuid;
begin
  select * into v_inv from public.invoices where job_id = p_job;
  if v_inv.status is distinct from 'paid' then
    raise exception 'You can review once the invoice is paid';
  end if;
  if v_me = v_inv.customer_id then v_other := v_inv.trader_id;
  elsif v_me = v_inv.trader_id then v_other := v_inv.customer_id;
  else raise exception 'Not your job';
  end if;
  insert into public.reviews (job_id, reviewer_id, reviewee_id, rating, comment)
  values (p_job, v_me, v_other, p_rating, nullif(trim(p_comment), ''));
  perform public.notify(v_other, 'You received a new ' || p_rating || '-star review', '/profile/' || v_other);
end;
$$;

-- Only signed-in users may call the action functions.
revoke execute on function public.post_job(text, text, text, text, text) from public, anon;
revoke execute on function public.cancel_job(uuid) from public, anon;
revoke execute on function public.submit_quote(uuid, integer, text, date) from public, anon;
revoke execute on function public.withdraw_quote(uuid) from public, anon;
revoke execute on function public.accept_quote(uuid) from public, anon;
revoke execute on function public.create_invoice(uuid, text, integer, boolean, integer) from public, anon;
revoke execute on function public.pay_invoice(uuid, public.payment_method) from public, anon;
revoke execute on function public.confirm_cash(uuid, boolean) from public, anon;
revoke execute on function public.send_reminder(uuid) from public, anon;
revoke execute on function public.leave_review(uuid, integer, text) from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.has_quoted(uuid) from public, anon;
revoke execute on function public.owns_job(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
