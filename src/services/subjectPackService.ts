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
 */
async function uploadImage(file: File, userId: string, packId: string, slot: string): Promise<string> {
  console.log('[SubjectPack] uploadImage:', { fileName: file.name, size: file.size, type: file.type, slot, online: navigator.onLine });
  
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
  
  // Toutes les tentatives ont échoué - message utilisateur clair
  const errorMsg = lastError?.message || 'Erreur inconnue';
  const isNetworkError = errorMsg.includes('fetch') || 
                         errorMsg.includes('network') || 
                         errorMsg.includes('NetworkError') ||
                         errorMsg.includes('Load failed');
  
  if (isNetworkError) {
    throw new Error('Erreur réseau. Vérifie ta connexion et réessaie.');
  }
  
  throw new Error(`Échec upload ${slot}: ${errorMsg}`);
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
export async function createSubjectPack(
  input: CreateSubjectPackInput,
  files: { master: File; anchorA?: File; anchorB?: File },
  userId: string
): Promise<SubjectPack> {
  console.log('[SubjectPack] Creating pack:', { input, userId, hasFiles: { master: !!files.master, anchorA: !!files.anchorA, anchorB: !!files.anchorB } });
  
  // Generate a temporary ID for the folder structure
  const tempId = crypto.randomUUID();

  // Upload master image (required)
  console.log('[SubjectPack] Uploading master image...');
  const masterUrl = await uploadImage(files.master, userId, tempId, 'master');
  console.log('[SubjectPack] Master uploaded:', masterUrl);

  // Upload optional anchor images
  let anchorAUrl: string | null = null;
  let anchorBUrl: string | null = null;

  if (files.anchorA) {
    anchorAUrl = await uploadImage(files.anchorA, userId, tempId, 'anchor-a');
  }

  if (files.anchorB) {
    anchorBUrl = await uploadImage(files.anchorB, userId, tempId, 'anchor-b');
  }

  // Create the subject pack record
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
  return data as SubjectPack;
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
