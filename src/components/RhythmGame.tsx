'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Midi } from '@tonejs/midi'

const ARROW_KEYS = {
  37: 'LEFT',  // Left Arrow
  38: 'UP',    // Up Arrow
  39: 'RIGHT', // Right Arrow
  40: 'DOWN',  // Down Arrow
  65: 'LEFT',  // A
  87: 'UP',    // W
  68: 'RIGHT', // D
  83: 'DOWN'   // S
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
  isMiss?: boolean
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
  const [volume, setVolume] = useState(0.7) // Default volume
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const currentTimeRef = useRef<number>(0)

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
    
    const direction = ARROW_KEYS[e.keyCode as keyof typeof ARROW_KEYS];
    if (!direction) return;
    
    handleInput(direction);
  }, [isPlaying, notes]);

  // Handle input from any source (keyboard or touch)
  const handleInput = useCallback((direction: Direction) => {
    if (!isPlaying) return;
    
    // Find notes in the correct lane that are near the hit zone
    const hitY = canvasRef.current ? canvasRef.current.height - 50 : 0;
    const hitWindow = 50; // pixels
    
    const nearbyNotes = notes.filter(note => 
      note.direction === direction && 
      Math.abs(note.y - hitY) < hitWindow
    );
    
    if (nearbyNotes.length > 0) {
      // Find the closest note
      const closestNote = nearbyNotes.reduce((closest, note) => 
        Math.abs(note.y - hitY) < Math.abs(closest.y - hitY) ? note : closest
      );
      
      const yDiff = Math.abs(closestNote.y - hitY);
      console.log('Hit attempt:', direction, 'y-diff:', yDiff);
      
      // Perfect hit: within 20 pixels
      // Good hit: within 35 pixels
      // Miss: within 50 pixels
      let points = 0;
      if (yDiff < 20) {
        points = 100; // Perfect
      } else if (yDiff < 35) {
        points = 50; // Good
      } else {
        points = -5; // Miss penalty
      }
      
      setScore(prev => Math.max(0, prev + points)); // Prevent negative score
      setNotes(prev => prev.filter(n => n !== closestNote));
      
      // Add hit or miss effect
      setHitEffects(prev => [...prev, { 
        direction, 
        startTime: Date.now(),
        isMiss: points <= 0
      }]);
    } else {
      // Complete miss - no notes nearby
      setScore(prev => Math.max(0, prev - 5)); // Prevent negative score
      setHitEffects(prev => [...prev, { 
        direction, 
        startTime: Date.now(),
        isMiss: true
      }]);
    }
  }, [isPlaying, notes]);

  // Add keyboard event listeners
  useEffect(() => {
    if (!isPlaying) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.keyCode in ARROW_KEYS) {
        e.preventDefault();
        handleKeyDown(e);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, handleKeyDown]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const speed = 200 // pixels per second

    function drawArrow(x: number, y: number, direction: Direction, glow = false, isMiss = false) {
      ctx.save()
      ctx.translate(x, y)
      
      if (glow) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = isMiss ? '#ff0000' : '#ffff00';
      }

      // Make arrows bigger
      const size = glow ? 25 : 20;
      
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
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.8, size * 0.5)
      ctx.lineTo(-size * 0.8, size * 0.5)
      ctx.closePath()
      ctx.fillStyle = glow ? (isMiss ? '#ff0000' : '#ffff00') : '#fff'
      ctx.fill()

      if (glow) {
        ctx.strokeStyle = isMiss ? '#ff0000' : '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.restore()
    }

    function gameLoop(timestamp: number) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const currentTime = elapsed / 1000
      currentTimeRef.current = currentTime; // Update current time ref

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
            drawArrow(x, hitY, direction, true, effect.isMiss);
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
    <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="bg-gray-900 rounded-lg w-full"
      />
      <audio ref={audioRef} src={mp3Url} />
      
      {/* Game UI Container - centered in play area */}
      <div className="absolute inset-0 flex flex-col items-center">
        {/* Score and Volume Controls */}
        <div className="bg-black/50 p-6 rounded-xl space-y-6 mt-8 w-[400px] text-center">
          <div className="text-2xl font-bold">Score: {score}</div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-2xl">🔈</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-64 h-2"
            />
            <span className="text-2xl">🔊</span>
          </div>
          <div className="text-lg text-gray-300">
            Use arrow keys or WASD to play
          </div>
        </div>
      </div>
      
      {!isPlaying && (
        <button
          onClick={handleStart}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            px-12 py-6 bg-purple-500 text-white rounded-xl text-2xl font-bold
            hover:bg-purple-600 transition-colors"
        >
          Start Game
        </button>
      )}

      {/* Mobile touch controls - much bigger buttons */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-black/50">
        <div className="container mx-auto px-4 pb-8 pt-4">
          {/* Buttons Container */}
          <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
            {['LEFT', 'UP', 'DOWN', 'RIGHT'].map((direction) => (
              <button
                key={direction}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleInput(direction as Direction);
                }}
                onClick={() => handleInput(direction as Direction)}
                className="aspect-square bg-white/20 rounded-3xl flex items-center justify-center
                  text-8xl active:bg-white/40 transition-colors min-h-[120px]"
              >
                {direction === 'LEFT' && '←'}
                {direction === 'UP' && '↑'}
                {direction === 'DOWN' && '↓'}
                {direction === 'RIGHT' && '→'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 