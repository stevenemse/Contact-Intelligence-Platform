import Link from "next/link";

export default function LandingPage() {
  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 3v13m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: "Import CSV robuste",
      desc: "Mapping assisté des colonnes, détection d'encodage, aperçu avant insertion, traitement asynchrone avec barre de progression.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round"/>
        </svg>
      ),
      title: "Qualité des données",
      desc: "Normalisation internationale des téléphones (libphonenumber), emails, casse, pays et indicatifs, détection des lignes incomplètes.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" strokeLinecap="round"/>
        </svg>
      ),
      title: "Déduplication contrôlée",
      desc: "Doublons exacts, forts et probables avec score de similarité, revue côte à côte et fusion journalisée.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-6.586L3.293 6.707A1 1 0 013 6V4z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: "Segment Builder",
      desc: "Filtres dynamiques AND/OR/NOT avec opérateurs riches, segment sauvegardé, actualisé et exportable.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round"/>
        </svg>
      ),
      title: "Carte mondiale",
      desc: "Volumes par pays avec intensité, drill-down pays → région → ville, synchronisation carte / filtres / tableau.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:20,height:20}}>
          <path d="M12 10v6m0 0l-4-4m4 4l4-4M4 5h7M4 9h7" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
      ),
      title: "Export Builder",
      desc: "Base entière, segment ou résultat filtré, choix et ordre des colonnes, découpage par pays en fichiers distincts, CSV UTF-8.",
    },
  ]

  const stats = [
    { value: "6 étapes", label: "Wizard d'import guidé" },
    { value: "+237", label: "Pays par défaut Cameroun" },
    { value: "100%", label: "Multi-tenant & sécurisé" },
    { value: "RLS", label: "Row-Level Security Supabase" },
  ]

  return (
    <main className="landing-hero-bg min-h-screen">
      {/* Nav */}
      <header style={{
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
          <span style={{fontWeight:700,fontSize:15,color:'var(--text-primary)'}}>Contact Intelligence Platform</span>
        </div>
        <nav style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="/login" className="btn btn-ghost btn-sm">Se connecter</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Commencer gratuitement</Link>
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
            SaaS B2B · Data Management · Afrique & International
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
          Centralisez, nettoyez et
          <br />
          <span style={{
            background:'linear-gradient(135deg, var(--brand), var(--brand-deep))',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>
            exploitez vos contacts
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
          Import CSV avec mapping assisté, normalisation internationale des numéros,
          déduplication contrôlée, segments avancés AND/OR/NOT, carte mondiale
          interactive et exports prêts pour votre CRM ou outil SMS.
        </p>
        <div className="fade-up delay-3" style={{marginTop:32,display:'flex',alignItems:'center',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
          <Link href="/register" className="btn btn-primary" style={{padding:'12px 28px',fontSize:15}}>
            Créer mon espace de travail
          </Link>
          <Link href="/login" className="btn btn-ghost" style={{padding:'12px 24px',fontSize:15}}>
            J&apos;ai déjà un compte
          </Link>
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
      <section style={{maxWidth:1000,margin:'0 auto 80px',padding:'0 32px'}}>
        <h2 style={{
          textAlign:'center',
          fontSize:22,fontWeight:800,
          color:'var(--text-primary)',
          letterSpacing:'-.02em',
          marginBottom:32,
        }}>
          Tout ce dont vous avez besoin
        </h2>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
          gap:16,
        }}>
          {features.map((f, i) => (
            <div key={f.title} className="feature-card fade-up" style={{animationDelay:`${i * .07}s`}}>
              <div className="feature-icon">{f.icon}</div>
              <h3 style={{fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>{f.title}</h3>
              <p style={{fontSize:13.5,lineHeight:1.65,color:'var(--text-muted)'}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section style={{
        textAlign:'center',
        padding:'48px 32px 80px',
        borderTop:'1px solid var(--border)',
      }}>
        <h2 style={{fontSize:26,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-.02em',marginBottom:16}}>
          Prêt à nettoyer votre base ?
        </h2>
        <p style={{fontSize:15,color:'var(--text-muted)',marginBottom:28}}>
          Gratuit pour démarrer. Aucune carte bancaire requise.
        </p>
        <Link href="/register" className="btn btn-primary" style={{padding:'13px 32px',fontSize:15}}>
          Commencer maintenant — gratuitement
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
        Contact Intelligence Platform — préparez vos données, vos outils de campagne restent maîtres de l&apos;envoi.
      </footer>
    </main>
  )
}
