const PROMPTS = [
  "Visuel teasing produit sur fond dégradé doux",
  "Carrousel storytelling avant/après transformation",
  "Mockup hero avec texte court + CTA",
  "Annonce promo — 3 bénéfices clés en 4:5",
];

export default function TrendsCard() {
  return (
    <section className="trends-card">
      <h3>Prompts tendances</h3>
      <div className="trends-card__list">
        {PROMPTS.map((prompt) => (
          <span key={prompt} className="trends-card__chip">
            {prompt}
          </span>
        ))}
      </div>

      <style jsx>{`
        .trends-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        h3 {
          margin: 6px 0 4px;
          font-size: 1rem;
          color: #1f2937;
        }

        .trends-card__list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .trends-card__chip {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f8f9ff;
          color: #2535a0;
          font-size: 0.95rem;
          font-weight: 500;
        }
      `}</style>
    </section>
  );
}
