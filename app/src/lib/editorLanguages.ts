const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  stmd: 'stmd',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  py: 'python',
  rs: 'rust',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  lua: 'lua',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  r: 'r',
}

export type IconKind =
  | 'folder'
  | 'md'
  | 'stmd'
  | 'ts'
  | 'json'
  | 'code'
  | 'terminal'
  | 'image'
  | 'file'

const TS_FAMILY = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'])
const IMAGE_FAMILY = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])

/** Monaco language id for a file name. Unknown -> plaintext. */
export function getLanguageId(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return 'plaintext'
  const ext = filename.slice(dot + 1).toLowerCase()
  return BY_EXTENSION[ext] ?? 'plaintext'
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
}

/** MIME type for previewable images, null otherwise. */
export function imageMime(filename: string): string | null {  const dot = filename.lastIndexOf('.')
  if (dot < 0) return null
  return IMAGE_MIME[filename.slice(dot + 1).toLowerCase()] ?? null
}

/** Explorer icon bucket for a file name (folders handled by the caller). */
export function iconKind(filename: string): IconKind {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return 'file'
  const ext = filename.slice(dot + 1).toLowerCase()
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'md'
  if (ext === 'stmd') return 'stmd'
  if (TS_FAMILY.has(ext)) return 'ts'
  if (ext === 'json' || ext === 'jsonc') return 'json'
  if (IMAGE_FAMILY.has(ext)) return 'image'
  if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || ext === 'ps1') {
    return 'terminal'
  }
  if (BY_EXTENSION[ext]) return 'code'
  return 'file'
}
