import React, { useState, useRef } from 'react';
import { VALID_MARKER_IDS, MEMORY_PAIRS } from '../constants';
import { SoundPack } from '../types';
import { packManager } from '../services/packManager';
import { Upload, Save, X, Music, Brain } from 'lucide-react';

interface PackCreatorProps {
  onClose: () => void;
  onSave: () => void;
}

export const PackCreator: React.FC<PackCreatorProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [type, setType] = useState<'full' | 'memory'>('full');
  const [sounds, setSounds] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || activeUploadId === null) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSounds(prev => ({ ...prev, [activeUploadId]: result }));
      setActiveUploadId(null);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (id: number) => {
    setActiveUploadId(id);
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a pack name");
      return;
    }

    const requiredCount = type === 'full' ? 16 : 8;
    if (Object.keys(sounds).length < requiredCount) {
      alert(`Please upload all ${requiredCount} sounds`);
      return;
    }

    setIsSaving(true);
    try {
      const newPack: SoundPack = {
        id: `custom_${Date.now()}`,
        name: name.trim(),
        icon,
        type,
        isCustom: true,
        sounds
      };
      
      await packManager.saveCustomPack(newPack);
      onSave();
    } catch (e) {
      alert("Failed to save pack. Storage might be full.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderUploadSlots = () => {
    if (type === 'full') {
      return VALID_MARKER_IDS.map((id) => (
        <div key={id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
          <span className="text-gray-300 font-mono text-sm">Marker #{id}</span>
          <button 
            onClick={() => triggerUpload(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${sounds[id] ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            {sounds[id] ? '✓ Uploaded' : <><Upload size={16} /> Upload</>}
          </button>
        </div>
      ));
    } else {
      return MEMORY_PAIRS.map((pair, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
          <span className="text-gray-300 font-mono text-sm">Pair #{pair[0]} & #{pair[1]}</span>
          <button 
            onClick={() => triggerUpload(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${sounds[index] ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            {sounds[index] ? '✓ Uploaded' : <><Upload size={16} /> Upload</>}
          </button>
        </div>
      ));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
        <h2 className="text-xl font-bold text-white">Create Sound Pack</h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Pack Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Awesome Drums"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Icon (Emoji)</label>
            <input 
              type="text" 
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Pack Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setType('full'); setSounds({}); }}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${type === 'full' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                <Music size={24} />
                <span className="font-medium">Full (16 Sounds)</span>
                <span className="text-xs opacity-70 text-center">One sound per marker</span>
              </button>
              <button 
                onClick={() => { setType('memory'); setSounds({}); }}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${type === 'memory' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                <Brain size={24} />
                <span className="font-medium">Memory (8 Pairs)</span>
                <span className="text-xs opacity-70 text-center">Two markers share one sound</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-800 pb-2">Upload Sounds</h3>
          <p className="text-sm text-gray-400 mb-4">
            {type === 'full' ? 'Upload 16 different sounds.' : 'Upload 8 sounds. Each sound will be assigned to a pair of markers.'}
          </p>
          <div className="space-y-2">
            {renderUploadSlots()}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : <><Save size={20} /> Save Pack</>}
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="audio/*" 
        className="hidden" 
      />
    </div>
  );
};
