import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Shell } from './components/Shell'
import { ErrorState } from './components/States'
import { AppProvider } from './lib/context'
import { createDemoStore } from './lib/demoStore'
import { NoHouseholdError, createSupabaseStore, supabase } from './lib/supabaseStore'
import { Budgets } from './pages/Budgets'
import { Entries } from './pages/Entries'
import { Overview } from './pages/Overview'
import { Regular } from './pages/Regular'
import { Savings } from './pages/Savings'
import { Settings } from './pages/Settings'
import { SignIn, Setup } from './pages/SignIn'
import type { Store } from './lib/store'

function Screens({ store }: { store: Store }) {
  const [key, setKey] = useState(0)
  return (
    <AppProvider
      key={key}
      store={store}
      fallback={(error, retry) =>
        error instanceof NoHouseholdError && supabase ? (
          <Setup sb={supabase} onDone={() => setKey((k) => k + 1)} />
        ) : (
          <main id="main" className="gate">
            <ErrorState what="your household" error={error instanceof Error ? error.message : String(error)} retry={retry} />
          </main>
        )
      }
    >
      <Shell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/entries" element={<Entries />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/regular" element={<Regular />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </AppProvider>
  )
}

function WithSupabase() {
  const sb = supabase!
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [sb])
  const store = useMemo(() => (session ? createSupabaseStore(sb) : null), [sb, session?.user.id])
  if (session === undefined) return <div className="boot" role="status">Checking sign-in…</div>
  if (!session || !store) return <SignIn sb={sb} />
  return <Screens store={store} />
}

export default function App() {
  const demo = useMemo(() => (supabase ? null : createDemoStore()), [])
  return <BrowserRouter>{demo ? <Screens store={demo} /> : <WithSupabase />}</BrowserRouter>
}
