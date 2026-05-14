package utils

// Each entry should be a self-contained, readable function with no trailing newline.
var SampleTargetCodes = []string{

	// ── Arrays ────────────────────────────────────────────────────────────────

	`function sum(arr) {
  let total = 0
  for (let i = 0; i < arr.length; i++) {
    total += arr[i]
  }
  return total
}`,

	`function product(arr) {
  let result = 1
  for (const n of arr) {
    result *= n
  }
  return result
}`,

	`function maxInArray(nums) {
  let best = nums[0]
  for (const value of nums) {
    if (value > best) {
      best = value
    }
  }
  return best
}`,

	`function minInArray(nums) {
  let best = nums[0]
  for (const value of nums) {
    if (value < best) {
      best = value
    }
  }
  return best
}`,

	`function average(nums) {
  if (nums.length === 0) return 0
  let total = 0
  for (const n of nums) {
    total += n
  }
  return total / nums.length
}`,

	`function flatten(arr) {
  const out = []
  for (const item of arr) {
    if (Array.isArray(item)) {
      for (const inner of item) {
        out.push(inner)
      }
    } else {
      out.push(item)
    }
  }
  return out
}`,

	`function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}`,

	`function uniqueValues(list) {
  const seen = new Set()
  for (const item of list) {
    seen.add(item)
  }
  return Array.from(seen)
}`,

	`function compact(arr) {
  const out = []
  for (const item of arr) {
    if (item) {
      out.push(item)
    }
  }
  return out
}`,

	`function zip(a, b) {
  const out = []
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    out.push([a[i], b[i]])
  }
  return out
}`,

	`function rotate(arr, k) {
  const n = arr.length
  const shift = ((k % n) + n) % n
  return arr.slice(shift).concat(arr.slice(0, shift))
}`,

	`function intersection(a, b) {
  const setB = new Set(b)
  const out = []
  for (const item of a) {
    if (setB.has(item)) {
      out.push(item)
    }
  }
  return out
}`,

	`function difference(a, b) {
  const setB = new Set(b)
  const out = []
  for (const item of a) {
    if (!setB.has(item)) {
      out.push(item)
    }
  }
  return out
}`,

	`function groupBy(arr, keyFn) {
  const map = {}
  for (const item of arr) {
    const key = keyFn(item)
    if (!map[key]) {
      map[key] = []
    }
    map[key].push(item)
  }
  return map
}`,

	`function countBy(arr, keyFn) {
  const counts = {}
  for (const item of arr) {
    const key = keyFn(item)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}`,

	`function partition(arr, predFn) {
  const yes = []
  const no = []
  for (const item of arr) {
    if (predFn(item)) {
      yes.push(item)
    } else {
      no.push(item)
    }
  }
  return [yes, no]
}`,

	`function mergeSorted(a, b) {
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) {
      out.push(a[i])
      i++
    } else {
      out.push(b[j])
      j++
    }
  }
  return out.concat(a.slice(i), b.slice(j))
}`,

	`function binarySearch(arr, target) {
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return -1
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

	`function bubbleSort(arr) {
  const out = arr.slice()
  for (let i = 0; i < out.length - 1; i++) {
    for (let j = 0; j < out.length - 1 - i; j++) {
      if (out[j] > out[j + 1]) {
        const tmp = out[j]
        out[j] = out[j + 1]
        out[j + 1] = tmp
      }
    }
  }
  return out
}`,

	// ── Strings ───────────────────────────────────────────────────────────────

	`function isPalindrome(text) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  return cleaned === cleaned.split('').reverse().join('')
}`,

	`function reverseWords(sentence) {
  return sentence
    .trim()
    .split(/\s+/)
    .reverse()
    .join(' ')
}`,

	`function countVowels(input) {
  const vowels = new Set(['a', 'e', 'i', 'o', 'u'])
  let total = 0
  for (const ch of input.toLowerCase()) {
    if (vowels.has(ch)) total++
  }
  return total
}`,

	`function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}`,

	`function titleCase(sentence) {
  return sentence
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}`,

	`function camelToSnake(str) {
  return str.replace(/[A-Z]/g, ch => '_' + ch.toLowerCase())
}`,

	`function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())
}`,

	`function truncate(str, maxLen) {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}`,

	`function countOccurrences(str, sub) {
  if (!sub) return 0
  let count = 0
  let pos = 0
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++
    pos += sub.length
  }
  return count
}`,

	`function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '')
}`,

	`function padLeft(str, length, char) {
  const fill = char || ' '
  while (str.length < length) {
    str = fill + str
  }
  return str
}`,

	`function isAnagram(a, b) {
  const normalize = s => s.toLowerCase().replace(/\s/g, '').split('').sort().join('')
  return normalize(a) === normalize(b)
}`,

	`function longestWord(sentence) {
  const words = sentence.trim().split(/\s+/)
  let best = ''
  for (const word of words) {
    if (word.length > best.length) {
      best = word
    }
  }
  return best
}`,

	// ── Numbers & Math ────────────────────────────────────────────────────────

	`function fibonacci(n) {
  if (n <= 1) return n
  let a = 0
  let b = 1
  for (let i = 2; i <= n; i++) {
    const next = a + b
    a = b
    b = next
  }
  return b
}`,

	`function factorial(n) {
  let result = 1
  for (let i = 2; i <= n; i++) {
    result *= i
  }
  return result
}`,

	`function isPrime(n) {
  if (n < 2) return false
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false
  }
  return true
}`,

	`function gcd(a, b) {
  while (b !== 0) {
    const tmp = b
    b = a % b
    a = tmp
  }
  return a
}`,

	`function lcm(a, b) {
  return (a / gcd(a, b)) * b
}`,

	`function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}`,

	`function lerp(a, b, t) {
  return a + (b - a) * t
}`,

	`function toRoman(num) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
  let out = ''
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      out += syms[i]
      num -= vals[i]
    }
  }
  return out
}`,

	`function digitSum(n) {
  let sum = 0
  let abs = Math.abs(n)
  while (abs > 0) {
    sum += abs % 10
    abs = Math.floor(abs / 10)
  }
  return sum
}`,

	`function collatz(n) {
  let steps = 0
  while (n !== 1) {
    if (n % 2 === 0) {
      n = n / 2
    } else {
      n = 3 * n + 1
    }
    steps++
  }
  return steps
}`,

	// ── Objects & Maps ────────────────────────────────────────────────────────

	`function frequencyMap(words) {
  const counts = {}
  for (const word of words) {
    counts[word] = (counts[word] || 0) + 1
  }
  return counts
}`,

	`function invertObject(obj) {
  const out = {}
  for (const key in obj) {
    out[obj[key]] = key
  }
  return out
}`,

	`function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepClone)
  const out = {}
  for (const key in obj) {
    out[key] = deepClone(obj[key])
  }
  return out
}`,

	`function pick(obj, keys) {
  const out = {}
  for (const key of keys) {
    if (key in obj) {
      out[key] = obj[key]
    }
  }
  return out
}`,

	`function omit(obj, keys) {
  const skip = new Set(keys)
  const out = {}
  for (const key in obj) {
    if (!skip.has(key)) {
      out[key] = obj[key]
    }
  }
  return out
}`,

	`function flattenObject(obj, prefix) {
  const out = {}
  for (const key in obj) {
    const fullKey = prefix ? prefix + '.' + key : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const nested = flattenObject(obj[key], fullKey)
      for (const nk in nested) {
        out[nk] = nested[nk]
      }
    } else {
      out[fullKey] = obj[key]
    }
  }
  return out
}`,

	`function mergeDeep(target, source) {
  const out = Object.assign({}, target)
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      out[key] = mergeDeep(target[key] || {}, source[key])
    } else {
      out[key] = source[key]
    }
  }
  return out
}`,

	// ── Linked List (OO style) ────────────────────────────────────────────────

	`function createNode(value) {
  return { value, next: null }
}

