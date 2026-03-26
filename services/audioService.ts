import { VALID_MARKER_IDS } from '../constants';
import { packManager } from './packManager';
import { SoundPack, SoundItem } from '../types';

class AudioService {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map(); // key: soundItem.id
  private isUnlocked = false;
  
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
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn("Could not resume AudioContext", e);
      }
    }
    
    // iOS Unlock Hack: play a silent buffer
    if (!this.isUnlocked && this.audioContext.state === 'running') {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      this.isUnlocked = true;
    }
  }

  // Preload all sounds for a pack
  public async preloadPack(pack: SoundPack) {
    if (!this.audioContext) await this.init();
    
    console.log(`[AudioService] Preloading pack: ${pack.name}`);
    
    const promises = pack.sounds.map(async (item) => {
      if (this.buffers.has(item.id)) return;
      try {
        const response = await fetch(item.source);
        if (!response.ok) throw new Error(`File missing`);
        const arrayBuffer = await response.arrayBuffer();
        if (this.audioContext) {
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.buffers.set(item.id, audioBuffer);
        }
      } catch (error) {
        console.error("Failed to load sound item", item.name, error);
      }
    });

    await Promise.allSettled(promises);
  }

  public async playSynth(markerId: number) {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    console.log(`[Audio] Playing synth tone for ID ${markerId}`);
    this.playTone(markerId);
  }

  private playTone(markerId: number) {
    if (!this.audioContext) return;
    
    const freq = this.idToFrequency.get(markerId) || 440;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    
    const now = this.audioContext.currentTime;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  // Play a specific sound item
  public async playItem(item: SoundItem) {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const buffer = this.buffers.get(item.id);
    if (buffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      const start = item.startTime || 0;
      
      if (item.endTime) {
        source.start(0, start, item.endTime - start);
      } else {
        source.start(0, start);
      }
    } else {
      console.warn(`[Audio] Buffer not found for item ${item.id}`);
    }
  }
}

export const audioService = new AudioService();