'use client';

import { useCallback, useState } from 'react';
import { Group, Text, rem, Progress, Alert, Button, Stack } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconMusic, IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { Midi } from '@tonejs/midi';
import Meyda from 'meyda';

interface MeydaFeatures {
  rms: number;
  energy: number;
  spectralCentroid: number;
  zcr: number;  // Zero crossing rate for better beat detection
}

const DIRECTIONS = {
  UP: 38,    // Up arrow
  DOWN: 40,  // Down arrow
  LEFT: 37,  // Left arrow
  RIGHT: 39  // Right arrow
};

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [midiFiles, setMidiFiles] = useState<{ name: string, url: string }[]>([]);
  const [status, setStatus] = useState<string>('');

  const processAudio = async (audioBuffer: AudioBuffer) => {
    try {
      setStatus('Creating audio context...');
      const audioContext = new AudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create a silent destination
      const silentNode = audioContext.createGain();
      silentNode.gain.value = 0;
      source.connect(silentNode);
      silentNode.connect(audioContext.destination);

      setStatus('Initializing MIDI tracks...');
      const midi = new Midi();
      const gameTrack = midi.addTrack();
      
      let currentTime = 0;
      const timeIncrement = 512 / audioContext.sampleRate;
      const minTimeBetweenNotes = 0.4; // Increased to 400ms for better playability
      let lastNoteTime = -minTimeBetweenNotes;
      let features: { time: number, rms: number, energy: number, centroid: number, zcr: number }[] = [];

      // Rolling average for adaptive thresholds
      let energyHistory: number[] = [];
      const HISTORY_SIZE = 50;
      
      return new Promise<{ name: string, url: string }[]>((resolve, reject) => {
        try {
          setStatus('Setting up audio analyzer...');
          const analyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: source,
            bufferSize: 512,
            featureExtractors: ['rms', 'energy', 'spectralCentroid', 'zcr'],
            callback: (feature: MeydaFeatures) => {
              try {
                currentTime += timeIncrement;
                
                // Update energy history for adaptive threshold
                energyHistory.push(feature.energy);
                if (energyHistory.length > HISTORY_SIZE) {
                  energyHistory.shift();
                }
                
                // Calculate adaptive threshold
                const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
                const energyThreshold = avgEnergy * 1.5; // 50% above average

                // Only store significant moments that exceed the adaptive threshold
                if (feature.energy > energyThreshold && feature.rms > 0.15) {
                  features.push({
                    time: currentTime,
                    rms: feature.rms,
                    energy: feature.energy,
                    centroid: feature.spectralCentroid,
                    zcr: feature.zcr
                  });
                }

                // Update progress
                const progressPercent = (currentTime / audioBuffer.duration) * 50 + 50;
                setProgress(Math.min(progressPercent, 99));

                if (currentTime >= audioBuffer.duration) {
                  setStatus('Generating gameplay notes...');
                  analyzer.stop();
                  source.stop();
                  audioContext.close();

                  // Process collected features to generate notes
                  features = features.filter((f, i, arr) => {
                    // Keep only stronger local maxima
                    if (i === 0 || i === arr.length - 1) return false;
                    const prevEnergy = arr[i - 1].energy;
                    const nextEnergy = arr[i + 1].energy;
                    return f.energy > prevEnergy * 1.2 && f.energy > nextEnergy * 1.2;
                  });

                  // Sort by energy to get distribution of intensities
                  const sortedEnergies = features.map(f => f.energy).sort((a, b) => b - a);
                  const energyPercentile75 = sortedEnergies[Math.floor(sortedEnergies.length * 0.75)];

                  // Generate notes based on features
                  features.forEach((f) => {
                    if (f.time - lastNoteTime >= minTimeBetweenNotes) {
                      let direction;
                      const intensity = f.rms * f.energy;
                      
                      // Use energy percentile for more balanced distribution
                      if (f.energy > energyPercentile75) {
                        // Top 25% strongest hits go UP/DOWN
                        direction = f.centroid > 4000 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
                      } else {
                        // Weaker hits go LEFT/RIGHT
                        direction = f.zcr > 50 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
                      }

                      gameTrack.addNote({
                        midi: direction,
                        time: f.time,
                        duration: 0.1,
                        velocity: Math.min(intensity * 127, 127)
                      });

                      lastNoteTime = f.time;
                    }
                  });

                  const midiBlob = new Blob([midi.toArray()], { type: 'audio/midi' });
                  resolve([
                    { name: 'gameplay.mid', url: URL.createObjectURL(midiBlob) }
                  ]);
                }
              } catch (err) {
                console.error('Error in analyzer callback:', err);
                reject(err);
              }
            }
          });

          setStatus('Starting audio analysis...');
          analyzer.start();
          source.start(0);
        } catch (err) {
          console.error('Error setting up analyzer:', err);
          reject(err);
        }
      });
    } catch (err) {
      console.error('Error in processAudio:', err);
      throw err;
    }
  };

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setMidiFiles([]);
    setStatus('Reading file...');

    try {
      const file = acceptedFiles[0];
      const arrayBuffer = await file.arrayBuffer();
      setStatus('Decoding audio...');
      setProgress(25);
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      setProgress(50);
      setStatus('Processing audio...');
      
      const midiFiles = await processAudio(audioBuffer);
      setMidiFiles(midiFiles);
      setProgress(100);
      setStatus('Complete!');
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <Stack>
      <Dropzone
        onDrop={handleDrop}
        accept={['audio/mpeg']}
        maxSize={30 * 1024 * 1024}
        disabled={isProcessing}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconMusic
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              {isProcessing ? status : 'Drag MP3 files here or click to select'}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Files should not exceed 30MB
            </Text>
            {files.length > 0 && (
              <Text size="sm" mt={10}>
                Selected files: {files.map(file => file.name).join(', ')}
              </Text>
            )}
          </div>
        </Group>
      </Dropzone>

      {isProcessing && (
        <>
          <Stack gap="xs">
            <Progress
              value={progress}
              size="xl"
              radius="xl"
              animated
              striped
            />
            <Text size="sm" c="dimmed" ta="center">
              {Math.round(progress)}% - {status}
            </Text>
          </Stack>
        </>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      )}

      {midiFiles.length > 0 && (
        <Stack gap="sm">
          <Text size="lg" fw={500}>Download MIDI Files:</Text>
          {midiFiles.map((file) => (
            <Button
              key={file.name}
              component="a"
              href={file.url}
              download={file.name}
              leftSection={<IconDownload size={16} />}
            >
              Download {file.name}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
} 