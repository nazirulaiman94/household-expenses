import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { DueList } from '../components/DueList'
import { LineChart } from '../components/LineChart'
import { QuickAdd } from '../components/QuickAdd'
import { EmptyState, Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatDay, formatMonth, monthKey, monthRange, today } from '../lib/dates'
import { hasSampleData } from '../lib/demoStore'
import { money, moneyRound } from '../lib/money'
import { budgetAlerts, dueSoon, monthSeries, spendByCategory, totalsFor } from '../lib/stats'

export function Overview() {
  const { household, categories, store } = useApp()
  const cur = household.currency
  const [params, setParams] = useSearchParams()
  const thisMonth = monthKey(today())
  const month = /^\d{4}-\d{2}$/.test(params.get('m') ?? '') ? params.get('m')! : thisMonth
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const added = (location.state as { added?: string } | null)?.added ?? null
  const sheetRef = useRef<HTMLElement>(null)
  // Arriving from a save: bring the month statement into view.
  useEffect(() => {
    if (added) sheetRef.current?.scrollIntoView({ block: 'start' })
  }, [added])

  const load = useLoad(async (s) => {
    const from = monthRange(addMonths(month, -11)).from
    const [entries, recurring] = await Promise.all([s.entries(from, monthRange(month).to), s.recurring()])
    return { entries, recurring }
  }, [month])

  const go = (m: string) => setParams(m === thisMonth ? {} : { m })
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown'
  const memberName = (id: string) => household.members.find((m) => m.id === id)?.name ?? ''

  return (
    <>
      <div className="page-head">
        <div className="month-nav">
          <button type="button" className="btn btn--quiet btn--small" onClick={() => go(addMonths(month, -1))} aria-label="Previous month">
            <span aria-hidden="true" className="month-nav__arrow">‹</span>
            <span className="hide-s">Previous</span>
          </button>
          <h1>{formatMonth(month)}</h1>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => go(addMonths(month, 1))} disabled={month >= thisMonth} aria-label="Next month">
            <span className="hide-s">Next</span>
            <span aria-hidden="true" className="month-nav__arrow">›</span>
          </button>
        </div>
        {!adding && (
          <button type="button" className="btn btn--primary hide-s" onClick={() => setAdding(true)}>
            Add entry
          </button>
        )}
      </div>

      {adding && (
        <QuickAdd
          onClose={() => setAdding(false)}
          onSaved={(message, date) => {
            setAdding(false)
            const m = monthKey(date)
            navigate(m === thisMonth ? '/overview' : `/overview?m=${m}`, { state: { added: message } })
          }}
        />
      )}
      {added && !adding && (
        <p className="flash" role="status">
          {added}
        </p>
      )}

      <Loaded load={load} what="this month" rows={8}>
        {({ entries, recurring }) => {
          const t = totalsFor(entries, month)
          const uses = spendByCategory(entries, categories, month)
          const budgeted = uses.filter((u) => u.category.budget)
          const unbudgeted = uses.filter((u) => !u.category.budget && u.spent > 0)
          const series = monthSeries(entries, month, 12)
          const hasHistory = series.filter((m) => m.income || m.spent).length >= 2
          const monthEntries = entries.filter((e) => monthKey(e.date) === month)
          const totalBudget = budgeted.reduce((a, u) => a + (u.category.budget ?? 0), 0)
          const yearSpend = new Map<string, number>()
          for (const e of entries) if (e.kind === 'expense') yearSpend.set(e.categoryId, (yearSpend.get(e.categoryId) ?? 0) + e.amount)
          const yearTotal = [...yearSpend.values()].reduce((a, b) => a + b, 0)
          const yearRows = [...yearSpend.entries()].sort((a, b) => b[1] - a[1])
          // Average over the months actually tracked, from the first entry, at most 12.
          const firstMonth = entries.reduce((m, e) => (monthKey(e.date) < m ? monthKey(e.date) : m), month)
          const [fy, fm] = firstMonth.split('-').map(Number)
          const [my, mm] = month.split('-').map(Number)
          const trackedMonths = Math.min(12, Math.max(1, (my - fy) * 12 + (mm - fm) + 1))

          return (
            <>
              <section className="sheet" aria-labelledby="sheet-h" ref={sheetRef}>
                <div className="sheet__head">
                  <h2 id="sheet-h">The month so far</h2>
                  <p className="sheet__date">{month === thisMonth ? `To ${formatDay(today())}` : formatMonth(month)}</p>
                </div>
                <dl className="figures">
                  <div>
                    <dt>Came in</dt>
                    <dd className="num">{money(t.income, cur)}</dd>
                  </div>
                  <div>
                    <dt>Went out</dt>
                    <dd className="num">{money(t.spent, cur)}</dd>
                  </div>
                  <div className="figures__key">
                    <dt>Left over</dt>
                    <dd className={`num${t.saved < 0 ? ' is-negative' : ''}`}>{money(t.saved, cur)}</dd>
                  </div>
                </dl>

                {monthEntries.length === 0 ? (
                  <EmptyState
                    action={
                      <button type="button" className="btn" onClick={() => setAdding(true)}>
                        Add the first entry
                      </button>
                    }
                  >
                    Nothing recorded for {formatMonth(month)} yet. Income and spending you add show up here, set against your budgets.
                  </EmptyState>
                ) : (
                  <>
                    <h3 className="sheet__sub">Budgets</h3>
                    {budgeted.length === 0 ? (
                      <EmptyState action={<Link to="/budgets">Set monthly budgets</Link>}>No category has a monthly budget yet.</EmptyState>
                    ) : (
                      <table className="table budget-table">
                        <thead>
                          <tr>
                            <th scope="col">Category</th>
                            <th scope="col" className="num">Spent</th>
                            <th scope="col" className="num hide-s">Budget</th>
                            <th scope="col" className="num">Left</th>
                            <th scope="col" className="budget-table__bar-h"><span className="visually-hidden">Share used</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgeted.map((u) => {
                            const left = (u.category.budget ?? 0) - u.spent
                            const share = u.share ?? 0
                            return (
                              <tr key={u.category.id} className={share > 1.0001 ? 'is-over' : share >= 0.8 ? 'is-near' : ''}>
                                <th scope="row">{u.category.name}</th>
                                <td className="num">{money(u.spent, cur)}</td>
                                <td className="num hide-s">{money(u.category.budget ?? 0, cur, 0)}</td>
                                <td className="num">{money(left, cur)}</td>
                                <td className="budget-table__bar">
                                  <meter min={0} max={1} low={0.8} high={0.99995} optimum={0.4} value={share > 1.0001 ? 1 : Math.min(share, 0.9999)} aria-label={`${Math.round(share * 100)}% of budget used`} />
                                </td>
                              </tr>
                            )
                          })}
                          {unbudgeted.map((u) => (
                            <tr key={u.category.id}>
                              <th scope="row">{u.category.name}</th>
                              <td className="num">{money(u.spent, cur)}</td>
                              <td className="num muted hide-s">None</td>
                              <td className="num" />
                              <td />
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">All spending</th>
                            <td className="num">{money(t.spent, cur)}</td>
                            <td className="num hide-s">{money(totalBudget, cur, 0)}</td>
                            <td className="num">{money(totalBudget - budgeted.reduce((a, u) => a + u.spent, 0), cur)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    <div className="sheet__sub-row">
                      <h3 className="sheet__sub">Latest entries</h3>
                      <Link to={`/entries${month === thisMonth ? '' : `?m=${month}`}`}>All entries for {formatMonth(month, 'short')}</Link>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">What</th>
                          <th scope="col" className="hide-s">Category</th>
                          <th scope="col" className="hide-s">By</th>
                          <th scope="col" className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthEntries.slice(0, 8).map((e) => (
                          <tr key={e.id}>
                            <td className="nowrap">{formatDay(e.date)}</td>
                            <th scope="row">{e.note || catName(e.categoryId)}</th>
                            <td className="hide-s">{catName(e.categoryId)}</td>
                            <td className="hide-s">{memberName(e.enteredBy)}</td>
                            <td className={`num${e.kind === 'income' ? ' is-income' : ''}`}>
                              {e.kind === 'income' ? '+' : ''}
                              {money(e.amount, cur)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>

              {month === thisMonth && <DueList due={dueSoon(recurring)} alerts={budgetAlerts(uses)} />}

              <section className="trend" aria-labelledby="trend-h">
                <div className="section-head">
                  <h2 id="trend-h">Left over each month</h2>
                  <p className="muted">{formatMonth(series[0].month, 'short')} to {formatMonth(month, 'short')}</p>
                </div>
                {hasHistory ? (
                  <>
                    <LineChart
                      title="Money left over each month"
                      summary={`Over the last 12 months you kept between ${moneyRound(Math.min(...series.map((m) => m.saved)), cur)} and ${moneyRound(Math.max(...series.map((m) => m.saved)), cur)} a month.`}
                      points={series.map((m) => ({ label: formatMonth(m.month, 'short').replace(/ \d{2}(\d{2})$/, ' ’$1'), value: m.saved }))}
                      format={(v) => moneyRound(v, cur)}
                      every={2}
                    />
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Month</th>
                            <th scope="col" className="num">Came in</th>
                            <th scope="col" className="num">Went out</th>
                            <th scope="col" className="num">Left over</th>
                            <th scope="col" className="num hide-s">Kept</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...series].reverse().map((m) => (
                            <tr key={m.month} className={m.month === month ? 'is-current' : ''}>
                              <th scope="row">
                                <Link to={m.month === thisMonth ? '/overview' : `/overview?m=${m.month}`}>{formatMonth(m.month, 'short')}</Link>
                              </th>
                              <td className="num">{money(m.income, cur, 0)}</td>
                              <td className="num">{money(m.spent, cur, 0)}</td>
                              <td className={`num${m.saved < 0 ? ' is-negative' : ''}`}>{money(m.saved, cur, 0)}</td>
                              <td className="num hide-s">{m.income ? `${Math.round((m.saved / m.income) * 100)}%` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <EmptyState>The trend appears once you have two months of entries.</EmptyState>
                )}
              </section>

              {yearTotal > 0 && (
                <section aria-labelledby="where-h">
                  <div className="section-head">
                    <h2 id="where-h">Where the money went</h2>
                    <p className="muted">All spending, last 12 months</p>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col" className="num">Total</th>
                        <th scope="col" className="num">A month</th>
                        <th scope="col" className="num">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearRows.map(([id, sum]) => (
                        <tr key={id}>
                          <th scope="row">{catName(id)}</th>
                          <td className="num">{money(sum, cur, 0)}</td>
                          <td className="num">{money(sum / trackedMonths, cur, 0)}</td>
                          <td className="num">{Math.round((sum / yearTotal) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {store.mode === 'demo' && hasSampleData() && <p className="muted small">Sample figures. Clear them in Settings when you start using it for real.</p>}
            </>
          )
        }}
      </Loaded>
    </>
  )
}
