import { supabase } from '@/lib/supabase';

export interface SubjectPack {
  id: string;
  user_id: string;
  brand_id: string | null;
  name: string;
  pack_type: 'person' | 'mascot' | 'product' | 'object';
  master_image_url: string;
  anchor_a_url: string | null;
  anchor_b_url: string | null;
  identity_prompt: string;
  negative_prompt: string;
  constraints_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectPackInput {
  name: string;
  pack_type: 'person' | 'mascot' | 'product' | 'object';
  identity_prompt?: string;
  negative_prompt?: string;
  brand_id?: string;
}

/**
 * Upload an image to Supabase Storage and return the public URL
 * Returns null if upload fails for optional slots (anchors)
 */
async function uploadImage(
  file: File, 
  userId: string, 
  packId: string, 
  slot: string,
  options: { required?: boolean } = { required: true }
): Promise<string | null> {
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
  console.log('[SubjectPack] uploadImage:', { 
    slot, 
    fileName: file.name, 
    size: `${fileSizeMB}MB`, 
    type: file.type, 
    online: navigator.onLine,
    // @ts-ignore - connection API may not be available
    connectionType: navigator.connection?.effectiveType || 'unknown'
  });
  
  // Vérifier la session AVANT l'upload
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('[SubjectPack] Session expired or not authenticated:', authError);
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `subject-packs/${userId}/${packId}/${slot}-${Date.now()}.${ext}`;
  
  // Retry logic avec 3 tentatives et exponential backoff
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[SubjectPack] Upload attempt ${attempt}/${MAX_ATTEMPTS} for ${slot}...`);
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(path);

      console.log('[SubjectPack] Uploaded successfully:', publicUrl);
      return publicUrl;
      
    } catch (err: any) {
      lastError = err;
      console.warn(`[SubjectPack] Upload attempt ${attempt} failed:`, err.message);
      
      // Ne pas retry si c'est une erreur d'auth
      if (err.message?.includes('auth') || err.message?.includes('session')) {
        break;
      }
      
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 2s
        const delay = 1000 * attempt;
        console.log(`[SubjectPack] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  // Toutes les tentatives ont échoué
  const errorMsg = lastError?.message || 'Erreur inconnue';
  const isNetworkError = errorMsg.includes('fetch') || 
                         errorMsg.includes('network') || 
                         errorMsg.includes('NetworkError') ||
                         errorMsg.includes('Load failed');
  
  const detailedMsg = `${slot} (${file.type}, ${fileSizeMB}MB)`;
  
  // Si c'est un slot optionnel (anchors), on retourne null au lieu de throw
  if (!options.required) {
    console.warn(`[SubjectPack] Optional upload failed for ${detailedMsg}, continuing without it`);
    return null;
  }
  
  if (isNetworkError) {
    throw new Error(`Erreur réseau pour ${detailedMsg}. Vérifie ta connexion et réessaie.`);
  }
  
  throw new Error(`Échec upload ${detailedMsg}: ${errorMsg}`);
}

/**
 * List all subject packs for a user, optionally filtered by brand
 */
export async function listSubjectPacks(brandId?: string): Promise<SubjectPack[]> {
  let query = supabase
    .from('subject_packs')
    .select('*')
    .order('created_at', { ascending: false });

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as SubjectPack[];
}

/**
 * Get a single subject pack by ID
 */
export async function getSubjectPack(id: string): Promise<SubjectPack | null> {
  const { data, error } = await supabase
    .from('subject_packs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as SubjectPack;
}

/**
 * Create a new subject pack with up to 3 images
 * @param input - Pack metadata
 * @param files - Array of [masterFile, anchorAFile?, anchorBFile?]
 */
export interface CreateSubjectPackResult {
  pack: SubjectPack;
  warnings: string[];
}

/**
 * Create a new subject pack with up to 3 images
 * @param input - Pack metadata
 * @param files - Array of [masterFile, anchorAFile?, anchorBFile?]
 * @param onProgress - Optional callback for progress updates
 */
export async function createSubjectPack(
  input: CreateSubjectPackInput,
  files: { master: File; anchorA?: File; anchorB?: File },
  userId: string,
  onProgress?: (status: string) => void
): Promise<CreateSubjectPackResult> {
  console.log('[SubjectPack] Creating pack:', { input, userId, hasFiles: { master: !!files.master, anchorA: !!files.anchorA, anchorB: !!files.anchorB } });
  
  const warnings: string[] = [];
  
  // Generate a temporary ID for the folder structure
  const tempId = crypto.randomUUID();

  // Upload master image (required)
  onProgress?.('Upload Master...');
  console.log('[SubjectPack] Uploading master image...');
  const masterUrl = await uploadImage(files.master, userId, tempId, 'master', { required: true });
  
  if (!masterUrl) {
    throw new Error('L\'image Master est obligatoire.');
  }
  console.log('[SubjectPack] Master uploaded:', masterUrl);

  // Upload optional anchor images (non-blocking)
  let anchorAUrl: string | null = null;
  let anchorBUrl: string | null = null;

  if (files.anchorA) {
    onProgress?.('Upload Anchor A...');
    anchorAUrl = await uploadImage(files.anchorA, userId, tempId, 'anchor-a', { required: false });
    if (!anchorAUrl) {
      warnings.push('Anchor A n\'a pas pu être uploadé (réseau/format). Tu peux le re-ajouter plus tard.');
    }
  }

  if (files.anchorB) {
    onProgress?.('Upload Anchor B...');
    anchorBUrl = await uploadImage(files.anchorB, userId, tempId, 'anchor-b', { required: false });
    if (!anchorBUrl) {
      warnings.push('Anchor B n\'a pas pu être uploadé (réseau/format). Tu peux le re-ajouter plus tard.');
    }
  }

  // Create the subject pack record
  onProgress?.('Enregistrement du pack...');
  console.log('[SubjectPack] Creating DB record with brand_id:', input.brand_id);
  const { data, error } = await supabase
    .from('subject_packs')
    .insert({
      id: tempId,
      user_id: userId,
      brand_id: input.brand_id || null,
      name: input.name,
      pack_type: input.pack_type,
      master_image_url: masterUrl,
      anchor_a_url: anchorAUrl,
      anchor_b_url: anchorBUrl,
      identity_prompt: input.identity_prompt || '',
      negative_prompt: input.negative_prompt || '',
    })
    .select()
    .single();

  if (error) {
    console.error('[SubjectPack] DB insert failed:', error);
    throw new Error(`Database error: ${error.message}`);
  }
  
  console.log('[SubjectPack] Pack created successfully:', data.id);
  return { pack: data as SubjectPack, warnings };
}

/**
 * Update an existing subject pack
 */
export async function updateSubjectPack(
  id: string,
  updates: Partial<Omit<SubjectPack, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<SubjectPack> {
  const { data, error } = await supabase
    .from('subject_packs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SubjectPack;
}

/**
 * Delete a subject pack
 */
export async function deleteSubjectPack(id: string): Promise<void> {
  const { error } = await supabase
    .from('subject_packs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Set a subject pack as the default for a brand
 */
export async function setBrandDefaultSubjectPack(brandId: string, subjectPackId: string | null): Promise<void> {
  const { error } = await supabase
    .from('brands')
    .update({ default_subject_pack_id: subjectPackId })
    .eq('id', brandId);

  if (error) throw error;
}
