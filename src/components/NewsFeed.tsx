import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface News {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export function NewsFeed() {
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    fetchNews();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('news-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'news'
      }, () => {
        fetchNews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!error && data) {
      setNews(data);
    }
  };

  if (news.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Actualités
        </CardTitle>
        <CardDescription>
          Les dernières actualités de la plateforme
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {news.map((item) => (
              <div key={item.id} className="border-l-4 border-primary pl-4 py-2">
                <h4 className="font-semibold text-sm">{item.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{item.content}</p>
                <span className="text-xs text-muted-foreground mt-2 block">
                  {new Date(item.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
