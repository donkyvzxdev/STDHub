/**
 * Technical error codes → human i18n keys. The UI never shows raw codes
 * like `ai-http-401` to regular users (§56, §94).
 */
export function errorKey(code: string): string {
  if (code === 'ai-unreachable' || code === 'search-unreachable') {
    return 'errors.offline'
  }
  if (code === 'ai-not-configured') return 'errors.aiFailed'
  if (code.startsWith('ai-')) return 'errors.aiFailed'
  if (code === 'search-needs-key') return 'errors.aiFailed'
  if (code.startsWith('search-')) return 'errors.generic'
  if (code === 'exists') return 'errors.exists'
  if (code === 'invalid-name') return 'errors.invalidName'
  if (code === 'not-found') return 'errors.notFound'
  if (code === 'empty') return 'errors.empty'
  return 'errors.generic'
}
