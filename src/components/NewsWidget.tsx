import { useEffect, useState } from 'react';
import { Bell, X, Newspaper } from 'lucide-react';
import { supabase } from '@/lib/supabaseSafeClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface News {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export function NewsWidget() {
  const [news, setNews] = useState<News[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    fetchNews();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('news-widget-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'news'
      }, () => {
        fetchNews();
        checkForNewNews();
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
      .limit(10);
    
    if (!error && data) {
      setNews(data);
      checkForNewNews(data);
    }
  };

  const checkForNewNews = (newsData?: News[]) => {
    const newsToCheck = newsData || news;
    if (newsToCheck.length === 0) return;

    const lastReadTimestamp = localStorage.getItem('lastReadNewsTimestamp');
    const latestNewsTimestamp = new Date(newsToCheck[0].created_at).getTime();

    if (!lastReadTimestamp || latestNewsTimestamp > parseInt(lastReadTimestamp)) {
      setHasUnread(true);
    }
  };

  const markAsRead = () => {
    if (news.length > 0) {
      const latestTimestamp = new Date(news[0].created_at).getTime();
      localStorage.setItem('lastReadNewsTimestamp', latestTimestamp.toString());
      setHasUnread(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      markAsRead();
    }
  };

  if (news.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-2 border-primary/30 hover:border-primary"
        >
          <Newspaper className="h-4 w-4" />
          <span className={hasUnread ? 'animate-pulse font-semibold text-primary' : ''}>
            Actualités
          </span>
          {hasUnread && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive animate-pulse"
            >
              <Bell className="h-3 w-3" />
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[90vw] max-w-md p-0" 
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <Card className="border-0 shadow-strong">
          <CardHeader className="pb-3 bg-gradient-subtle">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Newspaper className="h-5 w-5 text-primary" />
                Actualités
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] px-4">
              <div className="space-y-4 py-4">
                {news.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={`border-l-4 border-primary pl-4 py-2 ${
                      index === 0 && hasUnread ? 'bg-primary/5 -ml-4 pr-4 rounded-r' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      {index === 0 && hasUnread && (
                        <Badge variant="secondary" className="text-xs">
                          Nouveau
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {item.content}
                    </p>
                    <span className="text-xs text-muted-foreground mt-2 block">
                      {new Date(item.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
