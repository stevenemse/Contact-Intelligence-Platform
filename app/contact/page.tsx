// route publique

export const instant = false

import Link from 'next/link'
import { cookies } from 'next/headers'
import SiteNav from '@/components/site-nav'
import ContactForm from '@/components/contact-form'

/** Numéro WhatsApp du support : c'est la destination unique des demandes. */
const WHATSAPP_NUMBER = '237686033789'
const WHATSAPPpretty = '+237 6 86 03 37 89'

export default async function ContactPage() {
  const store = await cookies()
  const locale = store.get('locale')?.value === 'en' ? 'en' : 'fr'

  const directText = encodeURIComponent(locale === 'fr'
    ? 'Bonjour Contact Intelligence, j’ai une question.'
    : 'Hello Contact Intelligence, I have a question.')

  const reasons = locale === 'fr'
    ? [
        { icon: '🆘', title: 'Signaler un problème', desc: 'Un import bloqué, un numéro mal réparé, une donnée étrange : écrivez, on regarde le jour même.' },
        { icon: '🚀', title: 'Passer à Business', desc: '50 000 contacts, sièges et priorité : dites-nous l’effectif de vos équipes et on active le plan sur WhatsApp.' },
        { icon: '🤝', title: 'Plan Entreprise', desc: 'Paliers 100k à 1M+ contacts, à la carte. La conversation commence ici, la facturation suit vos cycles.' },
      ]
    : [
        { icon: '🆘', title: 'Report an issue', desc: 'A stuck import, a badly repaired number, odd data: write to us, we look at it the same day.' },
        { icon: '🚀', title: 'Upgrade to Business', desc: '50k contacts, seats and priority: tell us your team size and the plan is enabled over WhatsApp.' },
        { icon: '🤝', title: 'Enterprise plan', desc: 'Tiers from 100k to 1M+ contacts, à la carte. The conversation starts here, billing follows your cycles.' },
      ]

  return (
    <main className="landing-hero-bg min-h-screen">
      <SiteNav />

      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 32px 24px', textAlign: 'center' }}>
        <span className="badge badge-teal" style={{ marginBottom: 14, display: 'inline-block' }}>
          {locale === 'fr' ? 'Support humain, réponse le jour même' : 'Human support, same-day reply'}
        </span>
        <h1 style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 900, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 12px' }}>
          {locale === 'fr' ? 'Parlons de votre base, sur WhatsApp.' : 'Let’s talk about your data, on WhatsApp.'}
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
          {locale === 'fr'
            ? 'Un bug, une question, un plan à activer : tout arrive sur le WhatsApp du support, sans formulaire mort et sans boîte mail oubliée.'
            : 'A bug, a question, a plan to activate: everything lands on the support WhatsApp — no dead forms, no forgotten inbox.'}
        </p>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${directText}`}
            target="_blank"
            rel="noopener"
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            💬 {locale === 'fr' ? 'Ouvrir la discussion' : 'Open the chat'} · <span style={{ fontWeight: 400 }}>{WHATSAPPpretty}</span>
          </a>
          <Link href="/pricing" className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: 15 }}>
            {locale === 'fr' ? 'Voir les tarifs' : 'See pricing'}
          </Link>
        </div>
      </section>

      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {reasons.map(r => (
          <div key={r.title} className="glass-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }} aria-hidden="true">{r.icon}</div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{r.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{r.desc}</p>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 640, margin: '0 auto', padding: '8px 32px 80px' }}>
        <ContactForm locale={locale} />
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 32px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
        {locale === 'fr'
          ? `Support WhatsApp ${WHATSAPPpretty} — du lundi au samedi, 8h – 20h (heure d’Abidjan).`
          : `WhatsApp support ${WHATSAPPpretty} — Monday to Saturday, 8am – 8pm (Abidjan time).`}
      </footer>
    </main>
  )
}
