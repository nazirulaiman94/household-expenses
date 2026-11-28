import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CURRENCIES } from '../lib/money'

export function SignIn({ sb }: { sb: SupabaseClient }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const email = String(new FormData(ev.currentTarget).get('email')).trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter your email address.')
    setError('')
    setState('sending')
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) {
      setError(error.message)
      setState('idle')
    } else setState('sent')
  }

  return (
    <main id="main" className="gate">
      <h1>Household expenses</h1>
      {state === 'sent' ? (
        <p role="status">Check your email for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit} noValidate className="gate__form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" autoFocus aria-invalid={error ? true : undefined} aria-describedby="email-help" />
            <p id="email-help" className="field__help field__help--error">{error}</p>
          </div>
          <button type="submit" className="btn btn--primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </main>
  )
}

/** Signed in for the first time: start a household or join your partner's. */
export function Setup({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const d = new FormData(ev.currentTarget)
    const display = String(d.get('display')).trim()
    if (!display) return setError('Tell us what to call you.')
    setBusy(true)
    setError('')
    const res =
      mode === 'create'
        ? await sb.rpc('create_household', { p_name: String(d.get('name')).trim(), p_currency: String(d.get('currency')), p_display_name: display })
        : await sb.rpc('join_household', { p_code: String(d.get('code')), p_display_name: display })
    setBusy(false)
    if (res.error) setError(res.error.message)
    else onDone()
  }

  return (
    <main id="main" className="gate">
      <h1>Set up your household</h1>
      <div className="tabs" role="group" aria-label="Start or join">
        <button type="button" className="tab" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Start a new household</button>
        <button type="button" className="tab" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join my partner's</button>
      </div>
      <form onSubmit={submit} noValidate className="gate__form">
        <div className="field">
          <label htmlFor="display">Your name</label>
          <input id="display" name="display" autoComplete="given-name" />
        </div>
        {mode === 'create' ? (
          <>
            <div className="field">
              <label htmlFor="hname">Household name</label>
              <input id="hname" name="name" placeholder="Household" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="hcur">Currency</label>
              <select id="hcur" name="currency" defaultValue="MYR">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="code">Invite code from your partner's Settings</label>
            <input id="code" name="code" autoComplete="off" className="num" />
          </div>
        )}
        <p className="field__help field__help--error" role="alert">{error}</p>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Setting up…' : mode === 'create' ? 'Create household' : 'Join household'}
        </button>
      </form>
    </main>
  )
}
