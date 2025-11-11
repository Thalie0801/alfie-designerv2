import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const questions = [
  {
    id: 1,
    title: "Quel est le nom de votre marque ?",
    description: "Comment souhaitez-vous que votre marque soit identifiée ?",
    type: "text" as const,
    field: "name",
    placeholder: "Ex: Ma Super Marque"
  },
  {
    id: 2,
    title: "Quelle est votre palette de couleurs ?",
    description: "Entrez jusqu'à 5 couleurs principales de votre marque (codes hexadécimaux)",
    type: "colors" as const,
    field: "palette",
    placeholder: "#FF5733, #3498DB, #2ECC71"
  },
  {
    id: 3,
    title: "Quel est le ton de votre marque ?",
    description: "Comment votre marque s'exprime-t-elle ?",
    type: "radio" as const,
    field: "tone",
    options: [
      { value: "professionnel", label: "Professionnel & Formel" },
      { value: "amical", label: "Amical & Accessible" },
      { value: "inspirant", label: "Inspirant & Motivant" },
      { value: "technique", label: "Technique & Expert" },
      { value: "ludique", label: "Ludique & Créatif" }
    ]
  },
  {
    id: 4,
    title: "Quelle est votre industrie ?",
    description: "Dans quel secteur opérez-vous ?",
    type: "radio" as const,
    field: "industry",
    options: [
      { value: "tech", label: "Technologie & Numérique" },
      { value: "retail", label: "Commerce & E-commerce" },
      { value: "service", label: "Services & Conseil" },
      { value: "creative", label: "Créatif & Design" },
      { value: "health", label: "Santé & Bien-être" },
      { value: "other", label: "Autre" }
    ]
  },
  {
    id: 5,
    title: "Quel est votre public cible ?",
    description: "Qui sont vos clients principaux ?",
    type: "textarea" as const,
    field: "target_audience",
    placeholder: "Ex: Entrepreneurs de 25-45 ans, passionnés de tech et d'innovation..."
  },
  {
    id: 6,
    title: "Quelle est votre proposition de valeur unique ?",
    description: "Qu'est-ce qui vous différencie de vos concurrents ?",
    type: "textarea" as const,
    field: "value_proposition",
    placeholder: "Ex: Nous proposons des solutions IA accessibles pour les PME..."
  },
  {
    id: 7,
    title: "Quels sont vos mots-clés de marque ?",
    description: "3-5 mots qui définissent votre identité",
    type: "text" as const,
    field: "keywords",
    placeholder: "Ex: Innovation, Simplicité, Excellence, Proximité"
  }
];

export default function BrandKitQuestionnaire() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleNext = () => {
    const answer = answers[currentQuestion.field];
    if (!answer || (typeof answer === 'string' && !answer.trim())) {
      toast.error('Veuillez répondre à la question avant de continuer');
      return;
    }
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);
    try {
      // Construire la voix de marque à partir des réponses
      const voice = `Ton ${answers.tone || 'professionnel'}. Secteur: ${answers.industry || 'général'}. 
Public cible: ${answers.target_audience || 'large public'}. 
Valeur unique: ${answers.value_proposition || 'excellence'}. 
Mots-clés: ${answers.keywords || 'qualité, innovation'}.`;

      // Créer la marque
      const { data: brand, error } = await supabase
        .from('brands')
        .insert({
          user_id: user.id,
          name: answers.name,
          palette: answers.palette ? answers.palette.split(',').map((c: string) => c.trim()) : [],
          voice: voice.trim(),
          fonts: { heading: 'Inter', body: 'Inter' }
        })
        .select()
        .single();

      if (error) throw error;

      // Définir comme marque active
      await supabase
        .from('profiles')
        .update({ active_brand_id: brand.id })
        .eq('user_id', user.id);

      toast.success('🎉 Brand Kit créé avec succès !');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error creating brand:', error);
      toast.error('Erreur lors de la création du Brand Kit');
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (value: any) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.field]: value
    }));
  };

  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-xl">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <CardTitle>Configuration de votre Brand Kit</CardTitle>
          </div>
          <CardDescription>
            Question {currentStep + 1} sur {questions.length}
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">{currentQuestion.title}</h3>
            <p className="text-sm text-muted-foreground">{currentQuestion.description}</p>
          </div>

          {currentQuestion.type === 'text' && (
            <div className="space-y-2">
              <Input
                value={answers[currentQuestion.field] || ''}
                onChange={(e) => updateAnswer(e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="text-lg"
              />
            </div>
          )}

          {currentQuestion.type === 'colors' && (
            <div className="space-y-2">
              <Input
                value={answers[currentQuestion.field] || ''}
                onChange={(e) => updateAnswer(e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Séparez les couleurs par des virgules. Format: #RRGGBB
              </p>
            </div>
          )}

          {currentQuestion.type === 'textarea' && (
            <div className="space-y-2">
              <Textarea
                value={answers[currentQuestion.field] || ''}
                onChange={(e) => updateAnswer(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={5}
                className="text-base"
              />
            </div>
          )}

          {currentQuestion.type === 'radio' && (
            <RadioGroup
              value={answers[currentQuestion.field]}
              onValueChange={updateAnswer}
              className="space-y-3"
            >
              {currentQuestion.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-3 p-4 rounded-lg border hover:border-primary transition-colors">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="gap-2"
            >
              {currentStep === questions.length - 1 ? (
                loading ? 'Création...' : 'Créer mon Brand Kit'
              ) : (
                <>
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
