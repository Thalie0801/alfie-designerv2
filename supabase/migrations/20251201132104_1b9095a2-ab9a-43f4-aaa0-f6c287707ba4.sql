-- Add new video engine types for Replicate and VEO 3.1
ALTER TYPE video_engine ADD VALUE IF NOT EXISTS 'replicate';
ALTER TYPE video_engine ADD VALUE IF NOT EXISTS 'veo_3_1';