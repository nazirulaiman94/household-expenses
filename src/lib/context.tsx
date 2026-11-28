import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Store } from './store'
import type { Category, Household, Member } from './types'

interface Ctx {
  store: Store
  household: Household
  categories: Category[]
  me: Member
  /** Bumps after every change so screens reload. */
  version: number
  changed: () => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}

export type Load<T> = { state: 'loading' } | { state: 'error'; error: string; retry: () => void } | { state: 'ready'; data: T }

/** Loads data for a screen and reloads whenever the household data changes. */
export function useLoad<T>(fn: (s: Store) => Promise<T>, deps: unknown[] = []): Load<T> {
  const { store, version } = useApp()
  const [res, setRes] = useState<Load<T>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    fn(store).then(
      (data) => live && setRes({ state: 'ready', data }),
      (e: unknown) => live && setRes({ state: 'error', error: e instanceof Error ? e.message : String(e), retry: () => setAttempt((a) => a + 1) }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, attempt, ...deps])
  return res
}

export function AppProvider({ store, children, fallback }: { store: Store; children: ReactNode; fallback: (error: unknown, retry: () => void) => ReactNode }) {
  const [version, setVersion] = useState(0)
  const [base, setBase] = useState<{ household: Household; categories: Category[]; me: Member } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const changed = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let live = true
    Promise.all([store.household(), store.categories(), store.me()]).then(
      ([household, categories, me]) => {
        if (!live) return
        setError(null)
        setBase({ household, categories, me: me ?? household.members[0] })
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [store, version])

  if (error && !base) return <>{fallback(error, changed)}</>
  if (!base) return <div className="boot" role="status">Opening your household…</div>
  return <StoreCtx.Provider value={{ store, ...base, version, changed }}>{children}</StoreCtx.Provider>
}
