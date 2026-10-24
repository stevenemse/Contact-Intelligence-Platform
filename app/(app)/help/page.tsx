// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { cookies } from 'next/headers'
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries'

export default async function HelpPage() {
  const locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'fr'
  const h = getDictionary(locale as Locale).help

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{h.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{h.sub}</p>
      </div>

      {/* Démarrer en 4 étapes */}
      <section>
        <h2 className="section-title mb-3">{h.startTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {h.steps.map((s, i) => (
            <div key={s.title} className="kpi-card space-y-2">
              <span className="badge badge-teal">{i + 1}</span>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Guides par fonctionnalité */}
      <section>
        <h2 className="section-title mb-3">{h.guidesTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {h.guides.map(g => (
            <div key={g.title} className="kpi-card space-y-1.5">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{g.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="section-title mb-3">{h.faqTitle}</h2>
        <div className="faq-block">
          {h.faq.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact support */}
      <section className="kpi-card text-center py-8 space-y-2">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{h.contactTitle}</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{h.contactSub}</p>
        <a
          href="mailto:contact@contactintelligence.app?subject=Aide%20%E2%80%94%20Contact%20Intelligence"
          className="btn btn-primary"
          style={{ marginTop: 8 }}
        >
          {h.contactBtn}
        </a>
        <p className="text-xs" style={{ color: 'var(--text-faint)', marginTop: 8 }}>{h.contactTip}</p>
      </section>
    </div>
  )
}
