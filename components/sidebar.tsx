'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/i18n-provider'
import ThemeToggle from '@/components/theme-toggle'
import { hasPlanFeature, type PlanFeature } from '@/lib/plans'

// ── SVG Icons ──────────────────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="7" height="7" rx="2"/>
      <rect x="11" y="2" width="7" height="7" rx="2"/>
      <rect x="2" y="11" width="7" height="7" rx="2"/>
      <rect x="11" y="11" width="7" height="7" rx="2"/>
    </svg>
  )
}
function IconContacts() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="6" r="3"/>
      <path d="M2 17c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
      <path d="M14 9c2 0 4 1.5 4 4.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconDuplicates() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 4H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/>
      <rect x="9" y="2" width="8" height="12" rx="2"/>
    </svg>
  )
}
function IconTags() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7.5L10 2l8 5.5V17a1 1 0 01-1 1H3a1 1 0 01-1-1V7.5z"/>
      <circle cx="10" cy="11" r="2"/>
    </svg>
  )
}
function IconFields() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h12M4 10h12M4 14h6" strokeLinecap="round"/>
    </svg>
  )
}
function IconImport() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3v10m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" strokeLinecap="round"/>
    </svg>
  )
}
function IconSegments() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5h14M5 10h10M7 15h6" strokeLinecap="round"/>
    </svg>
  )
}
function IconMap() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2V5z"/>
      <path d="M8 3v12M12 5v12" strokeLinecap="round"/>
    </svg>
  )
}
function IconExport() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13V3m0 0l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" strokeLinecap="round"/>
    </svg>
  )
}
function IconShield() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2l6 2.4v4.2c0 4-2.6 7.5-6 8.6-3.4-1.1-6-4.6-6-8.6V4.4L10 2z" strokeLinejoin="round"/>
      <path d="M7.6 9.8l1.7 1.7 3.2-3.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconActivity() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 10h3l2-5 3 10 2-7 2 4h4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconTeam() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="6" r="2.5"/>
      <circle cx="13" cy="6" r="2.5"/>
      <path d="M1 17c0-2.761 2.686-5 6-5"/>
      <path d="M13 12c3.314 0 6 2.239 6 5"/>
    </svg>
  )
}
function IconHelp() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="8"/>
      <path d="M7.9 7.7a2.2 2.2 0 014.2.8c0 1.5-2.1 1.8-2.1 3" strokeLinecap="round"/>
      <circle cx="10" cy="14.2" r=".8" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IconSettings() {
  return (
    <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.657 4.343l-1.06 1.06M5.403 14.597l-1.06 1.06M15.657 15.657l-1.06-1.06M5.403 5.403l-1.06-1.06"/>
    </svg>
  )
}
function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:15,height:15}}>
      <path d="M3 9l7-6 7 6v7a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1V9z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}>
      <path d="M13 7l3 3m0 0l-3 3m3-3H8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 4H5a2 2 0 00-2 2v8a2 2 0 002 2h3" strokeLinecap="round"/>
    </svg>
  )
}
function IconGlobe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:14,height:14}}>
      <circle cx="10" cy="10" r="8"/>
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16"/>
    </svg>
  )
}
function IconBurger() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:18,height:18}}>
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>
    </svg>
  )
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'badge-teal',
  admin:   'badge-blue',
  manager: 'badge-yellow',
  member:  '',
  viewer:  '',
}

