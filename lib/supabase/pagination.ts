import 'server-only'

const PAGE_SIZE = 500

type PageResult = { data: unknown[] | null; error: unknown }

/**
 * PostgREST renvoie au maximum 1000 lignes par requête : au-delà, les résultats
 * sont tronqués silencieusement. On pagine donc explicitement (ordre stable
 * obligatoire) pour que les comptages et les exports portent sur toute la base.
 */
export async function selectAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult>,
  maxRows = 100000
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    out.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return out
}
