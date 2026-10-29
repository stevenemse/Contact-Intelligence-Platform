// Génère le CSV de test e2e (18 000 lignes) :
//  - PRNG Mulberry32 : l'ancien LCG dégénérait (1 650 numéros distincts
//    pour 18 000 lignes, ce qui truquait le résultat du test) ;
//  - mobiles +225 valides (10 chiffres 01/05/07) ;
//  - anciens numéros à 8 chiffres +225 INVALIDES mais réparables (01/05/07) ;
//  - numéros LOCAUX sans « + » (pays déduit de la colonne Pays) ;
//  - quelques numéros +237 et +236 ;
//  - DEUX doublons de distance extrême : la ligne 101 est copiée telle
//    quelle à la ligne 12 001 (même numéro, même email) ;
//    la ligne 501 à la ligne 14 501.
// Sortie : public/e2e-import.csv (18 000) + public/e2e-dupes.csv (50)
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('public', { recursive: true })

const N = 18000
const rows = ['full_name,phone,email,company,source,city,pays']

// Mulberry32 : période 2^32, distribution uniforme des chiffres générés
let state = 42
const rand = () => {
  state = (state + 0x6D2B79F5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const firsts = ['Awa', 'Jean', 'Fatou', 'Kouassi', 'Bintou', 'Aboubacar', 'Salif', 'Rokia', 'Marc', 'Nadège']
const lasts = ['Traoré', 'Koné', 'Diallo', 'Diarra', 'Yapi', 'Berger', 'Ouattara', 'Cissé']
const companies = ['Jumia CI', 'Orange CI', 'Moov CI', 'Cabinet KKB', 'Salon SARA']
const cities = ['Abidjan', 'Cocody', 'Yopougon', 'Treichville']

// mobile CI valide : 0{1,5,7} + 8 chiffres
const ciMobile = () => {
  const h = ['01', '05', '07'][Math.floor(rand() * 3)]
  let d = h
  for (let i = 0; i < 8; i++) d += Math.floor(rand() * 10)
  return d
}
// ancien format 8 chiffres (8x/9x) → réparé en préfixant par 01/05/07
const ciOld = () => {
  let d = rand() < 0.5 ? '8' : '9'
  for (let i = 0; i < 7; i++) d += Math.floor(rand() * 10)
  return d
}
const cmMobile = () => {
  let d = rand() < 0.5 ? '6' : '67'
  for (let i = 0; i < (d === '6' ? 7 : 6); i++) d += Math.floor(rand() * 10)
  return d
}
const cfMobile = () => {
  let d = '7'
  for (let i = 0; i < 3; i++) d += Math.floor(rand() * 10)
  return d
}

const fmt = (d) => [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ')

const line = (i) => {
  const name = `${firsts[Math.floor(rand() * 10)]} ${lasts[Math.floor(rand() * 8)]} ${i}`
  const email = `c${i}@ex-e2e.test`
  const company = companies[Math.floor(rand() * 5)]
  const city = cities[Math.floor(rand() * 4)]
  const r = rand()
  let phone, pays
  if (r < 0.70) { phone = `+225 ${fmt(ciMobile())}`; pays = "Côte d'Ivoire" }
  else if (r < 0.82) { phone = `+225 ${fmt(ciOld())}`; pays = 'CI' }        // invalide → réparable
  else if (r < 0.90) { phone = fmt(ciMobile()); pays = "Côte d'Ivoire" }    // local sans +
  else if (r < 0.96) { phone = `+237 ${cmMobile()}`; pays = 'Cameroun' }
  else { phone = `+236 ${cfMobile()}`; pays = 'Centrafrique' }
  return `${name},${phone},${email},${company},E2E,${city},${pays}`
}

for (let i = 0; i < N; i++) rows.push(line(i))
// doublons de distance extrême (mêmes nom, téléphone et email qu'au début du fichier)
const FAR1_FROM = 100, FAR1_TO = 12000
const FAR2_FROM = 500, FAR2_TO = 14500
rows[FAR1_TO + 1] = rows[FAR1_FROM + 1] // décalage : rows[0] = en-tête
rows[FAR2_TO + 1] = rows[FAR2_FROM + 1]
writeFileSync('public/e2e-import.csv', rows.join('\n'))
const skippedFar = 2 // lignes expecting skipped par dédoublonnage intra-fichier

// fichier de second passage : 30 premières lignes du gros fichier (doublons EN BASE)
// + 20 variantes intra-fichier sur les 10 premières → test « importer quand même »
const dupes = ['full_name,phone,email,company,source,city,pays']
const body = rows.slice(1, 31)
for (const l of body) dupes.push(l)
for (let i = 0; i < 20; i++) dupes.push(body[i % 10])
writeFileSync('public/e2e-dupes.csv', dupes.join('\n'))

console.log('e2e-import.csv :', N, 'lignes ; doublons lointains :', skippedFar, `(lignes ${FAR1_TO + 2} et ${FAR2_TO + 2}) ; e2e-dupes.csv :`, dupes.length - 1, 'lignes')
