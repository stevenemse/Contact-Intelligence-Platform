import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import Papa from 'papaparse'

export type NormalizedPhone = {
  raw: string
  normalized: string | null
  e164: string | null
  countryCode: CountryCode | null
  isValid: boolean
  type: 'mobile' | 'fixed' | 'unknown'
}

export function normalizePhone(raw: string, defaultCountry: CountryCode = 'CM'): NormalizedPhone {
  const rawClean = raw.trim()
  if (!rawClean) return { raw: rawClean, normalized: null, e164: null, countryCode: null, isValid: false, type: 'unknown' }

  // try direct parse
  let parsed = parsePhoneNumberFromString(rawClean)
  // retry with context prefix +
  if (!parsed && /^\d{7,}$/.test(rawClean)) {
    parsed = parsePhoneNumberFromString(`+${rawClean}`)
  }
  // retry with default country context
  if (!parsed) {
    parsed = parsePhoneNumberFromString(rawClean, defaultCountry)
  }
  if (!parsed) {
    return { raw: rawClean, normalized: null, e164: null, countryCode: null, isValid: false, type: 'unknown' }
  }
  const isValid = parsed.isValid()
  const typeGuess = parsed.getType()
  const type: 'mobile' | 'fixed' | 'unknown' =
    typeGuess === 'MOBILE' ? 'mobile'
    : typeGuess === 'FIXED_LINE' ? 'fixed'
    : 'unknown'
  return {
    raw: rawClean,
    normalized: parsed.formatInternational(),
    e164: parsed.format('E.164'),
    countryCode: parsed.country ?? null,
    isValid,
    type,
  }
}

export function checkSuggestedCountryForPhone(raw: string): CountryCode | null {
  // quickly find country if the number is a valid international number
  const p = parsePhoneNumberFromString(raw)
  return p?.country ?? null
}

export type NormalizedEmail = {
  raw: string
  normalized: string | null
  isValid: boolean
}

export function normalizeEmail(raw: string): NormalizedEmail {
  const emailRaw = raw.trim().toLowerCase().replace(/\s+/g, '')
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw)
  return { raw: raw.trim(), normalized: emailRaw, isValid: ok }
}

export const normalizeEmailAlias = normalizeEmail

// Change case normalization expensive for names
export function normalizeNameCase(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  // "jean dupont" -> "Jean Dupont", "jean-pierre" -> "Jean-Pierre", "o'neil" -> "O'Neil"
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase())
}

// Simple Levenshtein similarity
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const al = (a ?? '').toLowerCase().trim()
  const bl = (b ?? '').toLowerCase().trim()
  if (!al || !bl) return 0
  if (al === bl) return 1
  const longLen = Math.max(al.length, bl.length)
  if (longLen === 0) return 1
  return 1 - levenshtein(al, bl) / longLen
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = new Array(n + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  return dp[n]
}

export type DuplicateRule = 'skip' | 'update' | 'merge'

export type ColMapping = {
  first_name?: string
  last_name?: string
  full_name?: string
  phone?: string
  email?: string
  country?: string
  city?: string
  region?: string
  company?: string
  job_title?: string
  source?: string
  tag?: string
}

type Decoded = { data: unknown[][]; errors: Papa.ParseError[] }

export function decodeCsvFile(buffer: Buffer): Decoded {
  const text = detectDecode(buffer)
  const result = Papa.parse<unknown[]>(text, { header: false, skipEmptyLines: 'greedy' })
  return { data: result.data as unknown[][], errors: result.errors }
}

export function parseCsvPreview(buffer: Buffer): { headers: string[]; sample: Record<string, unknown>[]; totalRows: number } {
  const text = detectDecode(buffer)
  const result = Papa.parse<unknown[]>(text, { header: false, skipEmptyLines: 'greedy' })
  const rows = result.data as unknown[][]
  const headers = (rows[0] ?? []).map((h, i) => String(h ?? `col_${i + 1}`))
  const sample = rows.slice(1, 6).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
  return { headers, sample, totalRows: Math.max(0, rows.length - 1) }
}

function detectDecode(buffer: Buffer): string {
  // BOM-based detection
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf-8')
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf-16le')
  }
  // heuristic check for utf8 valid
  const utf8 = buffer.toString('utf-8')
  if (!utf8.includes('\uFFFD')) return utf8
  return buffer.toString('latin1')
}
