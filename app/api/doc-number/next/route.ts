import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { getNextDocNumber, type DocType } from '@/lib/docNumber'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { doc_type } = await request.json()
    if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 })

    const number = await getNextDocNumber(user.id, doc_type as DocType)
    return NextResponse.json({ number })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
