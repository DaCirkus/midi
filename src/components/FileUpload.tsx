'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile, createGame } from '@/lib/supabase';
import { generateMidiFromAudio } from '@/lib/midiGenerator';
import { Midi } from '@tonejs/midi';

export default function FileUpload() {
  const router = useRouter();
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [midiBlob, setMidiBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'audio/mpeg') {
      setMp3File(file);
      setMidiBlob(null);
      setProgress(0);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'audio/mpeg') {
      setMp3File(file);
      setMidiBlob(null);
      setProgress(0);
      setError(null);
    } else {
      setError('Please upload an MP3 file');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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
        setProgress(progress);
      });
      
      setMidiBlob(midi);
    } catch (error) {
      console.error('Generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate MIDI');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGame = async () => {
    if (!midiBlob || !mp3File) return;
    setLoading(true);
    setError(null);
    try {
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
      
      const game = await createGame(mp3Url, midiData);
      router.push(`/game?id=${game.id}`);
    } catch (error) {
      console.error('Failed to generate game:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Upload Area - Takes up most of the space */}
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="flex-1 flex items-center justify-center p-8 group relative border-2 border-dashed 
          border-white/20 rounded-xl m-4 hover:border-purple-400/50 transition-colors duration-300 
          cursor-pointer bg-white/5 hover:bg-white/10"
      >
        <input
          type="file"
          accept=".mp3"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label 
          htmlFor="file-upload"
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
        >
          {mp3File ? (
            <div className="space-y-8">
              <div className="w-32 h-32 mx-auto bg-purple-400/20 rounded-full flex items-center justify-center">
                <span className="text-6xl">🎵</span>
              </div>
              <div>
                <p className="text-3xl font-semibold text-purple-300">{mp3File.name}</p>
                <p className="text-xl text-gray-400 mt-4">Click or drag to choose a different file</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="w-32 h-32 mx-auto bg-white/10 rounded-full flex items-center justify-center
                group-hover:bg-purple-400/20 transition-colors duration-300">
                <span className="text-6xl">📁</span>
              </div>
              <div>
                <p className="text-3xl font-semibold text-white/90">Drop your MP3 file here</p>
                <p className="text-xl text-gray-400 mt-4">or click to browse</p>
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-center">
          {error}
        </div>
      )}

      {/* Progress and Actions - At the bottom */}
      <div className="p-4 space-y-4">
        {/* Generate MIDI Button */}
        {mp3File && !midiBlob && (
          <button
            onClick={handleGenerate}
            disabled={!mp3File || loading}
            className="w-full px-8 py-6 bg-gradient-to-r from-purple-500 to-pink-500 
              rounded-xl font-semibold text-2xl hover:from-purple-600 hover:to-pink-600 
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300
              hover:shadow-lg hover:shadow-purple-500/20 transform hover:-translate-y-0.5"
          >
            {loading ? 'Generating...' : 'Generate MIDI'}
          </button>
        )}

        {/* Progress Bar */}
        {loading && (
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-lg text-center text-gray-400">{progress}% Complete</p>
          </div>
        )}

        {/* MIDI Actions */}
        {midiBlob && (
          <div className="space-y-4">
            {/* Download MIDI Button */}
            <a 
              href={URL.createObjectURL(midiBlob)}
              download="gameplay.mid"
              className="block w-full px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-500 
                text-center rounded-xl font-semibold text-2xl hover:from-green-600 hover:to-emerald-600
                transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 
                transform hover:-translate-y-0.5"
            >
              Download MIDI
            </a>
            
            {/* Generate Game Button */}
            <button
              onClick={handleGenerateGame}
              className="w-full px-8 py-6 bg-gradient-to-r from-purple-500 to-pink-500 
                rounded-xl font-semibold text-2xl hover:from-purple-600 hover:to-pink-600
                transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 
                transform hover:-translate-y-0.5"
            >
              Create Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 