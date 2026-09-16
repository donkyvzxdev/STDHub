// STDHub e2e — in-memory File System Access API stub + seeded fixtures.
// Injected via Playwright addInitScript BEFORE the app boots, so the real
// production WebFileProvider + ExplorerTree + EditorView run unmodified
// against a fake disk. Real (trusted) mouse events exercise the real path.
;(() => {
  const files = new Map()
  files.set('estudos', { isDir: true })
  files.set('estudos/matematica', { isDir: true })
  files.set('estudos/matematica/algebra.md', {
    isDir: false,
    content: '# Algebra\n\n- equacao do 2o grau\n',
  })
  files.set('estudos/matematica/geo.md', {
    isDir: false,
    content: '# Geometria\n\n- pitagoras\n',
  })
  files.set('estudos/fisica.md', {
    isDir: false,
    content: '# Fisica\n\n- cinematica\n',
  })

  const enc = new TextEncoder()
  const dec = new TextDecoder()

  function toBytes(content) {
    if (content instanceof Uint8Array) return content
    return enc.encode(content ?? '')
  }

  function notFound() {
    return new DOMException('not found', 'NotFoundError')
  }
  function mismatch() {
    return new DOMException('type mismatch', 'TypeMismatchError')
  }

  function makeFileHandle(path, name) {
    return {
      kind: 'file',
      name,
      async getFile() {
        const e = files.get(path)
        if (!e || e.isDir) throw notFound()
        return new File([toBytes(e.content)], name)
      },
      async createWritable() {
        const chunks = []
        return {
          async write(data) {
            if (typeof data === 'string') chunks.push(enc.encode(data))
            else chunks.push(new Uint8Array(data))
          },
          async close() {
            const total = chunks.reduce((n, b) => n + b.length, 0)
            const out = new Uint8Array(total)
            let o = 0
            for (const b of chunks) {
              out.set(b, o)
              o += b.length
            }
            files.set(path, { isDir: false, content: out })
          },
        }
      },
    }
  }

  function makeDirHandle(path, name) {
    return {
      kind: 'directory',
      name,
      async *values() {
        const prefix = `${path}/`
        const seen = new Set()
        for (const [p, e] of files) {
          if (!p.startsWith(prefix)) continue
          const rest = p.slice(prefix.length)
          if (!rest || rest.includes('/') || seen.has(rest)) continue
          seen.add(rest)
          yield e.isDir ? makeDirHandle(p, rest) : makeFileHandle(p, rest)
        }
      },
      async getFileHandle(childName, options) {
        const full = `${path}/${childName}`
        const e = files.get(full)
        if (e) {
          if (e.isDir) throw mismatch()
          return makeFileHandle(full, childName)
        }
        if (options && options.create) {
          files.set(full, { isDir: false, content: '' })
          return makeFileHandle(full, childName)
        }
        throw notFound()
      },
      async getDirectoryHandle(childName, options) {
        const full = `${path}/${childName}`
        const e = files.get(full)
        if (e) {
          if (!e.isDir) throw mismatch()
          return makeDirHandle(full, childName)
        }
        if (options && options.create) {
          files.set(full, { isDir: true })
          return makeDirHandle(full, childName)
        }
        throw notFound()
      },
      async removeEntry(childName, options) {
        const full = `${path}/${childName}`
        const e = files.get(full)
        if (!e) throw notFound()
        if (e.isDir && !(options && options.recursive)) {
          for (const p of files.keys()) {
            if (p.startsWith(`${full}/`)) {
              throw new DOMException('not empty', 'InvalidModificationError')
            }
          }
        }
        for (const p of [...files.keys()]) {
          if (p === full || p.startsWith(`${full}/`)) files.delete(p)
        }
      },
    }
  }

  window.showDirectoryPicker = async () => makeDirHandle('estudos', 'estudos')

  window.__memfsDump = () => {
    const out = {}
    for (const [p, e] of files) {
      if (!e.isDir) out[p] = dec.decode(toBytes(e.content))
    }
    return out
  }

  try {
    window.localStorage.setItem('stdhub.language', 'en')
  } catch {
    // ignore (private mode)
  }
})()
