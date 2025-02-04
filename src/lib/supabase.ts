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
  midi_url: string
  created_at: string
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  MP3: 'mp3-files',
  MIDI: 'midi-files'
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
  
  // For MIDI files, use base64 encoding
  if (bucket === 'MIDI') {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS[bucket])
      .upload(fileName, base64, {
        contentType: 'text/plain',
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
  
  // For other files, use standard upload
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

export async function createGame(mp3Url: string, midiUrl: string) {
  const { data, error } = await supabase
    .from(TABLES.GAMES)
    .insert([{ mp3_url: mp3Url, midi_url: midiUrl }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function getGame(id: string) {
  const { data, error } = await supabase
    .from(TABLES.GAMES)
    .select()
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
} 