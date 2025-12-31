import { motion } from "framer-motion";
import { Star } from "lucide-react";

// TODO: Remplacer par de vrais témoignages clients
const testimonials = [
  {
    name: "Sophie M.",
    role: "Community Manager",
    company: "Agence Pulse",
    initials: "SM",
    color: "bg-alfie-mint",
    content: "Alfie m'a fait gagner 10h par semaine sur la création de visuels. Le Mini-Film est juste incroyable !",
    rating: 5,
  },
  {
    name: "Marc D.",
    role: "Entrepreneur e-commerce",
    company: "MyShop.fr",
    initials: "MD",
    color: "bg-alfie-lilac",
    content: "J'ai lancé ma boutique avec Alfie. Pack Lancement + Brand Kit = game changer pour ma marque.",
    rating: 5,
  },
  {
    name: "Julie L.",
    role: "Coach Business",
    company: "",
    initials: "JL",
    color: "bg-alfie-peach",
    content: "L'optimiseur de prompts est magique. Je tape mon idée brute et hop, visuel pro en 30 secondes.",
    rating: 5,
  },
  {
    name: "Thomas R.",
    role: "Directeur Créatif",
    company: "Studio Digital",
    initials: "TR",
    color: "bg-emerald-400",
    content: "On gère 5 clients avec le plan Studio. Les images de référence changent tout pour la cohérence.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-b from-white to-alfie-mint/5 px-4 py-16 sm:py-20 md:py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Ils utilisent{" "}
            <span className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent">
              Alfie
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Découvrez ce que nos utilisateurs pensent d'Alfie Designer
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-700 text-lg leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                {/* Avatar with initials */}
                <div
                  className={`h-12 w-12 rounded-full ${testimonial.color} flex items-center justify-center text-slate-900 font-bold text-sm`}
                >
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {testimonial.role}
                    {testimonial.company && ` · ${testimonial.company}`}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
