import { useState } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseSafeClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function FeatureRequestDialog() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert([{
          name: user?.email || 'Utilisateur anonyme',
          email: user?.email || '',
          message: `[SUGGESTION DE FONCTIONNALITÉ]\n\nTitre: ${formData.title}\n\nDescription:\n${formData.description}`,
          status: 'pending'
        }]);

      if (error) throw error;

      toast.success('✨ Suggestion envoyée ! Merci pour votre contribution.');
      setFormData({ title: '', description: '' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error submitting feature request:', error);
      toast.error('Erreur lors de l\'envoi de la suggestion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2 border-secondary/30 hover:border-secondary hover:bg-secondary/10"
        >
          <Lightbulb className="h-4 w-4 text-secondary" />
          <span>Suggérer</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-secondary" />
            Suggérer une fonctionnalité
          </DialogTitle>
          <DialogDescription>
            Vous avez une idée pour améliorer Alfie ? Partagez-la avec nous !
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Titre de la suggestion <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ex: Intégration avec Instagram"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description détaillée <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Décrivez votre idée en détail : à quoi servirait cette fonctionnalité ? Comment l'utiliseriez-vous ?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isSubmitting}
              className="min-h-[120px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 caractères
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-gradient-to-r from-primary to-secondary text-white"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
