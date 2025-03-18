'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile, createGame, GameData } from '@/lib/supabase';
import { generateMidiFromAudio } from '@/lib/midiGenerator';
import { Midi } from '@tonejs/midi';
import GameCustomization from './GameCustomization';

export default function FileUpload() {
  const router = useRouter();
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [midiBlob, setMidiBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [visualCustomization, setVisualCustomization] = useState<NonNullable<GameData['visual_customization']> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'audio/mpeg') {
      setMp3File(file);
      setMidiBlob(null);
      setProgress(0);
      setError(null);
    } else if (file) {
      setError('Please upload an MP3 file');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      if (file && file.type === 'audio/mpeg') {
        setMp3File(file);
        setMidiBlob(null);
        setProgress(0);
        setError(null);
      } else {
        setError('Please upload an MP3 file');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleGenerate = async () => {
    if (!mp3File) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    
    try {
      const arrayBuffer = await mp3File.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const midi = await generateMidiFromAudio(audioBuffer, (progress) => {
        setProgress(Math.min(progress, 0.99));
      });
      
      setProgress(1.0);
      setMidiBlob(midi);
      setShowCustomization(true);
    } catch (error) {
      console.error('Generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate MIDI');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomizationChange = (customization: NonNullable<GameData['visual_customization']>) => {
    setVisualCustomization(customization);
  };

  const handleCustomizationComplete = () => {
    handleGenerateGame();
  };

  const handleGenerateGame = async () => {
    if (!midiBlob || !mp3File) return;
    setLoading(true);
    setError(null);
    try {
      // Validate image URL if using image background
      if (visualCustomization?.background.type === 'image') {
        try {
          // Check if imageUrl exists
          if (!visualCustomization.background.imageUrl || visualCustomization.background.imageUrl.trim() === '') {
            console.warn('Image URL is empty, falling back to color background');
            // Create a modified copy with color background instead
            visualCustomization.background = {
              type: 'color',
              color: '#1a1a2e'
            };
          } else {
            // Validate URL format
            const url = new URL(visualCustomization.background.imageUrl);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
              console.warn('Image URL must use HTTPS or HTTP protocol, falling back to color background');
              // Create a modified copy with color background instead
              visualCustomization.background = {
                type: 'color',
                color: '#1a1a2e'
              };
            } else {
              // Additional check to see if image can load (optional, can cause delays)
              console.log('Testing image loading for:', visualCustomization.background.imageUrl);
            }
          }
        } catch (error) {
          console.warn('Invalid image URL, falling back to color background:', error);
          // Create a modified copy with color background instead
          if (visualCustomization) {
            visualCustomization.background = {
              type: 'color',
              color: '#1a1a2e'
            };
          }
        }
      }
      
      const mp3Url = await uploadFile(mp3File, 'MP3');
      
      const arrayBuffer = await midiBlob.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const midiData = {
        notes: midi.tracks[0].notes.map(note => ({
          time: note.time,
          midi: note.midi,
          duration: note.duration,
          velocity: note.velocity
        })),
        tempo: midi.header.tempos[0]?.bpm || 120
      };
      
      const game = await createGame(mp3Url, midiData, visualCustomization || undefined);
      router.push(`/game/${game.id}`);
    } catch (error) {
      console.error('Failed to generate game:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('image')) {
          setError(`Image background error: ${error.message}`);
        } else if (error.message.includes('413')) {
          setError('File too large. Please use a smaller MP3 file.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          setError('Network error. Please check your internet connection and try again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Failed to generate game. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If showing customization, render the customization component
  if (showCustomization && midiBlob) {
    return (
      <div className="w-full">
        <GameCustomization 
          onCustomizationChange={handleCustomizationChange}
          onComplete={handleCustomizationComplete}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Step 1: Upload MP3 */}
      <div className="mb-3">
        <h2 className="text-sm font-medium mb-1">Step 1: Upload your MP3</h2>
        
        {/* Upload Area with Drag & Drop */}
        <div 
          className={`border ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'} 
            rounded bg-gray-800 p-4 cursor-pointer transition-colors`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <div className="flex items-center">
            {/* Much larger music note icon with project color */}
            <div className="w-20 h-20 mr-4 flex-none text-[#ffffff]">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M55 15L55 50C55 55.5228 50.5228 60 45 60C39.4772 60 35 55.5228 35 50C35 44.4772 39.4772 40 45 40C47 40 49 40.5 50 41.5L50 20L30 25L30 55C30 60.5228 25.5228 65 20 65C14.4772 65 10 60.5228 10 55C10 49.4772 14.4772 45 20 45C22 45 24 45.5 25 46.5L25 20L55 15Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">
                {mp3File ? mp3File.name : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-500">MP3 files only</p>
            </div>
            
            <input 
              id="file-upload"
              type="file" 
              accept="audio/mpeg" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-900 rounded text-red-200 text-xs">
          {error}
        </div>
      )}
      
      {/* Generate Button */}
      {mp3File && !midiBlob && (
        <div className="mb-3">
          <h2 className="text-sm font-medium mb-1">Step 2: Generate MIDI</h2>
          <button
            className="w-full py-1.5 bg-[#239063] hover:bg-[#1c7550] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Generate Rhythm Game'}
          </button>
          
          {/* Progress Bar */}
          {loading && (
            <div className="mt-2">
              <div className="w-full bg-gray-700 rounded-full h-1">
                <div
                  className="bg-[#239063] h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                ></div>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                {`${Math.min(Math.round(progress * 100), 100)}% complete`}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* MIDI Generated */}
      {midiBlob && !showCustomization && (
        <div className="mb-3">
          <h2 className="text-sm font-medium mb-1">Step 3: Customize & Create</h2>
          <div className="p-2 bg-[#239063]/20 border border-[#239063] rounded text-[#a3e6c5] text-xs mb-2">
            MIDI successfully generated!
          </div>
          
          <button
            className="w-full py-1.5 bg-[#239063] hover:bg-[#1c7550] text-white rounded text-xs font-medium transition-colors"
            onClick={() => setShowCustomization(true)}
          >
            Continue to Customization
          </button>
        </div>
      )}
    </div>
  );
} 