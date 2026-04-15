'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

export interface UserProfile {
  company_name?: string
  company_name_cn?: string
  logo_url?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  default_currency?: string
  default_payment_terms?: string
  default_validity?: number
  bank_name?: string
  bank_account?: string
  bank_swift?: string
  bank_beneficiary?: string
  bank_address?: string
}

interface UserProfileContextValue {
  profile: UserProfile | null
  /** Call after saving settings to sync the context. */
  refreshProfile: () => Promise<void>
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  refreshProfile: async () => {},
})

export function UserProfileProvider({
  initialProfile,
  children,
}: {
  initialProfile: UserProfile | null
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile)

  // Sync state when the server layout passes a new initialProfile (happens on
  // client-side navigation — layout re-renders with fresh server data, but
  // useState() ignores prop changes after first mount without this effect).
  const prevInitialRef = useRef(initialProfile)
  useEffect(() => {
    if (initialProfile !== prevInitialRef.current) {
      prevInitialRef.current = initialProfile
      // Only overwrite if the server gave us real data; keep client-refreshed
      // data if server returned null (e.g. layout cached stale null)
      if (initialProfile != null) {
        setProfile(initialProfile)
      }
    }
  }, [initialProfile])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user-profile')
      if (!res.ok) {
        console.warn('[UserProfile] GET /api/user-profile returned', res.status)
        return
      }
      const data = await res.json()
      if (data && !data.error) {
        setProfile(data)
      } else {
        console.warn('[UserProfile] refreshProfile got unexpected data:', data)
      }
    } catch (err) {
      console.error('[UserProfile] refreshProfile failed:', err)
    }
  }, [])

  return (
    <UserProfileContext.Provider value={{ profile, refreshProfile }}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  return useContext(UserProfileContext)
}
