export interface SoundItem {
  id: string;
  source: string; // base64 data URI or URL
  name: string;
  startTime?: number; // for cropping (in seconds)
  endTime?: number; // for cropping (in seconds)
}

export interface SoundPack {
  id: string;
  name: string;
  icon?: string; // Optional emoji/icon for the UI
  type: 'full' | 'memory'; // 'full' = 16 sounds, 'memory' = 8 sounds (pairs)
  isCustom?: boolean; // True if created by the user and stored locally
  sounds: SoundItem[]; // Array of sounds (16 for full, 8 for memory)
}

export interface MarkerDetection {
  id: number;
  corners: { x: number; y: number }[];
}

export interface AppConfig {
  activePackId: string;
  debugMode: boolean;
}

// Extend window interface
declare global {
  interface Window {
    // Add any global variables here if needed
  }
}