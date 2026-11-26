import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useApp } from '../lib/context'

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/entries', label: 'Entries' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/regular', label: 'Regular items' },
  { to: '/savings', label: 'Savings' },
  { to: '/settings', label: 'Settings' },
]

export function Shell({ children }: { children: ReactNode }) {
  const { store, household, me } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {store.mode === 'demo' && (
        <p className="demo-note">
          Draft version: entries are saved only in this browser until Supabase is connected.
        </p>
      )}
      <header className="topbar">
        <div className="container topbar__inner">
          <NavLink to="/" className="wordmark" aria-label={`${household.name}, overview`}>
            {household.name}
          </NavLink>
          <button
            type="button"
            className="btn btn--quiet topbar__menu"
            aria-expanded={open}
            aria-controls="primary-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
          <nav id="primary-nav" className={`topnav${open ? ' is-open' : ''}`} aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="topnav__link" onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <p className="topbar__who">Signed in as {me.name}</p>
        </div>
      </header>
      <main id="main" className="container main">
        {children}
      </main>
    </>
  )
}
