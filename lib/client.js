/* ============================================================================
 * dsh-reason-tree — 根源追溯面板（浏览器半侧）
 * ----------------------------------------------------------------------------
 * 把 .md 追溯文件画成一棵从下往上长的树：结论在底部，理由往上一层。
 * 节点颜色 = 判定状态；点节点看全文，点按钮改状态（写回文件）。
 * 手写 ModuleLoader bundle，不用构建。
 * ========================================================================== */

window.__ModuleLoader__.load({
  id: 'dsh-reason-tree',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement
    var useEffect = react.useEffect
    var useRef = react.useRef
    var useState = react.useState
    var useCallback = react.useCallback

    var API = '/dsh-reason-tree'

    var ST = {
      '+': { color: '#68e0a8', label: '成立', ring: 'rgba(104,224,168,.55)' },
      '-': { color: '#ff6b8a', label: '不成立', ring: 'rgba(255,107,138,.55)' },
      '?': { color: '#8fa8c8', label: '待拆', ring: 'rgba(143,168,200,.45)' },
      '*': { color: '#b78cff', label: '结论', ring: 'rgba(183,140,255,.6)' }
    }

    /* ── 样式 ────────────────────────────────────────────────────────────── */
    var CSS = [
      '.tr-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:#05070d;color:#cfe0f5;overflow:hidden;font-size:12px}',
      '.tr-bar{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(120,180,255,.12);background:linear-gradient(180deg,rgba(12,20,34,.9),rgba(6,10,18,.6))}',
      '.tr-title{font-size:13px;font-weight:600;letter-spacing:.14em;color:#dceaff;display:flex;align-items:center;gap:8px}',
      '.tr-dot{width:6px;height:6px;border-radius:50%;background:#b78cff;box-shadow:0 0 10px #b78cff,0 0 20px rgba(183,140,255,.6);animation:tr-pulse 2.4s ease-in-out infinite}',
      '@keyframes tr-pulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}',
      '.tr-tabs{margin-left:auto;display:flex;align-items:center;gap:6px;max-width:60%;overflow:auto}',
      '.tr-tab{background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.16);color:#8fa8c8;border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;white-space:nowrap;transition:.15s}',
      '.tr-tab:hover{color:#dceaff;border-color:rgba(183,140,255,.45)}',
      '.tr-tab.on{color:#f0e6ff;border-color:rgba(183,140,255,.65);background:rgba(183,140,255,.14)}',
      '.tr-sel{max-width:220px;background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.18);color:#dceaff;border-radius:999px;padding:4px 10px;font-size:11px;outline:none;cursor:pointer}',
      '.tr-sel option{background:#0b1320;color:#dceaff}',
      '.tr-input{width:230px;background:rgba(255,255,255,.05);border:1px solid rgba(183,140,255,.5);color:#dceaff;border-radius:999px;padding:4px 11px;font-size:11px;outline:none;box-shadow:0 0 0 3px rgba(183,140,255,.1)}',
      '.tr-btn{background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.18);color:#9dbbdd;border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;transition:.15s}',
      '.tr-btn:hover{color:#dceaff;border-color:rgba(183,140,255,.45);background:rgba(183,140,255,.08)}',
      '.tr-stage{position:relative;flex:1;min-height:0}',
      '.tr-canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}',
      '.tr-canvas.dragging{cursor:grabbing}',
      '.tr-detail{position:absolute;left:14px;bottom:14px;width:min(460px,calc(100% - 28px));background:rgba(8,14,24,.94);border:1px solid rgba(120,180,255,.2);border-radius:12px;padding:12px 14px;backdrop-filter:blur(14px);box-shadow:0 18px 50px rgba(0,0,0,.55)}',
      '.tr-detail-t{font-size:12px;line-height:1.65;color:#eaf2ff;margin-bottom:10px;word-break:break-word}',
      '.tr-detail-x{position:absolute;right:8px;top:6px;width:20px;height:20px;border-radius:50%;border:0;background:transparent;color:#6f8ab0;cursor:pointer;font-size:14px;line-height:1}',
      '.tr-detail-x:hover{color:#ff7ab8}',
      '.tr-set{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tr-set-k{font-size:10px;color:#5f7a9e;letter-spacing:.1em}',
      '.tr-sbtn{border-radius:999px;padding:4px 12px;font-size:11px;cursor:pointer;border:1px solid;background:transparent;transition:.15s}',
      '.tr-sbtn.yes{color:#68e0a8;border-color:rgba(104,224,168,.45)}',
      '.tr-sbtn.yes.on{background:rgba(104,224,168,.18);box-shadow:0 0 14px rgba(104,224,168,.25)}',
      '.tr-sbtn.no{color:#ff6b8a;border-color:rgba(255,107,138,.45)}',
      '.tr-sbtn.no.on{background:rgba(255,107,138,.18);box-shadow:0 0 14px rgba(255,107,138,.25)}',
      '.tr-sbtn.q{color:#8fa8c8;border-color:rgba(143,168,200,.4)}',
      '.tr-sbtn.q.on{background:rgba(143,168,200,.18)}',
      '.tr-sbtn.mem{color:#b78cff;border-color:rgba(183,140,255,.5);margin-left:6px}',
      '.tr-sbtn.mem:hover{background:rgba(183,140,255,.16);box-shadow:0 0 14px rgba(183,140,255,.28)}',
      '.tr-legend{flex:none;display:flex;flex-wrap:wrap;gap:14px;padding:8px 14px;border-top:1px solid rgba(120,180,255,.1);background:rgba(4,8,14,.7)}',
      '.tr-lg{display:flex;align-items:center;gap:5px;font-size:10px;color:#6f8ab0;letter-spacing:.05em}',
      '.tr-lg i{width:7px;height:7px;border-radius:50%;display:block}',
      '.tr-hint{position:absolute;right:14px;bottom:12px;font-size:10px;color:#4d637f;letter-spacing:.05em;pointer-events:none;text-align:right}',
      '.tr-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5f7a9e;font-size:12px;text-align:center;line-height:2}',
      '.tr-zoom{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;gap:6px;z-index:3}',
      '.tr-zbtn{width:32px;height:32px;border-radius:50%;border:1px solid rgba(120,180,255,.24);background:rgba(8,16,28,.82);color:#9dbbdd;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);transition:.15s;user-select:none;padding:0}',
      '.tr-zbtn:hover{color:#dff0ff;border-color:rgba(183,140,255,.6);background:rgba(183,140,255,.14)}',
      '.tr-zbtn.sm{width:26px;height:26px;font-size:13px;opacity:.8}',
      '.tr-vol{display:flex;align-items:center;gap:6px;background:rgba(8,16,28,.82);border:1px solid rgba(120,180,255,.24);border-radius:999px;padding:4px 8px;backdrop-filter:blur(10px)}',
      '.tr-vol input{width:70px;accent-color:#b78cff;cursor:pointer;height:14px}',
      '.tr-vol-m{width:24px;height:24px;border:0;background:transparent;color:#9dbbdd;cursor:pointer;font-size:12px;padding:0;line-height:1}',
      '.tr-vol-m:hover{color:#dff0ff}',
      /* 关联记忆（与海马体联动） */
      '.tr-mem{margin-top:10px;border-top:1px solid rgba(120,180,255,.16);padding-top:9px}',
      '.tr-mem-k{font-size:10px;color:#5f7a9e;letter-spacing:.1em;margin-bottom:6px}',
      '.tr-mem-f{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#bfe0ff;margin-bottom:3px}',
      '.tr-mem-p{font-size:10px;color:#7e97b8;word-break:break-all;line-height:1.5;margin-bottom:5px;user-select:text}',
      '.tr-mem-m{font-size:10px;color:#5f7a9e;margin-bottom:6px}',
      '.tr-mem-x{font-family:ui-monospace,Consolas,monospace;font-size:10px;line-height:1.55;color:#9fb8d8;background:rgba(10,18,30,.75);border:1px solid rgba(120,180,255,.12);border-radius:8px;padding:7px 9px;max-height:130px;overflow:auto;white-space:pre-wrap;margin-bottom:7px}',
      '.tr-mem-a{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.tr-mem-b{border-radius:999px;padding:4px 11px;font-size:10.5px;cursor:pointer;border:1px solid rgba(183,140,255,.42);background:rgba(183,140,255,.12);color:#dcc8ff;transition:.15s}',
      '.tr-mem-b:hover{background:rgba(183,140,255,.24);border-color:rgba(183,140,255,.7)}',
      '.tr-mem-b.ghost{border-color:rgba(120,180,255,.3);background:transparent;color:#9dbbdd}',
      '.tr-mem-b.ghost:hover{background:rgba(120,180,255,.12);color:#dff0ff}',
      '.tr-mem-e{font-size:10px;color:#ff8fa8;line-height:1.5}',
      '.tr-mem-tip{font-size:10px;color:#8fd8b0;margin-left:2px}',
      '.tr-jump-tip{font-size:10.5px;color:#8fd8b0;margin-top:6px;line-height:1.5}'
    ].join('')

    if (typeof document !== 'undefined' && !document.querySelector('style[data-tr="1"]')) {
      var tag = document.createElement('style')
      tag.dataset.tr = '1'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 图标 ────────────────────────────────────────────────────────────── */
    function Icon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
        h('path', { d: 'M12 21V13', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', opacity: .8 }),
        h('path', { d: 'M12 13 5 7M12 13l7-6M12 21v0', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', opacity: .55 }),
        h('circle', { cx: 12, cy: 21, r: 2.2, fill: 'currentColor' }),
        h('circle', { cx: 5, cy: 6.2, r: 1.8, fill: 'currentColor', opacity: .8 }),
        h('circle', { cx: 19, cy: 6.2, r: 1.8, fill: 'currentColor', opacity: .8 })
      )
    }

    /* ── 布局：从下往上的树 ─────────────────────────────────────────────── */
    var NODE_W = 200
    var NODE_H = 44
    var INDENT = 236
    var ROW_H = 62

    function prepare(root) {
      var nodes = []
      var row = 0
      function walk(n, depth) {
        n._d = depth
        n._row = row++
        n._x = depth * INDENT
        n._y = -n._row * ROW_H
        n._kids = n.children || []
        nodes.push(n)
        for (var i = 0; i < n._kids.length; i++) walk(n._kids[i], depth + 1)
      }
      walk(root, 0)
      var minX = 0, maxX = 0, maxD = 0, maxRow = 0
      for (var i = 0; i < nodes.length; i++) {
        minX = Math.min(minX, nodes[i]._x)
        maxX = Math.max(maxX, nodes[i]._x)
        maxD = Math.max(maxD, nodes[i]._d)
        maxRow = Math.max(maxRow, nodes[i]._row)
      }
      return { root: root, nodes: nodes, minX: minX, maxX: maxX, maxD: maxD, maxRow: maxRow }
    }

    function createEngine(canvas, cb) {
      var ctx = canvas.getContext('2d')
      var dpr = Math.min(2, window.devicePixelRatio || 1)
      var tree = null
      var view = { k: 1, tx: 0, ty: 0 }
      var drag = null
      var hover = null
      var selected = null
      var w = 0, hh = 0
      var raf = 0
      var alive = true
      var t0 = performance.now()

      function resize() {
        var rect = canvas.parentElement.getBoundingClientRect()
        w = Math.max(120, rect.width)
        hh = Math.max(120, rect.height)
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(hh * dpr)
        canvas.style.width = w + 'px'
        canvas.style.height = hh + 'px'
      }

      function nodeY(n) { return n._y }
      function nodeX(n) { return n._x }

      function fit() {
        if (!tree || !w || !hh) return
        var spanX = tree.maxX - tree.minX + NODE_W + 60
        var kx = (w - 30) / spanX
        view.k = Math.max(0.62, Math.min(1.0, kx))
        view.tx = 16 - tree.minX * view.k
        view.ty = hh - 46 - tree.root._y * view.k
      }

      function toScreen(n) {
        return { x: nodeX(n) * view.k + view.tx, y: nodeY(n) * view.k + view.ty }
      }

      function hit(px, py) {
        if (!tree) return null
        for (var i = 0; i < tree.nodes.length; i++) {
          var n = tree.nodes[i]
          var p = toScreen(n)
          if (px >= p.x - (NODE_W * view.k) / 2 && px <= p.x + (NODE_W * view.k) / 2 &&
            py >= p.y - (NODE_H * view.k) / 2 && py <= p.y + (NODE_H * view.k) / 2) return n
        }
        return null
      }

      function draw() {
        if (!alive) return
        var t = (performance.now() - t0) / 1000
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        var g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.7, 0, canvas.width / 2, canvas.height * 0.7, Math.max(canvas.width, canvas.height) * 0.7)
        g.addColorStop(0, '#081120')
        g.addColorStop(0.6, '#040810')
        g.addColorStop(1, '#02040a')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (tree) {
          // 连线 + 沿线的流动光球
          for (var i = 0; i < tree.nodes.length; i++) {
            var n = tree.nodes[i]
            if (!n._kids.length) continue
            var a = toScreen(n)
            var ah = (NODE_H * view.k) / 2
            var bw = (NODE_W * view.k) / 2
            for (var j = 0; j < n._kids.length; j++) {
              var b = toScreen(n._kids[j])
              var midY = (a.y + b.y) / 2
              var lit = (selected && (selected === n || selected === n._kids[j])) || (hover && (hover === n || hover === n._kids[j]))
              var p0x = a.x, p0y = a.y - ah
              var p1x = a.x, p1y = a.y - ah - 26 * view.k
              var p2x = b.x - bw - 26 * view.k, p2y = midY
              var p3x = b.x - bw, p3y = b.y
              ctx.strokeStyle = lit ? 'rgba(183,140,255,.85)' : 'rgba(110,190,255,.20)'
              ctx.lineWidth = lit ? 1.8 : 1
              ctx.beginPath()
              ctx.moveTo(p0x, p0y)
              ctx.bezierCurveTo(p1x, p1y, p2x, p2y, p3x, p3y)
              ctx.stroke()

              var seed = (i * 7 + j * 3) % 11
              var ph = (t * 0.20 + seed * 0.09) % 1
              for (var q = 0; q < 2; q++) {
                var tt = (ph + q * 0.5) % 1
                var mt = 1 - tt
                var bx = mt * mt * mt * p0x + 3 * mt * mt * tt * p1x + 3 * mt * tt * tt * p2x + tt * tt * tt * p3x
                var by = mt * mt * mt * p0y + 3 * mt * mt * tt * p1y + 3 * mt * tt * tt * p2y + tt * tt * tt * p3y
                var fade = tt < 0.14 ? tt / 0.14 : (tt > 0.86 ? (1 - tt) / 0.14 : 1)
                var rr = (lit ? 3.8 : 2.8) * view.k
                var gg = ctx.createRadialGradient(bx, by, 0, bx, by, rr * 3.4)
                gg.addColorStop(0, 'rgba(214,246,255,' + (0.95 * fade).toFixed(3) + ')')
                gg.addColorStop(0.3, 'rgba(112,206,255,' + (0.5 * fade).toFixed(3) + ')')
                gg.addColorStop(1, 'rgba(70,160,255,0)')
                ctx.fillStyle = gg
                ctx.beginPath()
                ctx.arc(bx, by, rr * 3.4, 0, Math.PI * 2)
                ctx.fill()
              }
            }
          }
          // 节点
          for (var k = 0; k < tree.nodes.length; k++) {
            var N = tree.nodes[k]
            var P = toScreen(N)
            var st = ST[N.status] || ST['?']
            var isSel = selected === N
            var isHov = hover === N
            var nw = NODE_W * view.k
            var nh = NODE_H * view.k
            var r = Math.max(3, 7 * view.k)

            ctx.globalAlpha = 1
            ctx.fillStyle = isSel ? 'rgba(20,32,52,.98)' : 'rgba(10,17,28,.94)'
            ctx.strokeStyle = isSel ? st.color : (isHov ? st.ring : 'rgba(120,180,255,.24)')
            ctx.lineWidth = isSel ? 2 : 1
            ctx.beginPath()
            if (ctx.roundRect) ctx.roundRect(P.x - nw / 2, P.y - nh / 2, nw, nh, 10 * view.k)
            else ctx.rect(P.x - nw / 2, P.y - nh / 2, nw, nh)
            ctx.fill()
            ctx.stroke()

            // 状态点
            ctx.fillStyle = st.color
            ctx.shadowColor = st.color
            ctx.shadowBlur = (isSel || isHov ? 16 : 8)
            ctx.beginPath()
            ctx.arc(P.x - nw / 2 + 14 * view.k, P.y, r, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0

            // 文字（最多两行）
            var fs = Math.max(7, 11 * view.k)
            ctx.font = fs + 'px ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif'
            ctx.fillStyle = isSel ? '#ffffff' : '#cfe0f5'
            var maxW = nw - 34 * view.k
            var txt = N.text
            var lines = wrapText(ctx, txt, maxW, 2)
            var lh = fs * 1.35
            var startY = P.y - ((lines.length - 1) * lh) / 2
            for (var li = 0; li < lines.length; li++) {
              ctx.fillText(lines[li], P.x - nw / 2 + 26 * view.k, startY + li * lh + fs * 0.36)
            }
          }
        }
        raf = requestAnimationFrame(draw)
      }

      function wrapText(ctx, text, maxW, maxLines) {
        if (!text) return ['']
        var out = []
        var cur = ''
        for (var i = 0; i < text.length; i++) {
          var ch = text[i]
          var test = cur + ch
          if (ctx.measureText(test).width > maxW && cur) {
            out.push(cur)
            cur = ch
            if (out.length === maxLines - 1) break
          } else cur = test
        }
        var rest = text.slice(out.join('').length)
        if (out.length < maxLines) {
          out.push(rest.length > 0 ? rest : '')
        } else if (rest) {
          out[out.length - 1] = out[out.length - 1].slice(0, -1) + '…'
        }
        return out.filter(function (s) { return s !== '' || out.length === 1 })
      }

      function onDown(ev) {
        canvas.setPointerCapture(ev.pointerId)
        drag = { x: ev.clientX, y: ev.clientY, tx: view.tx, ty: view.ty, moved: false }
        canvas.classList.add('dragging')
      }
      function onMove(ev) {
        var rect = canvas.getBoundingClientRect()
        var px = ev.clientX - rect.left, py = ev.clientY - rect.top
        if (drag) {
          var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
          view.tx = drag.tx + dx
          view.ty = drag.ty + dy
          return
        }
        var n = hit(px, py)
        if (n !== hover) hover = n
        canvas.style.cursor = n ? 'pointer' : 'grab'
      }
      function onUp(ev) {
        var wasDrag = drag && drag.moved
        drag = null
        canvas.classList.remove('dragging')
        if (wasDrag) return
        var rect = canvas.getBoundingClientRect()
        var n = hit(ev.clientX - rect.left, ev.clientY - rect.top)
        selected = n
        if (cb.onSelect) cb.onSelect(n)
      }
      function onWheel(ev) {
        ev.preventDefault()
        var rect = canvas.getBoundingClientRect()
        var px = ev.clientX - rect.left, py = ev.clientY - rect.top
        var factor = Math.exp(-ev.deltaY * 0.0016)
        var nk = Math.max(0.2, Math.min(3, view.k * factor))
        view.tx = px - (px - view.tx) * (nk / view.k)
        view.ty = py - (py - view.ty) * (nk / view.k)
        view.k = nk
      }

      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointerleave', function () { hover = null })
      canvas.addEventListener('wheel', onWheel, { passive: false })
      var ro = new ResizeObserver(resize)
      ro.observe(canvas.parentElement)
      resize()
      raf = requestAnimationFrame(draw)

      return {
        setTree: function (root) {
          tree = root ? prepare(root) : null
          selected = null
          fit()
        },
        fit: fit,
        zoomBy: function (f) {
          var nk = Math.max(0.2, Math.min(3, view.k * f))
          view.tx = w / 2 - (w / 2 - view.tx) * (nk / view.k)
          view.ty = hh / 2 - (hh / 2 - view.ty) * (nk / view.k)
          view.k = nk
        },
        select: function (n) { selected = n },
        destroy: function () {
          alive = false
          cancelAnimationFrame(raf)
          ro.disconnect()
          canvas.removeEventListener('pointerdown', onDown)
          canvas.removeEventListener('pointermove', onMove)
          canvas.removeEventListener('pointerup', onUp)
          canvas.removeEventListener('wheel', onWheel)
        }
      }
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    var VOL_KEY = 'dsh-tr-vol'
    function readVol() {
      try {
        var v = parseFloat(localStorage.getItem(VOL_KEY))
        if (isFinite(v)) return Math.max(0, Math.min(1, v))
      } catch { }
      return 0.20
    }
    function saveVol(v) {
      try { localStorage.setItem(VOL_KEY, String(v)) } catch { }
    }

    function Panel() {
      var canvasRef = useRef(null)
      var engineRef = useRef(null)
      var [trees, setTrees] = useState([])
      var [dir, setDir] = useState('')
      var [idx, setIdx] = useState(0)
      var [sel, setSel] = useState(null)
      var selRef = useRef(null)
      var [err, setErr] = useState('')
      var [creating, setCreating] = useState(false)
      var [newTitle, setNewTitle] = useState('')
      var [mem, setMem] = useState(null)
      var [memErr, setMemErr] = useState('')
      var [memTip, setMemTip] = useState('')
      var [vol, setVol] = useState(readVol)
      var [muted, setMuted] = useState(false)
      var volRef = useRef(readVol())
      var mutedRef = useRef(false)
      var audioRef = useRef(null)
      var acRef = useRef(null)

      var ensureAudio = useCallback(function () {
        if (audioRef.current) return audioRef.current
        try {
          var a = new window.Audio(API + '/asset?name=bgm.mp3')
          a.loop = true
          a.volume = mutedRef.current ? 0 : volRef.current
          audioRef.current = { bgm: a }
          a.play().catch(function () { })
          return audioRef.current
        } catch (e) { return null }
      }, [])

      var beep = useCallback(function (kind) {
        if (mutedRef.current) return
        try {
          var AC = window.AudioContext || window.webkitAudioContext
          if (!AC) return
          if (!acRef.current) acRef.current = new AC()
          var ac = acRef.current
          var t = ac.currentTime
          var o = ac.createOscillator()
          var g = ac.createGain()
          o.connect(g)
          g.connect(ac.destination)
          var peak = 0.035
          var len = 0.18
          if (kind === 'open') {
            o.type = 'sine'
            o.frequency.setValueAtTime(440, t)
            o.frequency.exponentialRampToValueAtTime(880, t + 0.24)
            peak = 0.05
            len = 0.30
          } else if (kind === 'judge') {
            o.type = 'triangle'
            o.frequency.setValueAtTime(880, t)
            o.frequency.exponentialRampToValueAtTime(620, t + 0.12)
            peak = 0.032
            len = 0.19
          } else {
            o.type = 'triangle'
            o.frequency.setValueAtTime(988, t)
            o.frequency.exponentialRampToValueAtTime(1319, t + 0.12)
          }
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(peak, t + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, t + len)
          o.start(t)
          o.stop(t + len + 0.02)
        } catch (e) { }
      }, [])

      useEffect(function () {
        beep('open')
        var a = ensureAudio()
        var onFirst = function () {
          try { if (a && a.bgm.paused) a.bgm.play().catch(function () { }) } catch (e) { }
        }
        window.addEventListener('pointerdown', onFirst, { once: true })
        return function () {
          window.removeEventListener('pointerdown', onFirst)
          try { if (a) a.bgm.pause() } catch (e) { }
        }
      }, [])

      var load = useCallback(function (force, keepFile) {
        setErr('')
        fetch(API + '/trees' + (force ? '?force=1' : ''))
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!d || !d.ok) throw new Error(d && d.error || 'load failed')
            setDir(d.dir || '')
            var list = d.trees || []
            setTrees(list)
            // 改完判定刷新时，要停在同一棵树：按文件名找回去，找不到才回第一棵
            var at = 0
            if (keepFile) {
              for (var i = 0; i < list.length; i++) {
                if (list[i].file === keepFile) { at = i; break }
              }
            }
            setIdx(at)
          })
          .catch(function (e) { setErr(String(e && e.message || e)) })
      }, [])

      useEffect(function () {
        var engine = createEngine(canvasRef.current, {
          onSelect: function (n) {
            beep('click')
            selRef.current = n
            setSel(n)
          }
        })
        engineRef.current = engine
        load(false)
        return function () { engine.destroy() }
      }, [])

      useEffect(function () {
        if (!engineRef.current) return
        var t = trees[idx]
        engineRef.current.setTree(t ? t.roots[0] : null)
        // 改完判定会整棵重建。能按 id 找回同一个节点就继续选中它，
        // 不然一次判定就把弹窗关掉，爸还得再点一遍。
        var keep = selRef.current
        var found = null
        if (keep && t) {
          var walk = function (n) {
            if (!n || found) return
            if (String(n.id) === String(keep.id)) { found = n; return }
            var kids = n.children || []
            for (var i = 0; i < kids.length; i++) walk(kids[i])
          }
          walk(t.roots[0])
        }
        if (found) {
          engineRef.current.select(found)
          setSel(found)
        } else {
          selRef.current = null
          setSel(null)
        }
      }, [trees, idx])

      // ── 关联记忆（与海马体联动）─────────────────────────────────────
      // 节点行尾写了 `→ 文件:…` / `→ 记忆:…` 时，点开就顺手把记忆取过来：
      // 路径、大小、前 160 行都摆在这儿，再给一个「在海马体中定位」的跳转。
      useEffect(function () {
        setMem(null)
        setMemErr('')
        if (!sel || !sel.mem) return
        var alive = true
        var q = sel.mem.kind === 'topic' ? 'topic:' + sel.mem.key : sel.mem.key
        fetch(API + '/read?path=' + encodeURIComponent(q))
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!alive) return
            if (d && d.ok) setMem(d)
            else setMemErr((d && d.error) || '读取失败')
          })
          .catch(function () { if (alive) setMemErr('读取失败') })
        return function () { alive = false }
      }, [sel && sel.id])

      var jumpToMemory = function (fullPath, label, text) {
        var payload = { file: fullPath, label: label || '', text: text || '', ts: Date.now() }
        try { localStorage.setItem('dsh-hp-jump', JSON.stringify(payload)) } catch (e) { }
        try { window.dispatchEvent(new CustomEvent('dsh-hp-jump', { detail: payload })) } catch (e) { }
        setMemTip('已发送 → 点侧栏的海马体图标')
        setTimeout(function () { setMemTip('') }, 4200)
      }

      // 把「这条结论/理由本身」送到海马体：海马体扫过追溯目录，
      // 所以这里只要给出 md 的绝对路径 + 节点正文，对面就能选中对应那一条。
      var jumpToTraceNode = function () {
        var t = trees[idx]
        if (!t || !sel) return
        var d = String(dir || '').replace(/[\\/]+$/, '')
        var sep = d.indexOf('\\') >= 0 ? '\\' : '/'
        var full = d ? d + sep + t.file : t.file
        // 节点带 `→ 文件:…` 时那条路径更准（可能指向别的 md），优先用它
        if (mem && mem.path) full = mem.path
        jumpToMemory(full, t.file, sel.text)
      }

      var copyPath = function (text) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text)
        } catch (e) { }
        setMemTip('路径已复制')
        setTimeout(function () { setMemTip('') }, 2200)
      }

      var fmtSize = function (n) {
        if (!n && n !== 0) return ''
        if (n < 1024) return n + ' B'
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
        return (n / 1048576).toFixed(1) + ' MB'
      }
      var fmtTime = function (iso) {
        if (!iso) return ''
        var d = new Date(iso)
        if (isNaN(d.getTime())) return ''
        var p = function (x) { return String(x).padStart(2, '0') }
        return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
      }

      var setStatus = function (status) {        if (!sel || sel.id === 'root') return
        var t = trees[idx]
        if (!t) return
        beep('judge')
        fetch(API + '/status?file=' + encodeURIComponent(t.file) + '&line=' + sel.id + '&status=' + encodeURIComponent(status))
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!d || !d.ok) throw new Error(d && d.error || 'update failed')
            load(true, t.file)
          })
          .catch(function (e) { setErr(String(e && e.message || e)) })
      }

      var create = function () {
        var t = newTitle.trim()
        if (!t) { setCreating(false); return }
        fetch(API + '/create?title=' + encodeURIComponent(t))
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!d || !d.ok) throw new Error(d && d.error || 'create failed')
            setCreating(false)
            setNewTitle('')
            load(true)
          })
          .catch(function (e) { setErr(String(e && e.message || e)) })
      }

      var cur = trees[idx]

      var body = [
        h('div', { className: 'tr-bar', key: 'bar' },
          h('div', { className: 'tr-title' }, h('span', { className: 'tr-dot' }), '根源追溯'),
          h('div', { className: 'tr-tabs' },
            trees.length ? h('select', {
              className: 'tr-sel',
              value: String(idx),
              title: dir || '',
              onChange: function (e) { setIdx(Number(e.target.value)) }
            }, trees.map(function (t, i) {
              var name = String(t.file || '').replace(/\.md$/i, '')
              var text = name && t.title !== name ? name + ' · ' + t.title : t.title
              return h('option', { key: t.file, value: String(i) }, text)
            })) : null,
            creating ? h('input', {
              className: 'tr-input',
              autoFocus: true,
              placeholder: '要追溯的结论，回车创建',
              value: newTitle,
              onChange: function (e) { setNewTitle(e.target.value) },
              onKeyDown: function (e) {
                if (e.key === 'Enter') create()
                else if (e.key === 'Escape') { setCreating(false); setNewTitle('') }
              }
            }) : h('button', { className: 'tr-btn', onClick: function () { setCreating(true) } }, '＋ 新建'),
            h('button', { className: 'tr-btn', onClick: function () { load(true) } }, '刷新')
          )
        ),
        h('div', { className: 'tr-stage', key: 'stage' },
          h('canvas', { className: 'tr-canvas', ref: canvasRef }),
          err ? h('div', { className: 'tr-empty' }, '读取失败：' + err) : null,
          !err && !trees.length ? h('div', { className: 'tr-empty' },
            '还没有追溯文件。', h('br'),
            '在 ' + (dir || '追溯目录') + ' 里放一个 .md，第一行写「# 结论：…」，下面用缩进列表写理由。'
          ) : null,
          h('div', { className: 'tr-zoom', key: 'zoom' },
            h('div', { className: 'tr-vol', key: 'vol' },
              h('button', {
                className: 'tr-vol-m',
                title: muted ? '取消静音' : '静音',
                onClick: function () {
                  var nx = !mutedRef.current
                  mutedRef.current = nx
                  setMuted(nx)
                  try { if (audioRef.current) audioRef.current.bgm.volume = nx ? 0 : volRef.current } catch (e) { }
                }
              }, muted ? '🔇' : '🔊'),
              h('input', {
                type: 'range', min: 0, max: 100, value: Math.round(vol * 100),
                title: '音量 ' + Math.round(vol * 100) + '%',
                onChange: function (e) {
                  var v = Number(e.target.value) / 100
                  volRef.current = v
                  setVol(v)
                  saveVol(v)
                  try { if (audioRef.current && !mutedRef.current) audioRef.current.bgm.volume = v } catch (e2) { }
                }
              })
            ),
            h('button', { className: 'tr-zbtn', title: '放大', onClick: function () { if (engineRef.current) engineRef.current.zoomBy(1.3) } }, '+'),
            h('button', { className: 'tr-zbtn', title: '缩小', onClick: function () { if (engineRef.current) engineRef.current.zoomBy(1 / 1.3) } }, '−'),
            h('button', { className: 'tr-zbtn sm', title: '适应画布', onClick: function () { if (engineRef.current) engineRef.current.fit() } }, '⟲')
          ),
          sel ? h('div', { className: 'tr-detail' },
            h('button', { className: 'tr-detail-x', onClick: function () { selRef.current = null; setSel(null) } }, '×'),
            h('div', { className: 'tr-detail-t' }, sel.text),
            sel.id === 'root' ? null : h('div', { className: 'tr-set' },
              h('span', { className: 'tr-set-k' }, '判定'),
              h('button', { className: 'tr-sbtn yes' + (sel.status === '+' ? ' on' : ''), onClick: function () { setStatus('+') } }, '成立'),
              h('button', { className: 'tr-sbtn no' + (sel.status === '-' ? ' on' : ''), onClick: function () { setStatus('-') } }, '不成立'),
              h('button', { className: 'tr-sbtn q' + (sel.status === '?' ? ' on' : ''), onClick: function () { setStatus('?') } }, '待拆'),
              h('button', { className: 'tr-sbtn mem', title: '在海马体里打开这一条', onClick: function () { jumpToTraceNode() } }, '定位至海马体')
            ),
            memTip ? h('div', { className: 'tr-jump-tip' }, memTip) : null,
            sel.mem ? h('div', { className: 'tr-mem' },
              h('div', { className: 'tr-mem-k' },
                sel.mem.kind === 'topic' ? '关联记忆 · 主题' : '关联记忆 · 文件'),
              mem ? h('div', null,
                h('div', { className: 'tr-mem-f' }, '📄 ' + mem.name),
                h('div', { className: 'tr-mem-p' }, mem.path),
                h('div', { className: 'tr-mem-m' },
                  [fmtSize(mem.size), mem.total ? mem.total + ' 行' : '', fmtTime(mem.mtime) ? '改于 ' + fmtTime(mem.mtime) : '']
                    .filter(Boolean).join(' · ')),
                h('div', { className: 'tr-mem-x' }, mem.excerpt + (mem.truncated ? '\n…（只展开前 160 行）' : '')),
                h('div', { className: 'tr-mem-a' },
                  h('button', { className: 'tr-mem-b', onClick: function () { jumpToMemory(mem.path, mem.name, sel && sel.text) } }, '在海马体中定位'),
                  h('button', { className: 'tr-mem-b ghost', onClick: function () { copyPath(mem.path) } }, '复制路径'),
                  memTip ? h('span', { className: 'tr-mem-tip' }, memTip) : null
                )
              ) : memErr
                ? h('div', { className: 'tr-mem-e' }, memErr)
                : h('div', { className: 'tr-mem-m' }, '读取中…')
            ) : null
          ) : null,
          h('div', { className: 'tr-hint' },
            cur ? '结论：' + cur.title : '',
            h('br'),
            '拖动平移 · 点节点判定 · 右上角缩放'
          )
        ),
        h('div', { className: 'tr-legend', key: 'legend' },
          h('span', { className: 'tr-lg' }, h('i', { style: { background: ST['+'].color, boxShadow: '0 0 6px ' + ST['+'].color } }), '成立'),
          h('span', { className: 'tr-lg' }, h('i', { style: { background: ST['-'].color, boxShadow: '0 0 6px ' + ST['-'].color } }), '不成立'),
          h('span', { className: 'tr-lg' }, h('i', { style: { background: ST['?'].color, boxShadow: '0 0 6px ' + ST['?'].color } }), '待拆')
        )
      ]

      return h('div', { className: 'tr-root' }, body)
    }

    /* ── 注册 ────────────────────────────────────────────────────────────── */
    var PANEL_ID = 'dsh-reason-tree'

    function apply(ctx) {
      ctx.slots.inject('main', function () {
        return ctx.slots.register({
          name: 'main',
          key: PANEL_ID
        }, Panel)
      })
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 40,
          label: '根源追溯'
        }, Icon)
      })
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  }
})
