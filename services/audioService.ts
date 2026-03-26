import { VALID_MARKER_IDS, MEMORY_PAIRS } from '../constants';
import { packManager } from './packManager';

class AudioService {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map(); // key: "packId-markerId"
  
  // Map IDs to musical notes (frequencies) for the fallback synthesizer
  // Pentatonic scale-ish mapping for pleasant sounds
  private idToFrequency: Map<number, number> = new Map();

  constructor() {
    // Generate frequencies based on IDs
    const baseFreq = 220; // A3
    VALID_MARKER_IDS.forEach((id, index) => {
      // Just a simple formula to spread frequencies out
      const freq = baseFreq * Math.pow(1.05946, index * 2); 
      this.idToFrequency.set(id, freq);
    });
  }

  // Initialize AudioContext (must be called after user interaction)
  public async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Construct the path for a sound file
  private getSoundUrl(packId: string, markerId: number): string {
    return `/soundpacks/${packId}/${markerId}.wav`;
  }

  // Preload a specific sound
  private async loadSound(packId: string, markerId: number): Promise<void> {
    const cacheKey = `${packId}-${markerId}`;
    if (this.buffers.has(cacheKey)) return;

    try {
      const pack = packManager.getPackById(packId);
      if (!pack) throw new Error("Pack not found");

      let soundSource: string | undefined;

      // Handle memory mode mapping
      if (pack.type === 'memory') {
        const pairIndex = MEMORY_PAIRS.findIndex(pair => pair.includes(markerId));
        if (pairIndex !== -1) {
          // In memory mode, the sound key is the index of the pair (0-7)
          soundSource = pack.sounds[pairIndex];
        }
      } else {
        // Full mode: sound key is the marker ID
        soundSource = pack.sounds[markerId];
      }

      if (!soundSource) {
        // If it's a default pack without custom sounds, try fetching from public folder
        if (!pack.isCustom) {
          soundSource = this.getSoundUrl(packId, markerId);
        } else {
          throw new Error("No custom sound provided for this marker");
        }
      }

      const response = await fetch(soundSource);
      if (!response.ok) throw new Error(`File missing`);
      const arrayBuffer = await response.arrayBuffer();
      if (this.audioContext) {
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(cacheKey, audioBuffer);
      }
    } catch (error) {
      // Silent fail - we will use synthesizer later
    }
  }

  // Preload all valid sounds for a pack
  public async preloadPack(packId: string) {
    if (!this.audioContext) await this.init();
    
    console.log(`[AudioService] Preloading pack: ${packId}`);
    const promises = VALID_MARKER_IDS.map(id => this.loadSound(packId, id));
    await Promise.allSettled(promises);
  }

  private playTone(markerId: number) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    const freq = this.idToFrequency.get(markerId) || 440;
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
  }

  // Play sound for a marker
  public play(packId: string, markerId: number) {
    if (!this.audioContext) return;
    if (!VALID_MARKER_IDS.includes(markerId)) return;

    const cacheKey = `${packId}-${markerId}`;
    const buffer = this.buffers.get(cacheKey);

    if (buffer) {
      // Play File
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } else {
      // Fallback: Play Synth Tone
      console.log(`[Audio] Playing synth tone for ID ${markerId}`);
      this.playTone(markerId);
    }
  }
}

export const audioService = new AudioService();