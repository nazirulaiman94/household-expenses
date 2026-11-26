import { useState } from 'react'
import { money } from '../lib/money'

/** Categorical slots in fixed order (validated palette); "Other" is neutral grey. */
const SLOTS = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#6a4ce2']
const OTHER = '#9aa39e'

export interface Slice {
  name: string
  amount: number
}

/** A ring showing how this month's spending splits across categories, with a legend that carries every figure. */
export function SpendRing({ slices, currency, label }: { slices: Slice[]; currency: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const sorted = slices.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount)
  const top = sorted.slice(0, SLOTS.length)
  const rest = sorted.slice(SLOTS.length)
  const parts = [
    ...top.map((s, i) => ({ ...s, color: SLOTS[i] })),
    ...(rest.length ? [{ name: `Other (${rest.length})`, amount: rest.reduce((a, s) => a + s.amount, 0), color: OTHER }] : []),
  ]
  const total = parts.reduce((a, p) => a + p.amount, 0)
  if (!total) return null

  const R = 80
  const C = 2 * Math.PI * R
  const GAP = parts.length > 1 ? 3 : 0
  let offset = 0
  const active = hover !== null ? parts[hover] : null

  return (
    <section className="ring" aria-labelledby="ring-h">
      <h3 id="ring-h" className="sheet__sub">Where it went</h3>
      <div className="ring__body">
        <div className="ring__chart">
          <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${Math.round((p.amount / total) * 100)}%`).join(', ')}`}>
            <circle cx="100" cy="100" r={R} className="ring__track" />
            {parts.map((p, i) => {
              const len = (p.amount / total) * C
              const dash = Math.max(len - GAP, 0.5)
              const el = (
                <circle
                  key={p.name}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={hover === i ? 26 : 22}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 100 100)"
                  className={`ring__seg${hover !== null && hover !== i ? ' is-dim' : ''}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setHover((h) => (h === i ? null : i))}
                >
                  <title>{`${p.name}: ${money(p.amount, currency)} (${Math.round((p.amount / total) * 100)}%)`}</title>
                </circle>
              )
              offset += len
              return el
            })}
          </svg>
          <div className="ring__centre" aria-hidden="true">
            <span className="ring__centre-label">{active ? active.name : label}</span>
            <span className="ring__centre-figure num">{money(active ? active.amount : total, currency)}</span>
            {active && <span className="ring__centre-share num">{((active.amount / total) * 100).toFixed(1)}%</span>}
          </div>
        </div>
        <ul className="ring__legend">
          {parts.map((p, i) => (
            <li
              key={p.name}
              className={hover !== null && hover !== i ? 'is-dim' : ''}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <span className="ring__dot" style={{ background: p.color }} aria-hidden="true" />
              <span className="ring__name">{p.name}</span>
              <span className="ring__amt num">{money(p.amount, currency)}</span>
              <span className="ring__pct num">{Math.round((p.amount / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
