import React, { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Scanner } from './components/Scanner';
import { audioService } from './services/audioService';
import { FALLBACK_PACKS } from './constants';
import { SoundPack } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'scanner'>('home');
  const [currentPack, setCurrentPack] = useState<string>('default');
  const [packs, setPacks] = useState<SoundPack[]>(FALLBACK_PACKS);
  const [debugMode, setDebugMode] = useState<boolean>(true); // Default to true for debugging

  useEffect(() => {
    // Load pack configuration
    fetch('/packs.json')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setPacks(data);
        } else {
          console.warn("packs.json is not an array, using fallback");
          setPacks(FALLBACK_PACKS);
        }
      })
      .catch((err) => {
        console.error("Failed to load packs.json:", err);
        setPacks(FALLBACK_PACKS);
      });
  }, []);

  const handlePackSelect = async (packId: string) => {
    // Initialize audio context on user gesture (tap)
    await audioService.init();
    
    setCurrentPack(packId);
    setView('scanner');
  };

  const handleBack = () => {
    setView('home');
  };

  return (
    <div className="h-screen w-full bg-gray-900 overflow-hidden relative">
      {view === 'home' ? (
        <Home 
          packs={packs} 
          onSelectPack={handlePackSelect} 
          debugMode={debugMode}
          onToggleDebug={() => setDebugMode(!debugMode)}
        />
      ) : (
        <Scanner 
          currentPackId={currentPack}
          onBack={handleBack}
          initialDebugMode={debugMode}
        />
      )}
    </div>
  );
};

export default App;