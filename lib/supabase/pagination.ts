import 'server-only'

const PAGE_SIZE = 1000 // maximum PostgREST par requête
const WAVE = 6 // pages interrogées en parallèle par vague

type PageResult = { data: unknown[] | null; error: unknown }

/**
 * PostgREST renvoie au maximum 1000 lignes par requête : au-delà, les résultats
 * sont tronqués silencieusement. On pagine donc explicitement (ordre stable
 * obligatoire) pour que les comptages et les exports portent sur toute la base.
 * pages : les requêtes partent par vagues parallèles (WAVE) et sont ajoutées
 * dans l'ordre ; la vague s'arrête à la première page incomplète ou en erreur.
 */
export async function selectAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult>,
  maxRows = 100000
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += PAGE_SIZE * WAVE) {
    const waveFroms: number[] = []
    let stop = false
    for (let i = 0; i < WAVE && !stop; i++) {
      const f = from + i * PAGE_SIZE
      if (f >= maxRows) break
      waveFroms.push(f)
    }
    if (waveFroms.length === 0) break
    const results = await Promise.all(
      waveFroms.map(f => makeQuery(f, f + PAGE_SIZE - 1)),
    )
    for (let i = 0; i < results.length && !stop; i++) {
      const { data, error } = results[i]
      if (error || !data) stop = true // anomalie : on termine à la dernière page complète
      else {
        out.push(...(data as T[]))
        if (data.length < PAGE_SIZE) stop = true
      }
    }
    if (stop) break
  }
  return out
}
