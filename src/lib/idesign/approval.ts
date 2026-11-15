const PRE_APPROVAL_STATUSES = ['Entering Info', 'Lab Designing', 'Awaiting Approval']

export function getIDesignPlanApprovalState(latestProgress: string, planStatus: string | null) {
  // A canceled case was never necessarily approved, so only an explicitly approved plan counts.
  const implicitlyApproved = latestProgress !== 'Canceled' && !PRE_APPROVAL_STATUSES.includes(latestProgress)
  const approved = planStatus === 'approved' || implicitlyApproved
  return {
    approved,
    readyForApproval: latestProgress === 'Awaiting Approval' && !approved,
  }
}
