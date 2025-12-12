import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { trackEvent } from "@/utils/trackEvent";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Check, Sparkles, Upload, X } from "lucide-react";
import logo from "@/assets/alfie-logo-black.svg";

const sectors = [
  { value: "coach", label: "🎯 Coaching / Consulting" },
  { value: "ecommerce", label: "🛍️ E-commerce" },
  { value: "food", label: "🍽️ Food / Restaurant" },
  { value: "beauty", label: "💄 Beauté / Bien-être" },
  { value: "tech", label: "💻 Tech / SaaS" },
  { value: "education", label: "📚 Formation / Éducation" },
  { value: "creative", label: "🎨 Créatif / Artiste" },
  { value: "other", label: "✨ Autre" },
];

const styleWords = [
  "Moderne", "Minimaliste", "Coloré", "Élégant", "Fun", "Professionnel", 
  "Chaleureux", "Audacieux", "Naturel", "Premium", "Dynamique", "Épuré"
];

const fonts = [
  { value: "modern", label: "Sans-serif moderne", preview: "font-sans" },
  { value: "elegant", label: "Serif élégant", preview: "font-serif" },
  { value: "playful", label: "Arrondie fun", preview: "font-sans font-bold" },
];

const objectives = [
  { value: "sell", label: "💰 Vendre mes produits/services", icon: "💰" },
  { value: "grow", label: "📈 Développer mon audience", icon: "📈" },
  { value: "save", label: "⏱️ Gagner du temps", icon: "⏱️" },
];

const colorPresets = [
  { value: "warm", colors: ["#FF6B6B", "#FFA500", "#FFD93D"], label: "Chaud" },
  { value: "cool", colors: ["#4ECDC4", "#45B7D1", "#96E6A1"], label: "Frais" },
  { value: "pastel", colors: ["#FFB5BA", "#B5D8FF", "#E8D5FF"], label: "Pastel" },
  { value: "bold", colors: ["#FF0080", "#7928CA", "#0070F3"], label: "Audacieux" },
  { value: "neutral", colors: ["#1A1A1A", "#6B7280", "#F5F5F5"], label: "Neutre" },
];

const alfieMessages = [
  "Super choix ! 🐕",
  "J'adore ce style !",
  "On avance bien !",
  "Encore quelques questions...",
  "Tu vas voir, ça va être top !",
];

