import type { ReactNode } from 'react'
import type { Load } from '../lib/context'

/** Skeleton rows shaped like the table that is coming. */
export function SkeletonRows({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton__row">
          <span className="skeleton__bar" style={{ inlineSize: `${40 + ((i * 17) % 35)}%` }} />
          <span className="skeleton__bar skeleton__bar--num" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ what, error, retry }: { what: string; error: string; retry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>
        Could not load {what}: {error}
      </p>
      <button type="button" className="btn" onClick={retry}>
        Try again
      </button>
    </div>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state--empty">
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Renders the loading and error states, and hands the data to `children` when ready. */
export function Loaded<T>({ load, what, rows, children }: { load: Load<T>; what: string; rows?: number; children: (data: T) => ReactNode }) {
  if (load.state === 'loading') return <SkeletonRows rows={rows} label={`Loading ${what}`} />
  if (load.state === 'error') return <ErrorState what={what} error={load.error} retry={load.retry} />
  return <>{children(load.data)}</>
}
