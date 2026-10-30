'use client'

import { useState } from 'react'

/**
 * Formulaire de contact. Aucun serveur : le message est construit côté client
 * et WhatsApp l'ouvre prérempli vers le numéro du support (+237 686 033 789).
 * Le visiteur voit exactement ce qui va partir avant l'ouverture de l'app.
 */
export default function ContactForm({ locale }: { locale: 'fr' | 'en' }) {
  const WHATSAPP_NUMBER = '237686033789'

  const subjects = locale === 'fr'
    ? ['Signaler un problème', 'Passer au plan Business', 'Demander le plan Entreprise', 'Autre demande']
    : ['Report an issue', 'Upgrade to Business plan', 'Request Enterprise plan', 'Other request']

  const [subject, setSubject] = useState(subjects[0])
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [org, setOrg] = useState('')
  const [message, setMessage] = useState('')
  const [opened, setOpened] = useState(false)

  const ready = name.trim().length > 0 && message.trim().length > 4

  function text() {
    const subjectLabel = locale === 'fr' ? 'Objet' : 'Subject'
    const nameLabel = locale === 'fr' ? 'Nom' : 'Name'
    const contactLabel = locale === 'fr' ? 'Contact' : 'Contact'
    const orgLabel = locale === 'fr' ? 'Organisation' : 'Company'
    const msgLabel = locale === 'fr' ? 'Message' : 'Message'
    return [
      locale === 'fr' ? 'Bonjour Contact Intelligence' : 'Hello Contact Intelligence',
      '',
      `${subjectLabel} : ${subject}`,
      `${nameLabel} : ${name.trim()}`,
      `${contactLabel} : ${contact.trim() || '—'}`,
      `${orgLabel} : ${org.trim() || '—'}`,
      '',
      `${msgLabel} :`,
      message.trim(),
    ].join('\n')
  }

  function send() {
    if (!ready) return
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text())}`, '_blank', 'noopener')
    setOpened(true)
  }

  return (
    <div className="glass-card" style={{ padding: 24, textAlign: 'left' }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
        {locale === 'fr' ? 'Écrivez-nous sur WhatsApp' : 'Message us on WhatsApp'}
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '6px 0 16px', lineHeight: 1.55 }}>
        {locale === 'fr'
          ? 'Le message s’ouvre prérempli dans WhatsApp : vous appuyez sur « Envoyer » et rien ne part dans une boîte mail.'
          : 'The message opens pre-filled in WhatsApp: you just hit “Send” and nothing goes into an email box.'}
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {locale === 'fr' ? 'Objet' : 'Subject'}
          </span>
          <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {locale === 'fr' ? 'Votre nom *' : 'Your name *'}
            </span>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {locale === 'fr' ? 'Téléphone ou e-mail' : 'Phone or e-mail'}
            </span>
            <input className="input" value={contact} onChange={e => setContact(e.target.value)} placeholder="+237…" />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {locale === 'fr' ? 'Organisation' : 'Company'}
          </span>
          <input className="input" value={org} onChange={e => setOrg(e.target.value)} />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {locale === 'fr' ? 'Message *' : 'Message *'}
          </span>
          <textarea
            className="input"
            rows={5}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={locale === 'fr' ? 'Décrivez votre besoin ou le problème rencontré…' : 'Describe your need or the issue…'}
          />
        </label>
      </div>

      <button type="button" className="btn btn-primary" style={{ marginTop: 16, width: '100%', padding: '11px 20px' }} disabled={!ready} onClick={send}>
        📲 {locale === 'fr' ? 'Envoyer sur WhatsApp' : 'Send on WhatsApp'}
      </button>

      {opened && (
        <p style={{ fontSize: 12.5, color: 'var(--brand-deep)', margin: '10px 0 0', textAlign: 'center' }}>
          {locale === 'fr' ? 'WhatsApp s’est ouvert — appuyez sur Envoyer pour nous joindre.' : 'WhatsApp opened — press Send to reach us.'}
        </p>
      )}
      {!ready && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 0 0', textAlign: 'center' }}>
          {locale === 'fr' ? 'Renseignez au moins votre nom et votre message.' : 'Fill in at least your name and a message.'}
        </p>
      )}
    </div>
  )
}
