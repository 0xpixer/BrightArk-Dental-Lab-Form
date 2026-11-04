const PRE_APPROVAL_STATUSES = ['Entering Info', 'Lab Designing', 'Awaiting Clin. Review']

export function getIDesignPlanApprovalState(latestProgress: string, planStatus: string | null) {
  const implicitlyApproved = !PRE_APPROVAL_STATUSES.includes(latestProgress)
  const approved = planStatus === 'approved' || implicitlyApproved
  return {
    approved,
    readyForApproval: latestProgress === 'Awaiting Clin. Review' && !approved,
  }
}
