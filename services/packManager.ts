import localforage from 'localforage';
import { SoundPack } from '../types';
import { FALLBACK_PACKS } from '../constants';

const PACKS_STORE_KEY = 'custom_sound_packs';

class PackManager {
  private customPacks: SoundPack[] = [];

  constructor() {
    localforage.config({
      name: 'ProsopopusV2',
      storeName: 'sound_packs'
    });
  }

  public async init(): Promise<void> {
    try {
      const stored = await localforage.getItem<SoundPack[]>(PACKS_STORE_KEY);
      if (stored) {
        this.customPacks = stored;
      }
    } catch (e) {
      console.error("Failed to load custom packs from local storage", e);
    }
  }

  public getAllPacks(): SoundPack[] {
    return [...FALLBACK_PACKS, ...this.customPacks];
  }

  public getPackById(id: string): SoundPack | undefined {
    return this.getAllPacks().find(p => p.id === id);
  }

  public async saveCustomPack(pack: SoundPack): Promise<void> {
    // Ensure it's marked as custom
    pack.isCustom = true;
    
    // Check if updating or adding
    const existingIndex = this.customPacks.findIndex(p => p.id === pack.id);
    if (existingIndex >= 0) {
      this.customPacks[existingIndex] = pack;
    } else {
      this.customPacks.push(pack);
    }

    try {
      await localforage.setItem(PACKS_STORE_KEY, this.customPacks);
    } catch (e) {
      console.error("Failed to save custom pack", e);
      throw new Error("Storage full or unavailable");
    }
  }

  public async deleteCustomPack(id: string): Promise<void> {
    this.customPacks = this.customPacks.filter(p => p.id !== id);
    await localforage.setItem(PACKS_STORE_KEY, this.customPacks);
  }
}

export const packManager = new PackManager();
