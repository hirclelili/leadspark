import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

/**
 * Diagnostic endpoint – returns raw DB state for the current user's profile.
 * Visit /api/debug-profile in the browser to see what's actually in the DB.
 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated', hint: '请先登录' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // 1. placeholder (rpc check removed for type safety)

    // 2. Try to read all rows for this user (no .single() to catch duplicates)
    const { data: rows, error: rowsErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)

    // 3. Count total rows in table (to see if table exists at all)
    const { count, error: countErr } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      rows_for_user: rows,
      rows_error: rowsErr?.message ?? null,
      total_rows_in_table: count,
      count_error: countErr?.message ?? null,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
