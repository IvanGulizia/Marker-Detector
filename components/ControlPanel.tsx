import React, { useEffect, useState } from 'react';
import { SoundPack } from '../types';
import { FALLBACK_PACKS } from '../constants';

interface ControlPanelProps {
  currentPack: string;
  onPackChange: (packId: string) => void;
  debugMode: boolean;
  onDebugToggle: () => void;
  isCameraActive: boolean;
  onStartCamera: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentPack,
  onPackChange,
  debugMode,
  onDebugToggle,
  isCameraActive,
  onStartCamera
}) => {
  const [packs, setPacks] = useState<SoundPack[]>(FALLBACK_PACKS);

  useEffect(() => {
    // Attempt to fetch packs.json, fallback to constant if fails
    fetch('/packs.json')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('No packs.json found');
      })
      .then(data => setPacks(data))
      .catch(() => {
        console.log('Using fallback pack list');
        // keep fallback
      });
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-md p-6 rounded-t-3xl z-20 border-t border-gray-700 shadow-2xl">
      <div className="max-w-md mx-auto space-y-4">
        
        {!isCameraActive ? (
          <button
            onClick={onStartCamera}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 text-lg"
          >
            Start Camera
          </button>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Sound Pack Selector */}
            <div className="space-y-2">
              <label className="text-gray-400 text-xs uppercase tracking-wider font-semibold ml-1">Sound Pack</label>
              <div className="relative">
                <select
                  value={currentPack}
                  onChange={(e) => onPackChange(e.target.value)}
                  className="w-full appearance-none bg-gray-800 text-white border border-gray-600 rounded-xl py-3 px-4 pr-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                >
                  {packs.map(pack => (
                    <option key={pack.id} value={pack.id}>{pack.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Status & Debug Controls */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
               <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-sm text-gray-300 font-medium">Camera Live</span>
               </div>
               
               <label className="flex items-center gap-2 cursor-pointer group">
                 <span className="text-xs font-medium text-gray-500 group-hover:text-gray-300 transition-colors">Debug Overlay</span>
                 <div className="relative">
                   <input type="checkbox" className="sr-only" checked={debugMode} onChange={onDebugToggle} />
                   <div className={`block w-10 h-6 rounded-full transition-colors ${debugMode ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                   <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${debugMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                 </div>
               </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};