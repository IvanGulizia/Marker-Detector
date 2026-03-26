import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsAruco from 'js-aruco2';
import 'js-aruco2/src/dictionaries/aruco_4x4_1000.js';
import { audioService } from '../services/audioService';
import { packManager } from '../services/packManager';
import { VALID_MARKER_IDS, SOUND_COOLDOWN_MS } from '../constants';
import { SoundItem } from '../types';

const { AR } = jsAruco;

interface ScannerProps {
  currentPackId: string;
  onBack: () => void;
  initialDebugMode?: boolean;
}

export const Scanner: React.FC<ScannerProps> = ({ currentPackId, onBack, initialDebugMode = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [cvReady, setCvReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // New state to track actual playback
  const [detectedIds, setDetectedIds] = useState<number[]>([]);
  const [debugMode, setDebugMode] = useState(initialDebugMode); // Default to false for cleaner initial look
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastTriggeredId, setLastTriggeredId] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [loadingMsg, setLoadingMsg] = useState("Loading Vision Engine...");
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [procWidth, setProcWidth] = useState(800); // 800px default for better detection
  const [scanInterval, setScanInterval] = useState(100); // 100ms default
  const [persistenceMs, setPersistenceMs] = useState(500); // 500ms tracking memory
  
  const [markerMap, setMarkerMap] = useState<Record<number, SoundItem>>({});
  
  const [debugStats, setDebugStats] = useState({ fps: 0, processingTime: 0, resolution: '0x0' });
  
  const requestRef = useRef<number | null>(null);
  const lastScanTime = useRef<number>(0);
  const lastPlayedTime = useRef<Map<number, number>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const trackedMarkersRef = useRef<Map<number, { id: number, corners: any[], lastSeen: number }>>(new Map());
  
  const initAttempted = useRef(false);

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 8));
    console.log(`[APP] ${msg}`);
  };

  // --- 1. VISION INITIALIZATION ---
  useEffect(() => {
    // js-aruco2 is pure JS, no WASM compilation needed!
    detectorRef.current = new AR.Detector({ dictionaryName: 'ARUCO_4X4_1000' });
    addLog("Vision Engine Initialized (js-aruco2)");
    setCvReady(true);
  }, []);

  const generateMapping = useCallback(async () => {
    const pack = packManager.getPackById(currentPackId);
    if (!pack) return;

    await audioService.preloadPack(pack);

    if (pack.sounds.length > 0) {
      const shuffledMarkers = [...VALID_MARKER_IDS].sort(() => Math.random() - 0.5);
      const newMap: Record<number, SoundItem> = {};
      
      if (pack.type === 'full') {
        // Map up to 16 sounds to 16 markers
        for(let i = 0; i < Math.min(16, pack.sounds.length); i++) {
          newMap[shuffledMarkers[i]] = pack.sounds[i];
        }
      } else {
        // Map up to 8 sounds to 16 markers (pairs)
        for(let i = 0; i < Math.min(8, pack.sounds.length); i++) {
          newMap[shuffledMarkers[i*2]] = pack.sounds[i];
          newMap[shuffledMarkers[i*2 + 1]] = pack.sounds[i];
        }
      }
      setMarkerMap(newMap);
      addLog(`Mapping generated for ${pack.name}`);
    } else {
      setMarkerMap({}); // Empty map means fallback to synth
      addLog(`Using synth fallback for ${pack.name}`);
    }
  }, [currentPackId]);

  // Preload sounds and generate mapping
  useEffect(() => {
    generateMapping();
  }, [generateMapping]);

  // --- 2. CAMERA SETUP ---
  useEffect(() => {
    let mounted = true;
    setIsVideoPlaying(false); // Reset on camera switch

    const startCamera = async () => {
      setCameraError(null);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      try {
        addLog("Requesting Camera...");
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported. Ensure you are on HTTPS.");
        }

        // Use basic constraints first to ensure it works on all devices
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            // Don't force strict resolution to avoid "OverconstrainedError" on some mobiles
            width: { ideal: 1280 }, 
            height: { ideal: 720 }
          },
          audio: false,
        };

        const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
        let timeoutId: any;
        const timeoutPromise = new Promise<MediaStream>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Camera request timed out")), 10000);
        });

        const stream = await Promise.race([streamPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        addLog("Camera Acquired");
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          const attemptPlay = () => {
             if (!mounted) return;
             addLog("Attempting Play...");
             videoRef.current?.play()
              .then(() => {
                addLog("Video Playing");
                setIsVideoPlaying(true);
                if(videoRef.current) {
                  setDebugStats(prev => ({ 
                    ...prev, 
                    resolution: `${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}` 
                  }));
                }
              })
              .catch(e => {
                console.error(e);
                setCameraError("Autoplay blocked. Tap screen.");
                addLog("Play Error: " + e.message);
              });
          };

          // Try playing immediately
          attemptPlay();

          // Also listen to loadedmetadata just in case
          videoRef.current.onloadedmetadata = () => {
             addLog("Meta Loaded.");
             if (!isVideoPlaying) attemptPlay();
          };
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        let msg = "Camera access denied.";
        if (err.name === 'NotAllowedError') msg = "Permission denied. Enable camera in settings.";
        if (err.name === 'NotFoundError') msg = "No camera found.";
        if (err.name === 'NotReadableError') msg = "Camera in use by another app.";
        
        setCameraError(msg);
        addLog("Cam Fail: " + err.name);
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [facingMode]);

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleSimulate = () => {
    addLog("[TEST] Simulating Marker #13");
    triggerMarker(13);
  };

  // --- 3. TRIGGER LOGIC ---
  const triggerMarker = (id: number) => {
    const now = performance.now();
    const lastTime = lastPlayedTime.current.get(id) || 0;
    
    setLastTriggeredId(id);
    setTimeout(() => setLastTriggeredId(null), 300);

    if (now - lastTime > SOUND_COOLDOWN_MS) {
      addLog(`MATCH ID ${id} !!!`);
      
      const item = markerMap[id];
      if (item) {
        audioService.playItem(item);
      } else {
        audioService.playSynth(id);
      }
      
      lastPlayedTime.current.set(id, now);
    }
  };

  // --- 4. DETECTION LOOP ---
  const processFrame = useCallback(() => {
    if (!cvReady) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    if (!videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Safety check: is video actually ready?
    if (video.readyState !== 4 || video.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = performance.now();
    
    if (now - lastScanTime.current > scanInterval) {
      const startTime = performance.now();
      lastScanTime.current = now;

      try {
        if (!processingCanvasRef.current) processingCanvasRef.current = document.createElement('canvas');
        const pCanvas = processingCanvasRef.current;
        
        const scale = procWidth / video.videoWidth;
        const procHeight = video.videoHeight * scale;
        
        if (pCanvas.width !== procWidth) {
           pCanvas.width = procWidth;
           pCanvas.height = procHeight;
        }

        const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
        if (pCtx && detectorRef.current) {
           pCtx.drawImage(video, 0, 0, procWidth, procHeight);
           const imageData = pCtx.getImageData(0, 0, procWidth, procHeight);
           
           const markers = detectorRef.current.detect(imageData);

           // Update tracked markers with new detections
           if (markers.length > 0) {
             for (let i = 0; i < markers.length; i++) {
               const marker = markers[i];
               const id = marker.id;
               const isValid = VALID_MARKER_IDS.includes(id);
               
               if (debugMode || isValid) {
                 const invScale = 1 / scale;
                 const scaledCorners = marker.corners.map((c: any) => ({ x: c.x * invScale, y: c.y * invScale }));
                 
                 trackedMarkersRef.current.set(id, {
                   id,
                   corners: scaledCorners,
                   lastSeen: now
                 });
               }
             }
           }

           const activeIds: number[] = [];

           // Draw and trigger tracked markers
           trackedMarkersRef.current.forEach((data, id) => {
             if (now - data.lastSeen > persistenceMs) {
               trackedMarkersRef.current.delete(id);
             } else {
               const isValid = VALID_MARKER_IDS.includes(id);
               
               if (debugMode || isValid) {
                   const [c0, c1, c2, c3] = data.corners;
                   
                   ctx.beginPath();
                   ctx.lineWidth = isValid ? 4 : 2;
                   
                   // Fade out slightly if it's an old detection (ghosting effect)
                   const age = now - data.lastSeen;
                   const opacity = Math.max(0.3, 1 - (age / persistenceMs));
                   
                   ctx.strokeStyle = isValid ? `rgba(34, 197, 94, ${opacity})` : `rgba(255, 165, 0, ${opacity * 0.5})`;
                   ctx.moveTo(c0.x, c0.y);
                   ctx.lineTo(c1.x, c1.y);
                   ctx.lineTo(c2.x, c2.y);
                   ctx.lineTo(c3.x, c3.y);
                   ctx.closePath();
                   ctx.stroke();
                   
                   const centerX = (c0.x + c1.x + c2.x + c3.x) / 4;
                   const centerY = (c0.y + c1.y + c2.y + c3.y) / 4;
                   
                   ctx.font = "bold 24px monospace";
                   ctx.fillStyle = isValid ? `rgba(34, 197, 94, ${opacity})` : `rgba(255, 165, 0, ${opacity})`;
                   if(isValid) ctx.fillText(`ID:${id}`, centerX, centerY);
               }

               if (isValid) {
                 activeIds.push(id);
                 triggerMarker(id);
               }
             }
           });
           
           setDetectedIds(activeIds);

           const endTime = performance.now();
           setDebugStats(prev => ({
             ...prev,
             processingTime: Math.round(endTime - startTime),
             fps: Math.round(1000 / (endTime - startTime || 1))
           }));
        }
      } catch (e: any) {
        // Silent catch for intermittent frames
        console.error(e);
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [cvReady, currentPackId, debugMode, procWidth, scanInterval, persistenceMs]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cvReady, processFrame]);

  // --- RENDER ---
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video Element with AutoPlay */}
      <video 
        ref={videoRef} 
        className={`absolute w-full h-full object-cover transition-opacity duration-500 ${isVideoPlaying ? 'opacity-100' : 'opacity-0'}`} 
        playsInline 
        autoPlay 
        muted 
      />
      <canvas ref={canvasRef} className="absolute w-full h-full pointer-events-none object-cover" />

      {/* Visual Trigger Feedback */}
      <div className={`absolute inset-0 bg-green-500 pointer-events-none transition-opacity duration-100 ${lastTriggeredId ? 'opacity-30' : 'opacity-0'}`} />

      {/* ERROR OVERLAY (High Priority) */}
      {cameraError && (
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
           <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4 text-3xl">
             !
           </div>
           <h2 className="text-xl font-bold text-white mb-2">Camera Issue</h2>
           <p className="text-red-300 mb-6">{cameraError}</p>
           <div className="flex flex-col gap-3 w-full max-w-xs">
             <button onClick={() => window.location.reload()} className="bg-gray-800 text-white px-6 py-3 rounded-xl font-medium border border-gray-700">
               Retry
             </button>
             <button onClick={onBack} className="text-gray-400 py-2">
               Go Back
             </button>
           </div>
        </div>
      )}

      {/* LOADING OVERLAY (Wait for Vision + Camera) */}
      {(!cvReady || !isVideoPlaying) && !cameraError && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900 z-40 text-white p-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-blue-500 border-gray-800 mb-6"></div>
            
            <h2 className="text-xl font-bold mb-2">
              {!cvReady ? "Initializing Vision" : "Starting Camera"}
            </h2>
            
            <p className="font-mono text-sm text-gray-500 mb-8 max-w-xs">
              {!cvReady ? loadingMsg : "Waiting for video stream..."}
            </p>
            
            {/* Manual Bypass if stuck */}
            {!cvReady && (
              <button 
                onClick={() => { setCvReady(true); addLog("Loading bypassed"); }}
                className="text-xs text-gray-600 underline decoration-gray-700 underline-offset-4"
              >
                Skip Vision Check
              </button>
            )}
         </div>
      )}

      {/* HUD Controls */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-safe flex justify-between items-start pointer-events-none">
        <button onClick={onBack} className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>

        <div className="flex gap-2 pointer-events-auto">
           <button onClick={generateMapping} className="w-10 h-10 flex items-center justify-center bg-blue-600/80 backdrop-blur-md rounded-full text-white shadow-lg transition-colors hover:bg-blue-600" title="Shuffle Sounds">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
           {debugMode && (
             <button onClick={handleSimulate} className="px-3 h-10 rounded-full font-bold bg-blue-600/90 text-white backdrop-blur-md text-xs shadow-lg">
               SIM #13
             </button>
           )}
           <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg transition-colors hover:bg-black/60">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
           <button onClick={() => setDebugMode(!debugMode)} className={`px-4 h-10 rounded-full font-bold backdrop-blur-md text-xs shadow-lg transition-colors ${debugMode ? 'bg-green-600 text-white' : 'bg-black/40 text-gray-400'}`}>
             DEBUG
           </button>
           <button onClick={handleSwitchCamera} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
           </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Detection Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="text-gray-300 font-medium">Resolution (Quality)</label>
                  <span className="text-blue-400 font-mono">{procWidth}px</span>
                </div>
                <input 
                  type="range" min="160" max="800" step="80" 
                  value={procWidth} 
                  onChange={(e) => setProcWidth(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Higher = better detection, lower = better battery</p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="text-gray-300 font-medium">Tracking Memory</label>
                  <span className="text-green-400 font-mono">{persistenceMs}ms</span>
                </div>
                <input 
                  type="range" min="0" max="2000" step="100" 
                  value={persistenceMs} 
                  onChange={(e) => setPersistenceMs(Number(e.target.value))}
                  className="w-full accent-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">How long to remember a marker after it's lost</p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="text-gray-300 font-medium">Scan Interval</label>
                  <span className="text-purple-400 font-mono">{scanInterval}ms</span>
                </div>
                <input 
                  type="range" min="30" max="500" step="10" 
                  value={scanInterval} 
                  onChange={(e) => setScanInterval(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Lower = faster reaction, higher = better battery</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Debug Logs Panel */}
      {debugMode && (
        <div className="absolute bottom-safe left-4 right-4 z-30 pointer-events-none flex flex-col gap-2">
          <div className="bg-black/80 backdrop-blur text-green-400 p-3 rounded-xl font-mono text-[10px] shadow-lg border border-gray-800">
             <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-700">
               <span className="font-bold text-white">SYSTEM STATUS</span>
               <span className={cvReady ? "text-green-500" : "text-yellow-500"}>{cvReady ? "OK" : "INIT"}</span>
             </div>
             <div className="grid grid-cols-2 gap-x-2">
               <span>RES: {debugStats.resolution}</span>
               <span>FPS: {debugStats.fps}</span>
             </div>
          </div>
          
          <div className="bg-black/80 backdrop-blur p-2 rounded-xl border border-gray-800 pointer-events-auto max-h-32 overflow-y-auto shadow-lg">
             {debugLog.map((log, i) => (
               <div key={i} className="text-[9px] font-mono text-gray-300 border-b border-gray-800/50 pb-1 mb-1 last:border-0 last:mb-0 break-words">{log}</div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};