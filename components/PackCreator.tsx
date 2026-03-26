import React, { useState, useRef } from 'react';
import { SoundPack, SoundItem } from '../types';
import { packManager } from '../services/packManager';
import { Upload, Save, X, Music, Brain, Link as LinkIcon, Mic, Trash2, Play, Square } from 'lucide-react';

interface PackCreatorProps {
  onClose: () => void;
  onSave: () => void;
}

export const PackCreator: React.FC<PackCreatorProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [type, setType] = useState<'full' | 'memory'>('full');
  const [sounds, setSounds] = useState<SoundItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [urlInput, setUrlInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requiredCount = type === 'full' ? 16 : 8;

  // --- FILE UPLOAD ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        addSoundItem(file.name, result);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- URL IMPORT ---
  const handleUrlImport = async () => {
    if (!urlInput) return;
    try {
      // Use a CORS proxy for prototyping
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Failed to fetch");
      const blob = await res.blob();
      
      const reader = new FileReader();
      reader.onload = (e) => {
        addSoundItem(`URL: ${urlInput.split('/').pop() || 'sound'}`, e.target?.result as string);
        setUrlInput('');
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      alert("Could not import from URL. It might be blocked by CORS or invalid.");
    }
  };

  // --- MIC RECORDING ---
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = (e) => {
            addSoundItem(`Recording ${new Date().toLocaleTimeString()}`, e.target?.result as string);
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) {
        alert("Microphone access denied or unavailable.");
      }
    }
  };

  const addSoundItem = (name: string, source: string) => {
    setSounds(prev => {
      if (prev.length >= requiredCount) return prev;
      return [...prev, {
        id: `snd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        source
      }];
    });
  };

  const removeSound = (id: string) => {
    setSounds(prev => prev.filter(s => s.id !== id));
  };

  const playPreview = (source: string) => {
    const audio = new Audio(source);
    audio.play();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a pack name");
      return;
    }

    if (sounds.length < requiredCount) {
      alert(`Please add ${requiredCount - sounds.length} more sound(s)`);
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
        sounds: sounds.slice(0, requiredCount)
      };
      
      await packManager.saveCustomPack(newPack);
      onSave();
    } catch (e) {
      alert("Failed to save pack. Storage might be full.");
    } finally {
      setIsSaving(false);
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
        {/* Basic Info */}
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

          <div className="flex gap-4">
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-400 mb-1">Icon</label>
              <input 
                type="text" 
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-400 mb-1">Pack Type</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setType('full'); setSounds([]); }}
                  className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${type === 'full' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <Music size={18} /> Full (16)
                </button>
                <button 
                  onClick={() => { setType('memory'); setSounds([]); }}
                  className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${type === 'memory' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <Brain size={18} /> Memory (8)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Sounds Section */}
        <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
          <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Add Sounds ({sounds.length}/{requiredCount})</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {/* File Upload */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={sounds.length >= requiredCount}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 hover:border-blue-500 transition-colors disabled:opacity-50"
            >
              <Upload size={24} className="text-blue-400" />
              <span className="text-xs font-medium text-gray-300">Upload Files</span>
            </button>
            <input 
              type="file" 
              multiple
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" 
              className="hidden" 
            />

            {/* URL Import */}
            <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <LinkIcon size={16} />
                <span className="text-xs font-medium">From URL</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                />
                <button 
                  onClick={handleUrlImport}
                  disabled={!urlInput || sounds.length >= requiredCount}
                  className="bg-green-600 text-white px-2 py-1 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Mic Record */}
            <button 
              onClick={toggleRecording}
              disabled={sounds.length >= requiredCount && !isRecording}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors disabled:opacity-50 ${isRecording ? 'bg-red-900/50 border-red-500 animate-pulse' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-red-500'}`}
            >
              {isRecording ? <Square size={24} className="text-red-500" /> : <Mic size={24} className="text-red-400" />}
              <span className="text-xs font-medium text-gray-300">{isRecording ? 'Stop Recording' : 'Record Mic'}</span>
            </button>
          </div>

          {/* Sound List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {sounds.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No sounds added yet.<br/>Upload files, paste a URL, or record from mic.
              </div>
            ) : (
              sounds.map((sound, index) => (
                <div key={sound.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-gray-500 font-mono text-xs w-4">{index + 1}.</span>
                    <button 
                      onClick={() => playPreview(sound.source)}
                      className="w-8 h-8 flex items-center justify-center bg-blue-600/20 text-blue-400 rounded-full hover:bg-blue-600 hover:text-white transition-colors flex-shrink-0"
                    >
                      <Play size={14} className="ml-0.5" />
                    </button>
                    <span className="text-sm text-gray-300 truncate">{sound.name}</span>
                  </div>
                  <button 
                    onClick={() => removeSound(sound.id)}
                    className="p-2 text-gray-500 hover:text-red-500 rounded-full transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <button 
          onClick={handleSave}
          disabled={isSaving || sounds.length < requiredCount}
          className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : <><Save size={20} /> Save Pack ({sounds.length}/{requiredCount})</>}
        </button>
      </div>
    </div>
  );
};
