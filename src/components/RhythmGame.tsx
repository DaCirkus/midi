'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Midi } from '@tonejs/midi'
import { GameData } from '@/lib/supabase'

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
  mp3Url,
  visualCustomization
}: { 
  midiData: { notes: Array<{ time: number, midi: number }>, tempo: number }, 
  mp3Url: string,
  visualCustomization?: GameData['visual_customization']
}) {
  console.log('RhythmGame visualCustomization:', visualCustomization);

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notesRef = useRef<Note[]>([])
  const hitEffectsRef = useRef<HitEffect[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [volume, setVolume] = useState(0.7) // Default volume
  const [countdown, setCountdown] = useState<number | null>(null) // Add countdown state
  const [renderError, setRenderError] = useState<string | null>(null) // Add error state
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const currentTimeRef = useRef<number>(0)
  const lastHitTimeRef = useRef<{ [key in Direction]?: number }>({})
  const [error, setError] = useState<string | null>(null)

  // Default customization values if none provided
  const customization = visualCustomization || {
    background: {
      type: 'color',
      color: '#1a1a2e',
    },
    notes: {
      shape: 'arrow',
      size: 1,
      colors: {
        LEFT: '#ffffff',
        RIGHT: '#ffffff',
        UP: '#ffffff',
        DOWN: '#ffffff',
      },
      opacity: 1,
      glow: true,
      arrowColor: 'black',
    },
    hitEffects: {
      style: 'explosion',
      color: '#ffffff',
      size: 1,
      duration: 0.5,
    },
    missEffects: {
      style: 'shake',
      color: '#ff0000',
    },
    lanes: {
      color: '#ffffff',
      width: 1,
      glow: true,
    },
    ui: {
      theme: 'default',
      fontFamily: 'sans-serif',
    },
  }

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle image background
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (container && customization.background.type === 'image' && customization.background.imageUrl) {
      try {
        // Validate URL before applying
        const url = new URL(customization.background.imageUrl);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          console.log('Applying background image:', customization.background.imageUrl);
          
          // First set a loading state with a color background
          container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          container.style.backgroundImage = 'none';
          
          // Create an image element to test loading
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            // Successfully loaded the image
            console.log('Background image loaded successfully');
            container.style.backgroundImage = `url(${customization.background.imageUrl})`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            // Add a semi-transparent overlay to ensure game elements are visible
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
          };
          
          img.onerror = (e) => {
            // Failed to load the image
            console.error('Failed to load background image:', e);
            // Fall back to a color background
            container.style.backgroundImage = 'none';
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          };
          
          // Start loading the image
          img.src = customization.background.imageUrl;
        } else {
          // Invalid protocol, fall back to color
          console.warn('Invalid image URL protocol, falling back to color background');
          container.style.backgroundImage = 'none';
          container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        }
      } catch (error) {
        // Invalid URL, fall back to color
        console.warn('Invalid image URL, falling back to color background', error);
        container.style.backgroundImage = 'none';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      }
    } else if (container) {
      // Use color background if not using image type
      if (customization.background.type === 'color' && customization.background.color) {
        container.style.backgroundImage = 'none';
        container.style.backgroundColor = customization.background.color;
      } else {
        // Default fallback
        container.style.backgroundImage = 'none';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      }
    }
  }, [customization.background]);

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
      // This array order must match the visual left-to-right order in lanePositions
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
        startTime: currentTimeRef.current,
        isMiss: points <= 0,
        text: hitText
      });
    } else {
      // Only show miss if we're not in a grace period
      lastHitTimeRef.current[direction] = now;
      setScore(prev => Math.max(0, prev - 10));
      hitEffectsRef.current.push({ 
        direction, 
        startTime: currentTimeRef.current,
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
      ctx.shadowColor = isMiss 
        ? (customization.missEffects.color || '#ff0000') 
        : (customization.hitEffects.color || '#ffff00');
      ctx.globalAlpha = 0.8;  // Make glow effects more visible
    }

    const baseSize = 20;
    const size = glow 
      ? baseSize * 1.5 
      : baseSize * customization.notes.size;  // Apply size customization
    
    // No rotation needed - we'll draw each arrow pointing in its correct direction
    
    // Choose note shape based on customization
    const noteShape = customization.notes.shape || 'arrow';
    
    // First draw the shape
    if (noteShape === 'arrow') {
      // Draw arrow with thicker outline for better visibility
      ctx.beginPath();
      
      // Draw different arrow shapes based on direction
      if (direction === 'UP') {
        // Arrow pointing up
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.8, size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.5);
      } else if (direction === 'DOWN') {
        // Arrow pointing down
        ctx.moveTo(0, size);
        ctx.lineTo(size * 0.8, -size * 0.5);
        ctx.lineTo(-size * 0.8, -size * 0.5);
      } else if (direction === 'LEFT') {
        // Arrow pointing left
        ctx.moveTo(-size, 0);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.5, -size * 0.8);
      } else if (direction === 'RIGHT') {
        // Arrow pointing right
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.lineTo(-size * 0.5, -size * 0.8);
      }
      
      ctx.closePath();
      
      // Fill with customized color
      if (glow) {
        ctx.fillStyle = isMiss 
          ? (customization.missEffects.color || '#ff3333') 
          : (customization.hitEffects.color || '#ffff33');
      } else {
        ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
        ctx.globalAlpha = customization.notes.opacity;
      }
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = glow 
        ? (isMiss ? (customization.missEffects.color || '#ff0000') : (customization.hitEffects.color || '#ffff00')) 
        : '#ffffff';
      ctx.lineWidth = glow ? 3 : 2;
      ctx.stroke();
    } else if (noteShape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
      ctx.closePath();
      
      // Fill with customized color
      if (glow) {
        ctx.fillStyle = isMiss 
          ? (customization.missEffects.color || '#ff3333') 
          : (customization.hitEffects.color || '#ffff33');
      } else {
        ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
        ctx.globalAlpha = customization.notes.opacity;
      }
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = glow 
        ? (isMiss ? (customization.missEffects.color || '#ff0000') : (customization.hitEffects.color || '#ffff00')) 
        : '#ffffff';
      ctx.lineWidth = glow ? 3 : 2;
      ctx.stroke();
      
      // Add direction indicator inside the circle
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'square') {
      ctx.beginPath();
      ctx.rect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4);
      ctx.closePath();
      
      // Fill with customized color
      if (glow) {
        ctx.fillStyle = isMiss 
          ? (customization.missEffects.color || '#ff3333') 
          : (customization.hitEffects.color || '#ffff33');
      } else {
        ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
        ctx.globalAlpha = customization.notes.opacity;
      }
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = glow 
        ? (isMiss ? (customization.missEffects.color || '#ff0000') : (customization.hitEffects.color || '#ffff00')) 
        : '#ffffff';
      ctx.lineWidth = glow ? 3 : 2;
      ctx.stroke();
      
      // Add direction indicator inside the square
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'rectangle') {
      // Draw rectangle (wider than tall)
      ctx.beginPath();
      ctx.rect(-size * 0.9, -size * 0.6, size * 1.8, size * 1.2);
      ctx.closePath();
      
      // Fill with customized color
      if (glow) {
        ctx.fillStyle = isMiss 
          ? (customization.missEffects.color || '#ff3333') 
          : (customization.hitEffects.color || '#ffff33');
      } else {
        ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
        ctx.globalAlpha = customization.notes.opacity;
      }
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = glow 
        ? (isMiss ? (customization.missEffects.color || '#ff0000') : (customization.hitEffects.color || '#ffff00')) 
        : '#ffffff';
      ctx.lineWidth = glow ? 3 : 2;
      ctx.stroke();
      
      // Add direction indicator on the rectangle
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'guitar_pick') {
      // Draw guitar pick shape
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size, -size * 0.5, size * 0.8, size * 0.5);
      ctx.quadraticCurveTo(0, size * 1.2, -size * 0.8, size * 0.5);
      ctx.quadraticCurveTo(-size, -size * 0.5, 0, -size);
      ctx.closePath();
      
      // Fill with customized color
      if (glow) {
        ctx.fillStyle = isMiss 
          ? (customization.missEffects.color || '#ff3333') 
          : (customization.hitEffects.color || '#ffff33');
      } else {
        ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
        ctx.globalAlpha = customization.notes.opacity;
      }
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = glow 
        ? (isMiss ? (customization.missEffects.color || '#ff0000') : (customization.hitEffects.color || '#ffff00')) 
        : '#ffffff';
      ctx.lineWidth = glow ? 3 : 2;
      ctx.stroke();
      
      // Add direction indicator inside the guitar pick
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'triangle') {
      // Draw triangle shape
      ctx.beginPath();
      
      if (direction === 'UP') {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.8, size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.5);
      } else if (direction === 'DOWN') {
        ctx.moveTo(0, size);
        ctx.lineTo(size * 0.8, -size * 0.5);
        ctx.lineTo(-size * 0.8, -size * 0.5);
      } else if (direction === 'LEFT') {
        ctx.moveTo(-size, 0);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.5, -size * 0.8);
      } else { // RIGHT
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.lineTo(-size * 0.5, -size * 0.8);
      }
      
      ctx.closePath();
      
      // Fill with customized color
      ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add direction indicator inside the triangle
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'diamond') {
      // Draw diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      
      // Fill with customized color
      ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add direction indicator inside the diamond
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    } else if (noteShape === 'star') {
      // Draw a proper star shape
      ctx.beginPath();
      
      const outerRadius = size * 0.8;
      const innerRadius = size * 0.4;
      const spikes = 5;
      const rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      
      for (let i = 0; i < spikes; i++) {
        const x1 = Math.cos(rot + i * step * 2) * outerRadius;
        const y1 = Math.sin(rot + i * step * 2) * outerRadius;
        ctx.lineTo(x1, y1);
        const x2 = Math.cos(rot + i * step * 2 + step) * innerRadius;
        const y2 = Math.sin(rot + i * step * 2 + step) * innerRadius;
        ctx.lineTo(x2, y2);
      }
      
      ctx.closePath();
      
      // Fill with customized color
      ctx.fillStyle = customization.notes.colors[direction] || '#ffffff';
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add direction indicator inside the star
      ctx.fillStyle = glow ? '#000000' : (customization.notes.arrowColor === 'white' ? '#ffffff' : '#000000');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${size * 0.9}px sans-serif`;
      ctx.fillText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
      
      // Add outline to text for better visibility - use opposite color of fill
      ctx.strokeStyle = customization.notes.arrowColor === 'white' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeText(
        direction === 'LEFT' ? '←' : 
        direction === 'UP' ? '↑' : 
        direction === 'DOWN' ? '↓' : '→', 
        0, 0
      );
    }

    ctx.restore();
  }, [customization]);

  // Game loop function
  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current) return;

    // Only start the game timer if we're playing and not in countdown
    if (isPlaying && countdown === null) {
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
    
    // Call the draw function to handle background and clearing
    draw();
    
    // Define lane positions for note rendering
    // This order must match the directions array in midiToDirection
    const lanePositions: Record<Direction, number> = {
      'LEFT': canvas.width * 0.3,
      'UP': canvas.width * 0.45,
      'DOWN': canvas.width * 0.6,
      'RIGHT': canvas.width * 0.75
    };
    
    // Only update and draw notes if we're playing and not in countdown
    if (isPlaying && countdown === null) {
      // Update and draw notes
      notesRef.current = notesRef.current.filter(note => note.y < canvas.height + 100);
      
      notesRef.current.forEach(note => {
        note.y = (note.time - currentTimeRef.current) * -speed + hitZoneOffset;
        const x = lanePositions[note.direction];
        
        if (note.y > -50 && note.y < canvas.height + 50) {
          // Add glow to notes based on customization
          if (customization.notes.glow) {
            ctx.shadowBlur = 5 * customization.notes.size;
            ctx.shadowColor = customization.notes.colors[note.direction] || '#ffffff';
          }
          drawArrow(ctx, x, note.y, note.direction);
          ctx.shadowBlur = 0;
        }
      });
    }

    // Always continue the animation
    animationRef.current = window.requestAnimationFrame(gameLoop);
  }, [isPlaying, drawArrow, customization, score, countdown]);

  // Initialize audio with user gesture awareness
  useEffect(() => {
    if (!mp3Url) return;
    
    const audio = new Audio(mp3Url);
    audio.volume = volume;
    audio.preload = 'auto'; // Preload the audio
    
    // Add event listeners to help debug audio issues
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio can play through without buffering');
    });
    
    audio.addEventListener('play', () => {
      console.log('Audio playback started');
    });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
    
    audioRef.current = audio;
    
    // Create audio context - but don't resume until user gesture
    let audioContext: AudioContext;
    try {
      // Modern AudioContext usage with fallbacks for older browsers
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      
      // Log the audio context state
      console.log('Initial AudioContext state:', audioContext.state);
      
      audioContextRef.current = audioContext;
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
    }

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
    if (!audioRef.current) return;
    
    try {
      // Important: This must be triggered directly from a user gesture (like a click handler)
      // Resume audio context if it exists and is suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('Resuming AudioContext from user gesture');
        await audioContextRef.current.resume();
      }
      
      // Start the countdown from 3 instead of 5
      setCountdown(3);
      
      // Create a countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            
            // Start the game when countdown reaches 0
            setIsPlaying(true);
            startTimeRef.current = 0;
            
            // Play the audio with user gesture handling
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              
              // Use both play() methods for maximum compatibility
              const playPromise = audioRef.current.play();
              
              // Modern browsers return a promise from play()
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  console.log('Audio playback started successfully');
                }).catch(error => {
                  console.error('Failed to play audio:', error);
                  
                  // On autoplay failure, show UI to let user manually start audio
                  setError('Please tap anywhere to start audio playback');
                  
                  // Add a one-time click handler to the document to start audio
                  const handleDocumentClick = () => {
                    if (audioRef.current) {
                      audioRef.current.play().catch(e => console.error('Second play attempt failed:', e));
                    }
                    document.removeEventListener('click', handleDocumentClick);
                  };
                  document.addEventListener('click', handleDocumentClick);
                });
              }
            }
            
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      // User interaction is happening here, use it to unlock audio in Safari/iOS
      if (audioRef.current) {
        // A short silent sound to unlock audio on Safari
        const silentPlay = () => {
          audioRef.current!.volume = 0;
          audioRef.current!.play().then(() => {
            audioRef.current!.pause();
            audioRef.current!.volume = volume;
            console.log('Silent play successful - audio unlocked');
          }).catch(e => {
            console.log('Silent play failed, but may still have unlocked audio:', e);
          });
        };
        silentPlay();
      }
      
    } catch (error) {
      console.error('Failed to start game:', error);
      setError('Failed to start game. Please refresh and try again.');
    }
  }, [volume]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const direction = ARROW_KEYS[e.keyCode as keyof typeof ARROW_KEYS];
    if (!direction) return;
    
    e.preventDefault();
    
    // Always show visual feedback immediately when a key is pressed
    // But don't mark it as a miss by default
    hitEffectsRef.current.push({ 
      direction, 
      startTime: currentTimeRef.current
    });
    
    // Only process game logic if we're playing and not in countdown
    if (isPlaying && countdown === null) {
      handleInput(direction);
    }
  }, [isPlaying, handleInput, countdown]);

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

  // Handle canvas click for mobile/touch input
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Get the x position of the click/touch
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    const x = clientX - rect.left;
    const direction = getLaneFromX(x, canvas);
    
    if (!direction) return;
    
    // Show visual feedback
    hitEffectsRef.current.push({ 
      direction, 
      startTime: currentTimeRef.current
    });
    
    // Process game input if playing and not in countdown
    if (isPlaying && countdown === null) {
      handleInput(direction);
    }
  }, [isPlaying, handleInput, getLaneFromX, countdown]);

  // Draw function with customization support
  const draw = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Apply background based on customization
      if (customization.background.type === 'color') {
        ctx.fillStyle = customization.background.color || '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
      } else if (customization.background.type === 'gradient' && customization.background.gradientColors?.length) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        customization.background.gradientColors.forEach((color, index) => {
          gradient.addColorStop(index / (customization.background.gradientColors?.length || 1), color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      } else if (customization.background.type === 'pattern') {
        // For patterns, we'll draw a solid background first
        ctx.fillStyle = customization.background.color || '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        // Then draw the pattern on top
        const patternColor = customization.background.patternColor || '#ffffff';
        const pattern = customization.background.pattern || 'dots';
        
        ctx.strokeStyle = patternColor;
        ctx.fillStyle = patternColor;
        
        if (pattern === 'dots') {
          const dotSize = 2;
          const spacing = 20;
          ctx.globalAlpha = 0.3;
          
          for (let x = spacing; x < width; x += spacing) {
            for (let y = spacing; y < height; y += spacing) {
              ctx.beginPath();
              ctx.arc(x, y, dotSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          
          ctx.globalAlpha = 1;
        } else if (pattern === 'grid') {
          const spacing = 20;
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = 1;
          
          // Draw vertical lines
          for (let x = spacing; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          
          // Draw horizontal lines
          for (let y = spacing; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1;
        } else if (pattern === 'stripes') {
          const stripeWidth = 10;
          const spacing = 20;
          ctx.globalAlpha = 0.2;
          
          for (let i = -height; i < width + height; i += spacing) {
            ctx.beginPath();
            ctx.lineWidth = stripeWidth;
            ctx.moveTo(i, 0);
            ctx.lineTo(i + height, height);
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1;
        } else if (pattern === 'waves') {
          ctx.globalAlpha = 0.2;
          
          const waveHeight = 20;
          const waveLength = 40;
          
          for (let y = 0; y < height; y += waveHeight * 2) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            
            for (let x = 0; x < width; x += waveLength) {
              ctx.quadraticCurveTo(
                x + waveLength / 2, y + waveHeight,
                x + waveLength, y
              );
            }
            
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1;
        } else if (pattern === 'circuit') {
          ctx.globalAlpha = 0.3;
          
          // Draw large grid
          const largeSpacing = 100;
          ctx.lineWidth = 2;
          
          for (let x = largeSpacing; x < width; x += largeSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          
          for (let y = largeSpacing; y < height; y += largeSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
          
          // Draw small grid
          const smallSpacing = 20;
          ctx.lineWidth = 0.5;
          
          for (let x = smallSpacing; x < width; x += smallSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          
          for (let y = smallSpacing; y < height; y += smallSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1;
        }
      } else if (customization.background.type === 'image') {
        // For image backgrounds, we use a transparent canvas background
        // and let the container's background image show through
        ctx.clearRect(0, 0, width, height);
        
        try {
          // Validate the image URL
          if (customization.background.imageUrl) {
            new URL(customization.background.imageUrl);
          }
          
          // Add a semi-transparent overlay to ensure game elements are visible
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, width, height);
        } catch (error) {
          // If the image URL is invalid, fall back to a solid background
          console.warn('Invalid image URL in draw function, using fallback', error);
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Default background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
      }
      
      // Draw lanes with customization
      const laneWidth = 60 * (customization.lanes.width || 1);
      const laneSpacing = 100;
      const laneY = height - 100;
      const laneHeight = 100;
      const hitZoneOffset = height * 0.75;
      
      // Define lane positions to match gameLoop
      // This order must match the directions array in midiToDirection
      const lanePositions = {
        'LEFT': width * 0.3,
        'UP': width * 0.45,
        'DOWN': width * 0.6,
        'RIGHT': width * 0.75
      };
      
      // Draw lanes
      ctx.fillStyle = customization.lanes.color || '#ffffff';
      ctx.globalAlpha = 0.2;
      
      // Apply lane glow if enabled
      if (customization.lanes.glow) {
        ctx.shadowColor = customization.lanes.color || '#ffffff';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      
      // Draw each lane
      Object.entries(lanePositions).forEach(([direction, x]) => {
        // Draw lane with the same color as the note for this direction
        ctx.fillStyle = customization.notes.colors[direction as Direction] || '#ffffff';
        ctx.globalAlpha = 0.2;
        
        // Apply lane glow if enabled
        if (customization.lanes.glow) {
          ctx.shadowColor = customization.notes.colors[direction as Direction] || '#ffffff';
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }
        
        // Draw lane
        ctx.fillRect(x - laneWidth / 2, 0, laneWidth, height);
        
        // Hit line
        ctx.strokeStyle = customization.notes.colors[direction as Direction] || '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 25, hitZoneOffset);
        ctx.lineTo(x + 25, hitZoneOffset);
        ctx.stroke();
        
        // Draw lane indicator
        if (customization.notes.glow) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = customization.notes.colors[direction as Direction] || '#ffffff';
        }
        drawArrow(ctx, x, hitZoneOffset, direction as Direction, false, false);
      });
      
      // Reset shadow and alpha
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      
      // Draw target zones at bottom of screen
      Object.entries(lanePositions).forEach(([direction, x]) => {
        // Draw direction indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${customization.ui.fontFamily === 'default' ? 'sans-serif' : customization.ui.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Use different shapes based on customization
        if (customization.notes.shape === 'arrow') {
          // Draw proper arrow shape in the target zone
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.beginPath();
          
          if (direction === 'UP') {
            ctx.moveTo(x, laneY - 15);
            ctx.lineTo(x + 15, laneY + 10);
            ctx.lineTo(x - 15, laneY + 10);
          } else if (direction === 'DOWN') {
            ctx.moveTo(x, laneY + 15);
            ctx.lineTo(x + 15, laneY - 10);
            ctx.lineTo(x - 15, laneY - 10);
          } else if (direction === 'LEFT') {
            ctx.moveTo(x - 15, laneY);
            ctx.lineTo(x + 10, laneY - 15);
            ctx.lineTo(x + 10, laneY + 15);
          } else { // RIGHT
            ctx.moveTo(x + 15, laneY);
            ctx.lineTo(x - 10, laneY - 15);
            ctx.lineTo(x - 10, laneY + 15);
          }
          
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (customization.notes.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x, laneY, 15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.fill();
        } else if (customization.notes.shape === 'square') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.fillRect(x - 15, laneY - 15, 30, 30);
        } else if (customization.notes.shape === 'rectangle') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.fillRect(x - 15, laneY - 15, 30, 30);
          
          // Add direction indicator
          ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // Set opacity to 0 to make invisible
          ctx.font = `${15}px ${customization.ui.fontFamily === 'default' ? 'sans-serif' : customization.ui.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            direction === 'LEFT' ? '←' : 
            direction === 'UP' ? '↑' : 
            direction === 'DOWN' ? '↓' : '→', 
            x, laneY
          );
        } else if (customization.notes.shape === 'guitar_pick') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.beginPath();
          // Smaller guitar pick in target zone
          ctx.moveTo(x, laneY - 12);
          ctx.quadraticCurveTo(x + 12, laneY - 6, x + 10, laneY + 6);
          ctx.quadraticCurveTo(x, laneY + 12, x - 10, laneY + 6);
          ctx.quadraticCurveTo(x - 12, laneY - 6, x, laneY - 12);
          ctx.closePath();
          ctx.fill();
        } else if (customization.notes.shape === 'triangle') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.beginPath();
          ctx.moveTo(x, laneY - 15);
          ctx.lineTo(x - 15, laneY + 15);
          ctx.lineTo(x + 15, laneY + 15);
          ctx.closePath();
          ctx.fill();
        } else if (customization.notes.shape === 'diamond') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.beginPath();
          ctx.moveTo(x, laneY - 15);
          ctx.lineTo(x + 15, laneY);
          ctx.lineTo(x, laneY + 15);
          ctx.lineTo(x - 15, laneY);
          ctx.closePath();
          ctx.fill();
        } else if (customization.notes.shape === 'star') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Set opacity to 0 to make invisible
          ctx.beginPath();
          const outerRadius = 15;
          const innerRadius = 7;
          const spikes = 5;
          const rot = Math.PI / 2 * 3;
          const step = Math.PI / spikes;
          
          for (let i = 0; i < spikes; i++) {
            const x1 = x + Math.cos(rot + i * step * 2) * outerRadius;
            const y1 = laneY + Math.sin(rot + i * step * 2) * outerRadius;
            ctx.lineTo(x1, y1);
            const x2 = x + Math.cos(rot + i * step * 2 + step) * innerRadius;
            const y2 = laneY + Math.sin(rot + i * step * 2 + step) * innerRadius;
            ctx.lineTo(x2, y2);
          }
          
          ctx.closePath();
          ctx.fill();
        }
      });
      
      // Calculate note speed based on tempo
      const noteSpeed = 300; // pixels per second
      
      // Draw hit effects
      const currentHitEffects = hitEffectsRef.current.filter(effect => {
        const age = currentTimeRef.current - effect.startTime;
        return age < (customization.hitEffects.duration || 0.5);
      });
      
      // Update the hit effects reference to remove old effects
      hitEffectsRef.current = currentHitEffects;
      
      currentHitEffects.forEach(effect => {
        // Use the same lane positions as defined earlier in the function
        const x = lanePositions[effect.direction];
        const y = hitZoneOffset; // Use the hit zone position for effects
        const age = currentTimeRef.current - effect.startTime;
        const progress = age / (customization.hitEffects.duration || 0.5);
        
        // Skip rendering if the effect is too old
        if (progress >= 1) return;
        
        // Apply effect customization
        const effectColor = effect.isMiss 
          ? customization.missEffects.color || '#ff0000'
          : customization.hitEffects.color || '#ffffff';
        
        // Apply effect style based on customization
        if (effect.isMiss) {
          // Miss effect
          if (customization.missEffects.style === 'shake') {
            // Shake effect is handled in the input handler
            // Don't draw a red square here, just use the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else if (customization.missEffects.style === 'fade') {
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.5 * (1 - progress);
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else if (customization.missEffects.style === 'flash') {
            // Don't draw a red square, use a more subtle flash effect
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.3 * (1 - progress * 2); // Faster fade for flash
            ctx.beginPath();
            ctx.arc(x, y, 50, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else if (customization.missEffects.style === 'blur') {
            ctx.filter = `blur(${10 * (1 - progress)}px)`;
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.5 * (1 - progress);
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.filter = 'none';
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else if (customization.missEffects.style === 'shatter') {
            // Draw shattered pieces
            const pieces = 8;
            const radius = 40 * progress;
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.7 * (1 - progress);
            
            for (let i = 0; i < pieces; i++) {
              const angle = (i / pieces) * Math.PI * 2;
              const distance = radius;
              const pieceX = x + Math.cos(angle) * distance;
              const pieceY = y + Math.sin(angle) * distance;
              const pieceSize = 10 * (1 - progress);
              
              ctx.beginPath();
              ctx.arc(pieceX, pieceY, pieceSize, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else if (customization.missEffects.style === 'shrink') {
            const size = 40 * (1 - progress);
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.7 * (1 - progress);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          } else {
            // Default miss effect - just draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, true);
          }
          
          // Draw miss text
          if (effect.text) {
            ctx.fillStyle = `rgba(255, 50, 50, ${1 - progress})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = customization.missEffects.color || '#ff0000';
            ctx.font = `bold ${28 * customization.hitEffects.size}px ${customization.ui.fontFamily || 'Arial'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(effect.text, x, y - 50 - (age / 10));
            ctx.shadowBlur = 0;
          }
        } else {
          // Hit effect
          if (customization.hitEffects.style === 'explosion') {
            const size = 30 + 70 * progress * (customization.hitEffects.size || 1);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.7 * (1 - progress);
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'ripple') {
            const size = 30 + 70 * progress * (customization.hitEffects.size || 1);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.strokeStyle = effectColor;
            ctx.lineWidth = 5 * (1 - progress);
            ctx.globalAlpha = 0.7 * (1 - progress);
            ctx.stroke();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'flash') {
            // Don't draw a square, use a more subtle flash effect
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.5 * (1 - progress);
            ctx.beginPath();
            ctx.arc(x, y, 50, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'particles') {
            // Draw particles emanating from hit point
            const particles = 12;
            const radius = 60 * progress * (customization.hitEffects.size || 1);
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.8 * (1 - progress);
            
            for (let i = 0; i < particles; i++) {
              const angle = (i / particles) * Math.PI * 2;
              const distance = radius;
              const particleX = x + Math.cos(angle) * distance;
              const particleY = y + Math.sin(angle) * distance;
              const particleSize = 5 * (1 - progress) * (customization.hitEffects.size || 1);
              
              ctx.beginPath();
              ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'starburst') {
            // Draw star burst
            const points = 8;
            const outerRadius = 60 * progress * (customization.hitEffects.size || 1);
            const innerRadius = 30 * progress * (customization.hitEffects.size || 1);
            
            ctx.beginPath();
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.7 * (1 - progress);
            
            for (let i = 0; i < points * 2; i++) {
              const angle = (i / (points * 2)) * Math.PI * 2;
              const radius = i % 2 === 0 ? outerRadius : innerRadius;
              const pointX = x + Math.cos(angle) * radius;
              const pointY = y + Math.sin(angle) * radius;
              
              if (i === 0) {
                ctx.moveTo(pointX, pointY);
              } else {
                ctx.lineTo(pointX, pointY);
              }
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'pulse') {
            // Draw pulsing circles
            const pulseCount = 3;
            for (let i = 0; i < pulseCount; i++) {
              const pulseProgress = (progress + i / pulseCount) % 1;
              const size = 20 + 50 * pulseProgress * (customization.hitEffects.size || 1);
              
              ctx.beginPath();
              ctx.arc(x, y, size, 0, Math.PI * 2);
              ctx.strokeStyle = effectColor;
              ctx.lineWidth = 3 * (1 - pulseProgress);
              ctx.globalAlpha = 0.5 * (1 - pulseProgress);
              ctx.stroke();
            }
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else if (customization.hitEffects.style === 'glow') {
            // Draw glowing effect
            ctx.shadowBlur = 20 * (1 - progress) * (customization.hitEffects.size || 1);
            ctx.shadowColor = effectColor;
            ctx.fillStyle = effectColor;
            ctx.globalAlpha = 0.7 * (1 - progress);
            ctx.beginPath();
            ctx.arc(x, y, 30 * (customization.hitEffects.size || 1), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          } else {
            // Default hit effect - just draw the arrow with glow
            drawArrow(ctx, x, y, effect.direction, true, false);
          }
          
          // Draw hit text
          if (effect.text) {
            ctx.fillStyle = `rgba(255, 255, 50, ${1 - progress})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = customization.hitEffects.color || '#ffff00';
            ctx.font = `bold ${28 * customization.hitEffects.size}px ${customization.ui.fontFamily || 'Arial'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(effect.text, x, y - 50 - (age / 10));
            ctx.shadowBlur = 0;
          }
        }
        
        // Reset alpha
        ctx.globalAlpha = 1;
      });
      
      // Draw score with UI customization
      ctx.font = `bold 24px ${customization.ui.fontFamily === 'default' ? 'sans-serif' : customization.ui.fontFamily}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`Score: ${score}`, width / 2, 40);
      
      // Draw current time
      ctx.font = `16px ${customization.ui.fontFamily === 'default' ? 'sans-serif' : customization.ui.fontFamily}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(`${currentTimeRef.current.toFixed(1)}s`, width - 20, 30);
      
    } catch (error) {
      console.error('Error in draw function:', error);
      setRenderError('Error rendering game. Please try refreshing the page.');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [score, customization, notesRef, hitEffectsRef, currentTimeRef]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Game Canvas */}
      <canvas 
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ backgroundColor: 'transparent' }}
      />
      
      {/* Audio Error Message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
          <div className="bg-gray-800 border border-red-500 p-4 rounded-lg max-w-sm text-center">
            <p className="text-white mb-3">{error}</p>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.play()
                    .then(() => setError(null))
                    .catch(e => console.error('Manual play failed:', e));
                }
              }}
            >
              Start Audio
            </button>
          </div>
        </div>
      )}
      
      {/* Score & UI overlay */}
      <div className="absolute top-0 left-0 w-full p-4">
        <div className="text-white text-2xl font-bold text-center">
          {countdown !== null ? `Starting in: ${countdown}` : isPlaying ? `Score: ${score}` : 'Ready?'}
        </div>
      </div>
      
      {/* Volume Control */}
      <div className="absolute bottom-4 left-4 flex items-center">
        <button 
          className="text-white opacity-60 hover:opacity-100"
          onClick={() => setVolume(prev => prev === 0 ? 0.7 : 0)}
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        >
          {volume === 0 ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          )}
        </button>
        {volume > 0 && (
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.1" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="ml-2 w-20"
          />
        )}
      </div>
      
      {/* Mobile Controls - shown on touch devices */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center p-4 md:hidden">
          <div className="grid grid-cols-3 gap-2 w-64 h-36">
            <div></div>
            <button 
              className="bg-white bg-opacity-20 rounded-full flex items-center justify-center active:bg-opacity-40"
              onTouchStart={() => handleInput('UP')}
            >
              <span className="text-2xl">↑</span>
            </button>
            <div></div>
            <button 
              className="bg-white bg-opacity-20 rounded-full flex items-center justify-center active:bg-opacity-40"
              onTouchStart={() => handleInput('LEFT')}
            >
              <span className="text-2xl">←</span>
            </button>
            <button 
              className="bg-white bg-opacity-20 rounded-full flex items-center justify-center active:bg-opacity-40"
              onTouchStart={() => handleInput('DOWN')}
            >
              <span className="text-2xl">↓</span>
            </button>
            <button 
              className="bg-white bg-opacity-20 rounded-full flex items-center justify-center active:bg-opacity-40"
              onTouchStart={() => handleInput('RIGHT')}
            >
              <span className="text-2xl">→</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Start button - only shown when not playing */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-5 bg-black bg-opacity-30 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to Play?
            </h2>
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95"
              onClick={handleStart}
            >
              Play Now
            </button>
          </div>
        </div>
      )}
      
      {/* Countdown Display */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl font-bold text-white bg-black bg-opacity-40 w-20 h-20 flex items-center justify-center rounded-full">
            {countdown}
          </div>
        </div>
      )}
      
      {/* Audio element */}
      <audio ref={audioRef} src={mp3Url} preload="auto" />
    </div>
  );
} 