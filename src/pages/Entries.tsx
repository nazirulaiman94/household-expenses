import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QuickAdd } from '../components/QuickAdd'
import { EmptyState, Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatDay, formatMonth, monthKey, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'

export function Entries() {
  const { household, categories, store, changed } = useApp()
  const cur = household.currency
  const [params, setParams] = useSearchParams()
  const thisMonth = monthKey(today())
  const month = /^\d{4}-\d{2}$/.test(params.get('m') ?? '') ? params.get('m')! : thisMonth
  const cat = params.get('c') ?? ''
  const who = params.get('who') ?? ''
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useLoad((s) => s.entries(monthRange(month).from, monthRange(month).to), [month])

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  async function remove(id: string) {
    if (confirming !== id) {
      setConfirming(id)
      return
    }
    setError('')
    try {
      await store.deleteEntry(id)
      setConfirming(null)
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that entry.')
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown'
  const memberName = (id: string) => household.members.find((m) => m.id === id)?.name ?? ''

  return (
    <>
      <div className="page-head">
        <h1>Entries</h1>
        {!adding && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            Add entry
          </button>
        )}
      </div>
      {adding && (
        <QuickAdd
          onClose={() => setAdding(false)}
          onSaved={(message, date) => {
            const m = monthKey(date)
            navigate(m === thisMonth ? '/overview' : `/overview?m=${m}`, { state: { added: message } })
          }}
        />
      )}

      <div className="filters" role="group" aria-label="Filter entries">
        <div className="field">
          <label htmlFor="f-month">Month</label>
          <select id="f-month" value={month} onChange={(e) => set('m', e.target.value === thisMonth ? '' : e.target.value)}>
            {Array.from({ length: 25 }, (_, i) => addMonths(thisMonth, 1 - i)).map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-cat">Category</label>
          <select id="f-cat" value={cat} onChange={(e) => set('c', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-who">Added by</label>
          <select id="f-who" value={who} onChange={(e) => set('who', e.target.value)}>
            <option value="">Either of you</option>
            {household.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Loaded load={load} what="entries" rows={10}>
        {(all) => {
          const rows = all.filter((e) => (!cat || e.categoryId === cat) && (!who || e.enteredBy === who))
          if (!all.length)
            return (
              <EmptyState action={<button type="button" className="btn" onClick={() => setAdding(true)}>Add an entry</button>}>
                Nothing recorded in {formatMonth(month)}.
              </EmptyState>
            )
          if (!rows.length)
            return (
              <EmptyState action={<button type="button" className="btn" onClick={() => setParams(month === thisMonth ? {} : { m: month })}>Clear filters</button>}>
                No entries match these filters in {formatMonth(month)}.
              </EmptyState>
            )
          const inSum = rows.filter((e) => e.kind === 'income').reduce((a, e) => a + e.amount, 0)
          const outSum = rows.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0)
          return (
            <>
              <table className="table table--stack entries-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">What</th>
                    <th scope="col" className="hide-s">Category</th>
                    <th scope="col" className="hide-s">By</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap area-date">{formatDay(e.date)}</td>
                      <th scope="row" className="area-what">
                        {e.note || catName(e.categoryId)}
                        <span className="show-s muted small"> {catName(e.categoryId)}</span>
                      </th>
                      <td className="hide-s">{catName(e.categoryId)}</td>
                      <td className="hide-s">{memberName(e.enteredBy)}</td>
                      <td className={`num area-amt${e.kind === 'income' ? ' is-income' : ''}`}>
                        {e.kind === 'income' ? '+' : ''}
                        {money(e.amount, cur)}
                      </td>
                      <td className="row-actions area-act">
                        <button
                          type="button"
                          className={`btn btn--small ${confirming === e.id ? 'btn--danger' : 'btn--quiet'}`}
                          onClick={() => remove(e.id)}
                          onBlur={() => setConfirming((c) => (c === e.id ? null : c))}
                        >
                          {confirming === e.id ? 'Confirm delete' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2} className="area-what">{rows.length} entries</th>
                    <td className="hide-s" colSpan={2} />
                    <td className="num area-amt">
                      <span className="is-income">+{money(inSum, cur)}</span>
                      <br />
                      {money(outSum, cur)}
                    </td>
                    <td className="hide-s" />
                  </tr>
                </tfoot>
              </table>
              {error && <p className="status status--error" role="alert">{error}</p>}
            </>
          )
        }}
      </Loaded>
    </>
  )
}
