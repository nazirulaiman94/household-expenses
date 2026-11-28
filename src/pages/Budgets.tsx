import { useState, type FormEvent } from 'react'
import { Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { monthKey, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'
import { spendByCategory } from '../lib/stats'
import type { Category, Kind } from '../lib/types'

function BudgetRow({ c, spent }: { c: Category; spent: number | null }) {
  const { store, household, changed } = useApp()
  const [name, setName] = useState(c.name)
  const [budget, setBudget] = useState(c.budget?.toString() ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'confirm'>('idle')
  const [error, setError] = useState('')
  const dirty = name.trim() !== c.name || (budget.trim() === '' ? null : Number(budget)) !== c.budget

  async function save() {
    const b = budget.trim() === '' ? null : Number(budget)
    if (!name.trim()) return setError('Give the category a name.')
    if (b !== null && (!Number.isFinite(b) || b < 0)) return setError('Budget must be a positive number, or empty for none.')
    setError('')
    setState('saving')
    try {
      await store.saveCategory({ id: c.id, name: name.trim(), kind: c.kind, budget: b })
      setState('saved')
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setState('idle')
    }
  }

  async function remove() {
    if (state !== 'confirm') return setState('confirm')
    try {
      await store.deleteCategory(c.id)
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
      setState('idle')
    }
  }

  return (
    <tr>
      <th scope="row" className="area-name">
        <label className="visually-hidden" htmlFor={`n-${c.id}`}>Category name</label>
        <input id={`n-${c.id}`} className="input--inline" value={name} onChange={(e) => { setName(e.target.value); setState('idle') }} />
        {error && <span className="field__help--error small" role="alert"> {error}</span>}
      </th>
      {c.kind === 'expense' ? (
        <>
          <td className="num area-spent" data-label="This month">{spent !== null ? money(spent, household.currency) : ''}</td>
          <td className="num area-budget">
            <label className="visually-hidden" htmlFor={`b-${c.id}`}>Monthly budget for {c.name}</label>
            <span className="show-s stack-label" aria-hidden="true">Monthly budget</span>
            <input id={`b-${c.id}`} className="input--inline num" inputMode="decimal" placeholder="None" value={budget} onChange={(e) => { setBudget(e.target.value); setState('idle') }} />
          </td>
        </>
      ) : (
        <td colSpan={2} />
      )}
      <td className="row-actions area-act">
        <button type="button" className="btn btn--small" disabled={!dirty || state === 'saving'} onClick={save}>
          {state === 'saving' ? 'Saving…' : state === 'saved' && !dirty ? 'Saved' : 'Save'}
        </button>
        <button type="button" className={`btn btn--small ${state === 'confirm' ? 'btn--danger' : 'btn--quiet'}`} onClick={remove} onBlur={() => state === 'confirm' && setState('idle')}>
          {state === 'confirm' ? 'Confirm delete' : 'Delete'}
        </button>
      </td>
    </tr>
  )
}

function AddCategory() {
  const { store, changed } = useApp()
  const [error, setError] = useState('')
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const form = ev.currentTarget
    const d = new FormData(form)
    const name = String(d.get('name')).trim()
    const raw = String(d.get('budget')).trim()
    const budget = raw ? Number(raw) : null
    const kind: Kind = 'expense'
    if (!name) return setError('Give the category a name.')
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return setError('Budget must be a positive number, or empty.')
    setError('')
    try {
      await store.saveCategory({ name, kind, budget })
      form.reset()
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it.')
    }
  }
  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <h2>Add a spending category</h2>
      <div className="inline-form__fields">
        <div className="field">
          <label htmlFor="nc-name">Name</label>
          <input id="nc-name" name="name" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="nc-budget">Monthly budget, optional</label>
          <input id="nc-budget" name="budget" inputMode="decimal" className="num" autoComplete="off" />
        </div>
        <button type="submit" className="btn btn--primary">Add category</button>
      </div>
      <p className="field__help field__help--error" role="alert">{error}</p>
    </form>
  )
}

export function Budgets() {
  const { categories, household } = useApp()
  const month = monthKey(today())
  const load = useLoad((s) => s.entries(monthRange(month).from, monthRange(month).to))
  const spending = categories.filter((c) => c.kind === 'expense')
  const total = spending.reduce((a, c) => a + (c.budget ?? 0), 0)

  return (
    <>
      <div className="page-head">
        <h1>Budgets</h1>
        <p className="muted">Monthly budgets total {money(total, household.currency, 0)}. You both get an alert at 80%.</p>
      </div>
      <Loaded load={load} what="this month's spending" rows={9}>
        {(entries) => {
          const uses = new Map(spendByCategory(entries, categories, month).map((u) => [u.category.id, u.spent]))
          return (
            <>
              <section aria-labelledby="spend-h">
                <h2 id="spend-h" className="table-title">Spending</h2>
                <table className="table table--stack budgets-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col" className="num">This month</th>
                      <th scope="col" className="num">Monthly budget</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {spending.map((c) => (
                      <BudgetRow key={`${c.id}:${c.name}:${c.budget}`} c={c} spent={uses.get(c.id) ?? 0} />
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )
        }}
      </Loaded>
      <AddCategory />
    </>
  )
}
