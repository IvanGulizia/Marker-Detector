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

  useEffect(() => {
    // Load pack configuration
    fetch('/packs.json')
      .then(res => res.ok ? res.json() : FALLBACK_PACKS)
      .then(setPacks)
      .catch(() => console.log("Using fallback packs"));
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
        />
      ) : (
        <Scanner 
          currentPackId={currentPack}
          onBack={handleBack}
        />
      )}
    </div>
  );
};

export default App;