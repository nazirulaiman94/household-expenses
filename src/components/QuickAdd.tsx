import { useId, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../lib/context'
import { monthKey, monthRange, today } from '../lib/dates'
import { money } from '../lib/money'
import type { Kind } from '../lib/types'

/** The fast entry form: amount first, one tap for the kind, stays open for the next entry. */
/** After a save, `onSaved` gets the confirmation text and the entry's date; the caller closes the form and shows the result. */
export function QuickAdd({ onClose, onSaved, month, title = 'New entry' }: { onClose?: () => void; onSaved?: (message: string, date: string) => void; month?: string; title?: string }) {
  const { store, categories, household, changed } = useApp()
  // With a month chosen, the date defaults inside it: today for this month, else its last day.
  const range = month ? monthRange(month) : null
  const defaultDate = !month || month === monthKey(today()) ? today() : range!.to
  const id = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>('expense')
  const options = categories.filter((c) => c.kind === kind)
  const preferred = (k: Kind) => {
    const list = categories.filter((c) => c.kind === k)
    return (list.find((c) => c.name === (k === 'expense' ? 'Groceries' : 'Salary')) ?? list[0])?.id ?? ''
  }
  const [categoryId, setCategoryId] = useState(preferred('expense'))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [amountError, setAmountError] = useState('')

  function switchKind(k: Kind) {
    setKind(k)
    setCategoryId(preferred(k))
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const form = ev.currentTarget
    const data = new FormData(form)
    const amount = Number(String(data.get('amount')).replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError('Enter an amount above zero, for example 45.90.')
      amountRef.current?.focus()
      return
    }
    setAmountError('')
    setBusy(true)
    setStatus(null)
    try {
      await store.addEntry({
        kind,
        amount: Math.round(amount * 100) / 100,
        categoryId,
        note: String(data.get('note') ?? '').trim(),
        date: String(data.get('date') || today()),
      })
      const cat = categories.find((c) => c.id === categoryId)?.name ?? ''
      const message = `Added ${money(amount, household.currency)} to ${cat}.`
      if (onSaved) {
        onSaved(message, String(data.get('date') || today()))
        changed()
        return
      }
      setStatus({ tone: 'ok', text: message })
      ;(form.elements.namedItem('amount') as HTMLInputElement).value = ''
      ;(form.elements.namedItem('note') as HTMLInputElement).value = ''
      amountRef.current?.focus()
      changed()
    } catch (e) {
      setStatus({ tone: 'error', text: `Not saved: ${e instanceof Error ? e.message : 'something went wrong'}. Try again.` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="quick-add well" onSubmit={submit} noValidate aria-labelledby={`${id}-h`}>
      <div className="quick-add__head">
        <h2 id={`${id}-h`}>{title}</h2>
        {onClose && (
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="segmented" role="radiogroup" aria-label="Kind">
        {(['expense', 'income'] as const).map((k) => (
          <label key={k} className="segmented__opt">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => switchKind(k)} />
            <span>{k === 'expense' ? 'Spent' : 'Received'}</span>
          </label>
        ))}
      </div>
      <div className="quick-add__fields">
        <div className="field field--amount">
          <label htmlFor={`${id}-amount`}>Amount, {household.currency}</label>
          <input
            ref={amountRef}
            id={`${id}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            autoFocus={!!onClose}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={`${id}-amount-help`}
            className="num"
          />
          <p id={`${id}-amount-help`} className="field__help field__help--error">{amountError}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-cat`}>Category</label>
          <select id={`${id}-cat`} name="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="field__help" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-date`}>Date</label>
          <input id={`${id}-date`} name="date" type="date" defaultValue={defaultDate} min={range?.from} max={range ? (range.to < today() ? range.to : today()) : today()} />
          <p className="field__help" />
        </div>
        <div className="field field--wide">
          <label htmlFor={`${id}-note`}>Note, optional</label>
          <input id={`${id}-note`} name="note" type="text" autoComplete="off" placeholder="What was it for?" />
          <p className="field__help" />
        </div>
      </div>
      <div className="quick-add__foot">
        <button type="submit" className="btn btn--primary" disabled={busy || !categoryId}>
          {busy ? 'Saving…' : kind === 'expense' ? 'Add expense' : 'Add income'}
        </button>
        <p className={`status status--${status?.tone ?? 'ok'}`} role="status" aria-live="polite">{status?.text}</p>
      </div>
    </form>
  )
}
