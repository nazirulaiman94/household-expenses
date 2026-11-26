import { advance, today } from './dates'
import type { Store } from './store'
import { PRESET_CATEGORIES } from './store'
import type { Category, Entry, Goal, Household, Member, Recurring } from './types'

/**
 * Store for the claude.ai Artifact build. Data lives in the artifact's shared
 * database, so everyone the page is shared with (as Contributor or above) sees
 * the same household. Identity comes from the `user` capability; only ids are
 * stored, names are resolved when shown.
 *
 * Layout: hh/main (name, currency, openingBalance), members/<userId>,
 * categories/<id>, entries/<id>, recurring/<id>, goals/<id>.
 */

/* Minimal shapes of the platform namespaces this file uses. */
type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
type QSnap = { docs: Snap[] }
type DocRef = {
  get(): Promise<Snap>
  set(d: Record<string, unknown>): Promise<void>
  update(d: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
}
type Query = {
  where(f: string, op: string, v: unknown): Query
  orderBy(f: string, dir?: 'asc' | 'desc'): Query
  limit(n: number): Query
  get(): Promise<QSnap>
  onSnapshot(next: (s: QSnap & { metadata: { fromCache: boolean } }) => void, err?: (e: unknown) => void): () => void
}
type ColRef = Query & { doc(id?: string): DocRef & { id: string } }
export type Db = { doc(p: string): DocRef; collection(p: string): ColRef }
type Profile = { id: string; name: string }
export type User = {
  id(): Promise<string | null>
  profiles(ids: string[]): Promise<Record<string, Profile>>
}

export class SetupNeededError extends Error {
  constructor() {
    super('This household has not been set up yet.')
  }
}

const TIMEOUT = 10_000
function timed<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Your saved data can't be reached right now. Check your connection and try again.")), TIMEOUT)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(new Error(errorText(e)))
      },
    )
  })
}

function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code
  if (code === 'invalid_argument') return 'You can view this household but not change it. Ask the owner to share it with you as a Contributor.'
  if (code === 'quota_exceeded') return 'The household database is full. Delete some old entries and try again.'
  if (code === 'resource_exhausted') return 'Too many changes at once. Wait a moment and try again.'
  if (code === 'revoked') return 'Your access to this household was changed. Reload the page.'
  return (e as { message?: string })?.message || 'Something went wrong. Try again.'
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
const kind = (v: unknown) => (v === 'income' ? 'income' : 'expense') as Entry['kind']

const toCategory = (s: Snap): Category & { order: number } => {
  const d = s.data() ?? {}
  return { id: s.id, name: str(d.name, 'Untitled'), kind: kind(d.kind), budget: typeof d.budget === 'number' ? d.budget : null, order: num(d.order, 999) }
}
const toEntry = (s: Snap): Entry => {
  const d = s.data() ?? {}
  return { id: s.id, kind: kind(d.kind), amount: num(d.amount), categoryId: str(d.categoryId), note: str(d.note), date: str(d.date), enteredBy: str(d.enteredBy) }
}
const toRecurring = (s: Snap): Recurring => {
  const d = s.data() ?? {}
  const cad = d.cadence === 'weekly' || d.cadence === 'yearly' ? d.cadence : 'monthly'
  return { id: s.id, name: str(d.name), kind: kind(d.kind), amount: num(d.amount), categoryId: str(d.categoryId), cadence: cad, nextDue: str(d.nextDue, today()) }
}
const toGoal = (s: Snap): Goal => {
  const d = s.data() ?? {}
  return { id: s.id, name: str(d.name), target: num(d.target), targetDate: typeof d.targetDate === 'string' ? d.targetDate : null }
}
const byDateDesc = (a: Entry, b: Entry) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
const strip = <T extends { id?: string }>(o: T) => {
  const { id: _id, ...rest } = o
  return rest as Record<string, unknown>
}

