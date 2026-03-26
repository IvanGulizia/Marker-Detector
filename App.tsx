import React, { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Scanner } from './components/Scanner';
import { PackCreator } from './components/PackCreator';
import { audioService } from './services/audioService';
import { packManager } from './services/packManager';
import { SoundPack } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'scanner' | 'creator'>('home');
  const [currentPack, setCurrentPack] = useState<string>('default');
  const [packs, setPacks] = useState<SoundPack[]>([]);
  const [debugMode, setDebugMode] = useState<boolean>(true); // Default to true for debugging

  const loadPacks = async () => {
    await packManager.init();
    setPacks(packManager.getAllPacks());
  };

  useEffect(() => {
    loadPacks();
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
      {view === 'home' && (
        <Home 
          packs={packs} 
          onSelectPack={handlePackSelect} 
          debugMode={debugMode}
          onToggleDebug={() => setDebugMode(!debugMode)}
          onCreatePack={() => setView('creator')}
          onDeletePack={async (id) => {
            await packManager.deleteCustomPack(id);
            loadPacks();
          }}
        />
      )}
      {view === 'scanner' && (
        <Scanner 
          currentPackId={currentPack}
          onBack={handleBack}
          initialDebugMode={debugMode}
        />
      )}
      {view === 'creator' && (
        <PackCreator 
          onClose={() => setView('home')}
          onSave={() => {
            loadPacks();
            setView('home');
          }}
        />
      )}
    </div>
  );
};

export default App;