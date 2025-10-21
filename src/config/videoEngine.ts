/**
 * Configuration du moteur de génération vidéo FFmpeg
 */

export const VIDEO_ENGINE_CONFIG = {
  FFMPEG_BACKEND_URL: 'https://alfie-ffmpeg-backend.onrender.com',
  
  // Timeout pour les requêtes vidéo (30 secondes)
  REQUEST_TIMEOUT: 30000,
  
  // Nombre de tentatives en cas d'échec
  MAX_RETRIES: 3,
} as const;

export type VideoEngineConfig = typeof VIDEO_ENGINE_CONFIG;
