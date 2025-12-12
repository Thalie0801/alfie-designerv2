import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { StylePreset } from "@/lib/types/startFlow";

interface PortalDoorSceneProps {
  onFinish: (preset: StylePreset) => void;
}

export function PortalDoorScene({ onFinish }: PortalDoorSceneProps) {
  const reduce = useReducedMotion();
  const [choice, setChoice] = useState<StylePreset | null>(null);
  const [open, setOpen] = useState(false);

  const dust = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 70 + 10,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 0.4,
        dur: Math.random() * 0.8 + 0.7,
        drift: (Math.random() * 2 - 1) * 16,
      })),
    []
  );

  const start = useCallback((v: StylePreset) => {
    if (open) return;
    setChoice(v);

    // petite phase "unlock" avant l'ouverture
    window.setTimeout(() => setOpen(true), reduce ? 0 : 220);

    // finish (transition écran suivant)
    window.setTimeout(() => {
      onFinish(v);
    }, reduce ? 0 : 1200);
  }, [open, reduce, onFinish]);

  const glow =
    choice === "pop"
      ? "radial-gradient(circle at 50% 55%, rgba(255,105,180,.55), rgba(140,80,255,.25), transparent 70%)"
      : "radial-gradient(circle at 50% 55%, rgba(120,220,255,.45), rgba(40,120,255,.18), transparent 70%)";

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-gradient-to-b from-[#1a1218] to-[#0d0a0c]">
      <div className="relative w-full max-w-5xl mx-auto rounded-2xl overflow-hidden" style={{ minHeight: '600px' }}>
        {/* fond (bois + vignette) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(0,0,0,.18), rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,.18)), repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 2px, rgba(0,0,0,.02) 2px 6px), linear-gradient(#3b2a21, #2a1d17)",
          }}
        />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 140px rgba(0,0,0,.55)" }} />

        {/* contenu UI au-dessus */}
        <div className="relative z-20 px-6 pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/35 text-white/90 backdrop-blur">
            ⏱️ ~ 90 secondes
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-white drop-shadow">
            Ouvre le Portail
          </h1>
          <p className="mt-2 text-white/80">
            Choisis ta vibe, repars avec ton loot.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <ChoiceCard
              title="Pro & clean"
              subtitle="Élégant, sobre"
              tone="pro"
              disabled={open}
              dim={choice === "pop"}
              active={choice === "pro"}
              onClick={() => start("pro")}
            />
            <ChoiceCard
              title="Pop & fun"
              subtitle="Coloré, audacieux"
              tone="pop"
              disabled={open}
              dim={choice === "pro"}
              active={choice === "pop"}
              onClick={() => start("pop")}
            />
          </div>

          <button 
            onClick={() => onFinish("pro")}
            className="mt-8 text-sm text-white/70 underline underline-offset-4 hover:text-white/90 transition"
          >
            Skip intro ⏭️
          </button>
        </div>

        {/* PORTE 3D */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ perspective: "1200px" }}
        >
          {/* lumière derrière */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundImage: glow }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: open ? 1 : choice ? 0.45 : 0,
              scale: open ? 1.08 : 1,
            }}
            transition={{ duration: reduce ? 0 : 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          />

          {/* poussières */}
          <AnimatePresence>
            {open && !reduce && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {dust.map((p) => (
                  <motion.span
                    key={p.id}
                    className="absolute rounded-full bg-white/70"
                    style={{
                      left: `${p.left}%`,
                      top: `${p.top}%`,
                      width: p.size,
                      height: p.size,
                      filter: "blur(.2px)",
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: [0, 0.75, 0],
                      y: [-6, -18],
                      x: [0, p.drift],
                    }}
                    transition={{
                      delay: p.delay,
                      duration: p.dur,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* panneaux */}
          <div className="absolute inset-0 flex">
            {/* gauche */}
            <motion.div
              className="relative w-1/2 h-full"
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "0% 50%",
              }}
              animate={
                open
                  ? { rotateY: -78, x: -10 }
                  : choice
                  ? { rotateZ: [0, -0.5, 0.5, 0], x: [0, -2, 2, 0] }
                  : { rotateY: 0 }
              }
              transition={{
                duration: reduce ? 0 : open ? 0.95 : 0.22,
                ease: open ? [0.16, 1, 0.3, 1] : "easeOut",
              }}
            >
              <DoorPanel side="left" />
            </motion.div>

            {/* droite */}
            <motion.div
              className="relative w-1/2 h-full"
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "100% 50%",
              }}
              animate={
                open
                  ? { rotateY: 78, x: 10 }
                  : choice
                  ? { rotateZ: [0, 0.5, -0.5, 0], x: [0, 2, -2, 0] }
                  : { rotateY: 0 }
              }
              transition={{
                duration: reduce ? 0 : open ? 0.95 : 0.22,
                ease: open ? [0.16, 1, 0.3, 1] : "easeOut",
              }}
            >
              <DoorPanel side="right" />
            </motion.div>
          </div>

          {/* flash final */}
          <AnimatePresence>
            {open && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, times: [0, 0.35, 1] }}
                style={{ background: "rgba(255,255,255,.9)" }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  subtitle,
  tone,
  onClick,
  disabled,
  dim,
  active,
}: {
  title: string;
  subtitle: string;
  tone: "pro" | "pop";
  onClick: () => void;
  disabled?: boolean;
  dim?: boolean;
  active?: boolean;
}) {
  const bg =
    tone === "pop"
      ? "bg-gradient-to-b from-fuchsia-400 to-violet-600"
      : "bg-gradient-to-b from-slate-500 to-slate-800";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative rounded-2xl p-6 text-left text-white shadow-xl transition",
        "backdrop-blur border border-white/15",
        bg,
        dim ? "opacity-55" : "opacity-100",
        active ? "scale-[1.02] ring-2 ring-white/30" : "hover:scale-[1.01]",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="text-xl font-extrabold">{title}</div>
      <div className="text-white/85 text-sm mt-1">{subtitle}</div>
      <div className="absolute -bottom-3 right-5 h-6 w-6 rotate-45 bg-white/15 blur-[1px]" />
    </button>
  );
}

function DoorPanel({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.25)), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 2px, rgba(0,0,0,.02) 2px 8px), linear-gradient(#3a2a21, #241913)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 40px rgba(0,0,0,.35), 0 30px 80px rgba(0,0,0,.35)",
      }}
    >
      {/* joint central + highlights */}
      <div
        className="absolute top-0 bottom-0 w-[3px]"
        style={{
          [side === "left" ? "right" : "left"]: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,.0), rgba(255,255,255,.12), rgba(255,255,255,.0))",
        }}
      />
      {/* poignée */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full"
        style={{
          [side === "left" ? "right" : "left"]: 18,
          background: "radial-gradient(circle at 30% 30%, #ffd27a, #b57a2a)",
          boxShadow: "0 8px 18px rgba(0,0,0,.35)",
        }}
      />
    </div>
  );
}

export default PortalDoorScene;
