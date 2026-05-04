/** ADMIN або MANAGER — ті самі права, що й адмін, окрім керування обліковими записами користувачів (лише ADMIN). */
export function isElevatedRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

export function isStrictAdmin(role: string | undefined): boolean {
  return role === 'ADMIN'
}
