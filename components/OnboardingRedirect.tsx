'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Rendered by AppLayout when the user has no company_name yet.
 * Silently redirects to /onboarding unless already there.
 */
export function OnboardingRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname.startsWith('/onboarding')) {
      router.replace('/onboarding')
    }
  }, [pathname, router])

  return null
}
