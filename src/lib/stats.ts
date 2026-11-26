import { addDays, addMonths, monthKey, today } from './dates'
import type { Category, Entry, Goal, Recurring } from './types'

export interface MonthTotals {
  month: string
  income: number
  spent: number
  saved: number
}

const round = (n: number) => Math.round(n * 100) / 100

export function totalsFor(entries: Entry[], month: string): MonthTotals {
  let income = 0
  let spent = 0
  for (const e of entries) {
    if (monthKey(e.date) !== month) continue
    if (e.kind === 'income') income += e.amount
    else spent += e.amount
  }
  return { month, income: round(income), spent: round(spent), saved: round(income - spent) }
}

/** The last `n` months ending with `endMonth`, oldest first. */
export function monthSeries(entries: Entry[], endMonth: string, n = 12): MonthTotals[] {
  return Array.from({ length: n }, (_, i) => totalsFor(entries, addMonths(endMonth, i - (n - 1))))
}

export interface CategoryUse {
  category: Category
  spent: number
  /** spent / budget, or null without a budget */
  share: number | null
}

export function spendByCategory(entries: Entry[], categories: Category[], month: string): CategoryUse[] {
  const sums = new Map<string, number>()
  for (const e of entries) {
    if (e.kind !== 'expense' || monthKey(e.date) !== month) continue
    sums.set(e.categoryId, (sums.get(e.categoryId) ?? 0) + e.amount)
  }
  return categories
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const spent = round(sums.get(c.id) ?? 0)
      return { category: c, spent, share: c.budget ? spent / c.budget : null }
    })
    .sort((a, b) => b.spent - a.spent)
}

/** Categories at 80% or more of their monthly budget. */
export function budgetAlerts(uses: CategoryUse[]): CategoryUse[] {
  return uses.filter((u) => u.share !== null && u.share >= 0.8)
}

/** Recurring items due within `days` days, or already overdue. */
export function dueSoon(items: Recurring[], days = 7): Recurring[] {
  const limit = addDays(today(), days)
  return items.filter((r) => r.nextDue <= limit).sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1))
}

export function balance(opening: number, entries: Entry[]): number {
  let b = opening
  for (const e of entries) b += e.kind === 'income' ? e.amount : -e.amount
  return round(b)
}

/**
 * Average saved per month over the last `n` complete months that have entries.
 * The current month is left out because it is still running.
 */
export function averageMonthly(entries: Entry[], n = 6): { income: number; spent: number; saved: number; months: number } {
  const current = monthKey(today())
  const months = monthSeries(entries, addMonths(current, -1), n).filter((m) => m.income > 0 || m.spent > 0)
  if (!months.length) return { income: 0, spent: 0, saved: 0, months: 0 }
  const sum = months.reduce((a, m) => ({ income: a.income + m.income, spent: a.spent + m.spent }), { income: 0, spent: 0 })
  const income = round(sum.income / months.length)
  const spent = round(sum.spent / months.length)
  return { income, spent, saved: round(income - spent), months: months.length }
}

/** Plain savings, no interest or inflation: balance after `months` months. */
export function project(start: number, monthly: number, months: number): number {
  return round(start + monthly * months)
}

export interface GoalOutlook {
  goal: Goal
  remaining: number
  /** Months until reached at the current rate; 0 if already reached; null if never at this rate. */
  monthsAtRate: number | null
  /** The month it is reached at the current rate. */
  reachedOn: string | null
  /** Monthly saving needed to hit the target date; null without a date. */
  neededPerMonth: number | null
  onTrack: boolean | null
}

export function goalOutlook(goal: Goal, current: number, monthly: number): GoalOutlook {
  const remaining = round(Math.max(0, goal.target - current))
  const thisMonth = monthKey(today())
  let monthsAtRate: number | null
  if (remaining === 0) monthsAtRate = 0
  else if (monthly <= 0) monthsAtRate = null
  else monthsAtRate = Math.ceil(remaining / monthly)
  const reachedOn = monthsAtRate === null ? null : addMonths(thisMonth, monthsAtRate)
  let neededPerMonth: number | null = null
  let onTrack: boolean | null = null
  if (goal.targetDate) {
    const target = monthKey(goal.targetDate)
    const [ty, tm] = target.split('-').map(Number)
    const [cy, cm] = thisMonth.split('-').map(Number)
    const left = Math.max(1, (ty - cy) * 12 + (tm - cm))
    neededPerMonth = round(remaining / left)
    onTrack = remaining === 0 || (reachedOn !== null && reachedOn <= target)
  }
  return { goal, remaining, monthsAtRate, reachedOn, neededPerMonth, onTrack }
}
