-- Household expenses: shared household, categories with budgets, entries,
-- recurring reminders and savings goals. Every row belongs to a household,
-- and only members of that household can read or change it.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our household',
  currency text not null default 'MYR' check (char_length(currency) = 3),
  opening_balance numeric(14,2) not null default 0,
  invite_code text unique default substr(md5(gen_random_uuid()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members(user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  monthly_budget numeric(14,2) check (monthly_budget is null or monthly_budget >= 0),
  created_at timestamptz not null default now()
);
create index on public.categories(household_id);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid not null references public.categories(id) on delete restrict,
  note text not null default '',
  occurred_on date not null default current_date,
  entered_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.entries(household_id, occurred_on desc);

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid not null references public.categories(id) on delete restrict,
  cadence text not null check (cadence in ('weekly','monthly','yearly')),
  next_due date not null,
  created_at timestamptz not null default now()
);
create index on public.recurring_items(household_id, next_due);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now()
);
create index on public.goals(household_id);

-- Membership check used by every policy.
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.recurring_items enable row level security;
alter table public.goals enable row level security;

create policy "members read household" on public.households for select using (public.is_member(id));
create policy "members update household" on public.households for update using (public.is_member(id));

create policy "members see each other" on public.household_members for select using (public.is_member(household_id));
create policy "members rename themselves" on public.household_members for update using (user_id = auth.uid());

create policy "members manage categories" on public.categories for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage entries" on public.entries for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage recurring" on public.recurring_items for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage goals" on public.goals for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- First sign-in: make a household with the preset categories.
create or replace function public.create_household(p_name text, p_currency text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into households(name, currency) values (coalesce(nullif(p_name,''), 'Our household'), p_currency) returning id into hid;
  insert into household_members(household_id, user_id, display_name, email)
    values (hid, auth.uid(), p_display_name, (select email from auth.users where id = auth.uid()));
  insert into categories(household_id, name, kind) values
    (hid,'Salary','income'),(hid,'Other income','income'),(hid,'Housing','expense'),
    (hid,'Groceries','expense'),(hid,'Eating out','expense'),(hid,'Transport','expense'),
    (hid,'Utilities and phone','expense'),(hid,'Health','expense'),(hid,'Shopping','expense'),
    (hid,'Leisure','expense'),(hid,'Other','expense');
  return hid;
end $$;

-- Partner joins with the invite code shown in Settings.
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into hid from households where invite_code = lower(trim(p_code));
  if hid is null then raise exception 'No household has that invite code'; end if;
  insert into household_members(household_id, user_id, display_name, email)
    values (hid, auth.uid(), p_display_name, (select email from auth.users where id = auth.uid()))
    on conflict do nothing;
  return hid;
end $$;

-- Record a recurring item as an entry and move it to its next due date, in one step.
create or replace function public.confirm_recurring(p_id uuid, p_amount numeric)
returns void language plpgsql security invoker set search_path = public as $$
declare r recurring_items;
begin
  select * into r from recurring_items where id = p_id for update;
  if r.id is null then raise exception 'not found'; end if;
  insert into entries(household_id, kind, amount, category_id, note, occurred_on)
    values (r.household_id, r.kind, p_amount, r.category_id, r.name, least(r.next_due, current_date));
  update recurring_items set next_due = case r.cadence
      when 'weekly' then r.next_due + 7
      when 'monthly' then (r.next_due + interval '1 month')::date
      else (r.next_due + interval '1 year')::date end
    where id = p_id;
end $$;

revoke execute on function public.create_household(text,text,text) from anon;
revoke execute on function public.join_household(text,text) from anon;
revoke execute on function public.confirm_recurring(uuid,numeric) from anon;
