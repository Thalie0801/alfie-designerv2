import { useBrandKit } from "@/hooks/useBrandKit";
import { BrandSelector } from "@/components/BrandSelector";
import { StudioV2 as StudioV2Feature } from "@/features/studio/StudioV2";
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandSelector } from '@/components/BrandSelector';
import { StudioV2 as StudioV2Feature } from '@/features/studio/StudioV2';

export default function StudioV2Page() {
  const { activeBrandId } = useBrandKit();

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Studio Alfie</h1>
          <p className="text-muted-foreground max-w-2xl">
            Génère images, carrousels et vidéos avec une interface inspirée de Meta AI. Combine plusieurs
            formats dans une même requête et retrouve-les en un clin d'œil dans ta bibliothèque Alfie.
            Génère images, carrousels et vidéos avec l'assistant créatif Alfie. Combine plusieurs formats
            dans une même requête et retrouve-les en un clin d'œil dans ta bibliothèque.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <BrandSelector />
        </div>
      </header>

      <StudioV2Feature activeBrandId={activeBrandId ?? null} />
    </div>
  );
}