export default function Sidebar({ orgName, role, email, plan, showAdmin = false }: {
  orgName: string
  role: string
  email: string
  plan: string
  showAdmin?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const { locale, setLocale, t } = useI18n()
  const labels = t.nav

  useEffect(() => {
    const saved = window.localStorage.getItem('locale') as 'fr' | 'en' | null
    if (saved === 'fr' || saved === 'en') setLocale(saved)
  }, [setLocale])

  // fermer le drawer au changement de page
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  function toggleLocale() {
    const next = locale === 'fr' ? 'en' : 'fr'
    setLocale(next)
    window.localStorage.setItem('locale', next)
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  type Item = { href: string; label: string; Icon?: () => React.ReactElement; sub?: boolean; feature?: PlanFeature }
  const items: (Item | 'sep')[] = [
    { href: '/dashboard',     label: labels.dashboard,   Icon: IconDashboard },
    { href: '/contacts',      label: labels.contacts,    Icon: IconContacts },
    { href: '/duplicates',    label: labels.duplicates,  Icon: IconDuplicates, sub: true, feature: 'duplicates' },
    { href: '/tags',          label: labels.tags,        Icon: IconTags,       sub: true },
    { href: '/custom-fields', label: labels.fields,      Icon: IconFields,     sub: true, feature: 'customFields' },
    'sep',
    { href: '/imports',       label: labels.imports,     Icon: IconImport, feature: 'imports' },
    { href: '/segments',      label: labels.segments,    Icon: IconSegments, feature: 'segments' },
    { href: '/map',           label: labels.map,         Icon: IconMap, feature: 'map' },
    { href: '/exports',       label: labels.exports,     Icon: IconExport, feature: 'exports' },
    { href: '/activity',      label: labels.activity,    Icon: IconActivity, feature: 'activity' },
    'sep',
    { href: '/team',          label: labels.team,        Icon: IconTeam, feature: 'team' },
    { href: '/settings',      label: labels.settings,    Icon: IconSettings },
    { href: '/help',          label: labels.help,        Icon: IconHelp },
  ]

  const initials = email
    ? email.slice(0, 2).toUpperCase()
    : '?'

  const roleClass = ROLE_COLORS[role] ?? ''

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bouton burger mobile — fixe, en dehors du drawer */}
      <button
        className="mobile-burger"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <IconBurger />
      </button>

      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label={locale === 'fr' ? 'Navigation principale' : 'Main navigation'}>
        {/* Logo */}
        <div className="sidebar-logo">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)} style={{textDecoration:'none'}}>
            <div className="sidebar-logo-mark">CI</div>
            <div className="sidebar-brand-name" style={{fontSize:13.5, fontWeight:800, color:'#fff', letterSpacing:'-.01em'}}>
              Contact Intelligence
            </div>
          </Link>
          <button className="sidebar-collapse" onClick={() => setCollapsed(value => { const next = !value; window.localStorage.setItem('sidebar-collapsed', String(next)); return next })} aria-label={collapsed ? 'Développer la navigation' : 'Réduire la navigation'} aria-pressed={collapsed}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Org info */}
        <div className="sidebar-workspace" style={{padding:'12px 18px 10px',borderBottom:'1px solid var(--sidebar-border)'}}>
          <div style={{fontSize:10.5,fontWeight:700,color:'rgba(167,187,180,.75)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>Espace de travail</div>
          <div style={{fontSize:13.5,fontWeight:600,color:'#e2ece9',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{orgName || '—'}</div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {items.map((it, i) => {
            if (it === 'sep') {
              return <div key={`sep-${i}`} style={{ height: 1, background: 'var(--sidebar-border)', margin: '8px 8px' }} />
            }
            const { href, label, Icon, sub, feature } = it as Item
            const active = isActive(href)
            const locked = feature ? !hasPlanFeature(plan, feature) : false
            return (
              <Link
                key={href}
                href={locked ? '/pricing' : href}
                className={`nav-item${active ? ' active' : ''}${sub ? ' nav-sub' : ''}${locked ? ' nav-item-locked' : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-label={locked ? `${label} — upgrade requis` : label}
                title={locked ? (locale === 'fr' ? `${label} : mettez votre plan à niveau` : `${label}: upgrade your plan`) : undefined}
              >
                {sub ? <span className="nav-sub-dot" /> : Icon ? <Icon /> : null}
                <span>{label}</span>
                {locked && <span className="nav-lock" aria-hidden="true">⌁</span>}
              </Link>
            )
          })}
        </nav>

        {/* Administration plateforme — visible uniquement pour les super-admins */}
        {showAdmin && (
          <div className="sidebar-admin">
            <div className="sidebar-admin-label">{locale === 'fr' ? 'Plateforme' : 'Platform'}</div>
            <Link
              href="/admin"
              className={`nav-item nav-admin${isActive('/admin') ? ' active' : ''}`}
              aria-current={isActive('/admin') ? 'page' : undefined}
              title={locale === 'fr' ? 'Administration de la plateforme' : 'Platform administration'}
            >
              <IconShield />
              <span>{labels.admin}</span>
              <span className="nav-admin-pill" aria-hidden="true">super</span>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2ece9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
              <span className={`badge ${roleClass}`} style={{ marginTop: 3, fontSize: 10.5 }}>
                {role}
              </span>
            </div>
          </div>

          <div className="sidebar-tools">
            <Link
              href="/"
              className="nav-item sidebar-tool"
              title={locale === 'fr' ? 'Accueil' : 'Home'}
              aria-label={locale === 'fr' ? 'Accueil' : 'Home'}
            >
              <IconHome />
            </Link>
            <ThemeToggle className="sidebar-tool" style={{ fontSize: 12 }} />
            <button
              onClick={toggleLocale}
              className="nav-item sidebar-tool"
              aria-label={locale === 'fr' ? 'Passer en anglais' : 'Switch to French'}
              title={locale === 'fr' ? 'Passer en anglais' : 'Switch to French'}
            >
              <IconGlobe />
              <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
            </button>
          </div>

          <button onClick={logout} className="sidebar-logout" title={labels.logout}>
            <IconLogout />
            <span>{labels.logout}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
