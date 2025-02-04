'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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

interface HitEffect {
  direction: Direction
  startTime: number
}

export default function RhythmGame({ 
  midiData, 
  mp3Url 
}: { 
  midiData: { notes: Array<{ time: number, midi: number }>, tempo: number }, 
  mp3Url: string 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Add resize handler
  useEffect(() => {
    function handleResize() {
      if (canvasRef.current) {
        // Make canvas fill container while maintaining aspect ratio
        const container = canvasRef.current.parentElement;
        if (container) {
          const width = container.clientWidth;
          const height = Math.min(window.innerHeight * 0.7, width * 0.75); // 4:3 aspect ratio
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
      }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial resize
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load MIDI data
  useEffect(() => {
    const midiNotes = midiData.notes.map(note => ({
      time: note.time,
      direction: ARROW_KEYS[note.midi as keyof typeof ARROW_KEYS],
      y: -100 // Start above the canvas
    }));
    
    setNotes(midiNotes);
  }, [midiData]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPlaying) return;
    
    const currentTime = (Date.now() - startTimeRef.current) / 1000;
    const hitWindow = 0.15; // 150ms window for hitting notes
    
    const direction = ARROW_KEYS[e.keyCode as keyof typeof ARROW_KEYS];
    
    // Find the closest note for this key
    const noteIndex = notes.findIndex(note => 
      note.direction === direction &&
      Math.abs(note.time - currentTime) < hitWindow
    );
    
    if (noteIndex !== -1) {
      setScore(prev => prev + 100);
      setNotes(prev => prev.filter((_, i) => i !== noteIndex));
      // Add hit effect
      setHitEffects(prev => [...prev, { direction, startTime: Date.now() }]);
    }
  }, [isPlaying, notes]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const speed = 200 // pixels per second

    function drawArrow(x: number, y: number, direction: Direction, glow = false) {
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

      if (glow) {
        ctx.shadowBlur = 20
        ctx.shadowColor = '#fff'
      }

      ctx.beginPath()
      ctx.moveTo(0, -15)
      ctx.lineTo(10, 0)
      ctx.lineTo(-10, 0)
      ctx.closePath()
      ctx.fillStyle = glow ? '#ffff00' : '#fff'
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
      
      // Draw target lines and hit zones
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        const x = canvas.width * (0.3 + i * 0.15)
        const direction = ['LEFT', 'UP', 'DOWN', 'RIGHT'][i] as Direction
        
        // Vertical guide line
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
        
        // Hit zone
        const hitY = canvas.height - 50
        ctx.fillStyle = isPlaying ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'
        ctx.fillRect(x - 20, hitY - 20, 40, 40)
        
        // Hit line
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x - 20, hitY)
        ctx.lineTo(x + 20, hitY)
        ctx.stroke()

        // Draw hit effects
        const effect = hitEffects.find(e => e.direction === direction);
        if (effect) {
          const age = Date.now() - effect.startTime;
          if (age < 100) { // Effect lasts 100ms
            drawArrow(x, hitY, direction, true);
          }
        }
      }
      
      // Clean up old hit effects
      setHitEffects(prev => prev.filter(e => Date.now() - e.startTime < 100));
      
      // Reset style for notes
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2

      // Update and draw notes
      setNotes(prev => prev.map(note => ({
        ...note,
        y: 50 + ((currentTime - note.time) * speed) // Notes fall from top
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
  }, [isPlaying, notes, hitEffects])

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
    <div className="relative w-full max-w-4xl mx-auto">
      <canvas
        ref={canvasRef}
        className="bg-gray-900 rounded-lg w-full touch-none"
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

      {/* Mobile controls */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 flex justify-around bg-black/50">
        <button 
          onTouchStart={() => handleKeyDown({ keyCode: 37 } as KeyboardEvent)} 
          className="w-16 h-16 bg-white/20 rounded-full"
        >
          ←
        </button>
        <button 
          onTouchStart={() => handleKeyDown({ keyCode: 38 } as KeyboardEvent)} 
          className="w-16 h-16 bg-white/20 rounded-full"
        >
          ↑
        </button>
        <button 
          onTouchStart={() => handleKeyDown({ keyCode: 40 } as KeyboardEvent)} 
          className="w-16 h-16 bg-white/20 rounded-full"
        >
          ↓
        </button>
        <button 
          onTouchStart={() => handleKeyDown({ keyCode: 39 } as KeyboardEvent)} 
          className="w-16 h-16 bg-white/20 rounded-full"
        >
          →
        </button>
      </div>
    </div>
  )
} 