export type MediaType = 'image' | 'carousel' | 'video';

export type StudioMessageRole = 'user' | 'assistant';

export interface InputMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  name?: string;
  size?: number;
}

export interface GeneratedAsset {
  id: string;
  resourceId?: string;
  type: MediaType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  previewUrl?: string;
  downloadUrl?: string;
  inLibrary?: boolean;
  meta?: Record<string, any>;
  storage?: string;
}

export interface StudioMessage {
  id: string;
  role: StudioMessageRole;
  content: string;
  createdAt: string;
  assets?: GeneratedAsset[];
  metadata?: Record<string, any>;
}

export interface StudioV2PersistedState {
  messages: StudioMessage[];
  assets: GeneratedAsset[];
  inputMedias: InputMedia[];
  lastActivityAt: string;
}
