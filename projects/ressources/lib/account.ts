const MAX_NAME_LENGTH = 80

export function normalizeName(input: string): string {
  return input.trim().slice(0, MAX_NAME_LENGTH)
}

export function displayName(user: { name?: string | null; email: string }): string {
  const name = user.name?.trim()
  return name ? name : user.email
}
