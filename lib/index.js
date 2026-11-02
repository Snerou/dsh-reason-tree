/**
 * dsh-reason-tree — 根源追溯法面板（host 侧）
 * ---------------------------------------------------------------------------
 * 扫描一个目录里的 .md 追溯文件，解析成「从下往上的树」：
 *   第一行 `# 结论：xxx` 是结论，下面的缩进列表是理由，行首 `[+]` 成立 / `[-]` 不成立 / `[?]` 待拆。
 * 前端负责画，这里只负责读文件和改状态。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NS = 'dsh-reason-tree'
const ROUTE = '/dsh-reason-tree'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.resolve(HERE, 'assets')
const ASSET_MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }

/** 工作区：DSH 给的环境变量优先，没有就退回默认安装位置。 */
function resolveWorkspace() {
  const env = process.env.DSH_WORKSPACE || process.env.DSH_CWD || ''
  if (env) { try { if (fs.statSync(env).isDirectory()) return env } catch { } }
  const guess = path.join(os.homedir(), 'Documents', 'deepseek-harness', 'default-workspace')
  try { return fs.statSync(guess).isDirectory() ? guess : '' } catch { return '' }
}

// 记忆文件只允许在受控的根下面读，避免这个面板变成任意文件读取器。
// 默认只放工作区和 ~/.dsh；别的目录在 ~/.dsh/dsh-reason-tree.json 的 readRoots 里加。
let READ_ROOTS_CACHE = null

function readRoots() {
  if (READ_ROOTS_CACHE) return READ_ROOTS_CACHE
  const cfg = readConfig()
  const list = [resolveWorkspace(), process.env.DSH_HOME || path.join(os.homedir(), '.dsh')]
  for (const r of cfg.readRoots || []) if (typeof r === 'string' && r) list.push(r)
  const seen = new Set()
  const out = []
  for (const r of list) {
    let full
    try { full = path.resolve(r) } catch { continue }
    if (seen.has(full.toLowerCase())) continue
    seen.add(full.toLowerCase())
    out.push(full)
  }
  READ_ROOTS_CACHE = out
  return out
}

function insideRoots(full) {
  return readRoots().some((root) => full === root || full.startsWith(root + path.sep))
}

// 给「关联记忆」用：拿一个文件的路径/大小/前 160 行。
// path 支持 `topic:<key>`，去 soul-md 的记忆目录里找 topics/<key>.md。
function resolveTopic(key) {
  const base = path.join(os.homedir(), '.dsh', 'soul-md', 'memory')
  let cards = []
  try { cards = fs.readdirSync(base) } catch { return '' }
  for (const card of cards) {
    const p = path.join(base, card, 'topics', key + '.md')
    if (fs.existsSync(p)) return p
  }
  return ''
}

function readMemory(p) {
  if (!p) return { ok: false, error: '路径为空' }
  if (p.startsWith('topic:')) {
    const key = p.slice(6).trim()
    if (!/^[\w\u4e00-\u9fa5.-]+$/.test(key)) return { ok: false, error: '主题名不合法' }
    const found = resolveTopic(key)
    if (!found) return { ok: false, error: '找不到记忆主题「' + key + '」' }
    return readMemory(found)
  }
  let full
  try { full = path.resolve(p) } catch { return { ok: false, error: '路径不合法' } }
  if (!insideRoots(full)) return { ok: false, error: '不在允许读取的目录里' }
  let st
  try { st = fs.statSync(full) } catch { return { ok: false, error: '找不到这个文件' } }
  if (!st.isFile()) return { ok: false, error: '不是文件' }
  if (st.size > 2 * 1024 * 1024) return { ok: false, error: '文件超过 2MB，不展开' }
  let text = ''
  try { text = fs.readFileSync(full, 'utf8') } catch (e) { return { ok: false, error: String(e && e.message || e) } }
  const lines = text.split(/\r?\n/)
  return {
    ok: true,
    path: full,
    name: path.basename(full),
    dir: path.dirname(full),
    size: st.size,
    mtime: st.mtime.toISOString(),
    total: lines.length,
    excerpt: lines.slice(0, 160).join('\n'),
    truncated: lines.length > 160
  }
}

function readConfig() {
  try {
    const f = path.join(os.homedir(), '.dsh', 'dsh-reason-tree.json')
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')
      return JSON.parse(raw) || {}
    }
  } catch { }
  return {}
}

function resolveDir() {
  const cfg = readConfig()
  if (cfg.dir) return cfg.dir
  const ws = process.env.DSH_WORKSPACE || process.cwd()
  return path.join(ws, 'trace')
}

// 行尾引用：`→ 记忆:env-qq`（记忆主题）或 `→ 文件:tools/x.py`（磁盘文件）。
// 解析时剥掉，正文只留结论/理由本身，引用另存到 node.mem。
const MEMO_RE = /\s*(?:→|->|>)\s*(记忆|文件|memory|file)\s*[:：]\s*(.+?)\s*$/

function splitMemo(label) {
  const m = MEMO_RE.exec(label)
  if (!m) return { text: label, mem: null }
  const kind = m[1] === '文件' || m[1] === 'file' ? 'file' : 'topic'
  const body = label.slice(0, m.index).trim()
  if (!body) return { text: label, mem: null }
  return { text: body, mem: { kind, key: m[2].trim() } }
}

