/**
 * Tests Library CRUD - Phase 3 UX & Features
 * Vérifie les opérations CRUD sur les assets de la bibliothèque
 */

import { describe, it, expect } from 'vitest';

// Types pour les assets
interface LibraryAsset {
  id: string;
  user_id: string;
  brand_id: string;
  type: 'image' | 'carousel' | 'video';
  cloudinary_url: string;
  cloudinary_public_id: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

// Mock de la base de données
let mockAssets: LibraryAsset[] = [];
let mockStorageFiles: string[] = [];

// Service simulé
const libraryService = {
  createAsset: (asset: Omit<LibraryAsset, 'id' | 'created_at' | 'updated_at'>): LibraryAsset => {
    const newAsset: LibraryAsset = {
      ...asset,
      id: `asset-${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockAssets.push(newAsset);
    mockStorageFiles.push(asset.cloudinary_public_id);
    return newAsset;
  },

  deleteAsset: (assetId: string): boolean => {
    const asset = mockAssets.find(a => a.id === assetId);
    if (asset) {
      // Supprime le fichier storage
      mockStorageFiles = mockStorageFiles.filter(f => f !== asset.cloudinary_public_id);
      mockAssets = mockAssets.filter(a => a.id !== assetId);
      return true;
    }
    return false;
  },

  getAssets: (options: {
    page?: number;
    pageSize?: number;
    type?: LibraryAsset['type'];
    sortBy?: 'created_at';
    sortOrder?: 'asc' | 'desc';
    search?: string;
  } = {}): { assets: LibraryAsset[]; total: number } => {
    let filtered = [...mockAssets];

    // Filtrage par type
    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }

    // Recherche par tags
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(a => 
        a.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Tri par date
    if (options.sortBy === 'created_at') {
      filtered.sort((a, b) => {
        const diff = a.created_at.getTime() - b.created_at.getTime();
        return options.sortOrder === 'desc' ? -diff : diff;
      });
    }

    // Pagination
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      assets: filtered.slice(start, end),
      total: filtered.length,
    };
  },
};

describe('Library CRUD - Asset Creation', () => {
  it('Création asset après génération réussie', () => {
    mockAssets = [];
    mockStorageFiles = [];

    const asset = libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/image.png',
      cloudinary_public_id: 'alfie/user-1/image-123',
      tags: ['marketing', 'social'],
    });

    expect(asset.id).toBeDefined();
    expect(mockAssets).toHaveLength(1);
    expect(mockStorageFiles).toContain('alfie/user-1/image-123');
  });
});

describe('Library CRUD - Asset Deletion', () => {
  it('Suppression asset supprime fichier storage', () => {
    mockAssets = [];
    mockStorageFiles = [];

    const asset = libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'carousel',
      cloudinary_url: 'https://res.cloudinary.com/test/carousel.png',
      cloudinary_public_id: 'alfie/user-1/carousel-456',
      tags: [],
    });

    expect(mockStorageFiles).toContain('alfie/user-1/carousel-456');

    const deleted = libraryService.deleteAsset(asset.id);

    expect(deleted).toBe(true);
    expect(mockAssets).toHaveLength(0);
    expect(mockStorageFiles).not.toContain('alfie/user-1/carousel-456');
  });
});

describe('Library CRUD - Pagination', () => {
  it('Pagination 20 items par page', () => {
    mockAssets = [];
    mockStorageFiles = [];

    // Créer 50 assets
    for (let i = 0; i < 50; i++) {
      libraryService.createAsset({
        user_id: 'user-1',
        brand_id: 'brand-1',
        type: 'image',
        cloudinary_url: `https://res.cloudinary.com/test/image-${i}.png`,
        cloudinary_public_id: `alfie/user-1/image-${i}`,
        tags: [`tag-${i}`],
      });
    }

    const page1 = libraryService.getAssets({ page: 1, pageSize: 20 });
    const page2 = libraryService.getAssets({ page: 2, pageSize: 20 });
    const page3 = libraryService.getAssets({ page: 3, pageSize: 20 });

    expect(page1.assets).toHaveLength(20);
    expect(page2.assets).toHaveLength(20);
    expect(page3.assets).toHaveLength(10);
    expect(page1.total).toBe(50);
  });
});

describe('Library CRUD - Filtering', () => {
  it('Filtrage par type (image/carousel/video)', () => {
    mockAssets = [];
    mockStorageFiles = [];

    libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/image.png',
      cloudinary_public_id: 'alfie/image-1',
      tags: [],
    });

    libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'carousel',
      cloudinary_url: 'https://res.cloudinary.com/test/carousel.png',
      cloudinary_public_id: 'alfie/carousel-1',
      tags: [],
    });

    libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'video',
      cloudinary_url: 'https://res.cloudinary.com/test/video.mp4',
      cloudinary_public_id: 'alfie/video-1',
      tags: [],
    });

    const images = libraryService.getAssets({ type: 'image' });
    const carousels = libraryService.getAssets({ type: 'carousel' });
    const videos = libraryService.getAssets({ type: 'video' });

    expect(images.assets).toHaveLength(1);
    expect(carousels.assets).toHaveLength(1);
    expect(videos.assets).toHaveLength(1);
  });
});

describe('Library CRUD - Sorting', () => {
  it('Tri par date création', () => {
    mockAssets = [];
    mockStorageFiles = [];

    const asset1 = libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/old.png',
      cloudinary_public_id: 'alfie/old',
      tags: ['old'],
    });
    asset1.created_at = new Date('2024-01-01');

    const asset2 = libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/new.png',
      cloudinary_public_id: 'alfie/new',
      tags: ['new'],
    });
    asset2.created_at = new Date('2024-12-01');

    const asc = libraryService.getAssets({ sortBy: 'created_at', sortOrder: 'asc' });
    const desc = libraryService.getAssets({ sortBy: 'created_at', sortOrder: 'desc' });

    expect(asc.assets[0].tags).toContain('old');
    expect(desc.assets[0].tags).toContain('new');
  });
});

describe('Library CRUD - Search', () => {
  it('Recherche par titre/tags', () => {
    mockAssets = [];
    mockStorageFiles = [];

    libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/marketing.png',
      cloudinary_public_id: 'alfie/marketing',
      tags: ['marketing', 'instagram'],
    });

    libraryService.createAsset({
      user_id: 'user-1',
      brand_id: 'brand-1',
      type: 'image',
      cloudinary_url: 'https://res.cloudinary.com/test/sales.png',
      cloudinary_public_id: 'alfie/sales',
      tags: ['sales', 'linkedin'],
    });

    const marketingResults = libraryService.getAssets({ search: 'marketing' });
    const linkedinResults = libraryService.getAssets({ search: 'linkedin' });
    const noResults = libraryService.getAssets({ search: 'nonexistent' });

    expect(marketingResults.assets).toHaveLength(1);
    expect(linkedinResults.assets).toHaveLength(1);
    expect(noResults.assets).toHaveLength(0);
  });
});
