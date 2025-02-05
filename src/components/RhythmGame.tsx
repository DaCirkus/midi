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
  text?: string
}

export default function RhythmGame({ 
  midiData, 
  mp3Url 
}: { 
  midiData: { notes: Array<{ time: number, midi: number }>, tempo: number }, 
  mp3Url: string 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notesRef = useRef<Note[]>([])
  const hitEffectsRef = useRef<HitEffect[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [volume, setVolume] = useState(0.7) // Default volume
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const currentTimeRef = useRef<number>(0)
  const lastHitTimeRef = useRef<{ [key in Direction]?: number }>({})

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
          const height = Math.min(window.innerHeight * 0.9, width * 1.2); // Increased height ratio
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
    // Map any MIDI note to a direction based on modulo 4
    const midiToDirection = (midi: number): Direction => {
      const directions: Direction[] = ['LEFT', 'UP', 'DOWN', 'RIGHT'];
      return directions[midi % 4];
    };

    notesRef.current = midiData.notes
      .map(note => ({
        time: note.time,
        direction: midiToDirection(note.midi),
        y: -100
      }));

    console.log('Raw MIDI Data:', midiData);
    console.log('Generated Notes:', notesRef.current);
  }, [midiData]);

  // Handle input from any source (keyboard or touch)
  const handleInput = useCallback((direction: Direction) => {
    if (!isPlaying || !canvasRef.current) return;
    
    // Check if we're still in grace period (150ms)
    const now = Date.now();
    const lastHitTime = lastHitTimeRef.current[direction] || 0;
    if (now - lastHitTime < 150) return;
    
    const hitZoneOffset = canvasRef.current.height * 0.75;
    const hitY = hitZoneOffset;
    const hitWindow = 50;
    
    // Find notes in the hit window
    const nearbyNotes = notesRef.current.filter(note => 
      note.direction === direction && 
      Math.abs(note.y - hitY) < hitWindow
    );
    
    if (nearbyNotes.length > 0) {
      const closestNote = nearbyNotes.reduce((closest, note) => 
        Math.abs(note.y - hitY) < Math.abs(closest.y - hitY) ? note : closest
      );
      
      const yDiff = Math.abs(closestNote.y - hitY);
      let points = 0;
      let hitText = '';
      
      if (yDiff < 20) {
        points = 100;
        hitText = 'PERFECT!';
      } else if (yDiff < 35) {
        points = 50;
        hitText = 'GOOD!';
      } else {
        points = -10;
        hitText = 'MISS';
      }
      
      // Update last hit time
      lastHitTimeRef.current[direction] = now;
      
      setScore(prev => Math.max(0, prev + points));
      notesRef.current = notesRef.current.filter(n => n !== closestNote);
      
      hitEffectsRef.current.push({ 
        direction, 
        startTime: now,
        isMiss: points <= 0,
        text: hitText
      });
    } else {
      // Only show miss if we're not in a grace period
      lastHitTimeRef.current[direction] = now;
      setScore(prev => Math.max(0, prev - 10));
      hitEffectsRef.current.push({ 
        direction, 
        startTime: now,
        isMiss: true,
        text: 'MISS'
      });
    }
  }, [isPlaying]);

  // Draw arrow helper function
  const drawArrow = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, 
    y: number, 
    direction: Direction, 
    glow = false, 
    isMiss = false
  ) => {
    ctx.save();
    ctx.translate(x, y);
    
    if (glow) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = isMiss ? '#ff0000' : '#ffff00';
      ctx.globalAlpha = 0.8;  // Make glow effects more visible
    }

    const size = glow ? 30 : 20;  // Make glow effects bigger
    
    switch(direction) {
      case 'UP':
        ctx.rotate(0);
        break;
      case 'DOWN':
        ctx.rotate(Math.PI);
        break;
      case 'LEFT':
        ctx.rotate(-Math.PI/2);
        break;
      case 'RIGHT':
        ctx.rotate(Math.PI/2);
        break;
    }

    // Draw arrow with thicker outline for better visibility
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, size * 0.5);
    ctx.lineTo(-size * 0.8, size * 0.5);
    ctx.closePath();
    
    // Fill
    ctx.fillStyle = glow ? (isMiss ? '#ff3333' : '#ffff33') : '#ffffff';
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = glow ? (isMiss ? '#ff0000' : '#ffff00') : '#ffffff';
    ctx.lineWidth = glow ? 3 : 2;
    ctx.stroke();

    ctx.restore();
  }, []);

  // Game loop function
  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current) return;

    if (isPlaying) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const currentTime = elapsed / 1000;
      currentTimeRef.current = currentTime;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const speed = 300;
    const hitZoneOffset = canvas.height * 0.75;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw guide lines and hit zones with better visibility
    for (let i = 0; i < 4; i++) {
      const x = canvas.width * (0.3 + i * 0.15);
      const direction = ['LEFT', 'UP', 'DOWN', 'RIGHT'][i] as Direction;
      
      // Guide line
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      
      // Hit zone with better visibility
      const hitY = hitZoneOffset;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x - 25, hitY - 25, 50, 50);
      
      // Hit line
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 25, hitY);
      ctx.lineTo(x + 25, hitY);
      ctx.stroke();

      // Static arrow with glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      drawArrow(ctx, x, hitY, direction, false, false);
      ctx.shadowBlur = 0;
    }
    
    if (isPlaying) {
      // Update and draw notes
      notesRef.current = notesRef.current.filter(note => note.y < canvas.height + 100);
      
      notesRef.current.forEach(note => {
        note.y = (note.time - currentTimeRef.current) * -speed + hitZoneOffset;
        const x = canvas.width * (0.3 + ['LEFT', 'UP', 'DOWN', 'RIGHT'].indexOf(note.direction) * 0.15);
        
        if (note.y > -50 && note.y < canvas.height + 50) {
          // Add slight glow to notes
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#ffffff';
          drawArrow(ctx, x, note.y, note.direction);
          ctx.shadowBlur = 0;
        }
      });
    }

    // Update and draw hit effects with stronger visuals
    hitEffectsRef.current = hitEffectsRef.current.filter(
      effect => Date.now() - effect.startTime < 500
    );

    hitEffectsRef.current.forEach(effect => {
      const x = canvas.width * (0.3 + ['LEFT', 'UP', 'DOWN', 'RIGHT'].indexOf(effect.direction) * 0.15);
      const y = hitZoneOffset;
      const age = Date.now() - effect.startTime;
      const alpha = 1 - (age / 500);
      
      // Draw expanding circle effect
      ctx.beginPath();
      ctx.arc(x, y, (age / 500) * 50, 0, Math.PI * 2);
      ctx.strokeStyle = effect.isMiss ? `rgba(255, 0, 0, ${alpha})` : `rgba(255, 255, 0, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw hit effect
      drawArrow(ctx, x, y, effect.direction, true, effect.isMiss);
      
      // Draw hit text with better visibility
      if (effect.text) {
        ctx.fillStyle = effect.isMiss ? `rgba(255, 50, 50, ${alpha})` : `rgba(255, 255, 50, ${alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = effect.isMiss ? '#ff0000' : '#ffff00';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(effect.text, x, y - 50 - (age / 10));
        ctx.shadowBlur = 0;
      }
    });

    // Always continue the animation
    animationRef.current = window.requestAnimationFrame(gameLoop);
  }, [isPlaying, drawArrow]);

  // Initialize audio
  useEffect(() => {
    if (!mp3Url) return;
    
    const audio = new Audio(mp3Url);
    audio.volume = volume;
    audioRef.current = audio;
    
    // Create audio context
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [mp3Url, volume]);

  // Start the game loop immediately
  useEffect(() => {
    animationRef.current = window.requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [gameLoop]);

  // Remove the game loop start from handleStart
  const handleStart = useCallback(async () => {
    if (!audioRef.current || !audioContextRef.current) return;
    
    try {
      // Resume audio context
      await audioContextRef.current.resume();
      
      setIsPlaying(true);
      startTimeRef.current = 0;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  }, []);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const direction = ARROW_KEYS[e.keyCode as keyof typeof ARROW_KEYS];
    if (!direction) return;
    
    e.preventDefault();
    
    // Always show visual feedback immediately when a key is pressed
    hitEffectsRef.current.push({ 
      direction, 
      startTime: Date.now(),
      isMiss: true
    });
    
    // Only process game logic if we're playing
    if (isPlaying) {
      handleInput(direction);
    }
  }, [isPlaying, handleInput]);

  // Add keyboard event listeners
  useEffect(() => {
    const handleKeyDownWrapper = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };
    
    window.addEventListener('keydown', handleKeyDownWrapper);
    return () => window.removeEventListener('keydown', handleKeyDownWrapper);
  }, [handleKeyDown]);

  // Add these functions near the other handlers
  const getLaneFromX = useCallback((x: number, canvas: HTMLCanvasElement): Direction | null => {
    const relativeX = x / canvas.width;
    
    // Each lane is centered at these positions (30%, 45%, 60%, 75%)
    // and has a width of 50px
    const laneWidth = 50 / canvas.width;
    
    // Calculate exact boundaries for each lane
    const leftLane = { center: 0.30, min: 0.30 - laneWidth/2, max: 0.30 + laneWidth/2 };
    const upLane = { center: 0.45, min: 0.45 - laneWidth/2, max: 0.45 + laneWidth/2 };
    const downLane = { center: 0.60, min: 0.60 - laneWidth/2, max: 0.60 + laneWidth/2 };
    const rightLane = { center: 0.75, min: 0.75 - laneWidth/2, max: 0.75 + laneWidth/2 };
    
    // Check which lane was clicked using exact boundaries
    if (relativeX >= leftLane.min && relativeX < leftLane.max) return 'LEFT';
    if (relativeX >= upLane.min && relativeX < upLane.max) return 'UP';
    if (relativeX >= downLane.min && relativeX < downLane.max) return 'DOWN';
    if (relativeX >= rightLane.min && relativeX < rightLane.max) return 'RIGHT';
    return null;
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Get click/touch position
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
    
    const direction = getLaneFromX(x, canvas);
    if (!direction) return;

    // Show visual feedback
    hitEffectsRef.current.push({ 
      direction, 
      startTime: Date.now(),
      isMiss: true
    });
    
    // Process game input if playing
    if (isPlaying) {
      handleInput(direction);
    }
  }, [isPlaying, handleInput, getLaneFromX]);

  return (
    <div className="relative w-full aspect-video bg-black/30 rounded-2xl overflow-hidden">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />
      
      {/* Score Overlay */}
      {isPlaying && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl
              text-center shadow-lg border border-white/10">
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 
                bg-clip-text text-transparent">
                Score: {score}
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="absolute top-4 right-4">
            <div className="bg-black/60 backdrop-blur-md p-2 rounded-xl
              flex items-center gap-2 border border-white/10">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 h-1 accent-purple-500"
              />
              <span className="text-lg opacity-80">🔊</span>
            </div>
          </div>

          {/* Controls help */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl
              flex items-center gap-4 border border-white/10">
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">←</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↑</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↓</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">→</kbd>
              <span className="mx-2 text-white/70">or</span>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">A</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">W</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">S</kbd>
              <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">D</kbd>
              <span className="mx-2 text-white/70">or</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg">tap</span>
            </div>
          </div>
        </>
      )}

      {/* Start Button */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm 
          flex flex-col items-center justify-center gap-4">
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 
              text-white rounded-xl text-2xl font-bold 
              hover:from-purple-600 hover:to-pink-600 transition-all duration-300
              shadow-lg hover:shadow-purple-500/20 hover:scale-105 transform"
          >
            Start Game
          </button>
          <h2 className="text-3xl font-bold text-white">
            Ready to Play?
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">←</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↑</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">↓</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">→</kbd>
            <span className="mx-2 text-white/70">or</span>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">A</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">W</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">S</kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded-lg">D</kbd>
            <span className="mx-2 text-white/70">or</span>
            <span className="px-3 py-1.5 bg-white/10 rounded-lg">tap</span>
          </div>
        </div>
      )}
    </div>
  );
} 