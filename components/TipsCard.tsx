const TIPS = [
  "Glisse une accroche ultra courte dans la première slide.",
  "Varie les contrastes entre texte et fond pour l’accessibilité.",
  "Place ton CTA sur la dernière scène (rappel visuel léger).",
  "Active le Brand Kit pour conserver palette et typos.",
];

export default function TipsCard() {
  return (
    <section className="tips-card">
      <h3>Astuces</h3>
      <ul>
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <style jsx>{`
        .tips-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        h3 {
          margin: 6px 0 4px;
          font-size: 1rem;
          color: #1f2937;
        }

        ul {
          margin: 0;
          padding: 0 0 0 18px;
          line-height: 1.6;
          color: #475467;
          font-size: 0.95rem;
        }
      `}</style>
    </section>
  );
}
