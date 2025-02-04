import { Midi } from '@tonejs/midi'
import Meyda from 'meyda'

const DIRECTIONS = {
  UP: 38,    // Up arrow
  DOWN: 40,  // Down arrow
  LEFT: 37,  // Left arrow
  RIGHT: 39  // Right arrow
} as const

interface MeydaFeatures {
  rms: number
  energy: number
  spectralCentroid: number
  zcr: number
  perceptualSpread: number
  spectralFlatness: number
}

export async function generateMidiFromAudio(audioBuffer: AudioBuffer, onProgress?: (progress: number) => void): Promise<Blob> {
  const totalSamples = audioBuffer.length;
  let processedSamples = 0;
  
  // Create a single AudioContext for all operations
  const audioContext = new AudioContext();
  
  // Analyze a portion of the audio first to detect tempo
  const tempoSource = audioContext.createBufferSource();
  tempoSource.buffer = audioBuffer;
  
  const tempoAnalyzer = Meyda.createMeydaAnalyzer({
    audioContext,
    source: tempoSource,
    bufferSize: 2048,
    featureExtractors: ['perceptualSpread', 'spectralFlatness'],
    callback: () => {}
  });

  // Collect tempo data for first 10 seconds
  const tempoData: number[] = [];
  const sampleLength = Math.min(10 * audioBuffer.sampleRate, audioBuffer.length);
  for (let i = 0; i < sampleLength; i += 2048) {
    const features = tempoAnalyzer.get(['perceptualSpread', 'spectralFlatness']);
    if (features && 
        typeof features.perceptualSpread === 'number' && 
        typeof features.spectralFlatness === 'number' &&
        features.perceptualSpread > 0.5 && 
        features.spectralFlatness > 0.3) {
      tempoData.push(i);
    }
  }

  // Clean up tempo analysis
  tempoSource.disconnect();
  tempoAnalyzer.stop();

  // Calculate tempo from beat intervals
  const intervals = tempoData.slice(1).map((time, i) => time - tempoData[i]);
  const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length || 0;
  const tempo = averageInterval ? Math.round(60 / (averageInterval / audioBuffer.sampleRate)) : 120;
  
  // Use detected tempo, or fallback to 120 if detection fails
  const detectedTempo = tempo >= 60 && tempo <= 200 ? tempo : 120;
  console.log('Detected tempo:', detectedTempo, 'BPM');
  
  const midi = new Midi()
  midi.header.setTempo(detectedTempo);
  midi.header.timeSignatures = [{
    ticks: 0,
    timeSignature: [4, 4]
  }];

  // Create a track with proper initialization
  const gameTrack = midi.addTrack();
  gameTrack.channel = 0; // Set MIDI channel to drums

  let currentTime = 0
  const timeIncrement = 512 / audioBuffer.sampleRate
  const minTimeBetweenNotes = 0.4
  let lastNoteTime = -minTimeBetweenNotes
  let features: { time: number, rms: number, energy: number, centroid: number, zcr: number }[] = []

  // Rolling average for adaptive thresholds
  const energyHistory: number[] = []
  const HISTORY_SIZE = 50

  return new Promise((resolve, reject) => {
    try {
      onProgress?.(5); // Starting
      console.log('Starting MIDI generation with audio buffer:', audioBuffer);
      
      // Create a new source for the main analysis
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      onProgress?.(10); // Audio context setup
      console.log('Audio nodes connected');
      
      console.log('Creating Meyda analyzer');
      const analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source,
        bufferSize: 512,
        featureExtractors: ['rms', 'energy', 'spectralCentroid', 'zcr'],
        callback: (feature: MeydaFeatures) => {
          try {
            processedSamples += 512;
            const analysisProgress = Math.min(85, 10 + (75 * (processedSamples / totalSamples)));
            onProgress?.(analysisProgress);
            
            currentTime += timeIncrement;
            
            // Update energy history for adaptive threshold
            energyHistory.push(feature.energy);
            if (energyHistory.length > HISTORY_SIZE) {
              energyHistory.shift();
            }
            
            // Calculate adaptive threshold
            const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
            const energyThreshold = avgEnergy * 1.5;

            // Only store significant moments
            if (feature.energy > energyThreshold && feature.rms > 0.15) {
              features.push({
                time: currentTime,
                rms: feature.rms,
                energy: feature.energy,
                centroid: feature.spectralCentroid,
                zcr: feature.zcr
              });
            }

            if (currentTime >= audioBuffer.duration) {
              onProgress?.(90); // Feature collection complete
              console.log('Processing completed, collected features:', features.length);
              analyzer.stop();
              source.stop();
              audioContext.close();

              // Process collected features
              features = features.filter((f, i, arr) => {
                if (i === 0 || i === arr.length - 1) return false;
                const prevEnergy = arr[i - 1].energy;
                const nextEnergy = arr[i + 1].energy;
                return f.energy > prevEnergy * 1.2 && f.energy > nextEnergy * 1.2;
              });

              onProgress?.(95); // Feature filtering complete
              console.log('Filtered features:', features.length);

              // Sort by energy to get distribution
              const sortedEnergies = features.map(f => f.energy).sort((a, b) => b - a);
              const energyPercentile75 = sortedEnergies[Math.floor(sortedEnergies.length * 0.75)];

              // Generate notes
              let noteCount = 0;
              features.forEach((f) => {
                if (f.time - lastNoteTime >= minTimeBetweenNotes) {
                  let direction;
                  const intensity = f.rms * f.energy;
                  
                  if (f.energy > energyPercentile75) {
                    direction = f.centroid > 4000 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
                  } else {
                    direction = f.zcr > 50 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
                  }

                  gameTrack.addNote({
                    midi: direction,
                    time: f.time,
                    duration: 0.1,
                    velocity: Math.min(intensity * 127, 127)
                  });

                  lastNoteTime = f.time;
                  noteCount++;
                }
              });

              console.log('Generated notes:', noteCount);
              onProgress?.(100); // MIDI generation complete
              
              // Convert MIDI to binary format
              const midiData = midi.toArray();
              const midiBlob = new Blob([new Uint8Array(midiData)], { 
                type: 'application/x-midi' 
              });
              
              // Verify MIDI format
              const reader = new FileReader();
              reader.onload = () => {
                const arr = new Uint8Array(reader.result as ArrayBuffer);
                console.log('MIDI header:', Array.from(arr.slice(0, 4)).map(b => String.fromCharCode(b)).join(''));
              };
              reader.readAsArrayBuffer(midiBlob);
              
              resolve(midiBlob);
            }
          } catch (err) {
            console.error('Error in analyzer callback:', err);
            reject(err);
          }
        }
      });

      console.log('Starting audio analysis');
      analyzer.start();
      source.start(0);
    } catch (err) {
      console.error('Error setting up analyzer:', err);
      reject(err);
    }
  });
} 