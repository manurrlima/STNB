export function isWorkspaceEmail(email: string | undefined | null, domain: string): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
}
