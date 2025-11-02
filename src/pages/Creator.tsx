import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBrandKit } from "@/hooks/useBrandKit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Toggle } from "@/components/ui/toggle";
import { Clock, Sparkles } from "lucide-react";

interface Artifact {
  id: string;
  kind: "image" | "video";
  uri: string;
  meta?: any;
}

function buildBrandAwarePrompt(prompt: string, brandKit: any): string {
  if (!brandKit) return prompt;
  let enriched = prompt;
  if (brandKit.palette?.length > 0) enriched += `\nCouleurs: ${brandKit.palette.join(", ")}`;
  if (brandKit.fonts?.primary) enriched += `\nTypo: ${brandKit.fonts.primary}`;
  if (brandKit.voice) enriched += `\nTon: ${brandKit.voice}`;
  return enriched;
}

export default function Creator() {
  const { user } = useAuth();
  const { brandKit, brands, activeBrandId, setActiveBrand } = useBrandKit();
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("1080x1080");
  const [duration, setDuration] = useState(10);
  const [quality, setQuality] = useState<"draft" | "standard" | "premium">("standard");
  const [quantity, setQuantity] = useState(1);
  const [batchNight, setBatchNight] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [decision, setDecision] = useState<any>(null);
  const [quotaInfo, setQuotaInfo] = useState({ remaining: 0, total: 0 });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();
    }
  }, [user]);

  const loadQuotaInfo = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("quota_videos, woofs_consumed_this_month").eq("id", user.id).single();
    if (profile) setQuotaInfo({ remaining: (profile.quota_videos || 0) - (profile.woofs_consumed_this_month || 0), total: profile.quota_videos || 0 });
  };

  const handleGenerate = async () => {
    if (!user || !prompt.trim()) return toast.error("Veuillez saisir un prompt");
    
    setIsGenerating(true);
    setDecision(null);

    // Si carrousel (quantity > 1), générer d'abord le plan
    let carouselPlan: any = null;
    if (quantity > 1 && mode === "image") {
      try {
        toast.info(`Planification du carrousel de ${quantity} visuels...`);
        const { data: planRes, error: planError } = await supabase.functions.invoke("alfie-plan-carousel", {
          body: { 
            prompt, 
            brandKit: brandKit || {}, 
            slideCount: quantity 
          }
        });
        
        if (planError) throw planError;
        carouselPlan = planRes;
        toast.success("Plan du carrousel généré !");
      } catch (err: any) {
        toast.error(`Erreur lors de la planification : ${err.message}`);
        setIsGenerating(false);
        return;
      }
    }

    for (let i = 0; i < quantity; i++) {
      try {
        // Utiliser le prompt du slide si on a un plan de carrousel
        const slidePrompt = carouselPlan?.slides?.[i] 
          ? `${carouselPlan.slides[i].title}. ${carouselPlan.slides[i].subtitle || ''}` 
          : prompt;

        // ✅ Mapping explicite format → use_case
        const formatToUseCase: Record<string, string> = {
          "1080x1080": "post",           // Carré → post classique
          "1080x1920": "story",          // Portrait 9:16 → story/reel
          "1920x1080": "ad_landscape",   // Paysage → pub/bannière
        };
        const use_case = formatToUseCase[format] || "post";
        const { data: providerRes } = await supabase.functions.invoke("alfie-select-provider", {
          body: { brief: { use_case, style: quality }, modality: mode, format, duration_s: mode === "video" ? duration : 0, quality, budget_woofs: quotaInfo.remaining }
        });
        
        if (providerRes.decision === "KO") {
          toast.error("Budget insuffisant", { description: providerRes?.suggestions?.join(", ") });
          break;
        }
        
        setDecision(providerRes);
        let finalCost = providerRes.cost_woofs;

        if (batchNight) {
          await supabase.from("batch_requests").insert({ user_id: user.id, modality: mode, payload_json: { prompt: slidePrompt, format, duration, quality }, process_after: new Date(Date.now() + 8 * 3600 * 1000).toISOString() });
          toast.success(`Planifié slide ${i + 1}/${quantity} pour la nuit`);
          continue;
        }

        await supabase.functions.invoke("alfie-consume-woofs", { body: { cost_woofs: finalCost } });
        
        let renderUrl = "";
        if (mode === "image") {
          toast.info(`Génération slide ${i + 1}/${quantity}...`);
          const { data: imgRes } = await supabase.functions.invoke("alfie-render-image", { 
            body: { 
              provider: providerRes.provider, 
              prompt: buildBrandAwarePrompt(slidePrompt, brandKit), 
              assets: [], 
              format,
              brand_id: activeBrandId,   // ✅ Ajouter brand_id pour attribution correcte
              cost_woofs: finalCost       // ✅ Ajouter coût pour quotas cohérents
            } 
          });
          renderUrl = imgRes?.image_urls?.[0] || "";
        } else {
          const { data: vidRes } = await supabase.functions.invoke("alfie-render-video", { body: { provider: providerRes.provider, prompt: buildBrandAwarePrompt(slidePrompt, brandKit), assets: [], params: { duration, resolution: format, style: quality } } });
          renderUrl = vidRes?.video_url || "";
        }

        const { data: scoreRes } = await supabase.functions.invoke("alfie-score-coherence", { body: { render_url: renderUrl, brand_spec: brandKit ? JSON.stringify(brandKit) : null } });
        await supabase.functions.invoke("alfie-update-metrics", { body: { provider: providerRes.provider, use_case, format, reward: scoreRes.score / 100, success: true } });

        // Ajouter à l'affichage local
        setArtifacts(prev => [...prev, { id: `${Date.now()}-${i}`, kind: mode, uri: renderUrl, meta: { resolution: format, brand_score: scoreRes.score, cost_woofs: finalCost } }]);

        // Sauvegarder dans la base de données
        if (!activeBrandId) {
          toast.error("No active brand. Please select a brand first.");
          break;
        }
        
        const { error: insertError } = await supabase
          .from("media_generations")
          .insert({
            user_id: user.id,
            brand_id: activeBrandId,
            type: mode,
            prompt,
            output_url: renderUrl,
            thumbnail_url: mode === "image" ? renderUrl : null,
            status: "completed",
            modality: mode,
            provider_id: providerRes.provider,
            brand_score: scoreRes.score,
            cost_woofs: finalCost,
            metadata: { 
              resolution: format, 
              quality, 
              use_case,
              provider: providerRes.provider 
            },
            woofs: finalCost,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          } as any);

        if (insertError) {
          console.error("Erreur insertion media_generations:", insertError);
          toast.warning(`Création ${i + 1}/${quantity} réussie mais non sauvegardée`);
        } else {
          toast.success(`Création ${i + 1}/${quantity} terminée ✅`);
        }

        // Petit délai entre chaque génération
        if (i < quantity - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        loadQuotaInfo();
      } catch (err: any) {
        toast.error(`Erreur création ${i + 1}/${quantity}: ${err.message}`);
        break;
      }
    }

    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Créer</h1>
          <p className="text-muted-foreground">Générez vos visuels et vidéos en quelques clics</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div><Label>Mode</Label><Select value={mode} onValueChange={(v: any) => setMode(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image</SelectItem><SelectItem value="video">Vidéo</SelectItem></SelectContent></Select></div>
                {brands.length > 0 && <div><Label>Marque</Label><Select value={activeBrandId || ""} onValueChange={setActiveBrand}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
                <div><Label>Prompt</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} /></div>
                <div><Label>Format</Label><Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1080x1080">Carré</SelectItem><SelectItem value="1080x1920">Portrait</SelectItem><SelectItem value="1920x1080">Paysage</SelectItem></SelectContent></Select></div>
                {mode === "video" && <div><Label>Durée (s)</Label><Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} min={5} max={30} /></div>}
                <div><Label>Qualité</Label><Select value={quality} onValueChange={(v: any) => setQuality(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent></Select></div>
                <div><Label>Quantité (carrousel)</Label><Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 visuel</SelectItem><SelectItem value="2">2 visuels</SelectItem><SelectItem value="3">3 visuels</SelectItem><SelectItem value="4">4 visuels</SelectItem><SelectItem value="5">5 visuels</SelectItem></SelectContent></Select></div>
                <Toggle pressed={batchNight} onPressedChange={setBatchNight}>Batch nuit</Toggle>
                <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="w-full" size="lg">{isGenerating ? <><Clock className="w-4 h-4 mr-2 animate-spin" />Génération...</> : <><Sparkles className="w-4 h-4 mr-2" />Générer</>}</Button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4"><Card className="p-4"><h3 className="font-semibold mb-4">Livrables</h3>{artifacts.length === 0 ? <div className="text-center py-12 text-muted-foreground"><Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Vos créations ici</p></div> : <div className="grid grid-cols-2 gap-3">{artifacts.map(a => <div key={a.id} className="relative group">{a.kind === "image" ? <img src={a.uri} className="rounded-lg w-full" /> : <video src={a.uri} controls className="rounded-lg w-full" />}<div className="absolute bottom-2 left-2 flex gap-1">{a.meta?.brand_score && <Badge variant="outline" className="text-xs">{a.meta.brand_score}/100</Badge>}{a.meta?.cost_woofs && <Badge className="text-xs">{a.meta.cost_woofs} woofs</Badge>}</div></div>)}</div>}</Card></div>

          <div className="lg:col-span-4 space-y-4">{decision && <Card className="p-4"><h3 className="font-semibold mb-4">Décision IA</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Provider:</span><span className="font-mono">{decision.provider}</span></div><div className="flex justify-between"><span>Coût:</span><span className="font-semibold">{decision.cost_woofs} woofs</span></div></div></Card>}<Card className="p-4"><h3 className="font-semibold mb-4">Quota</h3><div className="space-y-2"><div className="flex justify-between text-sm"><span>Woofs:</span><span className="font-bold">{quotaInfo.remaining} / {quotaInfo.total}</span></div><Progress value={(quotaInfo.remaining / quotaInfo.total) * 100} /></div></Card></div>
        </div>
      </div>
    </div>
  );
}
