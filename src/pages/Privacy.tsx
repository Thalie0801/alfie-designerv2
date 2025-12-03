import { SimpleLegalLayout } from "@/components/SimpleLegalLayout";

export default function Privacy() {
  return (
    <SimpleLegalLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          Politique de confidentialité — Alfie Designer
        </h1>

        <section className="space-y-6 text-muted-foreground">
          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Préambule</h2>
            <p>
              La présente politique décrit comment Alfie Designer traite les données personnelles de ses utilisateurs 
              conformément au Règlement Général sur la Protection des Données (UE 2016/679) et à la loi Informatique et Libertés.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Responsable du traitement</h2>
            <p>Buzztron - Staelens Nathalie EI</p>
            <p>Adresse : 34 Place du Général de Gaulle, Bureau 3, 59000 Lille</p>
            <p>Tél : 07.45.26.30.64</p>
            <p>Email : contact@kronys.fr</p>
            <p>SIRET : 90432193200025</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Données collectées</h2>
            <p className="mb-3">
              Nous collectons uniquement les informations nécessaires à l'utilisation de la plateforme :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Identité : prénom, nom, adresse email, organisation.</li>
              <li>Informations de connexion : identifiants de compte, historique d'accès.</li>
              <li>Contenus créés sur la plateforme (textes, visuels, projets).</li>
              <li>Informations d'usage analytique (cookies, statistiques d'audience).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Canva Connect</h2>
            <p className="mb-3">Lorsque vous connectez votre compte Canva :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Alfie Designer utilise Canva Connect pour vous permettre de créer, modifier ou exporter vos visuels.</li>
              <li>Nous ne stockons aucun contenu personnel ni fichier Canva.</li>
              <li>Les jetons d'accès (tokens) fournis par Canva sont temporaires, chiffrés et automatiquement supprimés à expiration.</li>
              <li>Aucune donnée issue de Canva n'est utilisée à des fins commerciales ou publicitaires.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Base légale du traitement</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Exécution du contrat (utilisation du service Alfie Designer).</li>
              <li>Consentement (connexion à Canva, réception d'emails).</li>
              <li>Intérêt légitime (amélioration continue du service).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Destinataires</h2>
            <p className="mb-3">Les données sont traitées exclusivement par :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>L'Equipe Alfie Designer.</li>
              <li>
                Nos sous-traitants techniques conformes RGPD : Supabase (hébergement UE), Lovable (infrastructure web), 
                OpenAI - GEMINI, Mistral, Anthropic (génération de contenu).
              </li>
            </ul>
            <p className="mt-3">Aucune donnée n'est vendue ni transmise à des tiers non autorisés.</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Durée de conservation</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Compte utilisateur : tant que le compte est actif + 12 mois après suppression.</li>
              <li>Logs de connexion : 6 mois.</li>
              <li>Tokens Canva : durée de validité maximale 1 heure.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Droits des utilisateurs</h2>
            <p className="mb-3">Vous pouvez à tout moment :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Accéder à vos données,</li>
              <li>Demander leur rectification ou suppression,</li>
              <li>Retirer votre consentement,</li>
              <li>Demander la portabilité de vos informations.</li>
            </ul>
            <p className="mt-3">Envoyez toute demande à : contact@kronys.fr ou par téléphone au 07.45.26.30.64</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Sécurité</h2>
            <p className="mb-3">
              Nous utilisons le chiffrement SSL, le stockage chiffré des tokens et des sauvegardes redondantes.
            </p>
            <p>L'accès aux environnements techniques est strictement limité à l'équipe autorisée.</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Contact CNIL</h2>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL : 
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                www.cnil.fr
              </a>
            </p>
          </div>
        </section>
      </div>
    </SimpleLegalLayout>
  );
}
