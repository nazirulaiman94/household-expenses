-- Loans and buy-now-pay-later plans, paid in equal monthly instalments.
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  lender text not null default 'bank' check (lender in ('bank', 'bnpl')),
  monthly_amount numeric(14,2) not null check (monthly_amount > 0),
  months_left integer not null check (months_left >= 0),
  due_day smallint check (due_day between 1 and 31),
  category_id uuid not null references public.categories(id),
  last_paid_month text,
  last_entry_id uuid references public.entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.loans(household_id);
alter table public.loans enable row level security;
create policy "members manage loans" on public.loans for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Record this month's instalment as an entry and take one month off, in one step.
create or replace function public.pay_loan(p_id uuid, p_month text, p_on date)
returns void language plpgsql security invoker as $$
declare l loans; e uuid;
begin
  select * into l from loans where id = p_id for update;
  if not found then raise exception 'Loan not found'; end if;
  if l.last_paid_month = p_month then raise exception 'This month is already marked as paid.'; end if;
  if l.months_left <= 0 then raise exception 'This loan is already paid off.'; end if;
  insert into entries (household_id, kind, amount, category_id, note, occurred_on)
    values (l.household_id, 'expense', l.monthly_amount, l.category_id, l.name || ' instalment', p_on)
    returning id into e;
  update loans set months_left = months_left - 1, last_paid_month = p_month, last_entry_id = e where id = p_id;
end $$;

create or replace function public.undo_loan_payment(p_id uuid, p_month text)
returns void language plpgsql security invoker as $$
declare l loans;
begin
  select * into l from loans where id = p_id for update;
  if not found or l.last_paid_month is distinct from p_month then return; end if;
  if l.last_entry_id is not null then delete from entries where id = l.last_entry_id; end if;
  update loans set months_left = months_left + 1, last_paid_month = null, last_entry_id = null where id = p_id;
end $$;
