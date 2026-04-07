import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Force Node.js runtime for middleware
export const runtime = 'nodejs'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Try to get user, but don't fail if Supabase is unavailable
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user
  } catch (error) {
    console.log('Supabase auth check skipped:', error instanceof Error ? error.message : 'Unknown error')
  }

  // Define protected routes
  const protectedRoutes = ['/dashboard', '/quote', '/products', '/customers', '/settings']
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Define auth routes (these should redirect to dashboard if already logged in)
  const authRoutes = ['/login', '/signup']
  const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // If user is not logged in and trying to access protected route
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and trying to access auth route
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}