function listFromArray(arr) {
  if (arr.length === 0) return null
  const head = createNode(arr[0])
  let cur = head
  for (let i = 1; i < arr.length; i++) {
    cur.next = createNode(arr[i])
    cur = cur.next
  }
  return head
}`,

	`function reverseList(head) {
  let prev = null
  let cur = head
  while (cur !== null) {
    const next = cur.next
    cur.next = prev
    prev = cur
    cur = next
  }
  return prev
}`,

	`function listLength(head) {
  let count = 0
  let cur = head
  while (cur !== null) {
    count++
    cur = cur.next
  }
  return count
}`,

	// ── Stack / Queue ─────────────────────────────────────────────────────────

	`function createStack() {
  const items = []
  return {
    push(val) { items.push(val) },
    pop() { return items.pop() },
    peek() { return items[items.length - 1] },
    isEmpty() { return items.length === 0 },
    size() { return items.length }
  }
}`,

	`function createQueue() {
  const items = []
  return {
    enqueue(val) { items.push(val) },
    dequeue() { return items.shift() },
    front() { return items[0] },
    isEmpty() { return items.length === 0 },
    size() { return items.length }
  }
}`,

	`function isBalanced(str) {
  const stack = []
  const open = new Set(['(', '[', '{'])
  const match = { ')': '(', ']': '[', '}': '{' }
  for (const ch of str) {
    if (open.has(ch)) {
      stack.push(ch)
    } else if (match[ch]) {
      if (stack.pop() !== match[ch]) return false
    }
  }
  return stack.length === 0
}`,

	// ── Async / Promise patterns ──────────────────────────────────────────────

	`async function retry(fn, times) {
  let lastErr
  for (let i = 0; i < times; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}`,

	`function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}`,

	`function throttle(fn, interval) {
  let last = 0
  return function(...args) {
    const now = Date.now()
    if (now - last >= interval) {
      last = now
      return fn.apply(this, args)
    }
  }
}`,

	`function memoize(fn) {
  const cache = new Map()
  return function(...args) {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)
    const result = fn.apply(this, args)
    cache.set(key, result)
    return result
  }
}`,

	`function pipe(...fns) {
  return function(value) {
    let result = value
    for (const fn of fns) {
      result = fn(result)
    }
    return result
  }
}`,

	`function once(fn) {
  let called = false
  let result
  return function(...args) {
    if (!called) {
      called = true
      result = fn.apply(this, args)
    }
    return result
  }
}`,

	// ── DOM / Browser ─────────────────────────────────────────────────────────

	`function createElement(tag, attrs, children) {
  const el = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val)
  }
  for (const child of children || []) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else {
      el.appendChild(child)
    }
  }
  return el
}`,

	`function getQueryParams(url) {
  const params = {}
  const search = url.includes('?') ? url.split('?')[1] : ''
  for (const pair of search.split('&')) {
    if (!pair) continue
    const [key, val] = pair.split('=')
    params[decodeURIComponent(key)] = decodeURIComponent(val || '')
  }
  return params
}`,

	`function setCookie(name, value, days) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/'
}`,

	`function getCookie(name) {
  const prefix = name + '='
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length)
    }
  }
  return null
}`,

	// ── Date / Time ───────────────────────────────────────────────────────────

	`function formatDate(date, sep) {
  const d = sep || '-'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + d + month + d + day
}`,

	`function daysBetween(a, b) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  return Math.round(Math.abs(b - a) / MS_PER_DAY)
}`,

	`function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}`,

	`function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000)
  if (seconds < 60) return seconds + 's ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'm ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  return days + 'd ago'
}`,
}