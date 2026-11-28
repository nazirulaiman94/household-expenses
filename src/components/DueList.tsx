import { useState } from 'react'
import { useApp } from '../lib/context'
import { daysBetween, formatDay, today } from '../lib/dates'
import { money } from '../lib/money'
import type { CategoryUse } from '../lib/stats'
import type { Recurring } from '../lib/types'

function dueText(d: string): string {
  const n = daysBetween(today(), d)
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return `Due ${formatDay(d)}`
}

/** In-site reminders: regular items due within a week, and budgets at 80% or more. */
export function DueList({ due, alerts }: { due: Recurring[]; alerts: CategoryUse[] }) {
  const { store, household, changed } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (!due.length && !alerts.length) return null

  async function act(r: Recurring, what: 'confirm' | 'skip') {
    setBusy(r.id)
    setError('')
    try {
      if (what === 'confirm') await store.confirmRecurring(r.id, r.amount)
      else await store.skipRecurring(r.id)
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that item.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="due" aria-labelledby="due-h">
      <h2 id="due-h">Needs a look</h2>
      <ul className="due__list">
        {due.map((r) => {
          const overdue = r.nextDue < today()
          return (
            <li key={r.id} className={`due__item${overdue ? ' is-overdue' : ''}`}>
              <span className="due__name">{r.name}</span>
              <span className="due__when">{dueText(r.nextDue)}</span>
              <span className="num due__amt">{r.kind === 'income' ? '+' : ''}{money(r.amount, household.currency)}</span>
              <span className="due__actions">
                <button type="button" className="btn btn--small" disabled={busy === r.id} onClick={() => act(r, 'confirm')}>
                  {r.kind === 'income' ? 'Received' : 'Paid'}
                </button>
                <button type="button" className="btn btn--small btn--quiet" disabled={busy === r.id} onClick={() => act(r, 'skip')}>
                  Skip this time
                </button>
              </span>
            </li>
          )
        })}
        {alerts.map((a) => (
          <li key={a.category.id} className={`due__item${(a.share ?? 0) > 1.0001 ? ' is-overdue' : ''}`}>
            <span className="due__name">{a.category.name} budget</span>
            <span className="due__when">
              {(a.share ?? 0) > 1.0001 ? 'Over budget' : (a.share ?? 0) >= 0.9999 ? 'Used up' : `${Math.round((a.share ?? 0) * 100)}% used`}
            </span>
            <span className="num due__amt">
              {money(a.spent, household.currency)} of {money(a.category.budget ?? 0, household.currency, 0)}
            </span>
            <span className="due__actions" />
          </li>
        ))}
      </ul>
      {error && <p className="status status--error" role="alert">{error}</p>}
    </section>
  )
}
