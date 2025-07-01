import { Pool } from 'pg'

let pool: Pool | null = null
let isInitialized = false

export function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,

      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err)
    })

    console.log('Database pool created')
  }

  return pool
}

export async function testConnection() {
  const db = getDb()

  try {
    const client = await db.connect()
    await client.query('SELECT NOW()')
    client.release()
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

export async function initializeDatabase() {
  if (isInitialized) {
    return
  }

  const db = getDb()

  try {
    const isConnected = await testConnection()
    if (!isConnected) {
      throw new Error('Cannot connect to database')
    }

    const result = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('endpoints', 'uptime_checks')
    `)

    if (result.rows.length < 2) {
      console.warn('⚠️ Database tables may not be initialized properly')
    } else {
      console.log('✅ Database tables verified')
    }

    isInitialized = true
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    throw error
  }
}

if (typeof window === 'undefined') {
  setTimeout(() => {
    initializeDatabase().catch(console.error)
  }, 1000)
}
