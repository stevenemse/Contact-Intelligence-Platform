import { parsePhoneNumberFromString, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

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
 */

export type FixRule = {
  callingCode: string
  iso2: CountryCode
  label: string
  candidates: { prefix: string; name: string }[]
}

const FIX_RULES: Record<string, FixRule> = {
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
  '225': {
    callingCode: '225', iso2: 'CI',
    label: "Côte d'Ivoire +225 : préfixe « 0 » (8 → 10 chiffres)",
    candidates: [{ prefix: '0', name: 'tous' }],
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
}

export type RepairResult = { e164: string; label: string }

/**
 * Tente de réparer un numéro invalide en E.164.
 * Retourne la première correction qui passe la validation libphonenumber,
 * ou null si le numéro est irréparable en toute sécurité.
 */
export function repairPhone(e164: string): RepairResult | null {
  const p = parsePhoneNumberFromString(e164)
  if (!p) return null
  if (p.isValid()) return null // déjà valide

  const cc = String(p.countryCallingCode)
  const nat = p.nationalNumber
  if (!nat || nat.length < 4) return null

  // 1. règles de préfixe par indicatif
  const rule = FIX_RULES[cc]
  if (rule) {
    for (const c of rule.candidates) {
      const attempt = `+${cc}${c.prefix}${nat}`
      if (isValidPhoneNumber(attempt)) {
        return { e164: attempt, label: `${rule.label} — « ${c.prefix} » ajouté` }
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

export type PhoneFixSuggestion = {
  phoneId: string
  contactId: string
  raw: string
  e164: string | null
  suggested: string | null
  rule: string
  isValid: boolean
}

/** Même interface qu'avant pour la base : suggère une correction si réparable. */
export function suggestFixForPhone(
  input: { phoneId: string; contactId: string; raw: string; e164: string | null }
): PhoneFixSuggestion | null {
  const original = input.e164 ?? (input.raw.startsWith('+') ? input.raw : null)
  if (!original) return null

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

/** Devine l'indicatif depuis un numéro brut, null si inconnu. */
export function detectCallingCode(rawOrE164: string): { callingCode: string; iso2: CountryCode } | null {
  const p = parsePhoneNumberFromString(rawOrE164.startsWith('+') ? rawOrE164 : `+${rawOrE164}`)
  if (!p) return null
  return { callingCode: String(p.countryCallingCode), iso2: (p.country ?? 'CM') as CountryCode }
}
