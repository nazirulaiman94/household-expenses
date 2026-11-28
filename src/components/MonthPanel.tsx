import { useEffect, useState, type ReactNode } from 'react'
import { daysBetween, formatMonth, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'
import type { Entry } from '../lib/types'

/** A money figure whose digits roll into place like an odometer. */
export function RollingMoney({ value, currency, className = '' }: { value: number; currency: string; className?: string }) {
  const text = money(value, currency)
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(false)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)))
    return () => cancelAnimationFrame(id)
  }, [text])
  const cut = text.lastIndexOf('.')
  let digit = 0
  const render = (part: string, small: boolean) =>
    [...part].map((ch, i) => {
      if (!/\d/.test(ch)) return <span key={`${small}${i}`} className={small ? 'roll__small' : undefined}>{ch}</span>
      const d = Number(ch)
      const n = digit++
      return (
        <span key={`${small}${i}`} className={`roll__col${small ? ' roll__small' : ''}`}>
          <span className="roll__strip" style={{ transform: `translateY(${on ? -d : 0}em)`, transitionDelay: `${n * 45}ms` }}>
            {'0123456789'.split('').map((x) => <span key={x}>{x}</span>)}
          </span>
        </span>
      )
    })
  return (
    <span className={`roll num ${className}`} aria-label={text} role="text">
      <span aria-hidden="true">
        {render(cut > 0 ? text.slice(0, cut) : text, false)}
        {cut > 0 && render(text.slice(cut), true)}
      </span>
    </span>
  )
}

interface Day {
  day: number
  income: number
  spent: number
}

