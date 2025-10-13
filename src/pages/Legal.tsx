import { SimpleLegalLayout } from "@/components/SimpleLegalLayout";

export default function Legal() {
  return (
    <SimpleLegalLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          Mentions légales & CGU
        </h1>

        {/* Mentions légales */}
        <section className="space-y-6 text-muted-foreground mb-12">
          <h2 className="text-3xl font-bold text-foreground">Mentions légales</h2>
          
          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Éditeur du site</h3>
            <p>Staelens Nathalie – Entrepreneure individuelle</p>
            <p>Nom commercial : Alfie Designer</p>
            <p>Adresse professionnelle : Rue roger Salengro 62000 Arras</p>
            <p>Email : contact@kronys.fr</p>
            <p className="mt-2">Numéro SIREN / SIRET : En cours</p>
            <p>TVA intracommunautaire : En cours</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Directrice de la publication</h3>
            <p>Nathalie Staelens, Fondatrice</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Hébergement</h3>
            <p>Lovable.dev (hébergeur SaaS)</p>
            <p>Infrastructures : AWS Europe (Irlande) et Supabase (UE).</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Propriété intellectuelle</h3>
            <p>
              L'ensemble des contenus, marques, visuels et textes du site alfie-designer.com sont la propriété 
              exclusive d'Alfie Designer. Toute reproduction, distribution ou modification sans autorisation est interdite.
            </p>
          </div>
        </section>

        {/* CGU */}
        <section className="space-y-6 text-muted-foreground mb-12">
          <h2 className="text-3xl font-bold text-foreground">Conditions générales d'utilisation (CGU)</h2>
          
          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Objet</h3>
            <p>
              Les présentes CGU définissent les conditions d'accès et d'utilisation de la plateforme Alfie Designer 
              par tout utilisateur.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Accès au service</h3>
            <p className="mb-3">
              L'accès nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes 
              et à ne pas partager son accès.
            </p>
            <p>
              Alfie Designer se réserve le droit de suspendre un compte en cas d'usage abusif, non-conforme ou frauduleux.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Fonctionnement</h3>
            <p className="mb-3">
              Alfie Designer permet de générer et publier du contenu éditorial automatisé sur plusieurs canaux.
            </p>
            <p className="mb-3">
              Le service inclut des intégrations externes (Canva, Supabase, OpenAI).
            </p>
            <p>
              Alfie Designer ne saurait être tenue responsable des dysfonctionnements imputables à ces services tiers.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Responsabilités</h3>
            <p className="mb-3">
              L'utilisateur demeure seul responsable des contenus créés et diffusés via la plateforme.
            </p>
            <p>
              Alfie Designer ne garantit pas la disponibilité continue du service mais s'engage à corriger tout incident 
              dans les meilleurs délais.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Propriété intellectuelle</h3>
            <p className="mb-3">
              Les contenus générés via Alfie Designer appartiennent à l'utilisateur, sous réserve du respect 
              des droits des tiers.
            </p>
            <p>
              Les modèles, gabarits et codes source demeurent la propriété d'Alfie Designer.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Résiliation</h3>
            <p className="mb-3">
              L'utilisateur peut résilier son compte à tout moment.
            </p>
            <p>
              Alfie Designer peut suspendre ou clôturer un compte en cas de non-respect des présentes CGU.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Droit applicable</h3>
            <p className="mb-3">
              Les présentes CGU sont régies par le droit français.
            </p>
            <p>
              En cas de litige, compétence exclusive des tribunaux de Paris (France).
            </p>
          </div>
        </section>

        {/* Politique Cookies */}
        <section className="space-y-6 text-muted-foreground">
          <h2 className="text-3xl font-bold text-foreground">Politique Cookies</h2>
          
          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Qu'est-ce qu'un cookie ?</h3>
            <p>
              Un cookie est un petit fichier enregistré sur votre appareil pour permettre le bon fonctionnement 
              du site ou analyser son usage.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Cookies utilisés</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Techniques essentiels :</strong> connexion, préférences, sécurité.
              </li>
              <li>
                <strong>Mesure d'audience :</strong> statistiques anonymisées (Supabase Analytics).
              </li>
            </ul>
            <p className="mt-3">Aucun cookie publicitaire n'est exploité.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Gestion</h3>
            <p className="mb-3">
              Vous pouvez à tout moment gérer ou supprimer les cookies depuis votre navigateur.
            </p>
            <p>
              Le site reste utilisable même en cas de refus des cookies analytiques.
            </p>
          </div>
        </section>
      </div>
    </SimpleLegalLayout>
  );
}
