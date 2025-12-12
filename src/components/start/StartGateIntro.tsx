import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

type StylePreset = 'pro' | 'pop';

interface StartGateIntroProps {
  onFinish: (preset: StylePreset) => void;
}

export function StartGateIntro({ onFinish }: StartGateIntroProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleSelect = (preset: StylePreset) => {
    if (prefersReducedMotion) {
      onFinish(preset);
    } else {
      setTimeout(() => onFinish(preset), 900);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="text-center max-w-2xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-alfie-pink" />
            <span className="text-sm font-medium text-foreground/80">Expérience ~90s</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Ouvre la porte du Studio
          </h1>
          <p className="text-lg text-muted-foreground">
            Tu repars avec un pack prêt à poster. ~90s.
          </p>
        </motion.div>

        {/* Double Door Cards */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch mb-6">
          {/* Pro Door */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: -200, opacity: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => handleSelect('pro')}
            className="group relative flex-1 min-w-[200px] bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Choisir le style Pro & clean"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">💼</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Pro & clean</h3>
              <p className="text-sm text-muted-foreground">
                Épuré, corporate, confiance
              </p>
            </div>
          </motion.button>

          {/* Pop Door */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: 200, opacity: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => handleSelect('pop')}
            className="group relative flex-1 min-w-[200px] bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-alfie-pink/30 focus:outline-none focus:ring-2 focus:ring-alfie-pink focus:ring-offset-2"
            aria-label="Choisir le style Pop & fun"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-alfie-pink to-alfie-lilac rounded-2xl flex items-center justify-center">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Pop & fun</h3>
              <p className="text-sm text-muted-foreground">
                Coloré, énergique, créatif
              </p>
            </div>
          </motion.button>
        </div>

        {/* Skip Link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => handleSelect('pop')}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          Passer l'intro
        </motion.button>
      </div>
    </motion.div>
  );
}