export function createDbStore(db: Db, user: User | null): Store & { setUp(): Promise<void>; subscribe(cb: () => void): () => void } {
  let myId: string | null | undefined
  const getMyId = async () => (myId === undefined ? (myId = (await user?.id()) ?? null) : myId)
  let joined = false

  /** Records the viewer as a member the first time they change something. */
  async function join() {
    const id = await getMyId()
    if (!id || joined) return
    const ref = db.doc(`members/${id}`)
    const snap = await ref.get()
    if (!snap.exists) await ref.set({ joinedAt: new Date().toISOString() })
    joined = true
  }

  async function members(): Promise<Member[]> {
    const [snap, me] = await Promise.all([db.collection('members').get(), getMyId()])
    const ids = snap.docs.map((d) => d.id)
    if (me && !ids.includes(me)) ids.unshift(me)
    if (!ids.length) return []
    const ps = user ? await user.profiles(ids) : {}
    return ids.map((id, i) => ({ id, name: ps[id]?.name || (id === me ? 'You' : `Member ${i + 1}`) }))
  }

  async function upsert(col: string, o: { id?: string } & Record<string, unknown>) {
    await join()
    if (o.id) await db.collection(col).doc(o.id).update(strip(o))
    else await db.collection(col).doc().set({ ...strip(o), createdAt: new Date().toISOString() })
  }

  async function addEntryRaw(e: Omit<Entry, 'id' | 'enteredBy'>) {
    await join()
    await db.collection('entries').doc().set({ ...e, enteredBy: (await getMyId()) ?? '', createdAt: new Date().toISOString() })
  }

  return {
    mode: 'shared',
    async me() {
      const id = await timed(getMyId())
      if (!id) return null
      const ms = await timed(members())
      return ms.find((m) => m.id === id) ?? { id, name: 'You' }
    },
    async household(): Promise<Household> {
      const [snap, ms] = await timed(Promise.all([db.doc('hh/main').get(), members()]))
      if (!snap.exists) throw new SetupNeededError()
      const d = snap.data() ?? {}
      return { id: 'main', name: str(d.name, 'Our household'), currency: str(d.currency, 'MYR'), openingBalance: num(d.openingBalance), inviteCode: null, members: ms }
    },
    async updateHousehold(patch) {
      await join()
      await timed(db.doc('hh/main').update(patch as Record<string, unknown>))
    },
    async categories() {
      const snap = await timed(db.collection('categories').get())
      return snap.docs
        .map(toCategory)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(({ order: _o, ...c }) => c)
    },
    async saveCategory(c) {
      await timed(upsert('categories', { ...c, budget: c.budget ?? null }))
    },
    async deleteCategory(id) {
      const used = await timed(db.collection('entries').where('categoryId', '==', id).limit(1).get())
      if (used.docs.length) throw new Error('This category has entries. Move or delete them first.')
      await timed(db.collection('categories').doc(id).delete())
    },
    async entries(from, to) {
      const snap = await timed(db.collection('entries').where('date', '>=', from).where('date', '<=', to).get())
      return snap.docs.map(toEntry).sort(byDateDesc)
    },
    async allEntries() {
      const snap = await timed(db.collection('entries').get())
      return snap.docs.map(toEntry).sort(byDateDesc)
    },
    async addEntry(e) {
      await timed(addEntryRaw(e))
    },
    async deleteEntry(id) {
      await timed(db.collection('entries').doc(id).delete())
    },
    async recurring() {
      const snap = await timed(db.collection('recurring').get())
      return snap.docs.map(toRecurring)
    },
    async saveRecurring(r) {
      await timed(upsert('recurring', r))
    },
    async deleteRecurring(id) {
      await timed(db.collection('recurring').doc(id).delete())
    },
    async confirmRecurring(id, amount) {
      const ref = db.collection('recurring').doc(id)
      const snap = await timed(ref.get())
      if (!snap.exists) return
      const r = toRecurring(snap)
      await timed(addEntryRaw({ kind: r.kind, amount, categoryId: r.categoryId, note: r.name, date: r.nextDue <= today() ? r.nextDue : today() }))
      await timed(ref.update({ nextDue: advance(r.nextDue, r.cadence) }))
    },
    async skipRecurring(id) {
      const ref = db.collection('recurring').doc(id)
      const snap = await timed(ref.get())
      if (!snap.exists) return
      const r = toRecurring(snap)
      await timed(ref.update({ nextDue: advance(r.nextDue, r.cadence) }))
    },
    async goals() {
      const snap = await timed(db.collection('goals').get())
      return snap.docs.map(toGoal)
    },
    async saveGoal(g) {
      await timed(upsert('goals', g))
    },
    async deleteGoal(id) {
      await timed(db.collection('goals').doc(id).delete())
    },

    /** First-time setup from a person's click: the household and the preset categories. */
    async setUp() {
      await timed(
        (async () => {
          await join()
          const existing = await db.collection('categories').limit(1).get()
          if (!existing.docs.length) {
            for (const [i, c] of PRESET_CATEGORIES.entries()) await db.collection('categories').doc().set({ ...c, order: i + 1 })
          }
          await db.doc('hh/main').set({ name: 'Our household', currency: 'MYR', openingBalance: 0 })
        })(),
      )
    },

    /** Calls back when another person changes something, so screens reload. One listener per collection. */
    subscribe(cb) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const ping = () => {
        clearTimeout(timer)
        timer = setTimeout(cb, 400)
      }
      const offs = ['hh', 'categories', 'entries', 'recurring', 'goals'].map((col) => {
        let first = true
        return db.collection(col).onSnapshot(
          () => {
            if (first) {
              first = false
              return
            }
            ping()
          },
          () => {},
        )
      })
      return () => {
        clearTimeout(timer)
        offs.forEach((off) => off())
      }
    },
  }
}
