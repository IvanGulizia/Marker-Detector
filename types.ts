export interface SoundPack {
  id: string;
  name: string;
  icon?: string; // Optional emoji/icon for the UI
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