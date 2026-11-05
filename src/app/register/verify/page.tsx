import { VerifyRegistration } from '@/components/auth/VerifyRegistration'

export default function VerifyRegistrationPage({ searchParams }: {
  searchParams: { registrationId?: string; token?: string }
}) {
  return <VerifyRegistration
    registrationId={searchParams.registrationId ?? ''}
    token={searchParams.token ?? ''}
  />
}
