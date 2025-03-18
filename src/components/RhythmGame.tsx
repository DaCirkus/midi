'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Midi } from '@tonejs/midi'
import { GameData } from '@/lib/supabase'

// Add browser detection helper
const isChromeOnMobile = typeof navigator !== 'undefined' && 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
  /Chrome/i.test(navigator.userAgent) && 
  !/Edge|EdgiOS|EdgA/i.test(navigator.userAgent);

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

  // Initialize audio
  useEffect(() => {
    if (!mp3Url) return;
    
    const audio = new Audio(mp3Url);
    audio.volume = volume;
    audioRef.current = audio;
    
    // Create audio context
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // If we're on Chrome mobile, we need to "unlock" audio immediately
    if (isChromeOnMobile) {
      console.log('Chrome mobile detected, unlocking audio...');
      
      // This ensures audio can be played later
      const unlockAudio = () => {
        // Resume the audio context
        audioContext.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch(err => {
          console.error('Failed to resume AudioContext:', err);
        });

        // Play and immediately pause to unlock audio
        audio.play().then(() => {
          console.log('Audio unlocked successfully');
          audio.pause();
          audio.currentTime = 0;
        }).catch(err => {
          console.error('Failed to unlock audio:', err);
        });

        // Remove event listeners once unlocked
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('touchend', unlockAudio);
        document.removeEventListener('click', unlockAudio);
      };

      // Add event listeners to unlock audio on user interaction
      document.addEventListener('touchstart', unlockAudio);
      document.addEventListener('touchend', unlockAudio);
      document.addEventListener('click', unlockAudio);
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
    if (!audioRef.current || !audioContextRef.current) return;
    
    try {
      // Resume audio context
      await audioContextRef.current.resume();
      
      // For Chrome on mobile, make sure we have a valid user gesture
      if (isChromeOnMobile) {
        console.log('Ensuring audio is unlocked for Chrome mobile...');
        // Try to play audio briefly to ensure it's unlocked
        try {
          await audioRef.current.play();
          // Immediately pause it - we'll play it properly after countdown
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn('Could not pre-unlock audio:', error);
        }
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
            
            // Play audio with special handling for Chrome mobile
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              
              const playPromise = audioRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.error('Failed to play audio:', error);
                  
                  // If we're on Chrome mobile and still can't play, add a fallback button
                  if (isChromeOnMobile) {
                    createAudioFallbackButton();
                  }
                });
              }
            }
            
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }, []);

  // Add a fallback button for Chrome mobile if audio fails
  const createAudioFallbackButton = () => {
    // Only create the button if it doesn't already exist
    if (document.getElementById('audio-fallback-button')) return;
    
    const button = document.createElement('button');
    button.id = 'audio-fallback-button';
    button.innerText = 'Tap for Sound';
    button.style.position = 'absolute';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    button.style.padding = '8px 16px';
    button.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    button.style.color = 'white';
    button.style.border = '1px solid white';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontFamily = customization.ui.fontFamily || 'sans-serif';
    button.style.fontSize = '14px';
    button.style.transition = 'all 0.2s ease';
    button.style.backdropFilter = 'blur(4px)';
    button.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
    
    // Add a sound icon
    button.innerHTML = `<svg style="display: inline-block; vertical-align: middle; margin-right: 6px; width: 16px; height: 16px;" viewBox="0 0 24 24" fill="white"><path d="M14.5,3.27L14.5,3.27c-1.3,0.44-2.74,0.44-4.04,0l0,0C9.65,2.94,8.75,3.15,8.01,3.69L7.5,4l0,0C6.91,4.36,6.48,4.92,6.25,5.58 C6.11,6.05,5.87,6.49,5.5,6.79c-0.39,0.33-0.71,0.73-0.95,1.17C4.26,8.5,4.12,9.2,4.25,9.88c0.07,0.35,0.1,0.71,0.08,1.06l0,0.13 c-0.01,0.44,0.05,0.88,0.2,1.28c0.32,0.83,0.2,1.75-0.32,2.49c-0.53,0.76-0.64,1.74-0.27,2.61c0.14,0.33,0.34,0.66,0.58,0.96 c0.06,0.07,0.12,0.15,0.17,0.22c0.38,0.57,0.87,1.08,1.44,1.46c0.47,0.32,0.82,0.77,1.04,1.29l0,0l0,0c0.39,0.93,1.2,1.62,2.2,1.78 c0.41,0.07,0.81,0.08,1.22,0.06l0,0c0.09-0.01,0.18-0.01,0.28-0.01c0.44,0,0.86,0.08,1.27,0.25l0,0c0.83,0.33,1.78,0.22,2.54-0.26 l0.15-0.1c0.73-0.5,1.16-1.31,1.22-2.17c0.04-0.65,0.31-1.25,0.77-1.72c0.5-0.5,0.5-1,0.5-1h0.01c0-0.32-0.14-0.63-0.36-0.86 c-0.3-0.3-0.38-0.77-0.36-1.21c0.03-0.83-0.28-1.66-0.94-2.22c-0.51-0.44-0.79-1.06-0.8-1.71V9.92v0 c-0.01-0.65,0.22-1.28,0.67-1.77c0.42-0.47,0.91-0.87,1.45-1.19c0.67-0.4,1.14-1.05,1.31-1.82c0.13-0.63,0.02-1.27-0.31-1.83 c-0.5-0.83-1.27-1.45-2.19-1.75C15.57,3.29,15.03,3.22,14.5,3.27z M13.5,4.71c0.18-0.13,0.41-0.17,0.61-0.13 c0.51,0.11,0.99,0.39,1.35,0.82c0.11,0.13,0.15,0.27,0.13,0.42c-0.04,0.2-0.21,0.48-0.65,0.75c-0.71,0.42-1.35,0.96-1.85,1.6 c-0.78,0.85-1.15,1.95-1.15,3.09c0.01,1.12,0.44,2.19,1.28,3 c0,0,0.26,0.22,0.26,0.22c0.31,0.29,0.48,0.67,0.5,1.08 c0.05,1.5-0.16,3.22-1.63,4.1l0,0l0,0l0.47,0.27c1.06-0.71,1.3-2.14,1.3-3.32c0.76,0.74,0.78,1.89,0.63,2.77 c0.33-0.04,0.41-0.3,0.42-0.68c0.07-1.33-0.63-2.58-1.86-3.42c-0.28-0.2-0.45-0.5-0.5-0.83c-0.04-0.29-0.01-0.57,0.1-0.86 c0.21-0.57,0.63-1.04,1.16-1.33c1.05-0.61,1.71-1.69,1.71-2.88c0-0.71-0.22-1.39-0.65-1.96c-0.12-0.16-0.25-0.31-0.39-0.44l0,0 C14.16,6.92,13.9,6.73,13.66,6.56c-0.4-0.29-0.76-0.62-1.08-0.99c-0.3-0.35-0.39-0.81-0.28-1.23C12.49,4.01,12.82,3.82,13.5,4.71z M8,5.5C8,6.33,8.67,7,9.5,7S11,6.33,11,5.5S10.33,4,9.5,4S8,4.67,8,5.5z M9.75,15c0.41,0,0.75-0.34,0.75-0.75 c0-0.41-0.34-0.75-0.75-0.75S9,13.84,9,14.25C9,14.66,9.34,15,9.75,15z M9.75,11c0.41,0,0.75-0.34,0.75-0.75 c0-0.41-0.34-0.75-0.75-0.75S9,9.84,9,10.25C9,10.66,9.34,11,9.75,11z M6.75,9C6.34,9,6,9.34,6,9.75s0.34,0.75,0.75,0.75 S7.5,10.16,7.5,9.75S7.16,9,6.75,9z M16.75,14.5c0.41,0,0.75-0.34,0.75-0.75c0-0.41-0.34-0.75-0.75-0.75s-0.75,0.34-0.75,0.75 C16,14.16,16.34,14.5,16.75,14.5z M13.75,16.5c0.41,0,0.75-0.34,0.75-0.75c0-0.41-0.34-0.75-0.75-0.75s-0.75,0.34-0.75,0.75 C13,16.16,13.34,16.5,13.75,16.5z M7.5,14.5c0,0.41-0.34,0.75-0.75,0.75S6,14.91,6,14.5s0.34-0.75,0.75-0.75S7.5,14.09,7.5,14.5z M16.75,8.5c0.41,0,0.75-0.34,0.75-0.75c0-0.41-0.34-0.75-0.75-0.75s-0.75,0.34-0.75,0.75C16,8.16,16.34,8.5,16.75,8.5z"></path></svg>Tap for Sound`;
    
    // Add hover effect
    button.onmouseover = () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      button.style.transform = 'scale(1.05)';
    };
    
    button.onmouseout = () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      button.style.transform = 'scale(1)';
    };
    
    button.onclick = () => {
      if (audioRef.current) {
        // Visual feedback for the tap
        button.style.backgroundColor = 'rgba(0, 128, 255, 0.5)';
        button.style.transform = 'scale(0.95)';
        
        audioRef.current.play().then(() => {
          // Remove the button after successful play
          button.remove();
        }).catch(err => {
          console.error('Still failed to play audio:', err);
          // Reset the button style if play fails
          setTimeout(() => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            button.style.transform = 'scale(1)';
          }, 300);
        });
      }
    };
    
    // Add button to the game container
    const container = canvasRef.current?.parentElement;
    if (container) {
      container.appendChild(button);
    }
  };

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
    <div className={`relative w-full aspect-video overflow-hidden rounded-2xl ${
      customization.background.type === 'image' ? 'bg-cover bg-center' : 'bg-black/30'
    }`}>
      {renderError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-red-900/30 border border-red-900 rounded-lg p-4 max-w-md text-center">
            <h3 className="text-xl font-bold text-red-400 mb-2">Rendering Error</h3>
            <p className="text-white/80">{renderError}</p>
            <button 
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Game Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasClick}
          />
          
          {/* Score Overlay - Always visible, shows countdown or score */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
            <div className={`bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl
              text-center shadow-lg border border-white/10 transition-all duration-300
              ${countdown === 1 ? 'scale-105' : ''}`}>
              <div className={`text-2xl font-bold bg-gradient-to-r from-primary to-primary-dark 
                bg-clip-text text-transparent transition-all duration-300
                ${countdown === 1 ? 'scale-110 opacity-90' : ''}`}>
                {countdown !== null ? `Starting in: ${countdown}` : isPlaying ? `Score: ${score}` : 'Ready?'}
              </div>
              
              {/* Progress bar for countdown */}
              {countdown !== null && (
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-200 ease-linear"
                    style={{ width: `${(1 - countdown / 3) * 100}%` }}
                  ></div>
                </div>
              )}
              
              {/* Visual indicators for 3-second countdown */}
              {countdown !== null && (
                <div className="flex justify-between mt-1 px-1">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${i < 3 - countdown ? 'bg-primary' : 'bg-gray-600'}`}
                    ></div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Volume Control */}
          {isPlaying && (
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
                  className="w-24 h-1 accent-primary"
                />
                <span className="text-lg opacity-80">🔊</span>
              </div>
            </div>
          )}

          {/* Start Button */}
          {!isPlaying && countdown === null && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm 
              flex flex-col items-center justify-center gap-4">
              <button 
                onClick={async (e) => {
                  // For Chrome mobile, ensure audio is unlocked with the direct user gesture
                  if (isChromeOnMobile && audioRef.current && audioContextRef.current) {
                    // Add explicit logging
                    console.log('Handling Start button click on Chrome mobile');
                    
                    try {
                      // Resume audio context directly within the click handler
                      await audioContextRef.current.resume();
                      console.log('AudioContext resumed in click handler');
                      
                      // Try to play audio directly in the click handler
                      await audioRef.current.play();
                      console.log('Audio played successfully in click handler');
                      
                      // Immediately pause it - we'll play it properly after countdown
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                      console.log('Audio paused and reset');
                    } catch (error) {
                      console.warn('Audio preplay failed:', error);
                    }
                  }
                  
                  // Call the regular start handler
                  handleStart();
                }}
                className="px-8 py-4 bg-gradient-to-r from-primary to-primary-dark 
                  text-white rounded-xl text-2xl font-bold 
                  hover:from-primary-dark hover:to-primary transition-all duration-300
                  shadow-lg hover:shadow-primary/20 hover:scale-105 transform"
              >
                Start Game
              </button>
              <h2 className="text-3xl font-bold text-white">
                Ready to Play?
              </h2>
              <p className="text-white/70 text-lg">
                ←↑↓→ or WASD or tap
              </p>
            </div>
          )}

          {/* Countdown Display */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="absolute inset-0 bg-black bg-opacity-40"></div>
              <div className="flex flex-col items-center z-20">
                <div className="text-9xl font-bold text-white drop-shadow-glow animate-bounce" 
                     style={{ 
                       textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 30px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.4)',
                       transform: `scale(${1 + (countdown % 1) * 0.3})`,
                       transition: 'transform 0.1s ease-out'
                     }}>
                  {countdown}
                </div>
                <div className="text-2xl font-bold text-white mt-4 bg-black bg-opacity-50 px-6 py-2 rounded-full">
                  Get Ready!
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 