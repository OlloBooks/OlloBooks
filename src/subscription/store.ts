import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Difficulty, Size } from '../sudoku/model.ts'

export type Subscriber = {
  email: string
  size: Size
  difficulty: Difficulty
  count: number
  includeAnswers: boolean
  createdAt: string
  unsubscribedAt: string | null
  lastSentOn: string | null
}

export type SubscriberStore = {
  get(email: string): Promise<Subscriber | null>
  list(): Promise<Subscriber[]>
  save(subscriber: Subscriber): Promise<void>
  markSent(email: string, day: string): Promise<void>
  unsubscribe(email: string, at: string): Promise<void>
}

const INDEX_KEY = 'ollobooks:subscriber-emails'

function recordKey(email: string): string {
  return `ollobooks:subscriber:${email}`
}

export function subscriberFilePath(): string {
  const root = process.env.SUBSCRIBER_STORE_DIR ?? path.join(process.cwd(), '.data')
  return path.join(root, 'subscribers.json')
}

export function memoryStore(seed: Subscriber[] = []): SubscriberStore {
  const records = new Map(seed.map((subscriber) => [subscriber.email, structuredClone(subscriber)]))
  return {
    async get(email) {
      const found = records.get(email)
      return found ? structuredClone(found) : null
    },
    async list() {
      return [...records.values()].map((subscriber) => structuredClone(subscriber))
    },
    async save(subscriber) {
      records.set(subscriber.email, structuredClone(subscriber))
    },
    async markSent(email, day) {
      const current = records.get(email)
      if (!current || current.unsubscribedAt) return
      current.lastSentOn = day
    },
    async unsubscribe(email, at) {
      const current = records.get(email)
      if (!current || current.unsubscribedAt) return
      current.unsubscribedAt = at
    },
  }
}

type FileData = Record<string, Subscriber>

let writeChain: Promise<void> = Promise.resolve()

export function createFileStore(): SubscriberStore {
  const file = () => subscriberFilePath()

  async function read(): Promise<FileData> {
    try {
      const parsed = JSON.parse(await readFile(file(), 'utf8')) as FileData
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
      return parsed
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return {}
      throw error
    }
  }

  function update(mutate: (data: FileData) => void): Promise<void> {
    const run = writeChain.then(async () => {
      const data = await read()
      mutate(data)
      const target = file()
      await mkdir(path.dirname(target), { recursive: true })
      const temporary = `${target}.${process.pid}.tmp`
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`)
      await rename(temporary, target)
    })
    writeChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    async get(email) {
      const data = await read()
      return data[email] ?? null
    },
    async list() {
      return Object.values(await read())
    },
    save(subscriber) {
      return update((data) => {
        data[subscriber.email] = subscriber
      })
    },
    markSent(email, day) {
      return update((data) => {
        const current = data[email]
        if (!current || current.unsubscribedAt) return
        current.lastSentOn = day
      })
    },
    unsubscribe(email, at) {
      return update((data) => {
        const current = data[email]
        if (!current || current.unsubscribedAt) return
        current.unsubscribedAt = at
      })
    },
  }
}

function createRedisStore(): SubscriberStore {
  let client: import('@upstash/redis').Redis | null = null

  async function redis() {
    if (!client) {
      const { Redis } = await import('@upstash/redis')
      client = Redis.fromEnv()
    }
    return client
  }

  return {
    async get(email) {
      return (await (await redis()).get<Subscriber>(recordKey(email))) ?? null
    },
    async list() {
      const emails = await (await redis()).smembers(INDEX_KEY)
      const subscribers: Subscriber[] = []
      for (const email of emails) {
        const subscriber = await (await redis()).get<Subscriber>(recordKey(email))
        if (subscriber) subscribers.push(subscriber)
      }
      return subscribers
    },
    async save(subscriber) {
      const db = await redis()
      await db.set(recordKey(subscriber.email), subscriber)
      await db.sadd(INDEX_KEY, subscriber.email)
    },
    async markSent(email, day) {
      const current = await this.get(email)
      if (!current || current.unsubscribedAt) return
      await this.save({ ...current, lastSentOn: day })
    },
    async unsubscribe(email, at) {
      const current = await this.get(email)
      if (!current || current.unsubscribedAt) return
      await this.save({ ...current, unsubscribedAt: at })
    },
  }
}

export function createStore(): SubscriberStore {
  if (process.env.UPSTASH_REDIS_REST_URL) return createRedisStore()
  return createFileStore()
}
