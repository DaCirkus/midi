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
}

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [midiFiles, setMidiFiles] = useState<{ name: string, url: string }[]>([]);

  const processAudio = async (audioBuffer: AudioBuffer) => {
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    const analyzerNode = audioContext.createAnalyser();
    analyzerNode.fftSize = 2048;
    source.connect(analyzerNode);
    analyzerNode.connect(audioContext.destination);

    const drumMidi = new Midi();
    const drumTrack = drumMidi.addTrack();
    const bassMidi = new Midi();
    const bassTrack = bassMidi.addTrack();

    let currentTime = 0;
    const timeIncrement = 512 / audioContext.sampleRate;
    const features: number[] = [];

    return new Promise<{ name: string, url: string }[]>((resolve) => {
      const analyzer = Meyda.createMeydaAnalyzer({
        audioContext: audioContext,
        source: source,
        bufferSize: 512,
        featureExtractors: ['rms', 'energy'],
        callback: (feature: MeydaFeatures) => {
          if (feature.rms > 0.1) {
            drumTrack.addNote({
              midi: 36,
              time: currentTime,
              duration: 0.1,
              velocity: Math.min(feature.rms * 127, 127)
            });
          }

          if (feature.energy > 0.2) {
            bassTrack.addNote({
              midi: 48,
              time: currentTime,
              duration: 0.2,
              velocity: Math.min(feature.energy * 100, 127)
            });
          }

          currentTime += timeIncrement;
          features.push(feature.rms);

          if (currentTime >= audioBuffer.duration) {
            analyzer.stop();
            source.stop();
            audioContext.close();

            const drumBlob = new Blob([drumMidi.toArray()], { type: 'audio/midi' });
            const bassBlob = new Blob([bassMidi.toArray()], { type: 'audio/midi' });

            resolve([
              { name: 'drums.mid', url: URL.createObjectURL(drumBlob) },
              { name: 'bass.mid', url: URL.createObjectURL(bassBlob) }
            ]);
          }
        }
      });

      analyzer.start();
      source.start(0);
    });
  };

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setMidiFiles([]);

    try {
      const file = acceptedFiles[0];
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      setProgress(50);
      const midiFiles = await processAudio(audioBuffer);
      setMidiFiles(midiFiles);
      setProgress(100);
    } catch (err) {
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
              {isProcessing ? 'Processing...' : 'Drag MP3 files here or click to select'}
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
        <Progress
          value={progress}
          size="xl"
          radius="xl"
          animated
          striped
        />
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