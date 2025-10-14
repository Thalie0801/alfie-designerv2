import { SimpleLegalLayout } from "@/components/SimpleLegalLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <SimpleLegalLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          Questions fréquentes
        </h1>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="item-1" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Qu'est-ce qu'Alfie Designer ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Alfie Designer est un agent de création IA qui génère automatiquement des visuels professionnels 
              pour vos réseaux sociaux. Il s'intègre directement avec Canva pour créer des designs personnalisés 
              selon votre identité de marque.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Comment fonctionne l'intégration avec Canva ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Une fois votre compte Canva connecté, Alfie crée automatiquement vos designs et les envoie 
              directement dans votre espace Canva. Vous pouvez ensuite les modifier, planifier ou télécharger 
              depuis votre interface Canva habituelle.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Quels types de visuels puis-je créer ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Hero</strong> : Annonces, covers, citations (formats 1:1 et 16:9)</li>
                <li><strong>Carousel</strong> : Tips, storytelling (format 4:5)</li>
                <li><strong>Insight</strong> : Stats, preuves, données (formats 1:1 et 4:5)</li>
                <li><strong>Reel</strong> : Vidéos courtes 8-20 secondes (format 9:16)</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Comment définir ma charte graphique ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Dans votre espace, vous pouvez configurer votre Brand Kit avec vos couleurs, polices, logo et 
              style visuel. Alfie utilisera automatiquement ces éléments pour créer des designs cohérents 
              avec votre identité de marque.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Combien coûte Alfie Designer ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Nous proposons plusieurs formules adaptées à vos besoins :
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Starter</strong> : 29€/mois (20 visuels/mois)</li>
                <li><strong>Pro</strong> : 79€/mois (100 visuels/mois + fonctionnalités avancées)</li>
                <li><strong>Studio</strong> : 149€/mois (1000 visuels/mois + analytics)</li>
                <li><strong>Enterprise</strong> : Sur mesure (visuels illimités + support dédié)</li>
              </ul>
              <p className="mt-3">Une réduction de 20% est appliquée sur tous les abonnements annuels.</p>
              <p className="mt-3">
                <a href="/#pricing" className="text-primary hover:underline font-medium">
                  Voir tous les détails des forfaits →
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-7" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Mes données sont-elles sécurisées ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Absolument. Nous utilisons le chiffrement SSL et stockons vos données de manière sécurisée 
              dans l'Union Européenne. Nous ne stockons aucun contenu de vos fichiers Canva et les tokens 
              d'accès sont temporaires et automatiquement supprimés à expiration. Consultez notre 
              <a href="/privacy" className="text-primary hover:underline ml-1">politique de confidentialité</a> 
              pour plus de détails.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-8" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Qu'est-ce que le programme partenaire ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Notre programme d'affiliation multi-niveaux vous permet de gagner des commissions récurrentes :
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Niveau 1</strong> : 15% sur vos filleuls directs</li>
                <li><strong>Niveau 2</strong> : 5% sur le réseau de votre réseau (si Mentor ou Leader)</li>
                <li><strong>Niveau 3</strong> : 2% sur le réseau étendu (si Leader avec ≥5 filleuls)</li>
              </ul>
              <p className="mt-2">
                <a href="/devenir-partenaire" className="text-primary hover:underline">
                  En savoir plus sur le programme partenaire
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-9" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Puis-je modifier les designs créés par Alfie ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Oui, absolument ! Les designs sont envoyés dans votre Canva et vous pouvez les modifier 
              librement avec tous les outils Canva. Alfie crée une base solide que vous pouvez 
              personnaliser selon vos besoins.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-10" className="border rounded-lg px-6">
            <AccordionTrigger className="text-lg font-semibold">
              Comment puis-je vous contacter ?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Vous pouvez nous contacter par email à 
              <a href="mailto:contact@kronys.fr" className="text-primary hover:underline ml-1">
                contact@kronys.fr
              </a>
              {" "}ou via notre 
              <a href="/contact" className="text-primary hover:underline ml-1">
                formulaire de contact
              </a>.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </SimpleLegalLayout>
  );
}
