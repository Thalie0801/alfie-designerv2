import { motion } from "framer-motion";
import { Facebook, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const FACEBOOK_COMMUNITY = "https://www.facebook.com/groups/4851359094985657";
const WHATSAPP_COMMUNITY = "https://chat.whatsapp.com/HSqUJEeaugS4wVU2gyaJbs";

const communities = [
  {
    name: "Groupe Facebook",
    description: "Rejoins 3000+ créateurs qui partagent leurs visuels et s'entraident",
    icon: Facebook,
    href: FACEBOOK_COMMUNITY,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    members: "3000+ membres",
  },
  {
    name: "Groupe WhatsApp",
    description: "Discussions en direct, tips quotidiens et avant-premières exclusives",
    icon: MessageCircle,
    href: WHATSAPP_COMMUNITY,
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-50",
    textColor: "text-green-600",
    members: "Actif 24/7",
  },
];

export function CommunitySection() {
  return (
    <section className="bg-gradient-to-b from-muted/30 to-background px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-alfie-mint to-alfie-lilac">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Rejoins la communauté Alfie
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Échange avec d'autres créateurs, partage tes visuels et obtiens de l'aide
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {communities.map((community, index) => (
            <motion.a
              key={community.name}
              href={community.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-border"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${community.bgColor}`}>
                  <community.icon className={`h-6 w-6 ${community.textColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{community.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${community.bgColor} ${community.textColor}`}>
                      {community.members}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {community.description}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`mt-3 ${community.textColor} hover:${community.bgColor} p-0 h-auto font-medium`}
                  >
                    Rejoindre →
                  </Button>
                </div>
              </div>
              
              {/* Hover gradient effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${community.color} opacity-0 transition-opacity group-hover:opacity-5`} />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CommunitySection;
