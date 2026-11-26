import { addDays, addMonths, advance, monthKey, today } from './dates'
import type { Store } from './store'
import { PRESET_CATEGORIES } from './store'
import type { Category, Entry, Goal, Household, Recurring } from './types'

/**
 * A browser-only store so the draft runs before Supabase is connected.
 * Everything is sample data, kept in this browser's localStorage.
 */

interface DemoState {
  household: Household
  categories: Category[]
  entries: Entry[]
  recurring: Recurring[]
  goals: Goal[]
}

const KEY = 'household-expenses:demo:v3'
let memory: DemoState | null = null

const uid = () => Math.random().toString(36).slice(2, 10)

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function seedState(): DemoState {
  const rand = rng(42)
  const members = [
    { id: 'm1', name: 'You' },
    { id: 'm2', name: 'Partner' },
  ]
  const budgets: Record<string, number> = {
    Housing: 1800,
    Groceries: 900,
    'Eating out': 450,
    Transport: 500,
    'Utilities and phone': 350,
    Health: 200,
    Shopping: 400,
    Leisure: 250,
    Other: 200,
  }
  const categories: Category[] = PRESET_CATEGORIES.map((c, i) => ({
    ...c,
    id: `c${i + 1}`,
    budget: budgets[c.name] ?? null,
  }))
  const cat = (name: string) => categories.find((c) => c.name === name)!.id

  const entries: Entry[] = []
  const now = today()
  const thisMonth = monthKey(now)
  const push = (e: Omit<Entry, 'id'>) => {
    if (e.date <= now) entries.push({ ...e, id: uid() })
  }
  const who = () => (rand() < 0.55 ? 'm1' : 'm2')
  const amt = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100

  for (let i = 11; i >= 0; i--) {
    const mk = addMonths(thisMonth, -i)
    const d = (day: number) => `${mk}-${String(day).padStart(2, '0')}`
    push({ kind: 'income', amount: 4800, categoryId: cat('Salary'), note: 'Salary', date: d(25), enteredBy: 'm1' })
    push({ kind: 'income', amount: 3900, categoryId: cat('Salary'), note: 'Salary', date: d(25), enteredBy: 'm2' })
    if (rand() < 0.3)
      push({ kind: 'income', amount: amt(150, 600), categoryId: cat('Other income'), note: 'Side job', date: d(14), enteredBy: 'm2' })
    push({ kind: 'expense', amount: 1800, categoryId: cat('Housing'), note: 'Rent', date: d(1), enteredBy: 'm1' })
    push({ kind: 'expense', amount: 149, categoryId: cat('Utilities and phone'), note: 'Internet', date: d(5), enteredBy: 'm1' })
    push({ kind: 'expense', amount: amt(90, 180), categoryId: cat('Utilities and phone'), note: 'Electricity', date: d(12), enteredBy: 'm2' })
    for (let w = 0; w < 5; w++)
      push({ kind: 'expense', amount: amt(120, 230), categoryId: cat('Groceries'), note: 'Groceries', date: d(3 + w * 6), enteredBy: who() })
    for (let k = 0; k < 6; k++)
      push({ kind: 'expense', amount: amt(25, 110), categoryId: cat('Eating out'), note: ['Lunch', 'Dinner out', 'Coffee', 'Takeaway'][k % 4], date: d(2 + k * 4), enteredBy: who() })
    for (let k = 0; k < 4; k++)
      push({ kind: 'expense', amount: amt(60, 140), categoryId: cat('Transport'), note: k % 2 ? 'Petrol' : 'Grab', date: d(4 + k * 6), enteredBy: who() })
    if (rand() < 0.6)
      push({ kind: 'expense', amount: amt(80, 520), categoryId: cat('Shopping'), note: 'Household things', date: d(18), enteredBy: who() })
    if (rand() < 0.4)
      push({ kind: 'expense', amount: amt(40, 260), categoryId: cat('Health'), note: 'Clinic', date: d(9), enteredBy: who() })
    push({ kind: 'expense', amount: amt(60, 240), categoryId: cat('Leisure'), note: 'Cinema and streaming', date: d(20), enteredBy: who() })
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1))

  const nextOn = (day: number) => {
    const candidate = `${thisMonth}-${String(day).padStart(2, '0')}`
    return candidate >= now ? candidate : `${addMonths(thisMonth, 1)}-${String(day).padStart(2, '0')}`
  }
  const recurring: Recurring[] = [
    { id: 'r1', name: 'Rent', kind: 'expense', amount: 1800, categoryId: cat('Housing'), cadence: 'monthly', nextDue: nextOn(1) },
    { id: 'r2', name: 'Internet', kind: 'expense', amount: 149, categoryId: cat('Utilities and phone'), cadence: 'monthly', nextDue: addDays(now, -1) },
    { id: 'r3', name: 'Your salary', kind: 'income', amount: 4800, categoryId: cat('Salary'), cadence: 'monthly', nextDue: nextOn(25) },
    { id: 'r4', name: "Partner's salary", kind: 'income', amount: 3900, categoryId: cat('Salary'), cadence: 'monthly', nextDue: nextOn(25) },
    { id: 'r5', name: 'Car insurance', kind: 'expense', amount: 1240, categoryId: cat('Transport'), cadence: 'yearly', nextDue: addDays(now, 40) },
  ]

  const goals: Goal[] = [
    { id: 'g0', name: 'First RM 50,000', target: 50000, targetDate: null },
    { id: 'g1', name: 'Emergency fund', target: 70000, targetDate: `${addMonths(thisMonth, 6)}-01` },
    { id: 'g2', name: 'House deposit', target: 180000, targetDate: `${addMonths(thisMonth, 24)}-01` },
  ]

  return {
    household: { id: 'demo', name: 'Our household', currency: 'MYR', openingBalance: 5000, inviteCode: null, members },
    categories,
    entries,
    recurring,
    goals,
  }
}

