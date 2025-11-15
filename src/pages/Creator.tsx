import { useBrandKit } from '@/hooks/useBrandKit';
import { StudioGenerator } from '@/features/studio/StudioGenerator';

export default function Creator() {
  const { activeBrandId } = useBrandKit();

  return <StudioGenerator activeBrandId={activeBrandId} />;
}
