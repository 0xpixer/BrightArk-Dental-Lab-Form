import { NewIDesignOrderForm } from '@/components/admin/NewIDesignOrderForm'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function NewIDesignOrderPage() {
  const session = await auth()
  if (session?.user.role !== 'superadmin') redirect('/admin/idesign/orders')
  return <NewIDesignOrderForm />
}