export default function Start() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [alfieMessage, setAlfieMessage] = useState(alfieMessages[0]);
  
  // Form data
  const [email, setEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [sector, setSector] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [colorChoice, setColorChoice] = useState("");
  const [fontChoice, setFontChoice] = useState("");
  const [objective, setObjective] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    trackEvent("start_view");
  }, []);

  useEffect(() => {
    const messageIndex = Math.min(step - 1, alfieMessages.length - 1);
    setAlfieMessage(alfieMessages[messageIndex]);
  }, [step]);

  const totalSteps = 7;
  const progress = (step / totalSteps) * 100;

  const handleEmailSubmit = async () => {
    if (!email || !email.includes("@")) return;
    trackEvent("start_email_submitted", { email });
    setStep(2);
  };

  const handleStyleToggle = (style: string) => {
    if (selectedStyles.includes(style)) {
      setSelectedStyles(selectedStyles.filter(s => s !== style));
    } else if (selectedStyles.length < 3) {
      setSelectedStyles([...selectedStyles, style]);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    trackEvent("brandkit_completed", { 
      brandName, sector, styles: selectedStyles, colorChoice, fontChoice, objective 
    });

    try {
      // Check if user exists, if not create account
      let userId: string | null = null;
      const { data: existingUser } = await supabase.auth.getSession();
      
      if (!existingUser.session) {
        // Sign up with email (will auto-confirm)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: crypto.randomUUID(), // Temporary password, user can reset later
          options: {
            emailRedirectTo: `${window.location.origin}/free-pack`,
          }
        });
        
        if (signUpError && !signUpError.message.includes("already registered")) {
          console.error("Signup error:", signUpError);
        }
        userId = signUpData?.user?.id || null;
      } else {
        userId = existingUser.session.user.id;
      }

      // Create brand in database
      let brandId: string | null = null;
      if (userId) {
        // Upload logo if provided
        let logoUrl: string | null = null;
        if (logoFile) {
          const fileExt = logoFile.name.split('.').pop();
          const filePath = `${userId}/logo-${Date.now()}.${fileExt}`;
          const { data: uploadData } = await supabase.storage
            .from('chat-uploads')
            .upload(filePath, logoFile);
          
          if (uploadData) {
            const { data: publicUrl } = supabase.storage
              .from('chat-uploads')
              .getPublicUrl(filePath);
            logoUrl = publicUrl.publicUrl;
          }
        }

        // Get color palette from preset
        const colorPresetMap: Record<string, string[]> = {
          warm: ["#FF6B6B", "#FFA500", "#FFD93D"],
          cool: ["#4ECDC4", "#45B7D1", "#96E6A1"],
          pastel: ["#FFB5BA", "#B5D8FF", "#E8D5FF"],
          bold: ["#FF0080", "#7928CA", "#0070F3"],
          neutral: ["#1A1A1A", "#6B7280", "#F5F5F5"],
          auto: ["#96E6A1", "#D4A5FF", "#FFB5BA"],
        };

        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .insert({
            user_id: userId,
            name: brandName,
            niche: sector,
            voice: selectedStyles.join(", "),
            palette: colorPresetMap[colorChoice] || colorPresetMap.auto,
            fonts: { primary: fontChoice },
            logo_url: logoUrl,
            adjectives: selectedStyles,
            is_default: true,
          })
          .select('id')
          .single();

        if (!brandError && brandData) {
          brandId = brandData.id;
          
          // Update profile with active brand
          await supabase
            .from('profiles')
            .update({ active_brand_id: brandId })
            .eq('id', userId);
        }
      }

      // Navigate to free-pack with brand data
      navigate("/free-pack", { 
        state: { 
          brandName, 
          sector, 
          styles: selectedStyles, 
          colorChoice, 
          fontChoice, 
          objective,
          email,
          userId,
          brandId,
        } 
      });
    } catch (error) {
      console.error("Error:", error);
      // Still navigate even if there's an error
      navigate("/free-pack", { 
        state: { brandName, sector, styles: selectedStyles, colorChoice, fontChoice, objective, email } 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return email.includes("@");
      case 2: return brandName.length > 0;
      case 3: return sector.length > 0;
      case 4: return selectedStyles.length >= 1;
      case 5: return colorChoice.length > 0;
      case 6: return fontChoice.length > 0;
      case 7: return objective.length > 0;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-white to-alfie-lilac/20">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="Alfie" className="h-7" />
          <span className="text-sm text-slate-500">Étape {step}/{totalSteps}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="fixed top-[57px] inset-x-0 z-30">
        <Progress value={progress} className="h-1 rounded-none" />
      </div>

      {/* Main content */}
      <main className="pt-24 pb-8 px-4 min-h-screen flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          
          {/* Alfie mascot bubble */}
          <div className="mb-6 flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-alfie-mint flex items-center justify-center text-2xl shrink-0">
              🐕
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-700">{alfieMessage}</p>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 flex flex-col">
            
            {/* Step 1: Email */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">
                    Crée ton Brand Kit 🎨
                  </h1>
                  <p className="text-slate-600">
                    On te génère 3 visuels gratuits, adaptés à ta marque. Prêts en 5 min.
                  </p>
                </div>
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="ton@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                    onKeyDown={(e) => e.key === "Enter" && canProceed() && handleEmailSubmit()}
                  />
                  <Button
                    onClick={handleEmailSubmit}
                    disabled={!canProceed()}
                    className="w-full h-12 bg-alfie-mint hover:bg-alfie-pink text-slate-900 font-semibold"
                  >
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Pas de spam. Juste ton pack gratuit + Brand Kit.
                </p>
              </div>
            )}

            {/* Step 2: Brand name */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Comment s'appelle ta marque ?
                  </h2>
                </div>
                <Input
                  type="text"
                  placeholder="Ma Super Marque"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="h-12 text-base"
                  onKeyDown={(e) => e.key === "Enter" && canProceed() && setStep(3)}
                />
              </div>
            )}

            {/* Step 3: Sector */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Quel est ton secteur ?
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sectors.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSector(s.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        sector === s.value
                          ? "border-alfie-mint bg-alfie-mint/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-sm font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Style words */}
            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    3 mots pour décrire ton style
                  </h2>
                  <p className="text-sm text-slate-500">Choisis jusqu'à 3 mots</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {styleWords.map((word) => (
                    <button
                      key={word}
                      onClick={() => handleStyleToggle(word)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedStyles.includes(word)
                          ? "bg-alfie-mint text-slate-900"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {selectedStyles.includes(word) && <Check className="inline h-3 w-3 mr-1" />}
                      {word}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Sélectionnés : {selectedStyles.join(", ") || "Aucun"}
                </p>
              </div>
            )}

            {/* Step 5: Colors */}
            {step === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Quelle palette de couleurs ?
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setColorChoice(preset.value)}
                      className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        colorChoice === preset.value
                          ? "border-alfie-mint bg-alfie-mint/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex gap-1">
                        {preset.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="font-medium">{preset.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setColorChoice("auto")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      colorChoice === "auto"
                        ? "border-alfie-mint bg-alfie-mint/10"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-medium">✨ Laisse Alfie choisir</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Font */}
            {step === 6 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Quel style de typo ?
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {fonts.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => setFontChoice(font.value)}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        fontChoice === font.value
                          ? "border-alfie-mint bg-alfie-mint/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className={`text-xl ${font.preview}`}>{font.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 7: Objective + Logo */}
            {step === 7 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Quel est ton objectif principal ?
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {objectives.map((obj) => (
                    <button
                      key={obj.value}
                      onClick={() => setObjective(obj.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        objective === obj.value
                          ? "border-alfie-mint bg-alfie-mint/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-medium">{obj.label}</span>
                    </button>
                  ))}
                </div>

                {/* Logo upload (optional) */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-3">Logo (optionnel)</p>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-alfie-mint transition-colors">
                    {logoFile ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{logoFile.name}</span>
                        <button onClick={() => setLogoFile(null)}>
                          <X className="h-4 w-4 text-slate-400" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-slate-400" />
                        <span className="text-sm text-slate-500">Uploader ton logo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          {step > 1 && (
            <div className="mt-8 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-12"
              >
                Retour
              </Button>
              {step < 7 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="flex-1 h-12 bg-alfie-mint hover:bg-alfie-pink text-slate-900"
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={!canProceed() || isLoading}
                  className="flex-1 h-12 bg-alfie-mint hover:bg-alfie-pink text-slate-900"
                >
                  {isLoading ? (
                    "Génération..."
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Générer mon pack gratuit
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
