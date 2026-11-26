import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QuickAdd } from '../components/QuickAdd'
import { Loaded } from '../components/States'
import { useApp, useLoad } from '../lib/context'
import { addMonths, formatMonth, monthKey, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'
import { totalsFor } from '../lib/stats'

/** The homepage: pick a month, add an entry to it, then land on that month's overview. */
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
const firstName = (n: string) => n.trim().split(/\s+/)[0] || 'there'

export function Home() {
  const { household, me } = useApp()
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
      <section className="hero" aria-labelledby="hero-h">
        <svg className="hero__art" viewBox="0 0 400 220" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
          <path d="M0 190 C 60 170, 90 120, 150 128 S 240 70, 290 80 S 360 30, 400 20" />
          <path d="M0 210 C 70 196, 110 160, 170 162 S 260 118, 310 120 S 370 82, 400 74" />
          <circle cx="290" cy="80" r="5" />
          <circle cx="400" cy="20" r="5" />
        </svg>
        <p className="hero__hello">{greeting()}, {firstName(me.name)}</p>
        <h1 id="hero-h" className="visually-hidden">Add an entry</h1>
        <Loaded load={load} what={formatMonth(month)} rows={1}>
          {(entries) => {
            const t = totalsFor(entries, month)
            return (
              <>
                <p className="hero__label">Left over in {formatMonth(month)}</p>
                <p className={`hero__figure num${t.saved < 0 ? ' is-negative' : ''}`}>{money(t.saved, cur)}</p>
                <dl className="hero__split">
                  <div>
                    <dt>Came in</dt>
                    <dd className="num">{money(t.income, cur)}</dd>
                  </div>
                  <div>
                    <dt>Went out</dt>
                    <dd className="num">{money(t.spent, cur)}</dd>
                  </div>
                </dl>
                {!entries.length && <p className="hero__note">Nothing recorded for this month yet.</p>}
              </>
            )
          }}
        </Loaded>
        <Link to={overviewHref} className="hero__link">See the overview</Link>
      </section>

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

    </div>
  )
}
