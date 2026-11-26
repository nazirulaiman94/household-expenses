import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { advance } from './dates'
import type { Store } from './store'
import type { Category, Entry, Goal, Recurring } from './types'

export class NoHouseholdError extends Error {
  constructor() {
    super('You are signed in but not part of a household yet.')
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v)

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const toCategory = (r: Row): Category => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as Category['kind'],
  budget: r.monthly_budget == null ? null : num(r.monthly_budget),
})
const toEntry = (r: Row): Entry => ({
  id: r.id as string,
  kind: r.kind as Entry['kind'],
  amount: num(r.amount),
  categoryId: r.category_id as string,
  note: r.note as string,
  date: r.occurred_on as string,
  enteredBy: r.entered_by as string,
})
const toRecurring = (r: Row): Recurring => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as Recurring['kind'],
  amount: num(r.amount),
  categoryId: r.category_id as string,
  cadence: r.cadence as Recurring['cadence'],
  nextDue: r.next_due as string,
})
const toGoal = (r: Row): Goal => ({
  id: r.id as string,
  name: r.name as string,
  target: num(r.target_amount),
  targetDate: (r.target_date as string | null) ?? null,
})

export function createSupabaseStore(sb: SupabaseClient): Store {
  let hid: string | null = null

  async function householdId(): Promise<string> {
    if (hid) return hid
    const { data: auth } = await sb.auth.getUser()
    if (!auth.user) throw new Error('Not signed in')
    const rows = check(await sb.from('household_members').select('household_id').eq('user_id', auth.user.id).limit(1))
    if (!rows?.length) throw new NoHouseholdError()
    hid = rows[0].household_id as string
    return hid
  }

  return {
    mode: 'supabase',
    async me() {
      const { data } = await sb.auth.getUser()
      if (!data.user) return null
      const h = await householdId()
      const rows = check(await sb.from('household_members').select('user_id, display_name').eq('household_id', h).eq('user_id', data.user.id))
      return { id: data.user.id, name: (rows?.[0]?.display_name as string) ?? data.user.email ?? 'Me' }
    },
    async household() {
      const h = await householdId()
      const row = check(await sb.from('households').select('*').eq('id', h).single()) as Row
      const members = check(await sb.from('household_members').select('user_id, display_name').eq('household_id', h)) as Row[]
      return {
        id: h,
        name: row.name as string,
        currency: row.currency as string,
        openingBalance: num(row.opening_balance),
        inviteCode: row.invite_code as string,
        members: members.map((m) => ({ id: m.user_id as string, name: m.display_name as string })),
      }
    },
    async updateHousehold(patch) {
      const h = await householdId()
      const row: Row = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.currency !== undefined) row.currency = patch.currency
      if (patch.openingBalance !== undefined) row.opening_balance = patch.openingBalance
      check(await sb.from('households').update(row).eq('id', h))
    },

    async categories() {
      const h = await householdId()
      return (check(await sb.from('categories').select('*').eq('household_id', h).order('created_at')) as Row[]).map(toCategory)
    },
    async saveCategory(c) {
      const h = await householdId()
      const row = { household_id: h, name: c.name, kind: c.kind, monthly_budget: c.budget }
      if (c.id) check(await sb.from('categories').update(row).eq('id', c.id))
      else check(await sb.from('categories').insert(row))
    },
    async deleteCategory(id) {
      const res = await sb.from('categories').delete().eq('id', id)
      if (res.error?.code === '23503') throw new Error('This category has entries. Move or delete them first.')
      check(res)
    },

    async entries(from, to) {
      const h = await householdId()
      const rows = check(
        await sb.from('entries').select('*').eq('household_id', h).gte('occurred_on', from).lte('occurred_on', to)
          .order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
      ) as Row[]
      return rows.map(toEntry)
    },
    async allEntries() {
      const h = await householdId()
      const out: Entry[] = []
      for (let page = 0; ; page++) {
        const rows = check(
          await sb.from('entries').select('*').eq('household_id', h).order('occurred_on', { ascending: false })
            .range(page * 1000, page * 1000 + 999),
        ) as Row[]
        out.push(...rows.map(toEntry))
        if (rows.length < 1000) return out
      }
    },
    async addEntry(e) {
      const h = await householdId()
      check(await sb.from('entries').insert({ household_id: h, kind: e.kind, amount: e.amount, category_id: e.categoryId, note: e.note, occurred_on: e.date }))
    },
    async deleteEntry(id) {
      check(await sb.from('entries').delete().eq('id', id))
    },

    async recurring() {
      const h = await householdId()
      return (check(await sb.from('recurring_items').select('*').eq('household_id', h).order('next_due')) as Row[]).map(toRecurring)
    },
    async saveRecurring(r) {
      const h = await householdId()
      const row = { household_id: h, name: r.name, kind: r.kind, amount: r.amount, category_id: r.categoryId, cadence: r.cadence, next_due: r.nextDue }
      if (r.id) check(await sb.from('recurring_items').update(row).eq('id', r.id))
      else check(await sb.from('recurring_items').insert(row))
    },
    async deleteRecurring(id) {
      check(await sb.from('recurring_items').delete().eq('id', id))
    },
    async confirmRecurring(id, amount) {
      check(await sb.rpc('confirm_recurring', { p_id: id, p_amount: amount }))
    },
    async skipRecurring(id) {
      const row = check(await sb.from('recurring_items').select('next_due, cadence').eq('id', id).single()) as Row
      check(await sb.from('recurring_items').update({ next_due: advance(row.next_due as string, row.cadence as Recurring['cadence']) }).eq('id', id))
    },

    async goals() {
      const h = await householdId()
      return (check(await sb.from('goals').select('*').eq('household_id', h).order('created_at')) as Row[]).map(toGoal)
    },
    async saveGoal(g) {
      const h = await householdId()
      const row = { household_id: h, name: g.name, target_amount: g.target, target_date: g.targetDate }
      if (g.id) check(await sb.from('goals').update(row).eq('id', g.id))
      else check(await sb.from('goals').insert(row))
    },
    async deleteGoal(id) {
      check(await sb.from('goals').delete().eq('id', id))
    },
  }
}
