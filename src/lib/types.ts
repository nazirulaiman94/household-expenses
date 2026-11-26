export type Kind = 'income' | 'expense'
export type Cadence = 'weekly' | 'monthly' | 'yearly'

export interface Member {
  id: string
  name: string
}

export interface Household {
  id: string
  name: string
  currency: string
  /** Savings already held when tracking started; the projection starts from it. */
  openingBalance: number
  inviteCode: string | null
  members: Member[]
}

export interface Category {
  id: string
  name: string
  kind: Kind
  /** Monthly limit; null means no budget for this category. */
  budget: number | null
}

export interface Entry {
  id: string
  kind: Kind
  amount: number
  categoryId: string
  note: string
  /** Local date, YYYY-MM-DD. */
  date: string
  enteredBy: string
}

export interface Recurring {
  id: string
  name: string
  kind: Kind
  amount: number
  categoryId: string
  cadence: Cadence
  nextDue: string
}

export interface Goal {
  id: string
  name: string
  target: number
  targetDate: string | null
}

export type NewEntry = Omit<Entry, 'id' | 'enteredBy'>

export type Lender = 'bank' | 'bnpl'

/** A loan or buy-now-pay-later plan paid off in equal monthly instalments. */
export interface Loan {
  id: string
  name: string
  lender: Lender
  /** The instalment paid each month. */
  monthly: number
  /** Instalments still to pay. */
  monthsLeft: number
  /** Day of the month the instalment is due, 1 to 31; null when not set. */
  dueDay: number | null
  categoryId: string
  /** Month (YYYY-MM) of the last instalment marked paid, and the entry it created. */
  lastPaid: string | null
  lastEntryId: string | null
}
