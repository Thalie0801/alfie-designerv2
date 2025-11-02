import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CharacterCounter } from './CharacterCounter';
import { GripVertical, Trash2, Copy, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlideContent {
  type: 'hook' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  bullets?: string[];
  cta?: string;
}

interface SlideEditorCardProps {
  slide: SlideContent;
  index: number;
  onUpdate: (updated: SlideContent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragHandleProps?: any;
}

const CHAR_LIMITS = {
  title: { min: 10, max: 60 },
  subtitle: { max: 120 },
  bullet: { max: 90 },
  cta: { max: 40 }
};

const SLIDE_TYPES = [
  { value: 'hook', label: '🎣 Hook' },
  { value: 'problem', label: '⚠️ Problème' },
  { value: 'solution', label: '✅ Solution' },
  { value: 'impact', label: '📊 Impact' },
  { value: 'cta', label: '🎯 CTA' }
];

export function SlideEditorCard({
  slide,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  dragHandleProps
}: SlideEditorCardProps) {
  const [newBullet, setNewBullet] = useState('');

  const isValid = () => {
    const titleValid = slide.title.length >= CHAR_LIMITS.title.min && 
                       slide.title.length <= CHAR_LIMITS.title.max;
    const subtitleValid = !slide.subtitle || slide.subtitle.length <= CHAR_LIMITS.subtitle.max;
    const bulletsValid = !slide.bullets || (
      slide.bullets.length <= 6 && 
      slide.bullets.every(b => b.length <= CHAR_LIMITS.bullet.max)
    );
    const ctaValid = !slide.cta || slide.cta.length <= CHAR_LIMITS.cta.max;
    
    return titleValid && subtitleValid && bulletsValid && ctaValid;
  };

  const addBullet = () => {
    if (!newBullet.trim()) return;
    if ((slide.bullets?.length || 0) >= 6) {
      return;
    }
    onUpdate({
      ...slide,
      bullets: [...(slide.bullets || []), newBullet.trim()]
    });
    setNewBullet('');
  };

  const removeBullet = (idx: number) => {
    onUpdate({
      ...slide,
      bullets: slide.bullets?.filter((_, i) => i !== idx)
    });
  };

  return (
    <Card className={cn('relative', !isValid() && 'border-destructive')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm">
              Slide {index + 1}
            </CardTitle>
            {isValid() ? (
              <Badge variant="default" className="bg-success text-success-foreground">
                Valide
              </Badge>
            ) : (
              <Badge variant="destructive">Invalide</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onDuplicate}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Type */}
        <div className="space-y-2">
          <Label>Type de slide</Label>
          <Select
            value={slide.type}
            onValueChange={(value) => onUpdate({ ...slide, type: value as SlideContent['type'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLIDE_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Titre *</Label>
            <CharacterCounter
              current={slide.title.length}
              min={CHAR_LIMITS.title.min}
              max={CHAR_LIMITS.title.max}
            />
          </div>
          <Input
            value={slide.title}
            onChange={(e) => onUpdate({ ...slide, title: e.target.value })}
            placeholder="Titre accrocheur..."
            className={cn(
              slide.title.length > CHAR_LIMITS.title.max && 'border-destructive'
            )}
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Sous-titre</Label>
            <CharacterCounter
              current={slide.subtitle?.length || 0}
              max={CHAR_LIMITS.subtitle.max}
            />
          </div>
          <Textarea
            value={slide.subtitle || ''}
            onChange={(e) => onUpdate({ ...slide, subtitle: e.target.value })}
            placeholder="Description plus détaillée..."
            rows={2}
            className={cn(
              (slide.subtitle?.length || 0) > CHAR_LIMITS.subtitle.max && 'border-destructive'
            )}
          />
        </div>

        {/* Bullets */}
        <div className="space-y-2">
          <Label>Points clés (max 6)</Label>
          {slide.bullets && slide.bullets.length > 0 && (
            <div className="space-y-2">
              {slide.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-2">•</span>
                  <div className="flex-1 space-y-1">
                    <Input
                      value={bullet}
                      onChange={(e) => {
                        const newBullets = [...(slide.bullets || [])];
                        newBullets[idx] = e.target.value;
                        onUpdate({ ...slide, bullets: newBullets });
                      }}
                      className={cn(
                        bullet.length > CHAR_LIMITS.bullet.max && 'border-destructive'
                      )}
                    />
                    <CharacterCounter
                      current={bullet.length}
                      max={CHAR_LIMITS.bullet.max}
                      className="justify-end"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeBullet(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {(slide.bullets?.length || 0) < 6 && (
            <div className="flex gap-2">
              <Input
                value={newBullet}
                onChange={(e) => setNewBullet(e.target.value)}
                placeholder="Nouveau point..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBullet();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={addBullet}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Call-to-Action</Label>
            <CharacterCounter
              current={slide.cta?.length || 0}
              max={CHAR_LIMITS.cta.max}
            />
          </div>
          <Input
            value={slide.cta || ''}
            onChange={(e) => onUpdate({ ...slide, cta: e.target.value })}
            placeholder="Ex: Essayer gratuitement"
            className={cn(
              (slide.cta?.length || 0) > CHAR_LIMITS.cta.max && 'border-destructive'
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
