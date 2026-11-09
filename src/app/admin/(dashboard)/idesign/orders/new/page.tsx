import { NewIDesignOrderForm } from '@/components/admin/NewIDesignOrderForm'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { canCreateIDesignCases } from '@/lib/idesign/access'

export default async function NewIDesignOrderPage() {
  const session = await auth()
  if (!canCreateIDesignCases(session?.user.role ?? '')) redirect('/admin/idesign/orders')
  return <NewIDesignOrderForm />
}
