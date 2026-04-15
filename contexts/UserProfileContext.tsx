'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

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

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user-profile')
      const data = await res.json()
      if (data && !data.error) setProfile(data)
    } catch { /* keep existing */ }
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
