import { parsePhoneNumberFromString, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

export type { CountryCode } from 'libphonenumber-js'

/**
 * Moteur de réparation de numéros par indicatif.
 *
 * Stratégie (dans l'ordre, chaque candidat est REVALIDÉ par libphonenumber,
 * on ne devine jamais sans validation) :
 *  1. règles de préfixe par indicatif (ex : +237 → « 6 » mobile / « 2 » fixe)
 *  2. retrait du zéro national de rappel (ex : +33 06 12… → +33 6 12…)
 *  3. scan d'INSERTION : si le numéro est trop court, on essaie d'insérer un
 *     chiffre 0-9 à chaque position jusqu'à validation (couvre toutes les
 *     tranches nationales sans connaître la règle)
 *  4. scan de SUPPRESSION : si le numéro est trop long (ex : zéro d'opérateur
 *     mexicain « 1 » devant, chiffre parasite), on essaie de retirer un
 *     chiffre à chaque position jusqu'à validation
 *
 * `parsePhoneSmart` enrobe tout : parsing interpréTE avec le pays connu
 * (colonne « pays » du CSV ou pays dominant du lot), puis réparation — y
 * compris pour un numéro parsé mais INVALIDE (longueur/type faux), qui
 * n'était pas réparé auparavant.
 */

export type FixRule = {
  callingCode: string
  iso2: CountryCode
  label: string
  candidates: { prefix: string; name: string }[]
}

const FIX_RULES: Record<string, FixRule> = {
  '225': {
    callingCode: '225', iso2: 'CI',
    label: "Côte d'Ivoire +225 : préfixe « 01 », « 05 » ou « 07 » (8 → 10 chiffres)",
    candidates: [
      { prefix: '01', name: 'mobile 01' },
      { prefix: '05', name: 'mobile 05' },
      { prefix: '07', name: 'mobile 07' },
      { prefix: '0', name: 'tous' },
    ],
  },
  '237': {
    callingCode: '237', iso2: 'CM',
    label: 'Cameroun +237 : préfixe « 6 » (mobile) ou « 2 » (fixe)',
    candidates: [
      { prefix: '6', name: 'mobile → 6xxxxx' },
      { prefix: '2', name: 'fixe → 2xxxxx' },
    ],
  },
  '226': {
    callingCode: '226', iso2: 'BF',
    label: 'Burkina Faso +226 : préfixe « 7 » ou « 0 »',
    candidates: [{ prefix: '7', name: 'mobile' }, { prefix: '0', name: 'fixe' }],
  },
  '229': {
    callingCode: '229', iso2: 'BJ',
    label: "Bénin +229 : passage 8 → 10 chiffres, préfixe « 01 »",
    candidates: [
      { prefix: '01', name: 'mobile 01xx' },
      { prefix: '02', name: 'fixe 02xx' },
    ],
  },
  '241': {
    callingCode: '241', iso2: 'GA',
    label: 'Gabon +241 : préfixe « 0 » (7 → 8 chiffres)',
    candidates: [{ prefix: '0', name: 'tous' }],
  },
  '242': {
    callingCode: '242', iso2: 'CG',
    label: 'Congo +242 : préfixe « 0 » ou « 5 »',
    candidates: [{ prefix: '0', name: 'fixe' }, { prefix: '5', name: 'mobile' }],
  },
  '236': {
    callingCode: '236', iso2: 'CF',
    label: 'Centrafrique +236 : préfixe « 7 »',
    candidates: [{ prefix: '7', name: 'mobile' }],
  },
  '235': {
    callingCode: '235', iso2: 'TD',
    label: 'Tchad +235 : préfixe « 6 » ou « 7 »',
    candidates: [{ prefix: '6', name: 'mobile' }, { prefix: '7', name: 'mobile/fixe' }],
  },
  '228': {
    callingCode: '228', iso2: 'TG',
    label: 'Togo +228 : préfixe « 9 »',
    candidates: [{ prefix: '9', name: 'mobile' }],
  },
  '223': {
    callingCode: '223', iso2: 'ML',
    label: 'Mali +223 : préfixe « 7 » ou « 9 »',
    candidates: [{ prefix: '7', name: 'mobile' }, { prefix: '9', name: 'mobile' }],
  },
  '227': {
    callingCode: '227', iso2: 'NE',
    label: 'Niger +227 : préfixe « 9 » ou « 8 »',
    candidates: [{ prefix: '9', name: 'mobile' }, { prefix: '8', name: 'mobile' }],
  },
  '221': {
    callingCode: '221', iso2: 'SN',
    label: 'Sénégal +221 : préfixe « 7 » (7 → 9 chiffres)',
    candidates: [{ prefix: '7', name: 'mobile/fixe' }],
  },
  '220': {
    callingCode: '220', iso2: 'GM',
    label: 'Gambie +220 : préfixe « 2 » ou « 3 »',
    candidates: [{ prefix: '2', name: 'fixe' }, { prefix: '3', name: 'mobile' }],
  },
  '243': {
    callingCode: '243', iso2: 'CD',
    label: 'RDC +243 : préfixe « 8 » ou « 9 »',
    candidates: [{ prefix: '8', name: 'mobile' }, { prefix: '9', name: 'mobile' }],
  },
  '224': {
    callingCode: '224', iso2: 'GN',
    label: 'Guinée +224 : préfixe « 6 » (mobile)',
    candidates: [{ prefix: '6', name: 'mobile' }],
  },
}

/** ISO2 → indicatif, déduit des règles de réparation (pays où la réparation s'applique). */
const ISO_TO_CC: Record<string, string> = {}
for (const rule of Object.values(FIX_RULES)) ISO_TO_CC[rule.iso2] = rule.callingCode

export function callingCodeForIso(iso2?: string | null): string | null {
  if (!iso2) return null
  return ISO_TO_CC[String(iso2).toUpperCase()] ?? null
}

export type RepairResult = { e164: string; label: string }

/**
 * Réparation à partir des morceaux connus (indicatif + numéro national),
 * même quand le numéro d'origine n'a jamais pu être parsé. Chaque candidat
 * est revalidé par libphonenumber.
 */
export function repairFromParts(cc: string, nat: string, labelHead: string): RepairResult | null {
  if (!nat || nat.length < 4) return null

  // 1. règles de préfixe par indicatif
  const rule = FIX_RULES[cc]
  if (rule) {
    for (const c of rule.candidates) {
      const attempt = `+${cc}${c.prefix}${nat}`
      if (isValidPhoneNumber(attempt)) {
        return { e164: attempt, label: `${labelHead} — « ${c.prefix} » ajouté` }
      }
    }
  }

  // 2. retrait du zéro national de rappel (france : +33 06… → +33 6…)
  if (nat.startsWith('0')) {
    const attempt = `+${cc}${nat.slice(1)}`
    if (isValidPhoneNumber(attempt)) {
      return { e164: attempt, label: 'Zéro national de rappel « 0 » retiré' }
    }
  }

  // 3. scan d'insertion : numéro trop court → on essaie chaque position/chiffre
  //    (borné : ≤ 13 positions × 10 chiffres = 130 parses, ~µs chacun)
  if (nat.length <= 11) {
    for (let pos = 0; pos <= nat.length; pos++) {
      for (let d = 0; d <= 9; d++) {
        const attempt = `+${cc}${nat.slice(0, pos)}${d}${nat.slice(pos)}`
        if (isValidPhoneNumber(attempt)) {
          return { e164: attempt, label: `Numéro trop court : chiffre « ${d} » inséré en position ${pos + 1}` }
        }
      }
    }
  }

  // 4. scan de suppression : numéro trop long → on essaie chaque position
  if (nat.length >= 9) {
    for (let pos = 0; pos < nat.length; pos++) {
      const attempt = `+${cc}${nat.slice(0, pos)}${nat.slice(pos + 1)}`
      if (isValidPhoneNumber(attempt)) {
        return { e164: attempt, label: `Numéro trop long : chiffre en position ${pos + 1} retiré` }
      }
    }
  }

  return null
}

/** Répare un E.164 parsé mais invalide (compat : ancienne API). */
export function repairPhone(e164: string): RepairResult | null {
  const p = parsePhoneNumberFromString(e164)
  if (!p) return null
  if (p.isValid()) return null // déjà valide
  const cc = String(p.countryCallingCode)
  return repairFromParts(cc, p.nationalNumber, `${cc} : numéro invalide`)
}

// ── Parsing intelligent avec pays de contexte ───────────────────────────────

export type SmartPhone = {
  raw: string
  /** Format international lisible, null si totalement unparsable. */
  normalized: string | null
  e164: string | null
  /** Indicatif international (ex « 225 »). */
  cc: string | null
  iso2: CountryCode | null
  valid: boolean
  /** true si une correction automatique a été appliquée (valid → true). */
  repaired: boolean
  /** Règle de réparation appliquée, pour le rapport d'import. */
  rule: string | null
}

type ParsedBest = {
  normalized: string
  e164: string
  is_valid: boolean
  cc: string | null
  iso2: CountryCode | null
  type: 'mobile' | 'fixed' | 'unknown'
}

function toBest(p: NonNullable<ReturnType<typeof parsePhoneNumberFromString>>): ParsedBest {
  const typeGuess = p.getType()
  return {
    normalized: p.formatInternational(),
    e164: p.format('E.164'),
    is_valid: p.isValid(),
    cc: String(p.countryCallingCode),
    iso2: p.country ?? null,
    type: typeGuess === 'MOBILE' ? 'mobile' : typeGuess === 'FIXED_LINE' ? 'fixed' : 'unknown',
  }
}

/** Garde le meilleur des deux parses : valide d'abord, parsé ensuite. */
function better(a: ParsedBest | null, b: ParsedBest | null): ParsedBest | null {
  if (!a) return b
  if (!b) return a
  if (b.is_valid && !a.is_valid) return b
  return a
}

/**
 * Parse un numéro de téléphone du CSV et tente la réparation :
 *  - « +… » → parsing international direct ;
 *  - « 00… » → préfixe international converti ;
 *  - numéro local (pas de « + ») → interprété avec `hintIso` (colonne pays du
 *    fichier, ou pays dominant du lot), sinon fallback historique « + »+chiffres ;
 *  - numéro parsé mais invalide → `repairFromParts` (rules + scans) ;
 *  - numéro imparsable mais pays connu → idem sur les chiffres bruts.
 */
export function parsePhoneSmart(raw: string, hintIso?: CountryCode | null): SmartPhone {
  const rawClean = raw.trim()
  if (!rawClean) {
    return { raw: rawClean, normalized: null, e164: null, cc: null, iso2: null, valid: false, repaired: false, rule: null }
  }
  const digits = rawClean.replace(/\D+/g, '')

  let best: ParsedBest | null = null

  // A. international explicite
  if (rawClean.startsWith('+') || (rawClean.startsWith('00') && digits.length >= 9)) {
    const candidate = rawClean.startsWith('+') ? rawClean : '+' + digits.slice(2)
    const p = parsePhoneNumberFromString(candidate)
    if (p) best = better(best, toBest(p))
  }

  // B. numéro local + pays connu → parsing avec contexte national
  if (!best?.is_valid && hintIso) {
    const p = parsePhoneNumberFromString(rawClean, hintIso)
    if (p) best = better(best, toBest(p))
  }

  // C. fallback historique : « + » + chiffres (peut couvrir un indicatif oublié sans « + »)
  if (!best?.is_valid && digits.length >= 8 && digits.length <= 15) {
    const p = parsePhoneNumberFromString('+' + digits)
    if (p) best = better(best, toBest(p))
  }

  // D. réparation d'un numéro invalide
  if (!best?.is_valid) {
    const cc = best?.cc ?? callingCodeForIso(hintIso)
    if (cc) {
      // candidats nationaux : chiffres bruts, sans 0 de tête, sans indicatif local
      const candidates = new Set<string>()
      candidates.add(digits)
      if (digits.startsWith('0')) candidates.add(digits.slice(1))
      if (cc && digits.startsWith(cc)) candidates.add(digits.slice(cc.length))
      for (const nat of [...candidates]) {
        const fix = repairFromParts(cc, nat, callingLabel(cc))
        if (fix) {
          const p = parsePhoneNumberFromString(fix.e164)
          if (p && p.isValid()) {
            return {
              raw: rawClean,
              normalized: p.formatInternational(),
              e164: p.format('E.164'),
              cc: String(p.countryCallingCode),
              iso2: p.country ?? null,
              valid: true,
              repaired: true,
              rule: fix.label,
            }
          }
        }
      }
    }
  }

  // aucun candidat valide : on garde le meilleur parse (is_valid=false)
  // pour le correcteur de numéros ; un numéro imparsable reste sans normalisation.
  return {
    raw: rawClean,
    normalized: best?.normalized ?? null,
    e164: best?.e164 ?? null,
    cc: best?.cc ?? null,
    iso2: best?.iso2 ?? null,
    valid: Boolean(best?.is_valid),
    repaired: false,
    rule: null,
  }
}

function callingLabel(cc: string): string {
  const rule = Object.values(FIX_RULES).find(r => r.callingCode === cc)
  return rule ? rule.label : `${cc} : numéro invalide`
}

export type PhoneFixSuggestion = {
  phoneId: string
  contactId: string
  raw: string
  e164: string | null
  suggested: string | null
  rule: string
  isValid: boolean
}

/**
 * Suggère une correction pour un numéro already en base.
 * `hintIso2` : pays dominant de l'organisation — permet aussi de proposer une
 * correction pour les numéros locaux sans « + » (jamais traités avant).
 */
export function suggestFixForPhone(
  input: { phoneId: string; contactId: string; raw: string; e164: string | null },
  hintIso2?: CountryCode | null
): PhoneFixSuggestion | null {
  const original = input.e164 ?? (input.raw.startsWith('+') ? input.raw : null)

  if (original) {
    const fix = repairPhone(original)
    if (!fix) return null
    const formatted = parsePhoneNumberFromString(fix.e164)?.formatInternational() ?? fix.e164
    return {
      phoneId: input.phoneId,
      contactId: input.contactId,
      raw: input.raw,
      e164: original,
      suggested: formatted,
      rule: fix.label,
      isValid: false,
    }
  }

  if (hintIso2) {
    const res = parsePhoneSmart(input.raw, hintIso2)
    if (res.repaired && res.normalized) {
      return {
        phoneId: input.phoneId,
        contactId: input.contactId,
        raw: input.raw,
        e164: original,
        suggested: res.normalized,
        rule: res.rule ?? 'Numéro local réparé',
        isValid: false,
      }
    }
  }

  return null
}

/** Devine l'indicatif depuis un numéro brut, null si inconnu. */
export function detectCallingCode(rawOrE164: string): { callingCode: string; iso2: CountryCode } | null {
  const p = parsePhoneNumberFromString(rawOrE164.startsWith('+') ? rawOrE164 : `+${rawOrE164}`)
  if (!p) return null
  return { callingCode: String(p.countryCallingCode), iso2: (p.country ?? 'CM') as CountryCode }
}
