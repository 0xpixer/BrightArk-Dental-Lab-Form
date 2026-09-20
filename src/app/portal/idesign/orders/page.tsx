import { IDesignOrdersTable } from '@/components/admin/IDesignOrdersTable'
import { IDesignCasesTable } from '@/components/admin/IDesignCasesTable'

export default function PortalIDesignOrdersPage() {
  return <div className="mx-auto max-w-7xl space-y-8"><IDesignCasesTable /><IDesignOrdersTable /></div>
}
