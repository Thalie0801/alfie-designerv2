import { motion } from "framer-motion";
import { Lightbulb, Wand2, Sparkles, Download } from "lucide-react";

const steps = [
  {
    icon: Lightbulb,
    title: "Écris ton idée",
    description: "En langage naturel, comme tu parles",
    color: "from-amber-400 to-orange-500",
  },
  {
    icon: Wand2,
    title: "L'IA optimise",
    description: "Prompt pro généré automatiquement",
    color: "from-alfie-mint to-teal-500",
  },
  {
    icon: Sparkles,
    title: "Génération",
    description: "Image, carrousel ou mini-film",
    color: "from-alfie-lilac to-purple-500",
  },
  {
    icon: Download,
    title: "Export",
    description: "ZIP + Canva en 1 clic",
    color: "from-alfie-pink to-rose-500",
  },
];

export function WorkflowSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-white"
    >
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            4 étapes, zéro prise de tête
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Du brief à l'export, tout est automatisé.
          </p>
        </motion.div>

        {/* Timeline desktop */}
        <div className="hidden md:block relative">
          {/* Connecting line */}
          <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-alfie-mint via-50% to-alfie-pink" />
          
          <div className="grid grid-cols-4 gap-6">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="flex flex-col items-center text-center"
              >
                <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg mb-4 relative z-10`}>
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Timeline mobile */}
        <div className="md:hidden space-y-6">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="flex items-start gap-4"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                <step.icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-0.5">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
