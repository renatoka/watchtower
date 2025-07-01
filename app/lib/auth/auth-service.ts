import bcrypt from 'bcryptjs'
import { getDb } from '../database'
import {
  User,
  UserWithPassword,
  CreateUserRequest,
  LoginRequest,
} from './types'
import { generateToken } from './jwt'

export class AuthService {
  async login(
    credentials: LoginRequest,
    ipAddress?: string
  ): Promise<{ user: User; token: string }> {
    const db = getDb()

    try {
      const result = await db.query<UserWithPassword>(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [credentials.email.toLowerCase()]
      )

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password')
      }

      const userWithPassword = result.rows[0]

      const isValidPassword = await bcrypt.compare(
        credentials.password,
        userWithPassword.password_hash
      )

      if (!isValidPassword) {
        throw new Error('Invalid email or password')
      }

      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [
        userWithPassword.id,
      ])

      await db.query(
        'INSERT INTO auth_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
        [userWithPassword.id, 'login', ipAddress]
      )

      const { password_hash, ...user } = userWithPassword

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      })

      return { user: user as User, token }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const db = getDb()

    try {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [
        data.email.toLowerCase(),
      ])

      if (existing.rows.length > 0) {
        throw new Error('User with this email already exists')
      }

      const passwordHash = await bcrypt.hash(data.password, 10)

      const result = await db.query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role, created_at, updated_at`,
        [data.email.toLowerCase(), data.name, passwordHash, data.role || 'user']
      )

      return result.rows[0] as User
    } catch (error) {
      console.error('Create user error:', error)
      throw error
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const db = getDb()

    try {
      const result = await db.query(
        `SELECT id, email, name, role, created_at, updated_at
         FROM users WHERE id = $1 AND is_active = true`,
        [userId]
      )

      return result.rows[0] || null
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  async getAllUsers(): Promise<User[]> {
    const db = getDb()

    try {
      const result = await db.query(
        `SELECT id, email, name, role, created_at, updated_at, last_login
         FROM users WHERE is_active = true
         ORDER BY created_at DESC`
      )

      return result.rows as User[]
    } catch (error) {
      console.error('Get all users error:', error)
      return []
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const db = getDb()

    try {
      const passwordHash = await bcrypt.hash(newPassword, 10)

      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, userId]
      )
    } catch (error) {
      console.error('Update password error:', error)
      throw error
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const db = getDb()

    try {
      await db.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $2',
        [userId]
      )
    } catch (error) {
      console.error('Delete user error:', error)
      throw error
    }
  }
}

export const authService = new AuthService()
