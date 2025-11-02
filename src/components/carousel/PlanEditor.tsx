import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PlanGlobalsEditor, type CarouselGlobals } from './PlanGlobalsEditor';
import { SlideEditorCard, type SlideContent } from './SlideEditorCard';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CarouselPlan {
  globals: CarouselGlobals;
  slides: SlideContent[];
}

interface PlanEditorProps {
  plan: CarouselPlan;
  onPlanChange: (updatedPlan: CarouselPlan) => void;
  onValidate: () => void;
  onCancel: () => void;
}

function SortableSlide({ slide, index, onUpdate, onDelete, onDuplicate }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `slide-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SlideEditorCard
        slide={slide}
        index={index}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function PlanEditor({ plan, onPlanChange, onValidate, onCancel }: PlanEditorProps) {
  const { user } = useAuth();
  const [backgroundOnlyMode, setBackgroundOnlyMode] = useState(false);
  const [templateImageUrl, setTemplateImageUrl] = useState<string | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const validatePlan = (p: CarouselPlan): boolean => {
    if (!p?.slides || p.slides.length < 3) return false;

    return p.slides.every(slide => {
      const titleOk = slide.title && slide.title.length >= 10 && slide.title.length <= 60;
      const subtitleOk = !slide.subtitle || slide.subtitle.length <= 120;
      const bulletsOk = !slide.bullets || (
        slide.bullets.length <= 6 &&
        slide.bullets.every(b => b.length <= 90)
      );
      const ctaOk = !slide.cta || slide.cta.length <= 40;

      return titleOk && subtitleOk && bulletsOk && ctaOk;
    });
  };

  const isValid = validatePlan(plan);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = parseInt(active.id.split('-')[1]);
      const newIndex = parseInt(over.id.split('-')[1]);

      onPlanChange({
        ...plan,
        slides: arrayMove(plan.slides, oldIndex, newIndex)
      });
    }
  };

  const addSlide = () => {
    if (plan.slides.length >= 10) {
      toast.error('Maximum 10 slides');
      return;
    }

    const newSlide: SlideContent = {
      type: 'solution',
      title: 'Nouveau slide',
      subtitle: '',
      bullets: [],
      cta: ''
    };

    onPlanChange({
      ...plan,
      slides: [...plan.slides, newSlide]
    });
  };

  const updateSlide = (index: number, updated: SlideContent) => {
    const newSlides = [...plan.slides];
    newSlides[index] = updated;
    onPlanChange({ ...plan, slides: newSlides });
  };

  const deleteSlide = (index: number) => {
    if (plan.slides.length <= 3) {
      toast.error('Minimum 3 slides requis');
      return;
    }
    onPlanChange({
      ...plan,
      slides: plan.slides.filter((_, i) => i !== index)
    });
  };

  const duplicateSlide = (index: number) => {
    if (plan.slides.length >= 10) {
      toast.error('Maximum 10 slides');
      return;
    }
    const newSlides = [...plan.slides];
    newSlides.splice(index + 1, 0, { ...plan.slides[index] });
    onPlanChange({ ...plan, slides: newSlides });
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez uploader une image');
      return;
    }

    setUploadingTemplate(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('chat-uploads')
        .upload(`templates/${fileName}`, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(`templates/${fileName}`);

      setTemplateImageUrl(publicUrl);
      toast.success('Image de référence uploadée');
    } catch (error: any) {
      console.error('Template upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingTemplate(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Éditeur de Plan</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            onClick={onValidate}
            disabled={!isValid}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Générer les slides
          </Button>
        </div>
      </div>

      {!isValid && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="pt-4">
            <p className="text-sm text-orange-600 dark:text-orange-400">
              ⚠️ Certains champs nécessitent des corrections avant de pouvoir générer les visuels.
            </p>
          </CardContent>
        </Card>
      )}

      <PlanGlobalsEditor
        globals={plan.globals}
        onUpdate={(updated) => onPlanChange({ ...plan, globals: updated })}
      />

      {/* Options avancées */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mode "background only"</Label>
              <p className="text-xs text-muted-foreground">
                Génère uniquement le fond, le texte sera overlayé après
              </p>
            </div>
            <Switch
              checked={backgroundOnlyMode}
              onCheckedChange={setBackgroundOnlyMode}
            />
          </div>

          <div className="space-y-2">
            <Label>Image de référence (facultatif)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Uploadez un visuel pour guider le style et la composition
            </p>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleTemplateUpload}
                disabled={uploadingTemplate}
                className="flex-1"
              />
              {templateImageUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(templateImageUrl, '_blank')}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              )}
            </div>
            {uploadingTemplate && (
              <p className="text-xs text-muted-foreground">Upload en cours...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slides éditables */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={plan.slides.map((_, i) => `slide-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {plan.slides.map((slide, index) => (
              <SortableSlide
                key={`slide-${index}`}
                slide={slide}
                index={index}
                onUpdate={(updated: SlideContent) => updateSlide(index, updated)}
                onDelete={() => deleteSlide(index)}
                onDuplicate={() => duplicateSlide(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        onClick={addSlide}
        variant="outline"
        className="w-full gap-2"
        disabled={plan.slides.length >= 10}
      >
        <Plus className="h-4 w-4" />
        Ajouter un slide ({plan.slides.length}/10)
      </Button>

      {/* Store options in plan for later use */}
      <input
        type="hidden"
        value={JSON.stringify({ backgroundOnlyMode, templateImageUrl })}
        data-plan-options
      />
    </div>
  );
}