function Chart({ entries, month, currency }: { entries: Entry[]; month: string; currency: string }) {
  const { from, to } = monthRange(month)
  const n = Number(to.slice(8, 10))
  const days: Day[] = Array.from({ length: n }, (_, i) => ({ day: i + 1, income: 0, spent: 0 }))
  for (const e of entries) {
    const d = days[Number(e.date.slice(8, 10)) - 1]
    if (!d) continue
    if (e.kind === 'income') d.income += e.amount
    else d.spent += e.amount
  }
  const max = Math.max(1, ...days.map((d) => Math.max(d.income, d.spent)))
  const t = today()
  const todayIdx = t >= from && t <= to ? daysBetween(from, t) : t > to ? n : -1
  // Label up to three of the biggest days, spaced apart so labels never collide; the label sits on that day's taller bar.
  const top: { day: number; kind: 'income' | 'spent' }[] = []
  for (const d of [...days].sort((x, y) => Math.max(y.income, y.spent) - Math.max(x.income, x.spent))) {
    if (top.length === 3 || Math.max(d.income, d.spent) <= 0) break
    if (top.some((t) => Math.abs(t.day - d.day) < Math.max(3, Math.round(n / 7)))) continue
    top.push({ day: d.day, kind: d.income >= d.spent ? 'income' : 'spent' })
  }
  const labelled = (day: number, kind: 'income' | 'spent') => top.some((x) => x.day === day && x.kind === kind)
  const [pick, setPick] = useState<number | null>(null)
  const picked = pick !== null ? days[pick] : null
  const ticks = [1, 8, 15, 22, n]
  const short = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : Math.round(v).toString())

  return (
    <div className="mchart">
      <div className="mchart__head">
        <h3 className="mchart__title">{picked ? `${picked.day} ${formatMonth(month, 'short').split(' ')[0]}` : formatMonth(month, 'short').split(' ')[0]}</h3>
        {picked ? (
          <p className="mchart__readout num">
            <span className="mchart__key mchart__key--in" /> {money(picked.income, currency)} <span className="mchart__key mchart__key--out" /> {money(picked.spent, currency)}
          </p>
        ) : (
          <p className="mchart__legend">
            <span><span className="mchart__key mchart__key--in" /> Came in</span>
            <span><span className="mchart__key mchart__key--out" /> Went out</span>
          </p>
        )}
      </div>
      <div className="mchart__plot" role="img" aria-label={`Money in and out each day of ${formatMonth(month)}`} onPointerLeave={() => setPick(null)}>
        {todayIdx >= 0 && todayIdx < n && (
          <>
            <div className="mchart__future" style={{ left: `${((todayIdx + 1) / n) * 100}%` }} />
            <div className="mchart__today" style={{ left: `${((todayIdx + 0.5) / n) * 100}%` }}>
              <span>Today</span>
            </div>
          </>
        )}
        {days.map((d, i) => (
          <button
            type="button"
            key={d.day}
            className={`mchart__day${pick === i ? ' is-picked' : ''}`}
            aria-label={`${d.day} ${formatMonth(month)}: came in ${money(d.income, currency)}, went out ${money(d.spent, currency)}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setPick(i)}
            onClick={() => setPick((p) => (p === i ? null : i))}
          >
            {(['income', 'spent'] as const).map((k) =>
              d[k] > 0 ? (
                <span key={k} className={`mchart__bar mchart__bar--${k}`} style={{ height: `${(d[k] / max) * 100}%`, animationDelay: `${i * 18}ms` }}>
                  {labelled(d.day, k) && <span className="mchart__label num">{short(d[k])}</span>}
                </span>
              ) : (
                <span key={k} className="mchart__bar mchart__bar--none" />
              ),
            )}
          </button>
        ))}
      </div>
      <div className="mchart__axis" aria-hidden="true">
        {ticks.map((d) => (
          <span key={d} style={{ left: `${((d - 0.5) / n) * 100}%` }}>{d}</span>
        ))}
      </div>
    </div>
  )
}

/** The month at a glance: what is left with rolling figures, how income was used, and money in and out by day. */
export function MonthPanel({ entries, month, currency, income, spent, action }: { entries: Entry[]; month: string; currency: string; income: number; spent: number; action?: ReactNode }) {
  const left = income - spent
  const usedPct = income > 0 ? Math.round((spent / income) * 100) : spent > 0 ? 100 : 0
  const spentW = income > 0 ? Math.min(spent, income) / Math.max(income, spent) : spent > 0 ? 1 : 0
  const overW = spent > income && spent > 0 ? (spent - income) / spent : 0
  const leftW = income > 0 && spent < income ? (income - spent) / income : 0
  return (
    <div className="mpanel">
      <div className="mpanel__summary">
        <p className="mpanel__label">Left over in {formatMonth(month, 'short').split(' ')[0]}</p>
        <RollingMoney value={left} currency={currency} className={`mpanel__figure${left < 0 ? ' is-negative' : ''}`} />
        <div className="mpanel__usage">
          <p className="mpanel__usage-row">
            <span>Income spent</span>
            <span className={`num${usedPct > 100 ? ' is-negative' : ''}`}>{usedPct}%</span>
          </p>
          <div className="mpanel__track" aria-hidden="true">
            {spentW > 0 && <span className="mpanel__seg mpanel__seg--out" style={{ flexGrow: spentW }} />}
            {leftW > 0 && <span className="mpanel__seg mpanel__seg--left" style={{ flexGrow: leftW }} />}
            {overW > 0 && <span className="mpanel__seg mpanel__seg--over" style={{ flexGrow: overW }} />}
            {!spentW && !leftW && !overW && <span className="mpanel__seg mpanel__seg--empty" style={{ flexGrow: 1 }} />}
          </div>
        </div>
        <div className="mpanel__tiles">
          <div className="mpanel__tile">
            <p><span className="mchart__key mchart__key--in" /> Came in</p>
            <RollingMoney value={income} currency={currency} />
          </div>
          <div className="mpanel__tile">
            <p><span className="mchart__key mchart__key--out" /> Went out</p>
            <RollingMoney value={spent} currency={currency} />
          </div>
        </div>
        {action}
      </div>
      <Chart entries={entries} month={month} currency={currency} />
    </div>
  )
}
