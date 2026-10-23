import Link from "next/link";
import { cookies } from "next/headers";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { I18nProvider } from "@/lib/i18n/i18n-provider";

export const instant = false;

export default async function LandingPage() {
  const store = await cookies();
  const locale = store.get("locale")?.value === "en" ? "en" : "fr";
  const t = getDictionary(locale as Locale).landingFull;

  const stats = t.stats;
  const features = t.features;

  return (
    <I18nProvider initial={locale as Locale}>
    <main id="main-content" className="landing-hero-bg min-h-screen">
      {/* Nav */}
      <header className="landing-nav" style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        padding:'0 32px',
        height:64,
        borderBottom:'1px solid var(--border)',
        position:'sticky',
        top:0,
        zIndex:10,
        background:'rgba(255,255,255,.85)',
        backdropFilter:'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:34,height:34,borderRadius:10,
            background:'linear-gradient(135deg,var(--brand-light),var(--brand))',
            display:'grid',placeItems:'center',
            fontWeight:900,fontSize:13,color:'white',
          }}>CI</div>
          <span style={{fontWeight:700,fontSize:15,color:'var(--text-primary)'}} translate="no">Contact Intelligence</span>
        </div>
        <nav style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="/pricing" className="btn btn-ghost btn-sm">{t.pricing}</Link>
          <ThemeToggle className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} />
          <LanguageToggle className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} />
          <Link href="/login" className="btn btn-ghost btn-sm">{t.login}</Link>
          <Link href="/register" className="btn btn-primary btn-sm">{t.start}</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{
        maxWidth:860,
        margin:'0 auto',
        padding:'80px 32px 60px',
        textAlign:'center',
      }}>
        <div className="fade-up">
          <span className="badge badge-teal" style={{fontSize:12,marginBottom:16,display:'inline-flex'}}>
            {t.badge}
          </span>
        </div>
        <h1 className="fade-up delay-1" style={{
          fontSize:'clamp(32px, 5vw, 52px)',
          fontWeight:900,
          letterSpacing:'-.03em',
          lineHeight:1.1,
          color:'var(--text-primary)',
          marginTop:12,
        }}>
          {t.hero1}
          <br />
          <span style={{
            background:'linear-gradient(135deg, var(--brand), var(--brand-deep))',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>
            {t.hero2}
          </span>
        </h1>
        <p className="fade-up delay-2" style={{
          marginTop:20,
          fontSize:17,
          lineHeight:1.65,
          color:'var(--text-muted)',
          maxWidth:580,
          marginLeft:'auto',
          marginRight:'auto',
        }}>
          {t.heroSub}
        </p>
        <div className="fade-up delay-3" style={{marginTop:32,display:'flex',alignItems:'center',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
          <Link href="/register" className="btn btn-primary" style={{padding:'12px 28px',fontSize:15}}>
            {t.ctaCreate}
          </Link>
          <Link href="/login" className="btn btn-ghost" style={{padding:'12px 24px',fontSize:15}}>
            {t.ctaLogin}
          </Link>
        </div>
      </section>

      {/* Product preview */}
      <section className="product-preview-wrap" aria-label="Aperçu du produit">
        <div className="product-preview">
          <div className="product-preview-topbar">
            <div className="preview-dots" aria-hidden="true"><i /><i /><i /></div>
            <span translate="no">Contact Intelligence</span>
            <span className="preview-status"><b /> {t.preview.sync}</span>
          </div>
          <div className="product-preview-body">
            <aside className="preview-sidebar" aria-hidden="true">
              <div className="preview-logo">CI</div>
              <span className="preview-line wide" /><span className="preview-line" /><span className="preview-line" /><span className="preview-line short" />
              <div className="preview-sidebar-gap" />
              <span className="preview-line" /><span className="preview-line short" />
            </aside>
            <div className="preview-content">
              <div className="preview-heading"><span><small>{t.preview.overview}</small><strong>{t.preview.hello}</strong></span><em>7 juin 2025</em></div>
              <div className="preview-kpis"><div><small>{t.preview.activeContacts}</small><strong>1 768</strong><span>+12,4 %</span></div><div><small>{t.preview.dupesReview}</small><strong>24</strong><span className="warning">{t.preview.toReview}</span></div><div><small>{t.preview.countriesCovered}</small><strong>18</strong><span>{t.preview.thisMonth}</span></div></div>
              <div className="preview-panels"><div className="preview-chart"><small>{t.preview.chart}</small><div className="preview-bars"><i /><i /><i /><i /><i /><i /><i /></div></div><div className="preview-list"><small>{t.preview.lastImports}</small><span><b />clients_juin.csv <em>1 024 lignes</em></span><span><b />prospects_afrique.csv <em>744 lignes</em></span><span><b />evenement.xlsx <em>{t.preview.done}</em></span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="fade-up delay-4" style={{
        maxWidth:860,
        margin:'0 auto 64px',
        padding:'0 32px',
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
        gap:16,
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background:'var(--bg-elevated)',
            border:'1px solid var(--border)',
            borderRadius:12,
            padding:'16px 20px',
            textAlign:'center',
          }}>
            <div style={{fontSize:22,fontWeight:800,color:'var(--brand-deep)',letterSpacing:'-.02em'}}>{s.value}</div>
            <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:4,lineHeight:1.4}}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features grid */}
      <section id="features" style={{maxWidth:1000,margin:'0 auto 80px',padding:'0 32px',scrollMarginTop:88}}>
        <h2 style={{
          textAlign:'center',
          fontSize:22,fontWeight:800,
          color:'var(--text-primary)',
          letterSpacing:'-.02em',
          marginBottom:32,
        }}>
          {t.featuresTitle}
        </h2>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
          gap:16,
        }}>
          {features.map((f, i) => (
            <div key={f.title} className="feature-card fade-up" style={{animationDelay:`${i * .07}s`}}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
                  {i === 0 && <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 3v13m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round"/>}
                  {i === 1 && <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 01-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round"/>}
                  {i === 2 && <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round"/>}
                  {i === 3 && <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-6.586L3.293 6.707A1 1 0 013 6V4z" strokeLinecap="round" strokeLinejoin="round"/>}
                  {i === 4 && <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round"/></>}
                  {i === 5 && <><path d="M12 10v6m0 0l-4-4m4 4l4-4M4 5h7M4 9h7" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></>}
                </svg>
              </div>
              <h3 style={{fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>{f.title}</h3>
              <p style={{fontSize:13.5,lineHeight:1.65,color:'var(--text-muted)'}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ textAlign: 'center', padding: '0 32px 64px' }}>
        <Link href="/pricing" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 15 }}>
          {t.pricing} →
        </Link>
      </section>

      {/* CTA bottom */}
      <section style={{
        textAlign:'center',
        padding:'48px 32px 80px',
        borderTop:'1px solid var(--border)',
      }}>
        <h2 style={{fontSize:26,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-.02em',marginBottom:16}}>
          {t.ctaTitle}
        </h2>
        <p style={{fontSize:15,color:'var(--text-muted)',marginBottom:28}}>
          {t.ctaSub}
        </p>
        <Link href="/register" className="btn btn-primary" style={{padding:'13px 32px',fontSize:15}}>
          {t.ctaBtn}
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop:'1px solid var(--border)',
        padding:'20px 32px',
        textAlign:'center',
        fontSize:12.5,
        color:'var(--text-muted)',
      }}>
        {t.footer}
      </footer>
    </main>
    </I18nProvider>
  );
}
