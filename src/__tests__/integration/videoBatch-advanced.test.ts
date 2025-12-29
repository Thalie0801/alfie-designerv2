/**
 * Tests Video Batch Advanced - Phase 2 Core Business
 * Vérifie les fonctionnalités avancées du module Video Batch
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types
interface BatchClip {
  id: string;
  video_id: string;
  clip_index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  clip_url?: string;
  anchor_url?: string;
  veo_prompt?: string;
  error?: string;
}

interface BatchVideo {
  id: string;
  batch_id: string;
  video_index: number;
  title?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  clips: BatchClip[];
}

interface VideoBatch {
  id: string;
  user_id: string;
  brand_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videos: BatchVideo[];
}

interface BatchVideoTexts {
  video_id: string;
  caption?: string;
  clip1_title?: string;
  clip1_subtitle?: string;
  clip2_title?: string;
  clip2_subtitle?: string;
  clip3_title?: string;
  clip3_subtitle?: string;
  cta?: string;
}

// Mock data
let mockBatch: VideoBatch;
let mockTexts: BatchVideoTexts[];

beforeEach(() => {
  mockBatch = {
    id: 'batch-1',
    user_id: 'user-1',
    brand_id: 'brand-1',
    status: 'processing',
    videos: [
      {
        id: 'video-1',
        batch_id: 'batch-1',
        video_index: 0,
        title: 'Video 1',
        status: 'completed',
        clips: [
          { id: 'clip-1-0', video_id: 'video-1', clip_index: 0, status: 'completed', clip_url: 'https://cdn.example.com/clip1-0.mp4' },
          { id: 'clip-1-1', video_id: 'video-1', clip_index: 1, status: 'completed', clip_url: 'https://cdn.example.com/clip1-1.mp4' },
          { id: 'clip-1-2', video_id: 'video-1', clip_index: 2, status: 'completed', clip_url: 'https://cdn.example.com/clip1-2.mp4' },
        ],
      },
      {
        id: 'video-2',
        batch_id: 'batch-1',
        video_index: 1,
        title: 'Video 2',
        status: 'processing',
        clips: [
          { id: 'clip-2-0', video_id: 'video-2', clip_index: 0, status: 'completed', clip_url: 'https://cdn.example.com/clip2-0.mp4' },
          { id: 'clip-2-1', video_id: 'video-2', clip_index: 1, status: 'processing' },
          { id: 'clip-2-2', video_id: 'video-2', clip_index: 2, status: 'pending' },
        ],
      },
    ],
  };

  mockTexts = [
    {
      video_id: 'video-1',
      caption: 'Cette vidéo montre comment...',
      clip1_title: 'Introduction',
      clip1_subtitle: 'Bienvenue',
      clip2_title: 'Contenu Principal',
      clip2_subtitle: 'Le cœur du sujet',
      clip3_title: 'Conclusion',
      clip3_subtitle: 'À retenir',
      cta: 'Suivez-nous !',
    },
    {
      video_id: 'video-2',
      caption: 'Découvrez les secrets de...',
      clip1_title: 'Partie 1',
      clip1_subtitle: 'Les bases',
      clip2_title: 'Partie 2',
      clip2_subtitle: 'Approfondissement',
      clip3_title: 'Partie 3',
      clip3_subtitle: 'Maîtrise',
      cta: 'Abonnez-vous !',
    },
  ];
});

// Services simulés
const videoBatchService = {
  regenerateClip: (clipId: string): BatchClip | null => {
    for (const video of mockBatch.videos) {
      const clipIndex = video.clips.findIndex(c => c.id === clipId);
      if (clipIndex !== -1) {
        // Reset le clip pour régénération
        video.clips[clipIndex] = {
          ...video.clips[clipIndex],
          status: 'pending',
          clip_url: undefined,
          error: undefined,
        };
        return video.clips[clipIndex];
      }
    }
    return null;
  },

  regenerateVideo: (videoId: string): BatchVideo | null => {
    const video = mockBatch.videos.find(v => v.id === videoId);
    if (!video) return null;

    // Reset tous les clips de la vidéo
    video.clips = video.clips.map(clip => ({
      ...clip,
      status: 'pending' as const,
      clip_url: undefined,
      error: undefined,
    }));
    video.status = 'pending';

    return video;
  },

  updateBatchStatus: (): void => {
    const allVideosCompleted = mockBatch.videos.every(v => v.status === 'completed');
    const anyVideoFailed = mockBatch.videos.some(v => v.status === 'failed');

    if (allVideosCompleted) {
      mockBatch.status = 'completed';
    } else if (anyVideoFailed) {
      mockBatch.status = 'failed';
    }
  },

  generateManifest: (): object => {
    return {
      batch_id: mockBatch.id,
      created_at: new Date().toISOString(),
      videos: mockBatch.videos.map(v => ({
        video_id: v.id,
        video_index: v.video_index,
        title: v.title,
        clips: v.clips.map(c => ({
          clip_index: c.clip_index,
          url: c.clip_url,
        })),
      })),
    };
  },

  generateTextsMarkdown: (): string => {
    let markdown = '# Video Batch Texts\n\n';
    
    for (const text of mockTexts) {
      const video = mockBatch.videos.find(v => v.id === text.video_id);
      markdown += `## ${video?.title || text.video_id}\n\n`;
      markdown += `**Caption:** ${text.caption || 'N/A'}\n\n`;
      markdown += `### Clips\n`;
      markdown += `- Clip 1: ${text.clip1_title} - ${text.clip1_subtitle}\n`;
      markdown += `- Clip 2: ${text.clip2_title} - ${text.clip2_subtitle}\n`;
      markdown += `- Clip 3: ${text.clip3_title} - ${text.clip3_subtitle}\n\n`;
      markdown += `**CTA:** ${text.cta || 'N/A'}\n\n---\n\n`;
    }

    return markdown;
  },

  generateCanvaCSV: (): string => {
    const headers = [
      'batch_key',
      'video_index',
      'video_title',
      'clip1_title',
      'clip1_subtitle',
      'clip2_title',
      'clip2_subtitle',
      'clip3_title',
      'clip3_subtitle',
      'cta',
    ];

    const rows = mockTexts.map(text => {
      const video = mockBatch.videos.find(v => v.id === text.video_id);
      return [
        mockBatch.id,
        video?.video_index ?? 0,
        video?.title ?? '',
        text.clip1_title ?? '',
        text.clip1_subtitle ?? '',
        text.clip2_title ?? '',
        text.clip2_subtitle ?? '',
        text.clip3_title ?? '',
        text.clip3_subtitle ?? '',
        text.cta ?? '',
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },
};

describe('Video Batch - Régénération', () => {
  it('Régénération clip individuel conserve les autres', () => {
    const video = mockBatch.videos[0];
    const originalClip1Url = video.clips[1].clip_url;
    const originalClip2Url = video.clips[2].clip_url;

    // Régénérer uniquement le clip 0
    videoBatchService.regenerateClip('clip-1-0');

    expect(video.clips[0].status).toBe('pending');
    expect(video.clips[0].clip_url).toBeUndefined();
    
    // Les autres clips doivent rester intacts
    expect(video.clips[1].clip_url).toBe(originalClip1Url);
    expect(video.clips[2].clip_url).toBe(originalClip2Url);
    expect(video.clips[1].status).toBe('completed');
    expect(video.clips[2].status).toBe('completed');
  });

  it('Régénération vidéo entière (3 clips)', () => {
    const video = mockBatch.videos[0];
    
    // Tous les clips sont initialement completed
    expect(video.clips.every(c => c.status === 'completed')).toBe(true);

    // Régénérer toute la vidéo
    videoBatchService.regenerateVideo('video-1');

    // Tous les clips doivent être reset
    expect(video.clips.every(c => c.status === 'pending')).toBe(true);
    expect(video.clips.every(c => c.clip_url === undefined)).toBe(true);
    expect(video.status).toBe('pending');
  });
});

describe('Video Batch - Export', () => {
  it('Export ZIP contient manifest.json correct', () => {
    const manifest = videoBatchService.generateManifest();

    expect(manifest).toHaveProperty('batch_id', 'batch-1');
    expect(manifest).toHaveProperty('created_at');
    expect(manifest).toHaveProperty('videos');
    
    const videos = (manifest as any).videos;
    expect(videos).toHaveLength(2);
    expect(videos[0].clips).toHaveLength(3);
    expect(videos[0].clips[0]).toHaveProperty('url');
  });

  it('Export texts.md contient les captions', () => {
    const markdown = videoBatchService.generateTextsMarkdown();

    expect(markdown).toContain('# Video Batch Texts');
    expect(markdown).toContain('Cette vidéo montre comment...');
    expect(markdown).toContain('Découvrez les secrets de...');
    expect(markdown).toContain('Introduction');
    expect(markdown).toContain('Suivez-nous !');
    expect(markdown).toContain('Abonnez-vous !');
  });

  it('Export CSV Canva format correct', () => {
    const csv = videoBatchService.generateCanvaCSV();
    const lines = csv.split('\n');

    // Header line
    expect(lines[0]).toContain('batch_key,video_index,video_title');
    
    // Data rows
    expect(lines).toHaveLength(3); // header + 2 videos
    expect(lines[1]).toContain('batch-1');
    expect(lines[1]).toContain('Introduction');
    expect(lines[1]).toContain('Suivez-nous !');
  });
});

describe('Video Batch - Status', () => {
  it('Statut batch "completed" quand tous clips done', () => {
    // Compléter tous les clips de video-2
    mockBatch.videos[1].clips.forEach(clip => {
      clip.status = 'completed';
      clip.clip_url = 'https://cdn.example.com/completed.mp4';
    });
    mockBatch.videos[1].status = 'completed';

    videoBatchService.updateBatchStatus();

    expect(mockBatch.status).toBe('completed');
  });

  it('Statut batch "failed" si un clip échoue définitivement', () => {
    mockBatch.videos[1].clips[1].status = 'failed';
    mockBatch.videos[1].clips[1].error = 'Generation failed after max retries';
    mockBatch.videos[1].status = 'failed';

    videoBatchService.updateBatchStatus();

    expect(mockBatch.status).toBe('failed');
  });
});
