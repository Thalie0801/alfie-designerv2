const PROMPTS = [
  "Visuel teasing produit (fond dégradé doux)",
  "Carrousel storytelling avant/après",
  "Hero promo : 3 bénéfices clés",
  "Mockup avec micro-copy + CTA",
];

export default function TrendsCard() {
  return (
    <section>
      <h3 style={{margin:"6px 0 10px"}}>Prompts tendances</h3>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {PROMPTS.map((p) => (
          <span key={p} style={{
            display:"inline-block", padding:"10px 12px",
            border:"1px solid #e5e7eb", borderRadius:999, background:"#f8f9ff"
          }}>{p}</span>
        ))}
      </div>
    </section>
  );
}
