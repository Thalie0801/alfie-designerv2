import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import alfieLogo from "@/assets/alfie-logo-black.svg";

interface GeneratedContent {
  headline?: string;
  hook?: string;
  steps?: string[];
  cta?: string;
  caption?: string;
  hashtags?: string[];
}

const Demo = () => {
  const [type, setType] = useState<string>("hero");
  const [theme, setTheme] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast.error("Veuillez entrer un thème");
      return;
    }

    setLoading(true);
    setContent(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfie-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            theme,
            style: 'moderne',
            brandVoice: 'professionnel',
            channel: 'LinkedIn'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la génération');
      }

      const data = await response.json();
      setContent(data.content);
      toast.success("Contenu généré avec succès ! 🎉");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <img src={alfieLogo} alt="Alfie" className="w-36 h-auto" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Démo Alfie IA
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Testez la puissance de Gemini 2.5 Flash pour générer du contenu visuel percutant.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <Card className="p-8 space-y-6 shadow-medium">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type" className="text-base font-semibold mb-2 block">
                    Type de visuel
                  </Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type" className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hero">Hero - Post d'annonce</SelectItem>
                      <SelectItem value="carousel">Carousel - Contenu éducatif</SelectItem>
                      <SelectItem value="insight">Insight - Statistique</SelectItem>
                      <SelectItem value="reel">Reel - Vidéo courte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="theme" className="text-base font-semibold mb-2 block">
                    Thème du contenu
                  </Label>
                  <Input
                    id="theme"
                    placeholder="Ex: Lancement de ma nouvelle formation en marketing digital"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={loading || !theme.trim()}
              size="lg"
              className="w-full gradient-hero text-white shadow-medium hover:shadow-glow transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Alfie réfléchit...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Générer le contenu
                </>
              )}
            </Button>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <strong>💡 Note :</strong> Gemini 2.5 Flash est actuellement GRATUIT jusqu'au 6 octobre 2025 !
              </p>
            </div>
          </Card>

          {/* Output Panel */}
          <Card className={`p-8 ${content ? 'shadow-strong' : 'shadow-medium'} transition-shadow`}>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-accent" />
              Résultat
            </h2>

            {!content && !loading && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-center">
                  Le contenu généré apparaîtra ici.<br />
                  Configurez et cliquez sur "Générer".
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Alfie crée votre contenu...</p>
                </div>
              </div>
            )}

            {content && (
              <div className="space-y-6">
                {content.headline && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase">Headline</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(content.headline || '')}
                      >
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-lg font-bold text-foreground p-4 bg-muted rounded-lg">
                      {content.headline}
                    </p>
                  </div>
                )}

                {content.hook && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground uppercase mb-2 block">Hook</Label>
                    <p className="text-lg font-bold text-foreground p-4 bg-muted rounded-lg">
                      {content.hook}
                    </p>
                  </div>
                )}

                {content.steps && content.steps.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground uppercase mb-2 block">Steps</Label>
                    <div className="space-y-2">
                      {content.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <p className="text-foreground flex-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {content.cta && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground uppercase mb-2 block">CTA</Label>
                    <p className="text-lg font-bold text-white p-4 gradient-warm rounded-lg shadow-medium">
                      {content.cta}
                    </p>
                  </div>
                )}

                {content.caption && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground uppercase mb-2 block">Caption</Label>
                    <p className="text-foreground p-4 bg-muted rounded-lg whitespace-pre-wrap">
                      {content.caption}
                    </p>
                  </div>
                )}

                {content.hashtags && content.hashtags.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground uppercase mb-2 block">Hashtags</Label>
                    <div className="flex flex-wrap gap-2">
                      {content.hashtags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Demo;
