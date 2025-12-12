import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "C'est vraiment gratuit pour commencer ?",
    answer: "Oui ! Tu peux créer ton Brand Kit et générer 3 visuels gratuits sans carte bancaire. C'est notre façon de te montrer la puissance d'Alfie avant tout engagement.",
  },
  {
    question: "Combien de temps pour créer mon premier visuel ?",
    answer: "Environ 5 minutes. 1 minute pour le Brand Kit, et quelques secondes par visuel généré. C'est ultra rapide !",
  },
  {
    question: "Je peux annuler mon abonnement quand je veux ?",
    answer: "Absolument. Pas d'engagement, pas de frais cachés. Tu peux annuler en 1 clic depuis ton espace, et ton abonnement reste actif jusqu'à la fin de la période payée.",
  },
  {
    question: "Les visuels sont-ils libres de droits ?",
    answer: "Oui, 100%. Tout ce que tu génères avec Alfie t'appartient. Tu peux l'utiliser pour ton business, tes réseaux, ta publicité... sans restriction.",
  },
  {
    question: "Quelle est la qualité des visuels générés ?",
    answer: "Alfie utilise les derniers modèles d'IA (Gemini Pro, Veo 3.1) pour générer des visuels HD de qualité professionnelle, optimisés pour chaque plateforme.",
  },
  {
    question: "Comment fonctionne le Brand Kit ?",
    answer: "Tu réponds à quelques questions sur ta marque (nom, couleurs, style...) et Alfie mémorise tout. Ensuite, chaque visuel généré respecte automatiquement ton identité.",
  },
  {
    question: "Puis-je utiliser mes propres images ?",
    answer: "Oui ! Tu peux uploader ton logo, des photos de produits, ou n'importe quelle image de référence. Alfie les intègre dans tes créations.",
  },
  {
    question: "C'est quoi les 'Woofs' ?",
    answer: "Les Woofs sont notre monnaie de génération. Chaque visuel coûte un certain nombre de Woofs selon sa complexité. Ton abonnement te donne un quota mensuel, et tu peux acheter des packs supplémentaires si besoin.",
  },
];

export function FAQSection() {
  return (
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-slate-50"
    >
      <div className="mx-auto max-w-3xl">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-muted-foreground">
            Tout ce que tu veux savoir sur Alfie Designer.
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
            >
              <AccordionItem
                value={`item-${idx}`}
                className="bg-white rounded-xl border border-slate-200 px-6 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-semibold text-slate-900 hover:text-alfie-mint py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </motion.section>
  );
}
