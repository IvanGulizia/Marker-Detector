import { SoundPack } from './types';

export const VALID_MARKER_IDS = [
  13, 30, 41, 42, 43, 49, 50, 54,
  63, 72, 108, 140, 164, 175, 194, 236
];

export const DEFAULT_PACK_ID = 'default';

// How often to scan for markers (ms)
// 100ms = 10 FPS detection (saves battery)
export const DETECTION_INTERVAL_MS = 100;

// Debounce sound playback (ms)
export const SOUND_COOLDOWN_MS = 2000;

// Default to a fallback list if packs.json fetch fails
export const FALLBACK_PACKS: SoundPack[] = [
  { 
    id: 'default', 
    name: 'Synth Default', 
    type: 'full',
    icon: '🎹',
    sounds: [] // Empty means it will fallback to synth tones
  },
  { 
    id: 'animals', 
    name: 'Animals (Memory)', 
    type: 'memory',
    icon: '🦁',
    sounds: [] // Placeholder for future default assets
  }
];