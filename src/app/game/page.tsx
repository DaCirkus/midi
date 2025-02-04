'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import RhythmGame from '@/components/RhythmGame'
import { useEffect, useState } from 'react'
import { getGame, type GameData } from '@/lib/supabase'

function GameContent() {
  const searchParams = useSearchParams()
  const gameId = searchParams.get('id')
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadGame() {
      if (!gameId) {
        setLoading(false)
        return
      }
      try {
        const data = await getGame(gameId)
        setGameData(data)
      } catch (error) {
        console.error('Failed to load game:', error)
      } finally {
        setLoading(false)
      }
    }
    loadGame()
  }, [gameId])

  if (loading) return <div>Loading game...</div>
  if (!gameId) return <div>No game ID provided</div>
  if (!gameData) return <div>Game not found</div>

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Rhythm Game</h1>
      <RhythmGame 
        midiData={gameData.midi_data}
        mp3Url={gameData.mp3_url}
      />
      <div className="mt-4 text-sm text-gray-500">
        Use arrow keys to hit the notes as they reach the bottom of the screen
      </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GameContent />
    </Suspense>
  )
} 