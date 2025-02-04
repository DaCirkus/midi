'use client'

import { useEffect, useRef, useState } from 'react'
import { Midi } from '@tonejs/midi'

const ARROW_KEYS = {
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN'
} as const

type Direction = typeof ARROW_KEYS[keyof typeof ARROW_KEYS]

interface Note {
  time: number
  direction: Direction
  y: number
}

export default function RhythmGame({ midiUrl, mp3Url }: { midiUrl: string, mp3Url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>(0)

  // Load MIDI data
  useEffect(() => {
    async function loadMidi() {
      const response = await fetch(midiUrl)
      const arrayBuffer = await response.arrayBuffer()
      const midi = new Midi(new Uint8Array(arrayBuffer))
      
      const midiNotes = midi.tracks[0].notes.map(note => ({
        time: note.time,
        direction: ARROW_KEYS[note.midi as keyof typeof ARROW_KEYS],
        y: -100 // Start above the canvas
      }))
      
      setNotes(midiNotes)
    }
    loadMidi()
  }, [midiUrl])

  // Handle keyboard input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isPlaying) return
      
      const currentTime = (Date.now() - startTimeRef.current) / 1000
      const hitWindow = 0.15 // 150ms window for hitting notes
      
      // Find the closest note for this key
      const noteIndex = notes.findIndex(note => 
        ARROW_KEYS[e.keyCode as keyof typeof ARROW_KEYS] === note.direction &&
        Math.abs(note.time - currentTime) < hitWindow
      )
      
      if (noteIndex !== -1) {
        setScore(prev => prev + 100)
        setNotes(prev => prev.filter((_, i) => i !== noteIndex))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, notes])

  // Game loop
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const speed = 200 // pixels per second

    function drawArrow(x: number, y: number, direction: Direction) {
      ctx.save()
      ctx.translate(x, y)
      
      switch(direction) {
        case 'UP':
          ctx.rotate(0)
          break
        case 'DOWN':
          ctx.rotate(Math.PI)
          break
        case 'LEFT':
          ctx.rotate(-Math.PI/2)
          break
        case 'RIGHT':
          ctx.rotate(Math.PI/2)
          break
      }

      ctx.beginPath()
      ctx.moveTo(0, -15)
      ctx.lineTo(10, 0)
      ctx.lineTo(-10, 0)
      ctx.closePath()
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()
    }

    function gameLoop(timestamp: number) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const currentTime = elapsed / 1000

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw target lines
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        const x = canvas.width * (0.3 + i * 0.15)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Update and draw notes
      setNotes(prev => prev.map(note => ({
        ...note,
        y: ((note.time - currentTime) * speed) + canvas.height - 50
      })))

      notes.forEach(note => {
        const x = canvas.width * (0.3 + ['LEFT', 'UP', 'DOWN', 'RIGHT'].indexOf(note.direction) * 0.15)
        drawArrow(x, note.y, note.direction)
      })

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    animationRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, notes])

  const handleStart = () => {
    setIsPlaying(true)
    setScore(0)
    startTimeRef.current = 0
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="bg-gray-900 rounded-lg"
      />
      <audio ref={audioRef} src={mp3Url} />
      
      <div className="absolute top-4 right-4 bg-black/50 p-4 rounded">
        Score: {score}
      </div>
      
      {!isPlaying && (
        <button
          onClick={handleStart}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            px-8 py-4 bg-purple-500 text-white rounded-lg text-xl font-bold
            hover:bg-purple-600 transition-colors"
        >
          Start Game
        </button>
      )}
    </div>
  )
} 