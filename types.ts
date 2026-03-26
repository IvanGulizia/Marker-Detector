export interface SoundPack {
  id: string;
  name: string;
  icon?: string; // Optional emoji/icon for the UI
  type: 'full' | 'memory'; // 'full' = 16 sounds, 'memory' = 8 sounds (pairs)
  isCustom?: boolean; // True if created by the user and stored locally
  sounds: Record<number, string>; // Maps marker ID to audio URL or base64 data URI
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