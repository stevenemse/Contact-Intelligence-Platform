import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext } from '@/lib/supabase/org-context'
import { validateSegmentRules, loadEnrichedContacts, applySegmentGroups } from '@/lib/supabase/segment-engine'

const bodySchema = z.object({ rules: z.array(z.unknown()).max(20) })

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let rules: z.infer<typeof bodySchema>['rules']
  try {
    rules = bodySchema.parse(await req.json()).rules
  } catch {
    return NextResponse.json({ error: 'Segment invalide' }, { status: 400 })
  }

  const validated = validateSegmentRules(rules)
  if (!validated.ok || !validated.groups) {
    return NextResponse.json({ error: validated.error ?? 'Segment invalide' }, { status: 400 })
  }

  const contacts = await loadEnrichedContacts(ctx.orgId)
  const ids = applySegmentGroups(validated.groups, contacts)
  return NextResponse.json({ count: ids.length })
}
