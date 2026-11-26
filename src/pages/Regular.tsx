import { useState, type FormEvent } from 'react'
import { EmptyState, Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { formatDay, today } from '../lib/dates'
import { money } from '../lib/money'
import type { Cadence, Kind, Recurring } from '../lib/types'

const CADENCE: Record<Cadence, string> = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' }

function RegularForm({ item, onDone }: { item?: Recurring; onDone: () => void }) {
  const { store, categories, household, changed } = useApp()
  const [kind, setKind] = useState<Kind>(item?.kind ?? 'expense')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const options = categories.filter((c) => c.kind === kind)

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = new FormData(ev.currentTarget)
    const name = String(d.get('name')).trim()
    const amount = Number(String(d.get('amount')).replace(/,/g, ''))
    if (!name) return setError('Give it a name, such as Rent.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter the usual amount, above zero.')
    setError('')
    setBusy(true)
    try {
      await store.saveRecurring({
        id: item?.id,
        name,
        kind,
        amount,
        categoryId: String(d.get('category')),
        cadence: d.get('cadence') as Cadence,
        nextDue: String(d.get('due') || today()),
      })
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
      <h2>{item ? `Edit ${item.name}` : 'New regular item'}</h2>
      <div className="inline-form__fields">
        <div className="field">
          <label htmlFor="r-name">Name</label>
          <input id="r-name" name="name" defaultValue={item?.name} autoComplete="off" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="r-kind">Kind</label>
          <select id="r-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="expense">A payment</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-amount">Usual amount, {household.currency}</label>
          <input id="r-amount" name="amount" inputMode="decimal" className="num" defaultValue={item?.amount} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="r-cat">Category</label>
          <select id="r-cat" name="category" defaultValue={item?.kind === kind ? item?.categoryId : options[0]?.id} key={kind}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-cadence">Repeats</label>
          <select id="r-cadence" name="cadence" defaultValue={item?.cadence ?? 'monthly'}>
            {(Object.keys(CADENCE) as Cadence[]).map((c) => (
              <option key={c} value={c}>{CADENCE[c]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-due">Next due</label>
          <input id="r-due" name="due" type="date" defaultValue={item?.nextDue ?? today()} />
        </div>
      </div>
      <p className="field__help field__help--error" role="alert">{error}</p>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button>
        <button type="button" className="btn btn--quiet" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

export function Regular() {
  const { store, household, categories, changed } = useApp()
  const cur = household.currency
  const load = useLoad((s) => s.recurring())
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<void>) {
    setError('')
    try {
      await fn()
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Regular items</h1>
          <p className="muted">Salary, rent and bills. Each one reminds you when it is due, and you confirm it with one tap.</p>
        </div>
        {editing === null && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            Add regular item
          </button>
        )}
      </div>
      {editing !== null && <RegularForm item={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      <Loaded load={load} what="regular items" rows={5}>
        {(items) =>
          !items.length ? (
            <EmptyState action={<button type="button" className="btn" onClick={() => setEditing('new')}>Add your salary or rent</button>}>
              No regular items yet. Add the payments that come round every month so the site can remind you.
            </EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="hide-s">Repeats</th>
                  <th scope="col" className="hide-s">Next due</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={r.nextDue < today() ? 'is-over' : ''}>
                    <th scope="row">
                      {r.name}
                      <span className="muted small"> {categories.find((c) => c.id === r.categoryId)?.name}</span>
                      <span className="show-s small">{r.nextDue < today() ? 'Overdue, ' : 'Due '}{formatDay(r.nextDue)}</span>
                    </th>
                    <td className="hide-s">{CADENCE[r.cadence]}</td>
                    <td className="nowrap hide-s">{r.nextDue < today() ? `Overdue, ${formatDay(r.nextDue)}` : formatDay(r.nextDue)}</td>
                    <td className={`num${r.kind === 'income' ? ' is-income' : ''}`}>{r.kind === 'income' ? '+' : ''}{money(r.amount, cur)}</td>
                    <td className="row-actions">
                      <button type="button" className="btn btn--small" onClick={() => run(() => store.confirmRecurring(r.id, r.amount))}>
                        {r.kind === 'income' ? 'Received' : 'Paid'}
                      </button>
                      <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(r)}>Edit</button>
                      <button
                        type="button"
                        className={`btn btn--small ${confirming === r.id ? 'btn--danger' : 'btn--quiet'}`}
                        onBlur={() => setConfirming((c) => (c === r.id ? null : c))}
                        onClick={() => (confirming === r.id ? run(() => store.deleteRecurring(r.id)) : setConfirming(r.id))}
                      >
                        {confirming === r.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Loaded>
      {error && <p className="status status--error" role="alert">{error}</p>}
    </>
  )
}
