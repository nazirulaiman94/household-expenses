import { useEffect, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { ErrorState } from './components/States'
import { AppProvider, useApp } from './lib/context'
import { createDbStore, SetupNeededError, type Db, type User } from './lib/dbStore'
import { createDemoStore } from './lib/demoStore'
import type { Store } from './lib/store'
import { Budgets } from './pages/Budgets'
import { Entries } from './pages/Entries'
import { Home } from './pages/Home'
import { Loans } from './pages/Loans'
import { Overview } from './pages/Overview'
import { Regular } from './pages/Regular'
import { Savings } from './pages/Savings'
import { Settings } from './pages/Settings'

type DbStore = ReturnType<typeof createDbStore>
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> }
  }
}

/** Resolves the shared store, or a browser-only one when this view has no database (signed out, or opened outside claude.ai). */
async function pickStore(): Promise<Store> {
  const use = window.claude?.use
  if (!use) return createDemoStore()
  const [db, user] = await Promise.all([use('db'), use('user')])
  if (!db) return createDemoStore()
  return createDbStore(db as Db, (user as User | null) ?? null)
}

function SetUp({ store, onDone }: { store: DbStore; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <main id="main" className="gate">
      <h1>Set up your household</h1>
      <p>This creates the household with the standard spending and income categories. You can rename them and set budgets afterwards.</p>
      {error && (
        <p className="state state--error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn--primary"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setError('')
          store.setUp().then(onDone, (e: unknown) => {
            setError(e instanceof Error ? e.message : String(e))
            setBusy(false)
          })
        }}
      >
        {busy ? 'Setting up…' : 'Set up household'}
      </button>
    </main>
  )
}

/** Reloads the screens when the other person changes something. */
function LiveUpdates({ store }: { store: Store }) {
  const { changed } = useApp()
  useEffect(() => {
    const s = store as Partial<DbStore>
    return s.subscribe ? s.subscribe(changed) : undefined
  }, [store, changed])
  return null
}

export default function ArtifactApp() {
  const [store, setStore] = useState<Store | null>(null)
  const [key, setKey] = useState(0)
  useEffect(() => {
    pickStore().then(setStore, () => setStore(createDemoStore()))
  }, [])
  if (!store) return <div className="boot" role="status">Opening your household…</div>
  return (
    <MemoryRouter>
      <AppProvider
        key={key}
        store={store}
        fallback={(error, retry) =>
          error instanceof SetupNeededError && store.mode === 'shared' ? (
            <SetUp store={store as DbStore} onDone={() => setKey((k) => k + 1)} />
          ) : (
            <main id="main" className="gate">
              <ErrorState what="your household" error={error instanceof Error ? error.message : String(error)} retry={retry} />
            </main>
          )
        }
      >
        <LiveUpdates store={store} />
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/entries" element={<Entries />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/regular" element={<Regular />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </AppProvider>
    </MemoryRouter>
  )
}