function load(): DemoState {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) memory = JSON.parse(raw) as DemoState
  } catch {
    /* storage blocked: fall back to memory */
  }
  if (!memory) memory = seedState()
  return memory
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    /* storage blocked: changes live until reload */
  }
}

export function resetDemo(empty = false) {
  memory = seedState()
  if (empty) {
    memory.entries = []
    memory.recurring = []
    memory.goals = []
    memory.household.openingBalance = 0
    memory.categories = memory.categories.map((c) => ({ ...c, budget: null }))
  }
  save()
}

const tick = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))

export function createDemoStore(): Store {
  const s = () => load()
  return {
    mode: 'demo',
    me: () => tick(s().household.members[0]),
    household: () => tick(structuredClone(s().household)),
    async updateHousehold(patch) {
      Object.assign(s().household, patch)
      save()
    },
    categories: () => tick(structuredClone(s().categories)),
    async saveCategory(c) {
      const list = s().categories
      const i = c.id ? list.findIndex((x) => x.id === c.id) : -1
      if (i >= 0) list[i] = { ...list[i], ...c, id: list[i].id }
      else list.push({ ...c, id: uid() })
      save()
    },
    async deleteCategory(id) {
      const st = s()
      if (st.entries.some((e) => e.categoryId === id)) throw new Error('This category has entries. Move or delete them first.')
      st.categories = st.categories.filter((c) => c.id !== id)
      save()
    },
    entries: (from, to) => tick(structuredClone(s().entries.filter((e) => e.date >= from && e.date <= to))),
    allEntries: () => tick(structuredClone(s().entries)),
    async addEntry(e) {
      const st = s()
      st.entries.push({ ...e, id: uid(), enteredBy: st.household.members[0].id })
      st.entries.sort((a, b) => (a.date < b.date ? 1 : -1))
      save()
    },
    async deleteEntry(id) {
      const st = s()
      st.entries = st.entries.filter((e) => e.id !== id)
      save()
    },
    recurring: () => tick(structuredClone(s().recurring)),
    async saveRecurring(r) {
      const list = s().recurring
      const i = r.id ? list.findIndex((x) => x.id === r.id) : -1
      if (i >= 0) list[i] = { ...list[i], ...r, id: list[i].id }
      else list.push({ ...r, id: uid() })
      save()
    },
    async deleteRecurring(id) {
      const st = s()
      st.recurring = st.recurring.filter((r) => r.id !== id)
      save()
    },
    async confirmRecurring(id, amount) {
      const st = s()
      const r = st.recurring.find((x) => x.id === id)
      if (!r) return
      st.entries.push({ id: uid(), kind: r.kind, amount, categoryId: r.categoryId, note: r.name, date: r.nextDue <= today() ? r.nextDue : today(), enteredBy: st.household.members[0].id })
      st.entries.sort((a, b) => (a.date < b.date ? 1 : -1))
      r.nextDue = advance(r.nextDue, r.cadence)
      save()
    },
    async skipRecurring(id) {
      const r = s().recurring.find((x) => x.id === id)
      if (r) r.nextDue = advance(r.nextDue, r.cadence)
      save()
    },
    goals: () => tick(structuredClone(s().goals)),
    async saveGoal(g) {
      const list = s().goals
      const i = g.id ? list.findIndex((x) => x.id === g.id) : -1
      if (i >= 0) list[i] = { ...list[i], ...g, id: list[i].id }
      else list.push({ ...g, id: uid() })
      save()
    },
    async deleteGoal(id) {
      const st = s()
      st.goals = st.goals.filter((g) => g.id !== id)
      save()
    },
  }
}
