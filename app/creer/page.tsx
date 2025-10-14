'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGeminiImages } from '@/hooks/useGeminiImages';
import { cn } from '@/lib/utils';

const aspectOptions: Array<'1:1' | '9:16' | '16:9' | '3:4'> = ['1:1', '9:16', '16:9', '3:4'];

export default function Creer() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9' | '3:4'>('1:1');
  const { loading, urls, error, generate } = useGeminiImages();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await generate(prompt.trim(), aspectRatio, 1);
  };

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Créer une image</CardTitle>
          <p className="text-sm text-muted-foreground">
            Décris ton idée pour générer une image avec Gemini (Imagen 3).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Décris l’image à générer…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <select
              className={cn(
                'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              )}
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
            >
              {aspectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button className="md:self-stretch" disabled={!prompt.trim() || loading} onClick={handleGenerate}>
              {loading ? 'Génération…' : 'Générer'}
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {urls.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {urls.map((url) => (
                <Card key={url} className="overflow-hidden">
                  <div className="relative aspect-square">
                    <Image
                      src={url}
                      alt="image générée"
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