function parseTrace(text, file) {  const lines = text.split(/\r?\n/)
  let title = file.replace(/\.md$/i, '')
  const roots = []
  const stack = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!stack.length && !roots.length && /^---\s*$/.test(trimmed)) continue
    if (stack.length && /^---\s*$/.test(trimmed)) break
    const h = /^#\s+(.+)$/.exec(trimmed)
    if (h) { title = h[1].trim().replace(/^结论[：:]\s*/, ''); continue }
    const m = /^(\s*)-\s*(?:\[([+\-?])\]\s*)?(.+)$/.exec(raw)
    if (!m) continue
    const indent = m[1].replace(/\t/g, '  ').length
    const depth = Math.floor(indent / 2) + 1
    const label = m[3].trim()
    if (!label) continue
    const sp = splitMemo(label)
    const node = { id: i, text: sp.text, status: m[2] || '?', children: [] }
    if (sp.mem) node.mem = sp.mem
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    if (stack.length) stack[stack.length - 1].node.children.push(node)
    else roots.push(node)
    stack.push({ depth, node })
  }
  // 结论本身也做成根节点，多条并列理由才能挂成同一棵树
  const rootText = title.replace(/^结论[：:]\s*/, '')
  const rootNode = { id: 'root', text: rootText, status: '*', children: roots }
  return { file, title, roots: [rootNode] }
}

function readAll() {
  const dir = resolveDir()
  const trees = []
  let names = []
  try {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      names = fs.readdirSync(dir).filter((n) => /\.md$/i.test(n))
    }
  } catch { }
  for (const name of names) {
    try {
      const text = fs.readFileSync(path.join(dir, name), 'utf8')
      const t = parseTrace(text, name)
      if (t.roots.length) trees.push(t)
    } catch { }
  }
  return { dir, trees }
}

function writeStatus(file, line, status) {
  if (!/^[+\-?]$/.test(status)) return { ok: false, error: 'bad status' }
  const full = path.join(resolveDir(), file)
  if (!fs.existsSync(full)) return { ok: false, error: 'file not found' }
  const raw = fs.readFileSync(full, 'utf8')
  const lines = raw.split(/\r?\n/)
  const i = Number(line)
  if (!Number.isInteger(i) || i < 0 || i >= lines.length) return { ok: false, error: 'bad line' }
  const m = /^(\s*-\s*)\[([+\-?])\](.*)$/.exec(lines[i])
  if (!m) return { ok: false, error: 'line is not a trace item' }
  lines[i] = m[1] + '[' + status + ']' + m[3]
  fs.writeFileSync(full, lines.join('\n'), 'utf8')
  return { ok: true }
}

function createTrace(title) {
  const dir = resolveDir()
  const name = String(title || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!name) return { ok: false, error: '标题不能为空' }
  try { fs.mkdirSync(dir, { recursive: true }) } catch { }
  let file = name + '.md'
  let i = 2
  while (fs.existsSync(path.join(dir, file))) { file = name + ' ' + i + '.md'; i++ }
  const content = '# 结论：' + name + '\n\n- [?] \n\n---\n\n写给自己：\n'
  try {
    fs.writeFileSync(path.join(dir, file), content, 'utf8')
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
  cache = null
  return { ok: true, file }
}

let cache = null
let cacheAt = 0
const TTL = 4000

function trees(force) {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache
  cache = readAll()
  cacheAt = Date.now()
  return cache
}

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length)
  })
  res.end(body)
}

function rejected(ctx, req, res) {
  try {
    const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
    if (!conn || typeof conn.requestRejection !== 'function') return false
    const code = conn.requestRejection(req)
    if (code === undefined || code === null || code === false) return false
    res.statusCode = typeof code === 'number' ? code : 403
    res.end()
    return true
  } catch { return false }
}

export const name = NS
export const inject = ['webServer', 'connection']

export function apply(ctx, config) {
  const cfg = Object.assign(readConfig(), config || {})

  let webServer
  try { webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined } catch { }
  webServer = webServer || ctx.webServer
  if (!webServer || typeof webServer.register !== 'function') {
    ctx.logger?.warn?.('[' + NS + '] 没有可用的 webServer，追溯面板不可用')
    return
  }

  const disposers = []
  const wrap = (route) => Object.assign({}, route, {
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      try { return route.handler(req, res) } catch (err) {
        sendJson(res, 500, { ok: false, error: String(err && err.message || err) })
      }
    }
  })

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/trees',
    handler: (req, res) => {
      const force = (req.url || '').includes('force=1')
      const data = trees(force)
      sendJson(res, 200, { ok: true, dir: cfg.dir || resolveDir(), trees: data.trees })
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/status',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const file = url.searchParams.get('file') || ''
      const line = url.searchParams.get('line') || ''
      const status = url.searchParams.get('status') || ''
      const r = writeStatus(file, line, status)
      if (!r.ok) { sendJson(res, 400, r); return }
      cache = null
      sendJson(res, 200, { ok: true })
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/create',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const title = url.searchParams.get('title') || ''
      const r = createTrace(title)
      if (!r.ok) { sendJson(res, 400, r); return }
      sendJson(res, 200, r)
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/read',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const p = url.searchParams.get('path') || ''
      sendJson(res, 200, readMemory(p))
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/asset',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const name = url.searchParams.get('name') || ''
      if (!/^[a-z0-9._-]+\.(mp3|ogg|wav)$/i.test(name)) { res.statusCode = 400; res.end(); return }
      const full = path.join(ASSET_DIR, name)
      if (!full.startsWith(ASSET_DIR)) { res.statusCode = 400; res.end(); return }
      let buf
      try { buf = fs.readFileSync(full) } catch { res.statusCode = 404; res.end(); return }
      const ext = path.extname(full).toLowerCase()
      res.writeHead(200, {
        'Content-Type': ASSET_MIME[ext] || 'application/octet-stream',
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=86400'
      })
      res.end(buf)
    }
  })))

  ctx.effect(() => () => {
    for (const d of disposers) { try { d() } catch { } }
  })
}
