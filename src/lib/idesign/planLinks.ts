export function getIDesignPlanReviewHref(caseId: number, versionNumber: number) {
  return `/api/idesign/cases/${caseId}/open?type=review&version=${versionNumber}`
}
