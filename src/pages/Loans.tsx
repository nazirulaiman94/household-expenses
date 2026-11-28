import { useState, type FormEvent } from 'react'
import { EmptyState, Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatMonth, monthKey, today } from '../lib/dates'
import { money } from '../lib/money'
import type { Lender, Loan } from '../lib/types'

const LENDER: Record<Lender, string> = { bank: 'Bank loan', bnpl: 'Buy now, pay later' }

/** The month the final instalment falls in, or null once paid off. */
function lastMonth(l: Loan, thisMonth: string): string | null {
  if (l.monthsLeft <= 0) return null
  return addMonths(thisMonth, l.lastPaid === thisMonth ? l.monthsLeft : l.monthsLeft - 1)
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

function LoanForm({ loan, onDone }: { loan?: Loan; onDone: () => void }) {
  const { store, categories, household, changed } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const options = categories.filter((c) => c.kind === 'expense')
  const guess = options.find((c) => /loan|debt|instal|akpk|bnpl/i.test(c.name)) ?? options.find((c) => c.name === 'Other') ?? options[0]

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = new FormData(ev.currentTarget)
    const name = String(d.get('name')).trim()
    const monthly = Number(String(d.get('monthly')).replace(/,/g, ''))
    const monthsLeft = Number(d.get('months'))
    const dueRaw = String(d.get('due')).trim()
    const dueDay = dueRaw ? Number(dueRaw) : null
    if (!name) return setError('Give it a name, such as Car loan or Atome.')
    if (!Number.isFinite(monthly) || monthly <= 0) return setError('Enter the monthly instalment, above zero.')
    if (!Number.isInteger(monthsLeft) || monthsLeft < 0 || monthsLeft > 600) return setError('Months left must be a whole number, such as 24.')
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return setError('Due day must be between 1 and 31, or empty.')
    setError('')
    setBusy(true)
    try {
      await store.saveLoan({ id: loan?.id, name, lender: d.get('lender') as Lender, monthly, monthsLeft, dueDay, categoryId: String(d.get('category')) })
      changed()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="well inline-form" onSubmit={submit} noValidate>
      <h2>{loan ? `Edit ${loan.name}` : 'New loan'}</h2>
      <div className="inline-form__fields">
        <div className="field">
          <label htmlFor="l-name">Name</label>
          <input id="l-name" name="name" defaultValue={loan?.name} autoComplete="off" placeholder="Car loan, Atome, PTPTN" />
        </div>
        <div className="field">
          <label htmlFor="l-lender">Type</label>
          <select id="l-lender" name="lender" defaultValue={loan?.lender ?? 'bank'}>
            <option value="bank">{LENDER.bank}</option>
            <option value="bnpl">{LENDER.bnpl}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="l-monthly">Monthly instalment, {household.currency}</label>
          <input id="l-monthly" name="monthly" inputMode="decimal" className="num" defaultValue={loan?.monthly} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="l-months">Months left to pay</label>
          <input id="l-months" name="months" inputMode="numeric" className="num" defaultValue={loan?.monthsLeft} autoComplete="off" />
          <p className="field__help">Count this month if you haven't paid it yet.</p>
        </div>
        <div className="field">
          <label htmlFor="l-due">Due on day, optional</label>
          <input id="l-due" name="due" inputMode="numeric" className="num" defaultValue={loan?.dueDay ?? ''} autoComplete="off" placeholder="e.g. 15" />
        </div>
        <div className="field">
          <label htmlFor="l-cat">Record payments under</label>
          <select id="l-cat" name="category" defaultValue={loan?.categoryId ?? guess?.id}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="field__help field__help--error" role="alert">{error}</p>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : loan ? 'Save changes' : 'Add loan'}</button>
        <button type="button" className="btn btn--quiet" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

export function Loans() {
  const { store, household, changed } = useApp()
  const cur = household.currency
  const thisMonth = monthKey(today())
  const load = useLoad((s) => s.loans())
  const [editing, setEditing] = useState<Loan | 'new' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(id: string, fn: () => Promise<void>) {
    setError('')
    setBusy(id)
    try {
      await fn()
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Loans</h1>
          <p className="muted">Bank loans and buy-now-pay-later plans. Mark each month's instalment as paid and the balance and months left update by themselves.</p>
        </div>
        {editing === null && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            Add loan
          </button>
        )}
      </div>

      {editing !== null && <LoanForm loan={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}

      <Loaded load={load} what="your loans" rows={4}>
        {(loans) => {
          if (!loans.length)
            return (
              <EmptyState action={<button type="button" className="btn" onClick={() => setEditing('new')}>Add your first loan</button>}>
                No loans yet. Add a car loan, personal loan or a BNPL plan to see what's left and when you'll be debt-free.
              </EmptyState>
            )
          const active = loans.filter((l) => l.monthsLeft > 0)
          const owed = active.reduce((a, l) => a + l.monthly * l.monthsLeft, 0)
          const perMonth = active.reduce((a, l) => a + l.monthly, 0)
          const dueNow = active.filter((l) => l.lastPaid !== thisMonth).reduce((a, l) => a + l.monthly, 0)
          const finish = active.map((l) => lastMonth(l, thisMonth)!).sort().at(-1)
          return (
            <>
              <dl className="figures loans__figures">
                <div className="figures__key">
                  <dt>Still to pay</dt>
                  <dd className="num">{money(owed, cur)}</dd>
                </div>
                <div>
                  <dt>Each month</dt>
                  <dd className="num">{money(perMonth, cur)}</dd>
                </div>
                <div>
                  <dt>{dueNow > 0 ? `Still due in ${formatMonth(thisMonth, 'short')}` : 'Debt-free by'}</dt>
                  <dd className="num">{dueNow > 0 ? money(dueNow, cur) : finish ? formatMonth(finish, 'short') : 'Now'}</dd>
                </div>
              </dl>
              {error && <p className="status status--error" role="alert">{error}</p>}
              <ul className="loan-list">
                {loans.map((l) => {
                  const paidNow = l.lastPaid === thisMonth
                  const done = l.monthsLeft <= 0
                  const end = lastMonth(l, thisMonth)
                  return (
                    <li key={l.id} className={`loan${done ? ' is-done' : ''}`}>
                      <div className="loan__head">
                        <div>
                          <h2 className="loan__name">{l.name}</h2>
                          <p className="loan__meta muted small">
                            {LENDER[l.lender]}
                            {l.dueDay && !done ? ` · due on the ${ordinal(l.dueDay)}` : ''}
                          </p>
                        </div>
                        {done ? <span className="paid-mark">Paid off</span> : paidNow ? <span className="loan__status">Paid for {formatMonth(thisMonth, 'short')}</span> : null}
                      </div>
                      <dl className="loan__nums">
                        <div>
                          <dt>Left to pay</dt>
                          <dd className="num">{money(l.monthly * l.monthsLeft, cur)}</dd>
                        </div>
                        <div>
                          <dt>Monthly</dt>
                          <dd className="num">{money(l.monthly, cur)}</dd>
                        </div>
                        <div>
                          <dt>Months left</dt>
                          <dd className="num">{l.monthsLeft}</dd>
                        </div>
                        <div>
                          <dt>Last payment</dt>
                          <dd>{end ? formatMonth(end, 'short') : 'Done'}</dd>
                        </div>
                      </dl>
                      <div className="loan__actions">
                        {!done && !paidNow && (
                          <button type="button" className="btn btn--primary" disabled={busy === l.id} onClick={() => run(l.id, () => store.payLoan(l.id))}>
                            {busy === l.id ? 'Saving…' : `Mark ${formatMonth(thisMonth, 'short')} as paid`}
                          </button>
                        )}
                        {paidNow && (
                          <button type="button" className="btn" disabled={busy === l.id} onClick={() => run(l.id, () => store.undoLoanPayment(l.id))}>
                            Undo this month
                          </button>
                        )}
                        <button type="button" className="btn btn--quiet" onClick={() => setEditing(l)}>Edit</button>
                        <button
                          type="button"
                          className={`btn ${confirming === l.id ? 'btn--danger' : 'btn--quiet'}`}
                          onBlur={() => setConfirming((c) => (c === l.id ? null : c))}
                          onClick={() => (confirming === l.id ? run(l.id, () => store.deleteLoan(l.id)) : setConfirming(l.id))}
                        >
                          {confirming === l.id ? 'Confirm delete' : 'Delete'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="muted small">Marking a month as paid also adds the instalment to your entries, so it counts in that month's spending.</p>
            </>
          )
        }}
      </Loaded>
    </>
  )
}
