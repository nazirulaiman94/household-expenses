import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QuickAdd } from '../components/QuickAdd'
import { Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatMonth, monthKey, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'
import { totalsFor } from '../lib/stats'

/** The homepage: pick a month, add an entry to it, then land on that month's overview. */
export function Home() {
  const { household } = useApp()
  const cur = household.currency
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const thisMonth = monthKey(today())
  const lastMonth = addMonths(thisMonth, -1)
  const raw = params.get('m') ?? ''
  const month = /^\d{4}-\d{2}$/.test(raw) && raw <= thisMonth ? raw : thisMonth
  const pick = (m: string) => setParams(m === thisMonth ? {} : { m }, { replace: true })
  const overviewHref = month === thisMonth ? '/overview' : `/overview?m=${month}`

  const load = useLoad((s) => s.entries(monthRange(month).from, monthRange(month).to), [month])

  return (
    <div className="home">
      <div className="home__head">
        <h1>Add an entry</h1>
        <p className="muted">Pick the month it belongs to, then fill in the amount.</p>
      </div>

      <div className="home__month">
        <div className="tabs" role="group" aria-label="Month">
          <button type="button" className="tab" aria-pressed={month === thisMonth} onClick={() => pick(thisMonth)}>
            This month
          </button>
          <button type="button" className="tab" aria-pressed={month === lastMonth} onClick={() => pick(lastMonth)}>
            Last month
          </button>
        </div>
        <div className="field home__month-select">
          <label htmlFor="home-month">Or choose a month</label>
          <select id="home-month" value={month} onChange={(e) => pick(e.target.value)}>
            {Array.from({ length: 24 }, (_, i) => addMonths(thisMonth, -i)).map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <QuickAdd
        key={month}
        month={month}
        title={`New entry for ${formatMonth(month)}`}
        onSaved={(message, date) => {
          const m = monthKey(date)
          navigate(m === thisMonth ? '/overview' : `/overview?m=${m}`, { state: { added: message } })
        }}
      />

      <section className="home__month-summary" aria-labelledby="home-sum-h">
        <h2 id="home-sum-h">{formatMonth(month)} so far</h2>
        <Loaded load={load} what={formatMonth(month)} rows={1}>
          {(entries) => {
            const t = totalsFor(entries, month)
            return entries.length ? (
              <dl className="home__totals">
                <div>
                  <dt>Came in</dt>
                  <dd className="num">{money(t.income, cur)}</dd>
                </div>
                <div>
                  <dt>Went out</dt>
                  <dd className="num">{money(t.spent, cur)}</dd>
                </div>
                <div>
                  <dt>Left over</dt>
                  <dd className={`num${t.saved < 0 ? ' is-negative' : ''}`}>{money(t.saved, cur)}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Nothing recorded yet.</p>
            )
          }}
        </Loaded>
        <Link to={overviewHref}>See the {formatMonth(month)} overview</Link>
      </section>
    </div>
  )
}
