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

// Helper functions
export async function uploadFile(file: File, bucket: keyof typeof STORAGE_BUCKETS) {
  const fileName = `${Date.now()}-${file.name}`
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .upload(fileName, file)
  
  if (error) throw error
  
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