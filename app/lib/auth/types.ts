export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  createdAt: Date
  updatedAt: Date
}

export interface UserWithPassword extends User {
  password_hash: string
}

export interface JWTPayload {
  userId: string
  email: string
  role: 'admin' | 'user'
}

export interface LoginRequest {
  email: string
  password: string
}

export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role?: 'admin' | 'user'
}
