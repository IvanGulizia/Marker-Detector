import React from 'react';
import { SoundPack } from '../types';
import { Plus, Trash2, Music, Brain } from 'lucide-react';

interface HomeProps {
  packs: SoundPack[];
  onSelectPack: (packId: string) => void;
  debugMode: boolean;
  onToggleDebug: () => void;
  onCreatePack: () => void;
  onDeletePack: (packId: string) => void;
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

export const Home: React.FC<HomeProps> = ({ packs, onSelectPack, debugMode, onToggleDebug, onCreatePack, onDeletePack }) => {
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
        {/* Create New Pack Button */}
        <div
          onClick={onCreatePack}
          role="button"
          tabIndex={0}
          className="group relative bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-3xl p-6 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 text-left flex items-center justify-center gap-4 cursor-pointer"
        >
          <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full group-hover:scale-110 transition-transform duration-300">
            <Plus size={24} />
          </div>
          <span className="text-lg font-bold text-blue-600">Create Custom Pack</span>
        </div>

        {packs.map((pack) => (
          <div
            key={pack.id}
            className="group relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 flex items-center gap-6"
          >
            {/* Icon Container */}
            <div 
              onClick={() => onSelectPack(pack.id)}
              className="w-16 h-16 bg-blue-50 text-3xl flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-inner cursor-pointer"
            >
              {getIconForPack(pack)}
            </div>
            
            {/* Text */}
            <div className="flex-1 cursor-pointer" onClick={() => onSelectPack(pack.id)}>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                {pack.name}
                {pack.type === 'memory' ? <Brain size={16} className="text-purple-500" /> : <Music size={16} className="text-blue-500" />}
              </h3>
              <p className="text-sm text-gray-400 font-medium mt-1 group-hover:text-blue-500">
                {pack.type === 'full' ? '16 Sounds' : '8 Pairs (Memory)'} • {pack.isCustom ? 'Custom' : 'Default'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {pack.isCustom && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeletePack(pack.id); }}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Delete Pack"
                >
                  <Trash2 size={20} />
                </button>
              )}
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