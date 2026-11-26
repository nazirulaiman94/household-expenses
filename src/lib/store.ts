import type { Category, Entry, Goal, Household, Loan, Member, NewEntry, Recurring } from './types'

export interface Store {
  mode: 'demo' | 'supabase' | 'shared'
  /** The signed-in member, or null when nobody is signed in. */
  me(): Promise<Member | null>
  household(): Promise<Household>
  updateHousehold(patch: Partial<Pick<Household, 'name' | 'currency' | 'openingBalance'>>): Promise<void>

  categories(): Promise<Category[]>
  saveCategory(c: Omit<Category, 'id'> & { id?: string }): Promise<void>
  deleteCategory(id: string): Promise<void>

  /** Entries dated within [from, to], newest first. */
  entries(from: string, to: string): Promise<Entry[]>
  /** Every entry, used for the savings balance and projection. */
  allEntries(): Promise<Entry[]>
  addEntry(e: NewEntry): Promise<void>
  deleteEntry(id: string): Promise<void>

  recurring(): Promise<Recurring[]>
  saveRecurring(r: Omit<Recurring, 'id'> & { id?: string }): Promise<void>
  deleteRecurring(id: string): Promise<void>
  /** Record this occurrence as an entry and move the item to its next due date. */
  confirmRecurring(id: string, amount: number): Promise<void>
  /** Move the item to its next due date without recording anything. */
  skipRecurring(id: string): Promise<void>

  goals(): Promise<Goal[]>
  saveGoal(g: Omit<Goal, 'id'> & { id?: string }): Promise<void>
  deleteGoal(id: string): Promise<void>

  loans(): Promise<Loan[]>
  saveLoan(l: Omit<Loan, 'id' | 'lastPaid' | 'lastEntryId'> & { id?: string }): Promise<void>
  deleteLoan(id: string): Promise<void>
  /** Record this month's instalment as an entry, take one month off, and remember it for undo. */
  payLoan(id: string): Promise<void>
  /** Undo this month's instalment: remove its entry and add the month back. */
  undoLoanPayment(id: string): Promise<void>
}

export const PRESET_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salary', kind: 'income', budget: null },
  { name: 'Other income', kind: 'income', budget: null },
  { name: 'Housing', kind: 'expense', budget: null },
  { name: 'Groceries', kind: 'expense', budget: null },
  { name: 'Eating out', kind: 'expense', budget: null },
  { name: 'Transport', kind: 'expense', budget: null },
  { name: 'Utilities and phone', kind: 'expense', budget: null },
  { name: 'Health', kind: 'expense', budget: null },
  { name: 'Shopping', kind: 'expense', budget: null },
  { name: 'Leisure', kind: 'expense', budget: null },
  { name: 'Other', kind: 'expense', budget: null },
]
