import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart } from '../components/LineChart'
import { EmptyState, Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatMonth, monthKey, today } from '../lib/dates'
import { money, moneyRound } from '../lib/money'
import { averageMonthly, balance, goalOutlook, project } from '../lib/stats'
import type { Entry, Goal } from '../lib/types'

const HORIZONS = [1, 5, 10] as const

/** Balance at the end of each of the last 12 months, oldest first. */
function history(opening: number, entries: Entry[]): { month: string; value: number }[] {
  const thisMonth = monthKey(today())
  const out: { month: string; value: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const m = addMonths(thisMonth, -i)
    out.push({ month: m, value: balance(opening, entries.filter((e) => monthKey(e.date) <= m)) })
  }
  return out
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { store, household, changed } = useApp()
  const [error, setError] = useState('')
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = new FormData(ev.currentTarget)
    const name = String(d.get('name')).trim()
    const target = Number(String(d.get('target')).replace(/,/g, ''))
    if (!name) return setError('Name the goal, such as House deposit.')
    if (!Number.isFinite(target) || target <= 0) return setError('Enter the amount you are aiming for.')
    try {
      await store.saveGoal({ id: goal?.id, name, target, targetDate: String(d.get('date')) || null })
      changed()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }
  return (
    <form className="well inline-form" onSubmit={submit} noValidate>
      <h3>{goal ? `Edit ${goal.name}` : 'New goal'}</h3>
      <div className="inline-form__fields">
        <div className="field">
          <label htmlFor="g-name">Goal</label>
          <input id="g-name" name="name" defaultValue={goal?.name} autoComplete="off" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="g-target">Amount, {household.currency}</label>
          <input id="g-target" name="target" inputMode="decimal" className="num" defaultValue={goal?.target} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="g-date">By, optional</label>
          <input id="g-date" name="date" type="date" defaultValue={goal?.targetDate ?? ''} />
        </div>
      </div>
      <p className="field__help field__help--error" role="alert">{error}</p>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary">{goal ? 'Save goal' : 'Add goal'}</button>
        <button type="button" className="btn btn--quiet" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

export function Savings() {
  const { household, store, changed } = useApp()
  const cur = household.currency
  const [params, setParams] = useSearchParams()
  const years = (HORIZONS as readonly number[]).includes(Number(params.get('y'))) ? Number(params.get('y')) : 5
  const load = useLoad(async (s) => {
    const [entries, goals] = await Promise.all([s.allEntries(), s.goals()])
    return { entries, goals }
  })
  const [incomeAdj, setIncomeAdj] = useState<number | null>(null)
  const [spendAdj, setSpendAdj] = useState<number | null>(null)
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Savings outlook</h1>
          <p className="muted">Plain savings: what you keep each month, added up. No interest or inflation.</p>
        </div>
      </div>
      <Loaded load={load} what="your savings" rows={6}>
        {({ entries, goals }) => {
          const now = balance(household.openingBalance, entries)
          const avg = averageMonthly(entries)
          if (!avg.months)
            return (
              <EmptyState>
                The outlook needs one full month of entries to work from. Your current balance is {money(now, cur)}.
              </EmptyState>
            )
          const income = incomeAdj ?? Math.round(avg.income)
          const spend = spendAdj ?? Math.round(avg.spent)
          const monthly = income - spend
          const tweaked = incomeAdj !== null || spendAdj !== null
          const months = years * 12
          const past = history(household.openingBalance, entries)
          const thisMonth = monthKey(today())
          const future = Array.from({ length: months }, (_, i) => ({ month: addMonths(thisMonth, i + 1), value: project(now, monthly, i + 1) }))
          const points = [...past, ...future].map((p) => ({
            label: formatMonth(p.month, 'short').replace(/ \d{2}(\d{2})$/, ' ’$1'),
            value: p.value,
          }))
          const sliderMax = Math.max(1000, Math.ceil((avg.income * 2) / 500) * 500)

          return (
            <>
              <section className="sheet outlook" aria-labelledby="outlook-h">
                <div className="sheet__head">
                  <h2 id="outlook-h">Where your savings are heading</h2>
                  <div className="tabs" role="group" aria-label="How far ahead">
                    {HORIZONS.map((y) => (
                      <button key={y} type="button" className="tab" aria-pressed={years === y} onClick={() => setParams(y === 5 ? {} : { y: String(y) })}>
                        {y} {y === 1 ? 'year' : 'years'}
                      </button>
                    ))}
                  </div>
                </div>

                <dl className="figures">
                  <div>
                    <dt>Saved now</dt>
                    <dd className="num">{money(now, cur, 0)}</dd>
                  </div>
                  <div>
                    <dt>Kept a month{tweaked ? ', what-if' : `, average of last ${avg.months}`}</dt>
                    <dd className={`num${monthly < 0 ? ' is-negative' : ''}`}>{money(monthly, cur, 0)}</dd>
                  </div>
                  <div className="figures__key">
                    <dt>In {years} {years === 1 ? 'year' : 'years'}, {formatMonth(addMonths(thisMonth, months), 'short')}</dt>
                    <dd className="num">{money(project(now, monthly, months), cur, 0)}</dd>
                  </div>
                </dl>

                <LineChart
                  title="Savings balance, past year and projection"
                  summary={`Savings of ${moneyRound(now, cur)} today, projected to ${moneyRound(project(now, monthly, months), cur)} in ${years} years at ${moneyRound(monthly, cur)} a month.`}
                  points={points}
                  dashedFrom={past.length - 1}
                  format={(v) => moneyRound(v, cur)}
                  marks={goals.map((g) => ({ value: g.target, label: g.name }))}
                />
                <p className="muted small">Solid line: your actual balance over the last 12 months. Dashed: the projection.</p>

                <div className="whatif">
                  <h3>What if</h3>
                  <div className="whatif__sliders">
                    <div className="field">
                      <label htmlFor="s-income">
                        Income a month <span className="num">{money(income, cur, 0)}</span>
                      </label>
                      <input id="s-income" type="range" min={0} max={sliderMax} step={50} value={income} onChange={(e) => setIncomeAdj(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <label htmlFor="s-spend">
                        Spending a month <span className="num">{money(spend, cur, 0)}</span>
                      </label>
                      <input id="s-spend" type="range" min={0} max={sliderMax} step={50} value={spend} onChange={(e) => setSpendAdj(Number(e.target.value))} />
                    </div>
                  </div>
                  {tweaked && (
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => { setIncomeAdj(null); setSpendAdj(null) }}>
                      Back to your real averages
                    </button>
                  )}
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">After</th>
                      <th scope="col" className="num">Saved</th>
                      <th scope="col" className="num">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HORIZONS.map((y) => (
                      <tr key={y} className={y === years ? 'is-current' : ''}>
                        <th scope="row">{y} {y === 1 ? 'year' : 'years'}</th>
                        <td className="num">{money(project(now, monthly, y * 12), cur, 0)}</td>
                        <td className="num">{money(monthly * y * 12, cur, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section aria-labelledby="goals-h">
                <div className="section-head">
                  <h2 id="goals-h">Goals</h2>
                  {editing === null && (
                    <button type="button" className="btn" onClick={() => setEditing('new')}>Add goal</button>
                  )}
                </div>
                {editing !== null && <GoalForm goal={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
                {!goals.length ? (
                  <EmptyState>No goals yet. Add one, such as an emergency fund, to see when you reach it.</EmptyState>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Goal</th>
                        <th scope="col" className="num">Target</th>
                        <th scope="col" className="num hide-s">Still to save</th>
                        <th scope="col">At this rate</th>
                        <th scope="col" className="num hide-s">Needed a month</th>
                        <th scope="col"><span className="visually-hidden">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {goals.map((g) => {
                        const o = goalOutlook(g, now, monthly)
                        return (
                          <tr key={g.id} className={o.onTrack === false ? 'is-near' : ''}>
                            <th scope="row">
                              {g.name}
                              {g.targetDate && <span className="muted small"> by {formatMonth(monthKey(g.targetDate), 'short')}</span>}
                            </th>
                            <td className="num">{money(g.target, cur, 0)}</td>
                            <td className="num hide-s">{money(o.remaining, cur, 0)}</td>
                            <td>
                              {o.monthsAtRate === 0
                                ? <span className="paid-mark">Reached</span>
                                : o.reachedOn
                                  ? `${formatMonth(o.reachedOn, 'short')}${o.onTrack === false ? ', late' : o.onTrack ? ', on time' : ''}`
                                  : 'Not at this rate'}
                            </td>
                            <td className="num hide-s">{o.neededPerMonth !== null ? money(o.neededPerMonth, cur, 0) : ''}</td>
                            <td className="row-actions">
                              <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(g)}>Edit</button>
                              <button
                                type="button"
                                className={`btn btn--small ${confirming === g.id ? 'btn--danger' : 'btn--quiet'}`}
                                onBlur={() => setConfirming((c) => (c === g.id ? null : c))}
                                onClick={async () => {
                                  if (confirming !== g.id) return setConfirming(g.id)
                                  await store.deleteGoal(g.id)
                                  changed()
                                }}
                              >
                                {confirming === g.id ? 'Confirm delete' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )
        }}
      </Loaded>
    </>
  )
}
