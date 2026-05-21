package utils

// Each entry should be a self-contained, readable function with no trailing newline.
var SampleTargetCodes = []string{

	// ── Arrays & Collections ──────────────────────────────────────────────────

	`function paginateArray(items, page, pageSize) {
  if (pageSize <= 0) return { data: [], total: 0, totalPages: 0 }
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const clampedPage = Math.max(1, Math.min(page, totalPages))
  const start = (clampedPage - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    page: clampedPage,
    total,
    totalPages,
  }
}`,

	`function rankBy(items, scoreFn) {
  return items
    .map(item => ({ item, score: scoreFn(item) }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ rank: index + 1, item: entry.item, score: entry.score }))
}`,

	`function rollingAverage(values, windowSize) {
  if (windowSize <= 0 || values.length === 0) return []
  const result = []
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const window = values.slice(start, i + 1)
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length
    result.push(Math.round(avg * 100) / 100)
  }
  return result
}`,

	`function deduplicateBy(items, keyFn) {
  const seen = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return Array.from(seen.values())
}`,

	`function flatGroupBy(items, keyFn) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  }
  return Object.fromEntries(groups)
}`,

	`function topN(items, n, scoreFn) {
  if (n <= 0) return []
  const scored = items.map(item => ({ item, score: scoreFn(item) }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map(e => e.item)
}`,

	`function interleave(...arrays) {
  const maxLen = Math.max(...arrays.map(a => a.length))
  const result = []
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) {
        result.push(arr[i])
      }
    }
  }
  return result
}`,

	`function splitAt(arr, index) {
  if (index < 0) index = Math.max(0, arr.length + index)
  return [arr.slice(0, index), arr.slice(index)]
}`,

	`function frequencyRank(items) {
  const counts = new Map()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }))
}`,

	`function nearestNeighbor(points, target) {
  let closest = null
  let minDist = Infinity
  for (const point of points) {
    const dx = point.x - target.x
    const dy = point.y - target.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      closest = point
    }
  }
  return { point: closest, distance: minDist }
}`,

	// ── Strings ───────────────────────────────────────────────────────────────

	`function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}`,

	`function maskSensitive(str, visibleStart, visibleEnd, maskChar) {
  const mc = maskChar || '*'
  if (str.length <= visibleStart + visibleEnd) return str
  const start = str.slice(0, visibleStart)
  const end = visibleEnd > 0 ? str.slice(-visibleEnd) : ''
  const masked = mc.repeat(str.length - visibleStart - visibleEnd)
  return start + masked + end
}`,

	`function parseCSVLine(line, delimiter) {
  const sep = delimiter || ','
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === sep && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}`,

	`function highlightMatches(text, query) {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('(' + escaped + ')', 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}`,

	`function wordFrequency(text) {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || []
  const freq = {}
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }))
}`,

	`function interpolate(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match
  })
}`,

	`function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  return [...new Set(text.match(emailRegex) || [])]
}`,

	`function wrapText(text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if (current.length + word.length + (current ? 1 : 0) <= maxWidth) {
      current = current ? current + ' ' + word : word
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.join('\n')
}`,

	`function diffStrings(a, b) {
  const aWords = a.split(' ')
  const bWords = b.split(' ')
  const added = bWords.filter(w => !aWords.includes(w))
  const removed = aWords.filter(w => !bWords.includes(w))
  return { added, removed, unchanged: aWords.filter(w => bWords.includes(w)) }
}`,

	// ── Numbers & Math ────────────────────────────────────────────────────────

	`function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}`,

	`function formatBytes(bytes, decimals) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals === undefined ? 2 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}`,

	`function normalizeRange(value, min, max) {
  if (min === max) return 0
  return (value - min) / (max - min)
}`,

	`function percentChange(from, to) {
  if (from === 0) return null
  return roundTo(((to - from) / Math.abs(from)) * 100, 2)

  function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }
}`,

	`function generateRange(start, end, step) {
  const s = step || 1
  if (s === 0) return []
  const result = []
  if (s > 0) {
    for (let i = start; i < end; i += s) result.push(i)
  } else {
    for (let i = start; i > end; i += s) result.push(i)
  }
  return result
}`,

	`function weightedRandom(options) {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0)
  let rand = Math.random() * totalWeight
  for (const option of options) {
    rand -= option.weight
    if (rand <= 0) return option.value
  }
  return options[options.length - 1].value
}`,

	`function standardDeviation(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
  return Math.sqrt(variance)
}`,

	`function decimalToBinary(n) {
  if (n === 0) return '0'
  const sign = n < 0 ? '-' : ''
  let abs = Math.abs(n)
  const bits = []
  while (abs > 0) {
    bits.unshift(abs % 2)
    abs = Math.floor(abs / 2)
  }
  return sign + bits.join('')
}`,

	// ── Objects & Data ────────────────────────────────────────────────────────

	`function diffObjects(oldObj, newObj) {
  const changes = {}
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  for (const key of allKeys) {
    if (!(key in oldObj)) {
      changes[key] = { type: 'added', value: newObj[key] }
    } else if (!(key in newObj)) {
      changes[key] = { type: 'removed', value: oldObj[key] }
    } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changes[key] = { type: 'changed', from: oldObj[key], to: newObj[key] }
    }
  }
  return changes
}`,

	`function safeGet(obj, path, defaultValue) {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined || !(key in Object(current))) {
      return defaultValue !== undefined ? defaultValue : null
    }
    current = current[key]
  }
  return current
}`,

	`function safeSet(obj, path, value) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
  return obj
}`,

	`function mapValues(obj, transformFn) {
  const out = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = transformFn(obj[key], key)
    }
  }
  return out
}`,

	`function filterObject(obj, predicateFn) {
  const out = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && predicateFn(obj[key], key)) {
      out[key] = obj[key]
    }
  }
  return out
}`,

	`function renameKeys(obj, keyMap) {
  const out = {}
  for (const key in obj) {
    const newKey = keyMap[key] || key
    out[newKey] = obj[key]
  }
  return out
}`,

	`function groupAndAggregate(records, groupKey, aggregations) {
  const groups = {}
  for (const record of records) {
    const key = record[groupKey]
    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  }
  const result = {}
  for (const key in groups) {
    result[key] = {}
    for (const [field, aggFn] of Object.entries(aggregations)) {
      result[key][field] = aggFn(groups[key])
    }
  }
  return result
}`,

	// ── Async & Control Flow ──────────────────────────────────────────────────

	`async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs || 5000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}`,

	`async function retryWithBackoff(fn, maxRetries, baseDelayMs) {
  const delay = baseDelayMs || 200
  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const wait = delay * Math.pow(2, attempt) + Math.random() * 100
      await new Promise(resolve => setTimeout(resolve, wait))
      attempt++
    }
  }
}`,

	`function createRateLimiter(maxCalls, windowMs) {
  const timestamps = []
  return async function(fn) {
    const now = Date.now()
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
      timestamps.shift()
    }
    if (timestamps.length >= maxCalls) {
      const waitTime = timestamps[0] + windowMs - now
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    timestamps.push(Date.now())
    return fn()
  }
}`,

	`async function runWithConcurrencyLimit(tasks, limit) {
  const results = []
  const executing = []
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task())
    results.push(p)
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(results)
}`,

	`function createEventEmitter() {
  const listeners = {}
  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(fn)
    },
    off(event, fn) {
      if (!listeners[event]) return
      listeners[event] = listeners[event].filter(l => l !== fn)
    },
    emit(event, ...args) {
      if (!listeners[event]) return
      for (const fn of listeners[event]) {
        fn(...args)
      }
    },
    once(event, fn) {
      const wrapper = (...args) => { fn(...args); this.off(event, wrapper) }
      this.on(event, wrapper)
    }
  }
}`,

	`function batchProcess(items, batchSize, processFn) {
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches.reduce((chain, batch) => {
    return chain.then(results =>
      processFn(batch).then(batchResult => results.concat(batchResult))
    )
  }, Promise.resolve([]))
}`,

	// ── Validation ────────────────────────────────────────────────────────────

	`function validateEmail(email) {
  if (!email || typeof email !== 'string') return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || !domain) return false
  if (local.length > 64 || domain.length > 255) return false
  const domainParts = domain.split('.')
  if (domainParts.length < 2) return false
  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false
  return /^[a-zA-Z0-9._%+\-]+$/.test(local)
}`,

	`function validatePassword(password) {
  const errors = []
  if (!password || password.length < 8) errors.push('at least 8 characters required')
  if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter required')
  if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter required')
  if (!/[0-9]/.test(password)) errors.push('at least one digit required')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('at least one special character required')
  return { valid: errors.length === 0, errors }
}`,

	`function createValidator(schema) {
  return function validate(data) {
    const errors = {}
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field]
      for (const [rule, param] of Object.entries(rules)) {
        if (rule === 'required' && param && (value === undefined || value === null || value === '')) {
          errors[field] = field + ' is required'
          break
        }
        if (rule === 'minLength' && typeof value === 'string' && value.length < param) {
          errors[field] = field + ' must be at least ' + param + ' characters'
          break
        }
        if (rule === 'maxLength' && typeof value === 'string' && value.length > param) {
          errors[field] = field + ' must not exceed ' + param + ' characters'
          break
        }
        if (rule === 'min' && typeof value === 'number' && value < param) {
          errors[field] = field + ' must be at least ' + param
          break
        }
        if (rule === 'max' && typeof value === 'number' && value > param) {
          errors[field] = field + ' must be at most ' + param
          break
        }
        if (rule === 'pattern' && !param.test(value)) {
          errors[field] = field + ' has an invalid format'
          break
        }
      }
    }
    return { valid: Object.keys(errors).length === 0, errors }
  }
}`,

	// ── Caching & State ───────────────────────────────────────────────────────

	`function createLRUCache(capacity) {
  const map = new Map()
  return {
    get(key) {
      if (!map.has(key)) return null
      const value = map.get(key)
      map.delete(key)
      map.set(key, value)
      return value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      else if (map.size >= capacity) map.delete(map.keys().next().value)
      map.set(key, value)
    },
    has(key) { return map.has(key) },
    size() { return map.size }
  }
}`,

	`function createTTLCache(defaultTtlMs) {
  const store = new Map()
  return {
    set(key, value, ttlMs) {
      const expiry = Date.now() + (ttlMs || defaultTtlMs)
      store.set(key, { value, expiry })
    },
    get(key) {
      const entry = store.get(key)
      if (!entry) return null
      if (Date.now() > entry.expiry) {
        store.delete(key)
        return null
      }
      return entry.value
    },
    delete(key) { store.delete(key) },
    cleanup() {
      const now = Date.now()
      for (const [key, entry] of store.entries()) {
        if (now > entry.expiry) store.delete(key)
      }
    }
  }
}`,

	`function createStateMachine(initial, transitions) {
  let state = initial
  const listeners = []
  return {
    getState() { return state },
    transition(action) {
      const key = state + ':' + action
      const next = transitions[key]
      if (!next) throw new Error('Invalid transition: ' + action + ' from ' + state)
      const prev = state
      state = next
      for (const fn of listeners) fn(state, prev, action)
      return state
    },
    can(action) { return !!(transitions[state + ':' + action]) },
    onTransition(fn) { listeners.push(fn) }
  }
}`,

	// ── DOM & Browser ─────────────────────────────────────────────────────────

	`function observeIntersection(elements, callback, options) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry.target, entry.isIntersecting, entry)
    }
  }, options)
  const targets = Array.isArray(elements) ? elements : [elements]
  for (const el of targets) {
    observer.observe(el)
  }
  return () => observer.disconnect()
}`,

	`function persistToStorage(key, initialValue) {
  let value
  try {
    const stored = localStorage.getItem(key)
    value = stored !== null ? JSON.parse(stored) : initialValue
  } catch {
    value = initialValue
  }
  return {
    get() { return value },
    set(newValue) {
      value = newValue
      try {
        localStorage.setItem(key, JSON.stringify(newValue))
      } catch (err) {
        console.warn('Storage write failed:', err)
      }
    },
    reset() { this.set(initialValue) }
  }
}`,

	`function buildQueryString(params) {
  const parts = []
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item))
      }
    } else {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))
    }
  }
  return parts.length ? '?' + parts.join('&') : ''
}`,

	// ── Date & Time ───────────────────────────────────────────────────────────

	`function formatRelativeTime(date) {
  const now = Date.now()
  const then = typeof date === 'number' ? date : date.getTime()
  const diff = now - then
  const future = diff < 0
  const abs = Math.abs(diff)
  const intervals = [
    { label: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    { label: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'day', ms: 24 * 60 * 60 * 1000 },
    { label: 'hour', ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
  ]
  for (const { label, ms } of intervals) {
    const count = Math.floor(abs / ms)
    if (count >= 1) {
      const plural = count === 1 ? label : label + 's'
      return future ? 'in ' + count + ' ' + plural : count + ' ' + plural + ' ago'
    }
  }
  return 'just now'
}`,

	`function parseDate(str) {
  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, year: 1, month: 2, day: 3 },
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, year: 3, month: 1, day: 2 },
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, year: 3, month: 1, day: 2 },
  ]
  for (const fmt of formats) {
    const match = str.match(fmt.regex)
    if (match) {
      const year = parseInt(match[fmt.year])
      const month = parseInt(match[fmt.month]) - 1
      const day = parseInt(match[fmt.day])
      const date = new Date(year, month, day)
      if (isNaN(date.getTime())) return null
      return date
    }
  }
  return null
}`,

	`function scheduleAt(targetDate, fn) {
  const delay = targetDate.getTime() - Date.now()
  if (delay < 0) {
    return { cancel: () => {}, overdue: true }
  }
  const timer = setTimeout(fn, Math.min(delay, 2147483647))
  return {
    cancel() { clearTimeout(timer) },
    overdue: false,
    delay
  }
}`,

	// ── Trees & Graphs ────────────────────────────────────────────────────────

	`function buildTree(flatItems, idKey, parentKey) {
  const map = {}
  const roots = []
  for (const item of flatItems) {
    map[item[idKey]] = { ...item, children: [] }
  }
  for (const item of flatItems) {
    const node = map[item[idKey]]
    const parentId = item[parentKey]
    if (parentId !== null && parentId !== undefined && map[parentId]) {
      map[parentId].children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}`,

	`function walkTree(node, visitFn, childKey) {
  const key = childKey || 'children'
  const stack = [{ node, depth: 0, parent: null }]
  while (stack.length > 0) {
    const { node: current, depth, parent } = stack.pop()
    visitFn(current, depth, parent)
    const children = current[key]
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ node: children[i], depth: depth + 1, parent: current })
      }
    }
  }
}`,

	`function findInTree(root, predicateFn, childKey) {
  const key = childKey || 'children'
  const queue = [root]
  while (queue.length > 0) {
    const node = queue.shift()
    if (predicateFn(node)) return node
    const children = node[key]
    if (Array.isArray(children)) {
      for (const child of children) {
        queue.push(child)
      }
    }
  }
  return null
}`,

	`function computeTreeDepth(node, childKey) {
  const key = childKey || 'children'
  const children = node[key]
  if (!children || children.length === 0) return 0
  let maxChildDepth = 0
  for (const child of children) {
    const d = computeTreeDepth(child, key)
    if (d > maxChildDepth) maxChildDepth = d
  }
  return maxChildDepth + 1
}`,

	// ── Functional Utilities ──────────────────────────────────────────────────

	`function compose(...fns) {
  return function(value) {
    return fns.reduceRight((acc, fn) => fn(acc), value)
  }
}`,

	`function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args)
    }
    return function(...more) {
      return curried.apply(this, args.concat(more))
    }
  }
}`,

	`function trampoline(fn) {
  return function(...args) {
    let result = fn.apply(this, args)
    while (typeof result === 'function') {
      result = result()
    }
    return result
  }
}`,

	`function createPipeline(...middlewares) {
  return async function(ctx) {
    let index = -1
    async function dispatch(i) {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      const fn = middlewares[i]
      if (!fn) return
      await fn(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}`,

	// ── Sorting Algorithms ────────────────────────────────────────────────────

	`function bubbleSort(arr) {
  const out = arr.slice()
  let swapped
  for (let i = 0; i < out.length - 1; i++) {
    swapped = false
    for (let j = 0; j < out.length - 1 - i; j++) {
      if (out[j] > out[j + 1]) {
        const tmp = out[j]
        out[j] = out[j + 1]
        out[j + 1] = tmp
        swapped = true
      }
    }
    if (!swapped) break
  }
  return out
}`,

	`function insertionSort(arr) {
  const out = arr.slice()
  for (let i = 1; i < out.length; i++) {
    const key = out[i]
    let j = i - 1
    while (j >= 0 && out[j] > key) {
      out[j + 1] = out[j]
      j--
    }
    out[j + 1] = key
  }
  return out
}`,

	`function selectionSort(arr) {
  const out = arr.slice()
  for (let i = 0; i < out.length - 1; i++) {
    let minIdx = i
    for (let j = i + 1; j < out.length; j++) {
      if (out[j] < out[minIdx]) {
        minIdx = j
      }
    }
    if (minIdx !== i) {
      const tmp = out[i]
      out[i] = out[minIdx]
      out[minIdx] = tmp
    }
  }
  return out
}`,

	`function mergeSort(arr) {
  if (arr.length <= 1) return arr
  const mid = Math.floor(arr.length / 2)
  const left = mergeSort(arr.slice(0, mid))
  const right = mergeSort(arr.slice(mid))
  const result = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++])
    } else {
      result.push(right[j++])
    }
  }
  while (i < left.length) result.push(left[i++])
  while (j < right.length) result.push(right[j++])
  return result
}`,

	`function quickSort(arr) {
  if (arr.length <= 1) return arr
  const pivot = arr[Math.floor(arr.length / 2)]
  const left = []
  const middle = []
  const right = []
  for (const item of arr) {
    if (item < pivot) left.push(item)
    else if (item > pivot) right.push(item)
    else middle.push(item)
  }
  return quickSort(left).concat(middle, quickSort(right))
}`,

	`function heapSort(arr) {
  const out = arr.slice()
  const n = out.length

  function heapify(size, root) {
    let largest = root
    const left = 2 * root + 1
    const right = 2 * root + 2
    if (left < size && out[left] > out[largest]) largest = left
    if (right < size && out[right] > out[largest]) largest = right
    if (largest !== root) {
      const tmp = out[root]
      out[root] = out[largest]
      out[largest] = tmp
      heapify(size, largest)
    }
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(n, i)
  }
  for (let i = n - 1; i > 0; i--) {
    const tmp = out[0]
    out[0] = out[i]
    out[i] = tmp
    heapify(i, 0)
  }
  return out
}`,

	`function countingSort(arr, maxValue) {
  const counts = new Array(maxValue + 1).fill(0)
  for (const n of arr) {
    counts[n]++
  }
  const result = []
  for (let i = 0; i <= maxValue; i++) {
    for (let j = 0; j < counts[i]; j++) {
      result.push(i)
    }
  }
  return result
}`,

	`function radixSort(arr) {
  if (arr.length === 0) return arr
  const max = Math.max(...arr)
  let exp = 1
  let out = arr.slice()
  while (Math.floor(max / exp) > 0) {
    const buckets = Array.from({ length: 10 }, () => [])
    for (const num of out) {
      const digit = Math.floor(num / exp) % 10
      buckets[digit].push(num)
    }
    out = [].concat(...buckets)
    exp *= 10
  }
  return out
}`,

	// ── Search Algorithms ─────────────────────────────────────────────────────

	`function binarySearch(arr, target) {
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}`,

	`function exponentialSearch(arr, target) {
  if (arr[0] === target) return 0
  let bound = 1
  while (bound < arr.length && arr[bound] <= target) {
    bound *= 2
  }
  let lo = Math.floor(bound / 2)
  let hi = Math.min(bound, arr.length - 1)
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}`,

	`function jumpSearch(arr, target) {
  const n = arr.length
  const step = Math.floor(Math.sqrt(n))
  let prev = 0
  let curr = step
  while (curr < n && arr[curr] <= target) {
    prev = curr
    curr += step
  }
  for (let i = prev; i < Math.min(curr, n); i++) {
    if (arr[i] === target) return i
  }
  return -1
}`,

	// ── Graph Algorithms ──────────────────────────────────────────────────────

	`function dijkstra(graph, start) {
  const dist = {}
  const prev = {}
  const visited = new Set()
  for (const node in graph) {
    dist[node] = Infinity
    prev[node] = null
  }
  dist[start] = 0
  while (true) {
    let u = null
    for (const node in dist) {
      if (!visited.has(node) && (u === null || dist[node] < dist[u])) {
        u = node
      }
    }
    if (u === null || dist[u] === Infinity) break
    visited.add(u)
    for (const [neighbor, weight] of Object.entries(graph[u])) {
      const alt = dist[u] + weight
      if (alt < dist[neighbor]) {
        dist[neighbor] = alt
        prev[neighbor] = u
      }
    }
  }
  return { dist, prev }
}`,

	`function reconstructPath(prev, start, end) {
  const path = []
  let current = end
  while (current !== null) {
    path.unshift(current)
    current = prev[current]
  }
  if (path[0] !== start) return []
  return path
}`,

	`function breadthFirstSearch(graph, start) {
  const visited = new Set()
  const order = []
  const queue = [start]
  visited.add(start)
  while (queue.length > 0) {
    const node = queue.shift()
    order.push(node)
    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  return order
}`,

	`function depthFirstSearch(graph, start) {
  const visited = new Set()
  const order = []
  function dfs(node) {
    visited.add(node)
    order.push(node)
    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor)
      }
    }
  }
  dfs(start)
  return order
}`,

	`function topologicalSort(graph) {
  const visited = new Set()
  const stack = []
  function visit(node) {
    if (visited.has(node)) return
    visited.add(node)
    for (const neighbor of graph[node] || []) {
      visit(neighbor)
    }
    stack.push(node)
  }
  for (const node in graph) {
    visit(node)
  }
  return stack.reverse()
}`,

	`function detectCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = {}
  for (const node in graph) color[node] = WHITE
  function dfs(node) {
    color[node] = GRAY
    for (const neighbor of graph[node] || []) {
      if (color[neighbor] === GRAY) return true
      if (color[neighbor] === WHITE && dfs(neighbor)) return true
    }
    color[node] = BLACK
    return false
  }
  for (const node in graph) {
    if (color[node] === WHITE && dfs(node)) return true
  }
  return false
}`,

	`function bellmanFord(edges, nodeCount, start) {
  const dist = new Array(nodeCount).fill(Infinity)
  dist[start] = 0
  for (let i = 0; i < nodeCount - 1; i++) {
    for (const { from, to, weight } of edges) {
      if (dist[from] !== Infinity && dist[from] + weight < dist[to]) {
        dist[to] = dist[from] + weight
      }
    }
  }
  for (const { from, to, weight } of edges) {
    if (dist[from] !== Infinity && dist[from] + weight < dist[to]) {
      return { dist, hasNegativeCycle: true }
    }
  }
  return { dist, hasNegativeCycle: false }
}`,

	`function kruskalMST(nodes, edges) {
  const parent = {}
  const rank = {}
  for (const node of nodes) {
    parent[node] = node
    rank[node] = 0
  }
  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }
  function union(a, b) {
    const ra = find(a), rb = find(b)
    if (ra === rb) return false
    if (rank[ra] < rank[rb]) parent[ra] = rb
    else if (rank[ra] > rank[rb]) parent[rb] = ra
    else { parent[rb] = ra; rank[ra]++ }
    return true
  }
  const sorted = edges.slice().sort((a, b) => a.weight - b.weight)
  const mst = []
  for (const edge of sorted) {
    if (union(edge.from, edge.to)) {
      mst.push(edge)
      if (mst.length === nodes.length - 1) break
    }
  }
  return mst
}`,

	// ── Dynamic Programming ───────────────────────────────────────────────────

	`function longestCommonSubsequence(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  let i = m, j = n
  const lcs = []
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1])
      i--; j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return lcs
}`,

	`function knapsack(items, capacity) {
  const n = items.length
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    const { weight, value } = items[i - 1]
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weight] + value)
      }
    }
  }
  const chosen = []
  let w = capacity
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      chosen.push(items[i - 1])
      w -= items[i - 1].weight
    }
  }
  return { maxValue: dp[n][capacity], chosen }
}`,

	`function editDistance(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    return Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  })
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp[m][n]
}`,

	`function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity)
  dp[0] = 0
  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] + 1 < dp[i]) {
        dp[i] = dp[i - coin] + 1
      }
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount]
}`,

	`function longestIncreasingSubsequence(nums) {
  if (nums.length === 0) return []
  const dp = new Array(nums.length).fill(1)
  const parent = new Array(nums.length).fill(-1)
  let maxLen = 1, maxIdx = 0
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i] && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1
        parent[i] = j
      }
    }
    if (dp[i] > maxLen) {
      maxLen = dp[i]
      maxIdx = i
    }
  }
  const seq = []
  let idx = maxIdx
  while (idx !== -1) {
    seq.unshift(nums[idx])
    idx = parent[idx]
  }
  return seq
}`,

	`function matrixChainOrder(dims) {
  const n = dims.length - 1
  const dp = Array.from({ length: n }, () => new Array(n).fill(0))
  const split = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1
      dp[i][j] = Infinity
      for (let k = i; k < j; k++) {
        const cost = dp[i][k] + dp[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]
        if (cost < dp[i][j]) {
          dp[i][j] = cost
          split[i][j] = k
        }
      }
    }
  }
  return { minOps: dp[0][n - 1], split }
}`,

	// ── String Algorithms ─────────────────────────────────────────────────────

	`function kmpSearch(text, pattern) {
  if (pattern.length === 0) return []
  const lps = new Array(pattern.length).fill(0)
  let len = 0, i = 1
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) {
      lps[i++] = ++len
    } else if (len > 0) {
      len = lps[len - 1]
    } else {
      lps[i++] = 0
    }
  }
  const matches = []
  let t = 0, p = 0
  while (t < text.length) {
    if (text[t] === pattern[p]) { t++; p++ }
    if (p === pattern.length) {
      matches.push(t - p)
      p = lps[p - 1]
    } else if (t < text.length && text[t] !== pattern[p]) {
      p > 0 ? (p = lps[p - 1]) : t++
    }
  }
  return matches
}`,

	`function rabinKarp(text, pattern) {
  const BASE = 31
  const MOD = 1e9 + 9
  const m = pattern.length
  const n = text.length
  if (m > n) return []
  let patHash = 0, winHash = 0, power = 1
  for (let i = 0; i < m; i++) {
    const pc = pattern.charCodeAt(i) - 96
    const tc = text.charCodeAt(i) - 96
    patHash = (patHash * BASE + pc) % MOD
    winHash = (winHash * BASE + tc) % MOD
    if (i > 0) power = (power * BASE) % MOD
  }
  const matches = []
  if (patHash === winHash && text.slice(0, m) === pattern) matches.push(0)
  for (let i = 1; i <= n - m; i++) {
    const out = text.charCodeAt(i - 1) - 96
    const inn = text.charCodeAt(i + m - 1) - 96
    winHash = ((winHash - out * power % MOD + MOD) * BASE + inn) % MOD
    if (winHash === patHash && text.slice(i, i + m) === pattern) matches.push(i)
  }
  return matches
}`,

	`function longestPalindromicSubstring(s) {
  if (s.length === 0) return ''
  let start = 0, maxLen = 1
  function expand(l, r) {
    while (l >= 0 && r < s.length && s[l] === s[r]) {
      if (r - l + 1 > maxLen) {
        maxLen = r - l + 1
        start = l
      }
      l--; r++
    }
  }
  for (let i = 0; i < s.length; i++) {
    expand(i, i)
    expand(i, i + 1)
  }
  return s.slice(start, start + maxLen)
}`,

	// ── Tree Algorithms ───────────────────────────────────────────────────────

	`function createBST() {
  let root = null
  function insert(node, value) {
    if (!node) return { value, left: null, right: null }
    if (value < node.value) node.left = insert(node.left, value)
    else if (value > node.value) node.right = insert(node.right, value)
    return node
  }
  function search(node, value) {
    if (!node) return false
    if (value === node.value) return true
    return value < node.value ? search(node.left, value) : search(node.right, value)
  }
  function inorder(node, result) {
    if (!node) return
    inorder(node.left, result)
    result.push(node.value)
    inorder(node.right, result)
  }
  return {
    insert(value) { root = insert(root, value) },
    search(value) { return search(root, value) },
    toSortedArray() { const r = []; inorder(root, r); return r },
  }
}`,

	`function lowestCommonAncestor(root, p, q) {
  if (!root || root.value === p || root.value === q) return root
  const left = lowestCommonAncestor(root.left, p, q)
  const right = lowestCommonAncestor(root.right, p, q)
  if (left && right) return root
  return left || right
}`,

	`function isValidBST(node, min, max) {
  if (!node) return true
  if (min !== undefined && node.value <= min) return false
  if (max !== undefined && node.value >= max) return false
  return isValidBST(node.left, min, node.value) &&
    isValidBST(node.right, node.value, max)
}`,

	`function levelOrderTraversal(root) {
  if (!root) return []
  const levels = []
  const queue = [root]
  while (queue.length > 0) {
    const size = queue.length
    const level = []
    for (let i = 0; i < size; i++) {
      const node = queue.shift()
      level.push(node.value)
      if (node.left) queue.push(node.left)
      if (node.right) queue.push(node.right)
    }
    levels.push(level)
  }
  return levels
}`,

	// ── Backtracking ──────────────────────────────────────────────────────────

	`function solveNQueens(n) {
  const solutions = []
  const board = Array.from({ length: n }, () => new Array(n).fill('.'))
  const cols = new Set(), diag1 = new Set(), diag2 = new Set()
  function backtrack(row) {
    if (row === n) {
      solutions.push(board.map(r => r.join('')))
      return
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue
      board[row][col] = 'Q'
      cols.add(col); diag1.add(row - col); diag2.add(row + col)
      backtrack(row + 1)
      board[row][col] = '.'
      cols.delete(col); diag1.delete(row - col); diag2.delete(row + col)
    }
  }
  backtrack(0)
  return solutions
}`,

	`function solveSudoku(board) {
  function isValid(row, col, num) {
    const box = (r, c) => board[r][c] === num
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num || board[i][col] === num) return false
    }
    const br = Math.floor(row / 3) * 3
    const bc = Math.floor(col / 3) * 3
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if (board[r][c] === num) return false
      }
    }
    return true
  }
  function solve() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue
        for (let num = 1; num <= 9; num++) {
          if (isValid(r, c, num)) {
            board[r][c] = num
            if (solve()) return true
            board[r][c] = 0
          }
        }
        return false
      }
    }
    return true
  }
  const copy = board.map(row => row.slice())
  solve.call({ board: copy })
  return solve() ? board : null
}`,

	`function permutations(items) {
  const result = []
  function backtrack(current, remaining) {
    if (remaining.length === 0) {
      result.push(current.slice())
      return
    }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i])
      backtrack(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)])
      current.pop()
    }
  }
  backtrack([], items)
  return result
}`,

	`function subsets(nums) {
  const result = [[]]
  nums.sort((a, b) => a - b)
  function backtrack(start, current) {
    for (let i = start; i < nums.length; i++) {
      if (i > start && nums[i] === nums[i - 1]) continue
      current.push(nums[i])
      result.push(current.slice())
      backtrack(i + 1, current)
      current.pop()
    }
  }
  backtrack(0, [])
  return result
}`,
}