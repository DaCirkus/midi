import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables for Supabase')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types for our game data
export interface GameData {
  id: string
  mp3_url: string
  midi_data: {
    notes: Array<{
      time: number
      midi: number
      duration: number
      velocity: number
    }>
    tempo: number
  }
  visual_customization?: {
    background: {
      type: 'color' | 'gradient' | 'image' | 'pattern'
      color?: string
      gradientColors?: string[]
      gradientDirection?: string
      imageUrl?: string
      pattern?: 'dots' | 'stripes' | 'grid' | 'waves' | 'circuit'
      patternColor?: string
    }
    notes: {
      shape: 'arrow' | 'circle' | 'square' | 'rectangle' | 'guitar_pick' | 'custom' | 'triangle' | 'diamond' | 'star'
      size: number
      colors: {
        LEFT: string
        RIGHT: string
        UP: string
        DOWN: string
      }
      opacity: number
      glow: boolean
      arrowColor?: 'black' | 'white'
    }
    hitEffects: {
      style: 'explosion' | 'ripple' | 'flash' | 'particles' | 'starburst' | 'pulse' | 'glow' | 'none'
      color: string
      size: number
      duration: number
    }
    missEffects: {
      style: 'shake' | 'fade' | 'flash' | 'blur' | 'shatter' | 'shrink' | 'none'
      color: string
    }
    lanes: {
      color: string
      width: number
      glow: boolean
    }
    ui: {
      theme: 'default' | 'minimal' | 'retro' | 'futuristic'
      fontFamily: string
    }
  }
  created_at: string
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  MP3: 'mp3-files'
} as const

// Table names
export const TABLES = {
  GAMES: 'rhythmGames'
} as const

function sanitizeFilename(filename: string): string {
  // Remove special characters and replace spaces with underscores
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
}

// Helper functions
export async function uploadFile(file: File, bucket: keyof typeof STORAGE_BUCKETS) {
  const timestamp = Date.now()
  const sanitizedName = sanitizeFilename(file.name)
  const fileName = `${timestamp}-${sanitizedName}`
  
  console.log('Uploading file:', fileName, 'type:', file.type)
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) {
    console.error('Upload error:', error)
    throw error
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .getPublicUrl(fileName)
  
  return publicUrl
}

export async function createGame(
  mp3Url: string, 
  midiData: GameData['midi_data'],
  visualCustomization?: GameData['visual_customization']
) {
  console.log('createGame visualCustomization:', visualCustomization);
  
  // Sanitize visual customization data to prevent server errors
  let sanitizedCustomization = visualCustomization;
  
  if (visualCustomization) {
    // Create a deep copy to avoid mutating the original
    sanitizedCustomization = JSON.parse(JSON.stringify(visualCustomization)) as typeof visualCustomization;
    
    // Handle image background
    if (sanitizedCustomization?.background.type === 'image') {
      let useColorFallback = false;
      
      try {
        // Check if imageUrl exists
        if (!sanitizedCustomization.background.imageUrl || 
            sanitizedCustomization.background.imageUrl.trim() === '') {
          console.warn('Image URL is empty, falling back to color background');
          useColorFallback = true;
        } else {
          // Validate image URL
          const url = new URL(sanitizedCustomization.background.imageUrl);
          if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            // Invalid protocol
            console.warn('Invalid image URL protocol, falling back to color background');
            useColorFallback = true;
          }
        }
      } catch (error) {
        // Malformed URL
        console.warn('Malformed image URL, falling back to color background');
        useColorFallback = true;
      }
      
      // Apply fallback if needed
      if (useColorFallback && sanitizedCustomization) {
        sanitizedCustomization.background = {
          type: 'color',
          color: '#1a1a2e'
        };
      }
    }
  }
  
  const { data, error } = await supabase
    .from(TABLES.GAMES)
    .insert([{ 
      mp3_url: mp3Url, 
      midi_data: midiData,
      visual_customization: sanitizedCustomization 
    }])
    .select()
    .single()
  
  if (error) throw error;
  console.log('createGame response data:', data);
  return data;
}

export async function getGame(id: string) {
  try {
    const { data, error } = await supabase
      .from(TABLES.GAMES)
      .select()
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Supabase error in getGame:', error);
      throw new Error(`Failed to retrieve game: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Game not found');
    }
    
    // Validate and sanitize the game data
    if (!data.midi_data || !data.mp3_url) {
      throw new Error('Game data is incomplete');
    }
    
    // Sanitize visual customization if present
    if (data.visual_customization) {
      // Handle image background
      if (data.visual_customization.background.type === 'image') {
        try {
          // Validate image URL
          const url = new URL(data.visual_customization.background.imageUrl || '');
          if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            // Fall back to color background if URL protocol is invalid
            console.warn('Invalid image URL protocol in getGame, falling back to color background');
            data.visual_customization.background.type = 'color';
            data.visual_customization.background.color = '#1a1a2e';
          }
        } catch (error) {
          // Fall back to color background if URL is malformed
          console.warn('Malformed image URL in getGame, falling back to color background');
          data.visual_customization.background.type = 'color';
          data.visual_customization.background.color = '#1a1a2e';
        }
      }
    }
    
    console.log('getGame response data:', data);
    return data;
  } catch (error) {
    console.error('Error in getGame:', error);
    throw error;
  }
} 