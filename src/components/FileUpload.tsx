'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile, createGame } from '@/lib/supabase';
import { generateMidiFromAudio } from '@/lib/midiGenerator';

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
      setProgress(20);
      // Convert MP3 to AudioBuffer
      const arrayBuffer = await mp3File.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setProgress(40);
      console.log('Audio decoded');

      // Generate MIDI
      const midi = await generateMidiFromAudio(audioBuffer);
      setProgress(100);
      console.log('MIDI generated');
      
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
      // First upload both files
      const mp3Url = await uploadFile(mp3File, 'MP3');
      
      // Convert midiBlob to File
      const midiFile = new File([midiBlob], 'gameplay.mid', { type: 'audio/midi' });
      const midiUrl = await uploadFile(midiFile, 'MIDI');
      
      // Create game with the uploaded URLs
      const game = await createGame(mp3Url, midiUrl);
      router.push(`/game?id=${game.id}`);
    } catch (error) {
      console.error('Failed to generate game:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
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
          className="cursor-pointer text-gray-600 hover:text-blue-500"
        >
          {mp3File ? (
            <div>
              <p className="font-medium">{mp3File.name}</p>
              <p className="text-sm text-gray-500">Click to choose a different file</p>
            </div>
          ) : (
            <div>
              <p className="font-medium">Drop your MP3 file here</p>
              <p className="text-sm text-gray-500">or click to browse</p>
            </div>
          )}
        </label>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleGenerate}
          disabled={!mp3File || loading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate MIDI'}
        </button>

        {loading && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 text-center">{progress}%</p>
          </div>
        )}
      </div>

      {midiBlob && (
        <div className="space-y-4">
          <a 
            href={URL.createObjectURL(midiBlob)}
            download="gameplay.mid"
            className="block px-4 py-2 bg-green-500 text-white rounded text-center hover:bg-green-600"
          >
            Download MIDI
          </a>
          
          <button
            onClick={handleGenerateGame}
            className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Generate Game
          </button>
        </div>
      )}
    </div>
  );
} 