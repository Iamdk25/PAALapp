import { useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { authDevBypass } from '../lib/authMode'
import { DEV_BEARER_KEY } from '../lib/paalApiConstants'
import { PaalApiContext } from './paalApiContext'

function DevPaalApiProvider({ children }) {
  const value = useMemo(
    () => ({
      getToken: async () => {
        const custom = sessionStorage.getItem(DEV_BEARER_KEY)?.trim()
        return custom || 'local-dev-mock'
      },
    }),
    [],
  )
  return <PaalApiContext.Provider value={value}>{children}</PaalApiContext.Provider>
}

function ClerkPaalApiProvider({ children }) {
  const { getToken: clerkGetToken } = useAuth()
  const value = useMemo(
    () => ({
      getToken: async () => {
        const t = await clerkGetToken()
        if (t) return t
        const fallback = sessionStorage.getItem(DEV_BEARER_KEY)?.trim()
        return fallback || 'local-dev-mock'
      },
    }),
    [clerkGetToken],
  )
  return <PaalApiContext.Provider value={value}>{children}</PaalApiContext.Provider>
}

export function PaalApiProvider({ children }) {
  if (authDevBypass) {
    return <DevPaalApiProvider>{children}</DevPaalApiProvider>
  }
  return <ClerkPaalApiProvider>{children}</ClerkPaalApiProvider>
}
