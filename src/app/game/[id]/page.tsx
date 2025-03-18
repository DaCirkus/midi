'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import RhythmGame from '@/components/RhythmGame'
import { useEffect, useState } from 'react'
import { getGame, type GameData } from '@/lib/supabase'

function LoadingState() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xl font-medium text-primary-200">Loading game...</p>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 text-4xl">⚠️</div>
        <h2 className="text-2xl font-bold text-red-400 mb-4">{message}</h2>
      </div>
    </div>
  )
}

function GameContent() {
  const params = useParams()
  const gameId = params.id as string
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGame() {
      if (!gameId) {
        setLoading(false)
        return
      }
      try {
        const data = await getGame(gameId)
        
        // Validate required game data
        if (!data) {
          throw new Error('Game not found');
        }
        
        if (!data.midi_data || !data.mp3_url) {
          throw new Error('Game data is incomplete');
        }
        
        // Validate MIDI data structure
        if (!Array.isArray(data.midi_data.notes) || !data.midi_data.tempo) {
          throw new Error('Invalid MIDI data structure');
        }
        
        // Validate visual customization if present
        if (data.visual_customization) {
          // If using image background, ensure the URL is valid
          if (data.visual_customization.background.type === 'image') {
            try {
              new URL(data.visual_customization.background.imageUrl || '');
            } catch (e) {
              // Fix the data by changing to a color background
              console.warn('Invalid image URL in game data, falling back to color background');
              data.visual_customization.background.type = 'color';
              data.visual_customization.background.color = '#1a1a2e';
            }
          }
        }
        
        setGameData(data)
      } catch (error) {
        console.error('Failed to load game:', error)
        setError(error instanceof Error ? error.message : 'Failed to load game')
      } finally {
        setLoading(false)
      }
    }
    loadGame()
  }, [gameId])

  if (loading) return <LoadingState />
  if (!gameId) return <ErrorState message="No game ID provided" />
  if (error) return <ErrorState message={error} />
  if (!gameData) return <ErrorState message="Game not found" />

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* Game container */}
      <div className="w-full max-w-4xl relative rounded-3xl overflow-hidden border border-white/10
        shadow-[0_0_50px_-12px] shadow-primary/30">
        <RhythmGame 
          midiData={gameData.midi_data}
          mp3Url={gameData.mp3_url}
          visualCustomization={gameData.visual_customization}
        />
      </div>

      {/* Controls help */}
      <div className="w-full max-w-4xl mt-8 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10
        text-center text-white/70">
        <p className="text-lg mb-2">Controls</p>
        <div className="flex justify-center gap-4">
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">←</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↑</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↓</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">→</kbd>
          <span className="mx-4">or</span>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">A</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">W</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">S</kbd>
          <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">D</kbd>
        </div>
      </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <GameContent />
    </Suspense>
  )
} 