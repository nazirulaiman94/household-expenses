import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../lib/context'

const LINKS = [
  { to: '/overview', label: 'Overview' },
  { to: '/entries', label: 'Entries' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/regular', label: 'Regular items' },
  { to: '/loans', label: 'Loans' },
  { to: '/savings', label: 'Savings' },
  { to: '/settings', label: 'Settings' },
]
const MORE = ['/budgets', '/regular', '/loans', '/settings']

const ico = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const Icons = {
  overview: <svg {...ico}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  entries: <svg {...ico}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>,
  savings: <svg {...ico}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  more: <svg {...ico}><path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} /></svg>,
  plus: <svg {...ico} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>,
}

export function Shell({ children }: { children: ReactNode }) {
  const { store, household, me } = useApp()
  const [more, setMore] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMore(false), [pathname])
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
          <NavLink to="/" className="wordmark" aria-label={`${household.name}, home`}>
            {household.name}
          </NavLink>
          <nav className="topnav" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="topnav__link">
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

      {more && <button type="button" className="tabbar__scrim" aria-label="Close menu" onClick={() => setMore(false)} />}
      <nav className="tabbar" aria-label="Main">
        {more && (
          <div className="tabbar__sheet" id="more-menu">
            {LINKS.filter((l) => MORE.includes(l.to)).map((l) => (
              <NavLink key={l.to} to={l.to} className="tabbar__sheet-link">
                {l.label}
              </NavLink>
            ))}
            <p className="muted small tabbar__who">Signed in as {me.name}</p>
          </div>
        )}
        <NavLink to="/overview" className="tabbar__item">{Icons.overview}<span>Overview</span></NavLink>
        <NavLink to="/entries" className="tabbar__item">{Icons.entries}<span>Entries</span></NavLink>
        <NavLink to="/" end className="tabbar__add" aria-label="Add an entry">{Icons.plus}</NavLink>
        <NavLink to="/savings" className="tabbar__item">{Icons.savings}<span>Savings</span></NavLink>
        <button
          type="button"
          className={`tabbar__item${more || MORE.includes(pathname) ? ' active' : ''}`}
          aria-expanded={more}
          aria-controls="more-menu"
          onClick={() => setMore((m) => !m)}
        >
          {Icons.more}<span>More</span>
        </button>
      </nav>
    </>
  )
}
