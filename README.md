# Household expenses

A shared expense tracker for a household: one joint pot, a login each, monthly
budgets per category, reminders for regular items, and a savings outlook.

## Run it

```sh
npm install
npm run dev
```

With no Supabase keys set, the app keeps entries **in your browser** and starts empty,
so you can try it straight away. Settings can load a year of sample data
to see the pages full, or clear everything.

## Connect Supabase (real data, two logins)

1. Create a Supabase project and run `supabase/migrations/20261126000000_init.sql`
   (SQL editor, or `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. In Supabase Auth, add your site URL to the redirect list (email sign-in links).
4. The first person signs in and creates the household. The second signs in and
   joins with the invite code shown in Settings.

## Deploy

Netlify builds with `npm run build` and serves `dist` (see `netlify.toml`).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Netlify site settings.

## What is in the draft

- **Overview**: this month's income, spending and what's left; each budget
  against its limit; latest entries; a 12-month trend; where the money went.
- **Entries**: the full list by month, filtered by category or person.
- **Budgets**: editable categories with a monthly limit each. Alerts at 80%.
- **Regular items**: salary, rent and bills remind you when due; one tap records them.
- **Savings**: projection from your real monthly average (1, 5, 10 years),
  what-if sliders for income and spending, and goals with target dates.
  Plain savings: no interest or inflation.
- **Settings**: household name, currency, starting savings, invite code.

Not built yet: the reminder and budget **emails** (a scheduled Supabase
function plus an email service). The in-site reminders work now.

Design: Hallmark, Dose theme. Tokens in `src/tokens.css`, screen styles in `src/app.css`.
