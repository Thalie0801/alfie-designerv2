import { useState } from 'react';
import { useSubjectPacks } from '@/hooks/useSubjectPacks';
import { useBrandKit } from '@/hooks/useBrandKit';
import { SubjectPackCreateModal } from './SubjectPackCreateModal';
import { setBrandDefaultSubjectPack } from '@/services/subjectPackService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, User, Dog, Package, Sparkles, Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PACK_TYPE_ICONS: Record<string, React.ReactNode> = {
  person: <User className="h-4 w-4" />,
  mascot: <Dog className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  object: <Sparkles className="h-4 w-4" />,
};

const PACK_TYPE_LABELS: Record<string, string> = {
  person: 'Personnage',
  mascot: 'Mascotte',
  product: 'Produit',
  object: 'Objet',
};

interface SubjectPackManagerProps {
  showHeader?: boolean;
  onPackSelect?: (packId: string) => void;
  brandId?: string;
}

export function SubjectPackManager({ showHeader = true, onPackSelect, brandId }: SubjectPackManagerProps) {
  const { packs, loading, deletePack, refresh } = useSubjectPacks(brandId);
  const { brandKit, loadBrands } = useBrandKit();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const defaultPackId = (brandKit as any)?.default_subject_pack_id;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deletePack(id);
      toast.success('Subject Pack supprimé');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = (packId: string) => {
    refresh();
    onPackSelect?.(packId);
  };

  const handleSetDefault = async (packId: string) => {
    if (!brandKit?.id) return;
    setSettingDefaultId(packId);
    try {
      await setBrandDefaultSubjectPack(brandKit.id, packId);
      await loadBrands(); // Refresh to get updated default
      onPackSelect?.(packId);
      toast.success('Subject Pack défini par défaut');
    } catch (err) {
      console.error('Set default error:', err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSettingDefaultId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Mes Subject Packs</h3>
            <p className="text-sm text-muted-foreground">
              Références visuelles réutilisables
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau
          </Button>
        </div>
      )}

      {packs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <User className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center mb-4">
              Aucun Subject Pack créé.<br />
              Crée-en un pour garantir la cohérence de tes visuels.
            </p>
            <Button onClick={() => setShowCreateModal(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Créer mon premier pack
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <Card key={pack.id} className="overflow-hidden group relative">
              {/* Default badge */}
              {defaultPackId === pack.id && (
                <Badge className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground">
                  <Star className="h-3 w-3 mr-1" />
                  Par défaut
                </Badge>
              )}

              {/* Images preview */}
              <div className="flex h-32 bg-muted">
                <div className="flex-1 relative">
                  <img
                    src={pack.master_image_url}
                    alt={pack.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </div>
                {(pack.anchor_a_url || pack.anchor_b_url) && (
                  <div className="w-1/3 flex flex-col">
                    {pack.anchor_a_url && (
                      <div className="flex-1 relative border-l border-background">
                        <img
                          src={pack.anchor_a_url}
                          alt="Anchor A"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                    {pack.anchor_b_url && (
                      <div className="flex-1 relative border-l border-t border-background">
                        <img
                          src={pack.anchor_b_url}
                          alt="Anchor B"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{pack.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      {PACK_TYPE_ICONS[pack.pack_type]}
                      {PACK_TYPE_LABELS[pack.pack_type]}
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* Définir par défaut */}
                    {defaultPackId !== pack.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSetDefault(pack.id)}
                        disabled={settingDefaultId === pack.id}
                        title="Définir par défaut"
                      >
                        {settingDefaultId === pack.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    {/* Supprimer */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingId === pack.id}
                        >
                          {deletingId === pack.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer "{pack.name}" ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Les projets utilisant ce pack ne seront plus associés à aucun subject.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(pack.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              {pack.identity_prompt && (
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {pack.identity_prompt}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <SubjectPackCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleCreated}
      />
    </div>
  );
}
