import { useEffect, useId, useRef, useState } from 'react'

export interface Point {
  label: string
  value: number
}

interface Props {
  points: Point[]
  format: (n: number) => string
  /** Horizontal reference lines, such as goals. */
  marks?: { value: number; label: string }[]
  /** Label every nth point on the x axis. */
  every?: number
  /** Points from this index on are drawn dashed (a projection). */
  dashedFrom?: number
  title: string
  summary: string
}

const PAD = { top: 24, right: 12, bottom: 36, left: 84 }

function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.floor(min / step) * step; out.length < 2 || out[out.length - 1] < max; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

export function LineChart({ points, format, marks = [], every = 1, dashedFrom, title, summary }: Props) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  const [W, setW] = useState(960)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = W < 600 ? 240 : 300
  if (points.length < 2) return null
  const shown = Math.max(every, Math.ceil(points.length / Math.max(2, Math.floor(W / 120))))
  const values = [...points.map((p) => p.value), ...marks.map((m) => m.value), 0]
  const t = ticks(Math.min(...values), Math.max(...values))
  const lo = t[0]
  const hi = t[t.length - 1]
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom)
  const path = (from: number, to: number) =>
    points.slice(from, to + 1).map((p, i) => `${i ? 'L' : 'M'}${x(from + i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const split = dashedFrom ?? points.length - 1
  const last = points[points.length - 1]

  return (
    <figure ref={ref} className="chart" aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-s`} width={W} height={H}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-s`}>{summary}</desc>
        {t.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'chart__zero' : 'chart__grid'} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart__tick" x={PAD.left - 10} y={y(v)} dy="0.32em" textAnchor="end">{format(v)}</text>
          </g>
        ))}
        {[...marks].sort((a, b) => b.value - a.value).map((m, i, arr) => {
          // Alternate close labels to the left edge so they never overprint.
          const crowded = i > 0 && Math.abs(y(arr[i - 1].value) - y(m.value)) < 16
          return (
            <g key={m.label}>
              <line className="chart__mark" x1={PAD.left} x2={W - PAD.right} y1={y(m.value)} y2={y(m.value)} />
              <text className="chart__mark-label" x={crowded ? PAD.left + 6 : W - PAD.right} y={y(m.value) - 6} textAnchor={crowded ? 'start' : 'end'}>{m.label}</text>
            </g>
          )
        })}
        <path className="chart__series" d={path(0, split)} vectorEffect="non-scaling-stroke" />
        {dashedFrom !== undefined && <path className="chart__series chart__series--projected" d={path(split, points.length - 1)} vectorEffect="non-scaling-stroke" />}
        {points.map((p, i) =>
          (i % shown === 0 && points.length - 1 - i >= shown) || i === points.length - 1 ? (
            <text key={i} className="chart__tick" x={x(i)} y={H - 10} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text>
          ) : null,
        )}
        <circle className="chart__end" cx={x(points.length - 1)} cy={y(last.value)} r={4} />
      </svg>
      <figcaption className="visually-hidden">{summary}</figcaption>
    </figure>
  )
}
