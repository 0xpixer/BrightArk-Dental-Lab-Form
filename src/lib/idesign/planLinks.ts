export function getIDesignPlanHref(caseId: number) {
  return `/api/idesign/cases/${caseId}/open`
}

export function getIDesignPlanViewerHref(caseId: number, detailBase: string, returnTo: string) {
  return `${detailBase}/${caseId}/plan?returnTo=${encodeURIComponent(returnTo)}`
}

export function getSafeIDesignPlanReturnTo(value: string | string[] | undefined, listHref: string) {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate) return listHref
  return candidate === listHref || candidate.startsWith(`${listHref}?`) ? candidate : listHref
}
