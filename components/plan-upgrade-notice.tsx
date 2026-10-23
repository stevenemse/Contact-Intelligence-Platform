'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { featureLabel, type PlanFeature } from '@/lib/plans'

export default function PlanUpgradeNotice({ feature, plan }: { feature: PlanFeature; plan: string }) {
  const { locale } = useI18n()
  const label = featureLabel(feature, locale)
  const isFrench = locale === 'fr'

  return (
    <div className="p-4 md:p-8">
      <div className="glass-card" style={{ maxWidth: 620, textAlign: 'center', margin: '40px auto', padding: '42px 28px' }}>
        <span className="badge badge-teal">{isFrench ? 'Fonctionnalité verrouillée' : 'Feature locked'}</span>
        <h1 className="display-1" style={{ marginTop: 16 }}>
          {isFrench ? `${label} n’est pas inclus dans votre plan` : `${label} is not included in your plan`}
        </h1>
        <p className="subtitle-page" style={{ marginTop: 12, lineHeight: 1.6 }}>
          {isFrench
            ? `Votre espace est actuellement sur le plan ${plan}. Comparez les plans disponibles pour débloquer cette fonctionnalité.`
            : `Your workspace is currently on the ${plan} plan. Compare available plans to unlock this feature.`}
        </p>
        <Link href="/pricing" className="btn btn-primary" style={{ marginTop: 22 }}>
          {isFrench ? 'Voir les plans' : 'View plans'}
        </Link>
      </div>
    </div>
  )
}
