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
  const [midiUrl, setMidiUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'audio/mpeg') {
      setMp3File(file);
      setMidiUrl(null);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!mp3File) return;
    setLoading(true);
    setProgress(0);
    
    try {
      // Upload MP3 to Supabase
      setProgress(10);
      await uploadFile(mp3File, 'MP3');
      setProgress(30);

      // Convert MP3 to AudioBuffer
      const arrayBuffer = await mp3File.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setProgress(50);

      // Generate MIDI
      const midiBlob = await generateMidiFromAudio(audioBuffer);
      setProgress(80);

      // Upload MIDI to Supabase
      const midiFile = new File([midiBlob], 'gameplay.mid', { type: 'audio/midi' });
      const midiPath = await uploadFile(midiFile, 'MIDI');
      setProgress(100);
      
      setMidiUrl(midiPath);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGame = async () => {
    if (!midiUrl) return;
    setLoading(true);
    try {
      const game = await createGame(mp3File!.name, midiUrl);
      router.push(`/game?id=${game.id}`);
    } catch (error) {
      console.error('Failed to generate game:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".mp3"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100"
      />
      
      <div className="space-y-2">
        <button
          onClick={handleUpload}
          disabled={!mp3File || loading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Generate MIDI'}
        </button>

        {loading && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {midiUrl && (
        <div className="space-y-4">
          <a 
            href={midiUrl}
            download
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