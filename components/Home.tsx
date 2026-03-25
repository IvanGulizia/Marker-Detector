import React from 'react';
import { SoundPack } from '../types';

interface HomeProps {
  packs: SoundPack[];
  onSelectPack: (packId: string) => void;
  debugMode: boolean;
  onToggleDebug: () => void;
}

const getIconForPack = (pack: SoundPack) => {
  if (pack.icon) return pack.icon;
  // Simple heuristic for default icons based on ID/Name
  const lowerId = pack.id.toLowerCase();
  if (lowerId.includes('animal')) return '🦁';
  if (lowerId.includes('drum')) return '🥁';
  if (lowerId.includes('space') || lowerId.includes('sci')) return '🚀';
  if (lowerId.includes('piano') || lowerId.includes('music')) return '🎹';
  return '📦'; // Default box icon
};

export const Home: React.FC<HomeProps> = ({ packs, onSelectPack, debugMode, onToggleDebug }) => {
  return (
    <div className="min-h-screen bg-zinc-50 text-gray-900 flex flex-col p-6 overflow-y-auto">
      
      {/* Header */}
      <header className="mt-8 mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-gray-900">Choose a Pack</h1>
          <p className="text-gray-500">Select a sound pack to start detecting markers.</p>
        </div>
        <button 
          onClick={onToggleDebug}
          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${debugMode ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
        >
          {debugMode ? 'DEBUG ON' : 'DEBUG OFF'}
        </button>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full pb-10">
        {packs.map((pack) => (
          <div
            key={pack.id}
            onClick={() => onSelectPack(pack.id)}
            role="button"
            tabIndex={0}
            className="group relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 text-left flex items-center gap-6 cursor-pointer"
          >
            {/* Icon Container */}
            <div className="w-16 h-16 bg-blue-50 text-3xl flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-inner">
              {getIconForPack(pack)}
            </div>
            
            {/* Text */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                {pack.name}
              </h3>
              <p className="text-sm text-gray-400 font-medium mt-1 group-hover:text-blue-500">
                Tap to start
              </p>
            </div>

            {/* Arrow Icon */}
            <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M16.72 7.72a.75.75 0 011.06 0l3.75 3.75a.75.75 0 010 1.06l-3.75 3.75a.75.75 0 11-1.06-1.06l2.47-2.47H3a.75.75 0 010-1.5h16.19l-2.47-2.47a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ))}
      </div>
      
      <footer className="mt-auto text-center text-xs text-gray-400 py-4">
        v1.0 • ArUco Detection
      </footer>
    </div>
  );
};