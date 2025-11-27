import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface News {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
}

export function NewsManager() {
  const [news, setNews] = useState<News[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    published: false
  });

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Erreur lors du chargement des actualités');
      return;
    }
    setNews(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Titre et contenu requis');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase
        .from('news')
        .update({
          title: formData.title,
          content: formData.content,
          published: formData.published
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Erreur lors de la modification');
        return;
      }
      toast.success('Actualité modifiée');
      setEditingId(null);
    } else {
      const { error } = await supabase
        .from('news')
        .insert({
          title: formData.title,
          content: formData.content,
          published: formData.published,
          created_by: user.id
        });

      if (error) {
        toast.error('Erreur lors de la création');
        return;
      }
      toast.success('Actualité créée');
      setIsAdding(false);
    }

    setFormData({ title: '', content: '', published: false });
    fetchNews();
  };

  const handleEdit = (item: News) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      content: item.content,
      published: item.published
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette actualité ?')) return;

    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    
    toast.success('Actualité supprimée');
    fetchNews();
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ title: '', content: '', published: false });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Gestion des actualités
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle actualité
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Créez et gérez les actualités visibles sur les dashboards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <Card className="border-2 border-primary/30">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Titre de l'actualité"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="content">Contenu</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Contenu de l'actualité"
                    rows={4}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="published"
                    checked={formData.published}
                    onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                  />
                  <Label htmlFor="published">Publier</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? 'Modifier' : 'Créer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {news.map((item) => (
            <Card key={item.id} className={item.published ? 'border-green-500/50' : 'border-gray-300'}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.content}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${item.published ? 'bg-green-500/20 text-green-700' : 'bg-gray-500/20 text-gray-700'}`}>
                        {item.published ? 'Publié' : 'Brouillon'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {news.length === 0 && !isAdding && (
            <p className="text-center text-muted-foreground py-8">
              Aucune actualité pour le moment
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
