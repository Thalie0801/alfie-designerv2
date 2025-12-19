import { useLocation, useParams, Link } from "react-router-dom";
import type { House } from "../lib/houses";
import { HOUSES } from "../lib/houses";

export default function Result() {
  const { house } = useParams<{ house?: string }>();
  const safeHouse: House = (house as House) || "alfie";
  const location = useLocation();
  const state = (location.state as { score?: number; answers?: Record<string, string> }) || {};
  const score = state.score ?? 0;

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Bravo !</h2>
        <p className="mb-4">
          Tu as terminé la quête {HOUSES[safeHouse].label} avec un score de {score}.
        </p>
        <Link
          to={HOUSES[safeHouse].primaryRoute}
          className="inline-block px-6 py-3 bg-white text-black rounded-lg font-semibold"
        >
          {HOUSES[safeHouse].cta}
        </Link>
        <div className="mt-4">
          <Link to="/village" className="text-blue-400 underline">
            Retourner au village
          </Link>
        </div>
      </div>
    </div>
  );
}
