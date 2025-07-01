'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BarChart3, Settings, LogOut, User } from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'

export function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const navigation = [
    { name: 'Real-Time Data', href: '/realtime', icon: BarChart3 },
    { name: 'Manage Endpoints', href: '/endpoints', icon: Settings },
  ]

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={60}
                  height={60}
                  className="bg-transparent rounded-full h-full w-full"
                />
              </Link>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2">
                  <Chip
                    label={user.name || 'User'}
                    className="text-sm bg-gray-100 text-gray-800"
                    avatar={
                      <Avatar
                        alt={user.name || 'User Avatar'}
                        className="w-6 h-6"
                      >
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </Avatar>
                    }
                  />
                </div>
                <button
                  onClick={logout}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
