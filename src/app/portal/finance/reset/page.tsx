import { FinancePasswordReset } from '@/components/finance/FinancePasswordReset'

export default function FinancePasswordResetPage({ searchParams }: { searchParams: { token?: string } }) {
  return <FinancePasswordReset token={searchParams.token ?? ''} />
}
