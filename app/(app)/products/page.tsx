import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProductsClient } from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <ProductsClient />
}