import { supabase } from './supabaseClient';

// Types
export interface Hashtag {
  id: string;
  code: string;
  created_at: string;
}

export interface CreateHashtagResult {
  code: string;
}

export class HashtagError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'HashtagError';
  }
}

/**
 * Normalizes a hashtag code by trimming, lowercasing, replacing spaces with hyphens,
 * removing illegal characters, collapsing repeated hyphens, and enforcing length constraints.
 * 
 * @param code - The raw hashtag code to normalize
 * @returns The normalized hashtag code
 * @throws HashtagError if the code is invalid after normalization
 */
export function normalizeHashtag(code: string): string {
  if (!code || typeof code !== 'string') {
    throw new HashtagError('Hashtag is required', code);
  }

  // Trim whitespace
  let normalized = code.trim();

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Replace spaces with hyphens
  normalized = normalized.replace(/\s+/g, '-');

  // Remove illegal characters except [a-z0-9_-]
  normalized = normalized.replace(/[^a-z0-9_-]/g, '');

  // Collapse repeated hyphens
  normalized = normalized.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  normalized = normalized.replace(/^-+|-+$/g, '');

  // Enforce length constraints
  if (normalized.length < 3) {
    throw new HashtagError('Hashtag must be at least 3 characters long', code);
  }

  if (normalized.length > 30) {
    throw new HashtagError('Hashtag must be no more than 30 characters long', code);
  }

  // Final validation with regex
  if (!/^[a-z0-9_-]{3,30}$/.test(normalized)) {
    throw new HashtagError('Hashtag contains invalid characters', code);
  }

  return normalized;
}

/**
 * Checks if a hashtag exists in the database.
 * 
 * @param code - The hashtag code to check
 * @returns Promise<boolean> - true if the hashtag exists, false otherwise
 * @throws HashtagError if the code is invalid
 */
export async function hashtagExists(code: string): Promise<boolean> {
  try {
    const normalized = normalizeHashtag(code);
    console.log('hashtagExists: checking for normalized code:', normalized);

    const { data, error } = await supabase
      .from('hashtags')
      .select('id')
      .eq('code', normalized)
      .limit(1);

    if (error) {
      console.error('Supabase error checking hashtag existence:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    const exists = data && data.length > 0;
    console.log('hashtagExists: result for', normalized, 'is', exists);
    return exists;
  } catch (err) {
    console.error('Error checking hashtag existence:', err);
    throw err; // Re-throw to let the calling function handle it
  }
}

/**
 * Creates a new hashtag in the database.
 * 
 * @param code - The hashtag code to create
 * @returns Promise<CreateHashtagResult> - The created hashtag code
 * @throws HashtagError if the code is invalid or already taken
 */
export async function createHashtag(code: string): Promise<CreateHashtagResult> {
  const normalized = normalizeHashtag(code);

  try {
    const { data, error } = await supabase
      .from('hashtags')
      .insert({ code: normalized })
      .select('code')
      .single();

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        throw new HashtagError('This hashtag is already taken', normalized);
      }
      
      console.error('Error creating hashtag:', error);
      throw new HashtagError('Failed to create hashtag', normalized);
    }

    if (!data) {
      throw new HashtagError('No data returned from hashtag creation', normalized);
    }

    return { code: data.code };
  } catch (err) {
    if (err instanceof HashtagError) {
      throw err;
    }
    
    console.error('Error creating hashtag:', err);
    throw new HashtagError('Failed to create hashtag', normalized);
  }
}

/**
 * Deletes a hashtag from the database.
 * 
 * @param code - The hashtag code to delete
 * @returns Promise<void>
 * @throws HashtagError if the code is invalid or deletion fails
 */
export async function deleteHashtag(code: string): Promise<void> {
  const normalized = normalizeHashtag(code);
  console.log('deleteHashtag called with:', code, 'normalized to:', normalized);

  try {
    const { data, error } = await supabase
      .from('hashtags')
      .delete()
      .eq('code', normalized)
      .select();

    console.log('Delete result:', { data, error });

    if (error) {
      console.error('Error deleting hashtag:', error);
      throw new HashtagError(`Failed to delete hashtag: ${error.message}`, normalized);
    }

    if (data && data.length === 0) {
      console.log('No hashtag found to delete (might already be deleted)');
    } else {
      console.log('Successfully deleted hashtag:', data);
    }
  } catch (err) {
    if (err instanceof HashtagError) {
      throw err;
    }
    
    console.error('Error deleting hashtag:', err);
    throw new HashtagError(`Failed to delete hashtag: ${err}`, normalized);
  }
}
