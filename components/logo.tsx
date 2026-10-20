import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/dashboard" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
      <div style={{
        width:32,height:32,borderRadius:9,
        background:'linear-gradient(135deg,var(--brand),var(--brand-dark))',
        display:'grid',placeItems:'center',
        fontWeight:900,fontSize:12,color:'white',
        boxShadow:'0 0 12px var(--brand-glow)',
        flexShrink:0,
      }}>CI</div>
      <span style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Contact Intelligence</span>
    </Link>
  )
}
