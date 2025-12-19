import { HOUSES } from "../lib/houses";
import type { House } from "../lib/houses";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const HOUSE_ORDER: House[] = ["alfie", "aeditus", "cap", "passage42"];

export default function Village() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Le village des 4 tavernes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {HOUSE_ORDER.map((house) => (
          <motion.button
            key={house}
            onClick={() => nav(`/quest/${house}`)}
            className="rounded-lg bg-gray-800 p-4 hover:bg-gray-700 focus:outline-none"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="font-semibold">{HOUSES[house].label}</div>
            <div className="text-sm text-gray-400">{HOUSES[house].tagline}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
