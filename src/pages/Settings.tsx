import { useState, type FormEvent } from 'react'
import { useApp } from '../lib/context'
import { resetDemo } from '../lib/demoStore'
import { CURRENCIES } from '../lib/money'
import { supabase } from '../lib/supabaseStore'

export function Settings() {
  const { store, household, changed } = useApp()
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState<'sample' | 'empty' | null>(null)

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = new FormData(ev.currentTarget)
    const opening = Number(String(d.get('opening')).replace(/,/g, '') || 0)
    if (!Number.isFinite(opening)) return setStatus({ tone: 'error', text: 'Savings at the start must be a number.' })
    try {
      await store.updateHousehold({ name: String(d.get('name')).trim() || 'Our household', currency: String(d.get('currency')), openingBalance: opening })
      setStatus({ tone: 'ok', text: 'Saved.' })
      changed()
    } catch (e) {
      setStatus({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' })
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <form className="settings" onSubmit={submit} noValidate>
        <h2>Household</h2>
        <div className="inline-form__fields">
          <div className="field">
            <label htmlFor="s-name">Name</label>
            <input id="s-name" name="name" defaultValue={household.name} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="s-cur">Currency</label>
            <select id="s-cur" name="currency" defaultValue={household.currency}>
              {[...new Set([household.currency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-open">Savings when you started tracking</label>
            <input id="s-open" name="opening" inputMode="decimal" className="num" defaultValue={household.openingBalance} autoComplete="off" />
            <p className="field__help">The savings outlook starts from this plus everything you have kept since.</p>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary">Save settings</button>
          <p className={`status status--${status?.tone ?? 'ok'}`} role="status">{status?.text}</p>
        </div>
      </form>

      <section className="settings" aria-labelledby="members-h">
        <h2 id="members-h">Members</h2>
        <ul className="plain-list">
          {household.members.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
        {store.mode === 'supabase' && household.inviteCode && (
          <p>
            To add your partner, have them sign in and enter the invite code <code className="num">{household.inviteCode}</code>.
          </p>
        )}
      </section>

      {store.mode === 'demo' ? (
        <section className="settings" aria-labelledby="demo-h">
          <h2 id="demo-h">Sample data</h2>
          <p>This draft keeps everything in this browser. Load a year of sample figures to see how the pages look when full, or clear everything to start fresh.</p>
          <div className="form-actions">
            {(['sample', 'empty'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${confirmReset === k ? 'btn--danger' : ''}`}
                onBlur={() => setConfirmReset((c) => (c === k ? null : c))}
                onClick={() => {
                  if (confirmReset !== k) return setConfirmReset(k)
                  resetDemo(k === 'empty')
                  setConfirmReset(null)
                  changed()
                }}
              >
                {confirmReset === k ? 'Confirm, this replaces everything' : k === 'sample' ? 'Load sample data' : 'Clear everything'}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="settings">
          <button type="button" className="btn" onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </section>
      )}
    </>
  )
}
