import { createContext, useContext, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { authDevBypass } from '../lib/authMode'

const StorageScopeContext = createContext({
  scopeId: '__dev_local__',
  isReady: true,
})

function ClerkStorageScopeBridge({ children }) {
  const { isLoaded, userId } = useAuth()
  const value = useMemo(
    () => ({ scopeId: userId ?? null, isReady: isLoaded }),
    [isLoaded, userId],
  )
  return <StorageScopeContext.Provider value={value}>{children}</StorageScopeContext.Provider>
}

export function StorageScopeProvider({ children }) {
  if (authDevBypass) {
    return (
      <StorageScopeContext.Provider value={{ scopeId: '__dev_local__', isReady: true }}>
        {children}
      </StorageScopeContext.Provider>
    )
  }
  return <ClerkStorageScopeBridge>{children}</ClerkStorageScopeBridge>
}

export function usePaalStorageScope() {
  return useContext(StorageScopeContext)
}
