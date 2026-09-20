import { NewIDesignOrderForm } from '@/components/admin/NewIDesignOrderForm'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { canViewIDesign } from '@/lib/idesign/access'

export default async function NewIDesignOrderPage() {
  const session = await auth()
  if (!canViewIDesign(session?.user.role ?? '')) redirect('/admin/idesign/orders')
  return <NewIDesignOrderForm />
}
