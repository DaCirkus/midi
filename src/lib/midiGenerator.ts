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
}

export async function generateMidiFromAudio(audioBuffer: AudioBuffer): Promise<Blob> {
  const audioContext = new AudioContext()
  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  
  // Create a silent destination
  const silentNode = audioContext.createGain()
  silentNode.gain.value = 0
  source.connect(silentNode)
  silentNode.connect(audioContext.destination)

  const midi = new Midi()
  const gameTrack = midi.addTrack()
  
  let currentTime = 0
  const timeIncrement = 512 / audioContext.sampleRate
  const minTimeBetweenNotes = 0.4
  let lastNoteTime = -minTimeBetweenNotes
  let features: { time: number, rms: number, energy: number, centroid: number, zcr: number }[] = []

  // Rolling average for adaptive thresholds
  const energyHistory: number[] = []
  const HISTORY_SIZE = 50

  return new Promise((resolve, reject) => {
    try {
      const analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source,
        bufferSize: 512,
        featureExtractors: ['rms', 'energy', 'spectralCentroid', 'zcr'],
        callback: (feature: MeydaFeatures) => {
          currentTime += timeIncrement
          
          // Update energy history for adaptive threshold
          energyHistory.push(feature.energy)
          if (energyHistory.length > HISTORY_SIZE) {
            energyHistory.shift()
          }
          
          // Calculate adaptive threshold
          const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length
          const energyThreshold = avgEnergy * 1.5

          // Only store significant moments
          if (feature.energy > energyThreshold && feature.rms > 0.15) {
            features.push({
              time: currentTime,
              rms: feature.rms,
              energy: feature.energy,
              centroid: feature.spectralCentroid,
              zcr: feature.zcr
            })
          }

          if (currentTime >= audioBuffer.duration) {
            analyzer.stop()
            source.stop()
            audioContext.close()

            // Process collected features
            features = features.filter((f, i, arr) => {
              if (i === 0 || i === arr.length - 1) return false
              const prevEnergy = arr[i - 1].energy
              const nextEnergy = arr[i + 1].energy
              return f.energy > prevEnergy * 1.2 && f.energy > nextEnergy * 1.2
            })

            // Sort by energy to get distribution
            const sortedEnergies = features.map(f => f.energy).sort((a, b) => b - a)
            const energyPercentile75 = sortedEnergies[Math.floor(sortedEnergies.length * 0.75)]

            // Generate notes
            features.forEach((f) => {
              if (f.time - lastNoteTime >= minTimeBetweenNotes) {
                let direction
                const intensity = f.rms * f.energy
                
                if (f.energy > energyPercentile75) {
                  direction = f.centroid > 4000 ? DIRECTIONS.UP : DIRECTIONS.DOWN
                } else {
                  direction = f.zcr > 50 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT
                }

                gameTrack.addNote({
                  midi: direction,
                  time: f.time,
                  duration: 0.1,
                  velocity: Math.min(intensity * 127, 127)
                })

                lastNoteTime = f.time
              }
            })

            resolve(new Blob([midi.toArray()], { type: 'audio/midi' }))
          }
        }
      })

      analyzer.start()
      source.start(0)
    } catch (err) {
      reject(err)
    }
  })
} 