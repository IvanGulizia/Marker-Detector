import React, { useRef, useEffect, useState, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { VALID_MARKER_IDS, DETECTION_INTERVAL_MS, SOUND_COOLDOWN_MS } from '../constants';

interface ScannerProps {
  currentPackId: string;
  onBack: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ currentPackId, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [cvReady, setCvReady] = useState(false);
  const [detectedIds, setDetectedIds] = useState<number[]>([]);
  const [debugMode, setDebugMode] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastTriggeredId, setLastTriggeredId] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [loadingMsg, setLoadingMsg] = useState("Loading Vision Engine...");
  
  const [debugStats, setDebugStats] = useState({ fps: 0, processingTime: 0, resolution: '0x0' });
  
  const requestRef = useRef<number | null>(null);
  const lastScanTime = useRef<number>(0);
  const lastPlayedTime = useRef<Map<number, number>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  
  // Ref to track if we already tried initializing to prevent double-execution
  const initAttempted = useRef(false);

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 10));
    console.log(`[APP] ${msg}`);
  };

  // --- 1. ROBUST OPENCV INITIALIZATION ---
  useEffect(() => {
    // If already ready, skip
    if (window.cv && window.cv.aruco && window.cv.getBuildInformation) {
      setCvReady(true);
      return;
    }

    let checkTimer: any = null;
    let attempts = 0;

    const checkAndInit = async () => {
      attempts++;
      
      // Step A: Check if script is loaded into window
      if (!window.cv) {
        if (attempts % 20 === 0) setLoadingMsg(`Downloading Engine (${Math.floor(attempts/2)}s)...`);
        return; // Keep waiting
      }

      // Step B: Check state of window.cv
      try {
        // State 1: It's a Promise/Factory function (typical for this build)
        if (typeof window.cv === 'function' && !window.cv.getBuildInformation && !initAttempted.current) {
          initAttempted.current = true;
          addLog("Starting WASM Compilation...");
          setLoadingMsg("Compiling WASM...");
          
          try {
            // Run the factory
            const cvInstance = await window.cv();
            // Replace the factory with the instance globally
            window.cv = cvInstance; 
            addLog("WASM Compiled Successfully.");
          } catch (e: any) {
            addLog("WASM Error: " + e.message);
            initAttempted.current = false; // Allow retry if it failed momentarily
          }
        }
        
        // State 2: It's a Ready Object
        if (window.cv.getBuildInformation) {
          if (window.cv.aruco) {
             addLog("ArUco Module Verified.");
             setCvReady(true);
             if(checkTimer) clearInterval(checkTimer);
          } else {
             // This happens if wrong build is loaded
             addLog("WARNING: cv loaded but ArUco missing.");
             setLoadingMsg("Error: ArUco module missing in this build.");
             if(checkTimer) clearInterval(checkTimer);
          }
        }
      } catch(e: any) {
        addLog("Init Check Error: " + e.message);
      }

      // Timeout after 60 seconds
      if (attempts > 120) {
        setLoadingMsg("Connection Timeout.");
        if(checkTimer) clearInterval(checkTimer);
      }
    };

    checkTimer = setInterval(checkAndInit, 500);

    return () => clearInterval(checkTimer);
  }, []);

  // Preload sounds
  useEffect(() => {
    audioService.preloadPack(currentPackId);
  }, [currentPackId]);

  // --- 2. CAMERA SETUP ---
  useEffect(() => {
    // Don't start camera until user is in this view.
    // We try to start it even if CV isn't ready, so user sees *something*
    const startCamera = async () => {
      setCameraError(null);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 }, // 720p is good balance
            height: { ideal: 720 }
          },
          audio: false,
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play();
             if(videoRef.current) {
               setDebugStats(prev => ({ 
                 ...prev, 
                 resolution: `${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}` 
               }));
             }
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setCameraError("Camera blocked or missing.");
        addLog("Cam Error: " + err);
      }
    };

    startCamera();

    return () => {
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
      audioService.play(currentPackId, id);
      lastPlayedTime.current.set(id, now);
    }
  };

  // --- 4. DETECTION LOOP ---
  const processFrame = useCallback(() => {
    // If not ready, just loop without processing
    if (!cvReady || !window.cv || !window.cv.aruco) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    if (!videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA || !ctx) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Resize canvas to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = performance.now();
    
    // Throttle detection to save battery/CPU
    if (now - lastScanTime.current > DETECTION_INTERVAL_MS) {
      const startTime = performance.now();
      lastScanTime.current = now;

      try {
        const cv = window.cv;
        const aruco = cv.aruco;

        // Create offscreen canvas for processing if needed
        if (!processingCanvasRef.current) processingCanvasRef.current = document.createElement('canvas');
        const pCanvas = processingCanvasRef.current;
        
        // Downscale for processing speed (320px width is enough for ArUco usually)
        const procWidth = 320; 
        const scale = procWidth / video.videoWidth;
        const procHeight = video.videoHeight * scale;
        
        if (pCanvas.width !== procWidth) {
           pCanvas.width = procWidth;
           pCanvas.height = procHeight;
        }

        const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
        if (pCtx) {
           pCtx.drawImage(video, 0, 0, procWidth, procHeight);
           
           let src = cv.imread(pCanvas);
           
           // ArUco Detection Pipeline
           let dictionary = new aruco.Dictionary(aruco.DICT_4X4_250);
           let params = new aruco.DetectorParameters();
           
           // Tune for performance and robustness
           params.adaptiveThreshWinSizeMin = 3;
           params.adaptiveThreshWinSizeMax = 23;
           params.adaptiveThreshWinSizeStep = 10;
           params.minMarkerPerimeterRate = 0.08; // Ignore very small distant markers

           let markerCorners = new cv.MatVector();
           let markerIds = new cv.Mat();
           let rejected = new cv.MatVector();

           aruco.detectMarkers(src, dictionary, markerCorners, markerIds, params, rejected);

           const foundIds: number[] = [];

           if (markerIds.rows > 0) {
             for (let i = 0; i < markerIds.rows; i++) {
               const id = markerIds.data32S[i];
               
               // Get corners for drawing
               const corners = markerCorners.get(i);
               const invScale = 1 / scale;
               
               // Transform corners back to full video size
               const x0 = corners.data32F[0] * invScale;
               const y0 = corners.data32F[1] * invScale;
               const x1 = corners.data32F[2] * invScale;
               const y1 = corners.data32F[3] * invScale;
               const x2 = corners.data32F[4] * invScale;
               const y2 = corners.data32F[5] * invScale;
               const x3 = corners.data32F[6] * invScale;
               const y3 = corners.data32F[7] * invScale;

               const isValid = VALID_MARKER_IDS.includes(id);

               if (debugMode || isValid) {
                   ctx.beginPath();
                   ctx.lineWidth = isValid ? 5 : 2;
                   ctx.strokeStyle = isValid ? '#22c55e' : '#f59e0b';
                   ctx.moveTo(x0, y0);
                   ctx.lineTo(x1, y1);
                   ctx.lineTo(x2, y2);
                   ctx.lineTo(x3, y3);
                   ctx.closePath();
                   ctx.stroke();
                   
                   // Draw ID text
                   const centerX = (x0 + x1 + x2 + x3) / 4;
                   const centerY = (y0 + y1 + y2 + y3) / 4;
                   
                   ctx.font = "bold 20px monospace";
                   ctx.fillStyle = isValid ? "#22c55e" : "#f59e0b";
                   ctx.strokeStyle = "black";
                   ctx.lineWidth = 3;
                   ctx.strokeText(`ID:${id}`, centerX, centerY);
                   ctx.fillText(`ID:${id}`, centerX, centerY);
               }

               if (isValid) {
                 foundIds.push(id);
                 triggerMarker(id);
               }
             }
           }
           
           setDetectedIds(foundIds);

           const endTime = performance.now();
           setDebugStats(prev => ({
             ...prev,
             processingTime: Math.round(endTime - startTime),
             fps: Math.round(1000 / (endTime - startTime || 1))
           }));

           // Clean up OpenCV objects to prevent memory leaks
           src.delete();
           dictionary.delete();
           markerIds.delete();
           markerCorners.delete();
           rejected.delete();
           params.delete();
        }
      } catch (e: any) {
        if (!debugLog.includes("Scan Loop Error")) {
             addLog("Scan Loop Error: " + e.message);
        }
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [cvReady, currentPackId, debugMode, debugLog]);

  useEffect(() => {
    // Start the loop
    requestRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cvReady, processFrame]);

  // --- RENDER ---
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} className="absolute w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="absolute w-full h-full pointer-events-none object-cover" />

      {/* Visual Trigger Feedback (Screen Flash) */}
      <div className={`absolute inset-0 bg-green-500 pointer-events-none transition-opacity duration-100 ${lastTriggeredId ? 'opacity-30' : 'opacity-0'}`} />

      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 pt-safe flex justify-between items-start pointer-events-none">
        <button onClick={onBack} className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>

        <div className="flex gap-2 pointer-events-auto">
           {debugMode && (
             <button onClick={handleSimulate} className="px-3 h-12 rounded-full font-bold bg-blue-600/80 text-white backdrop-blur-md text-xs shadow-lg animate-pulse">
               SIMULATE #13
             </button>
           )}
           <button onClick={() => setDebugMode(!debugMode)} className={`px-4 h-12 rounded-full font-bold backdrop-blur-md text-xs shadow-lg transition-colors ${debugMode ? 'bg-green-600 text-white' : 'bg-black/40 text-gray-400'}`}>
             {debugMode ? 'DEBUG' : 'DEBUG'}
           </button>
           <button onClick={handleSwitchCamera} className="w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
      </div>

      {/* Debug HUD */}
      {debugMode && (
        <div className="absolute bottom-safe left-4 right-4 z-30 pointer-events-none flex flex-col gap-2">
          <div className="bg-black/80 backdrop-blur text-green-400 p-4 rounded-xl font-mono text-xs shadow-lg border border-gray-800">
             <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
               <span className="font-bold text-white">VISION ENGINE</span>
               <span className={cvReady ? "text-green-500" : "text-yellow-500"}>{cvReady ? "READY" : "LOADING..."}</span>
             </div>
             <div className="grid grid-cols-2 gap-y-1">
               <span className="text-gray-500">RES:</span> <span>{debugStats.resolution}</span>
               <span className="text-gray-500">PROC:</span> <span>{debugStats.processingTime}ms ({debugStats.fps} FPS)</span>
               <span className="text-gray-500">LAST:</span> <span className="text-white font-bold">{lastTriggeredId || '-'}</span>
             </div>
          </div>
          
          <div className="bg-black/80 backdrop-blur p-2 rounded-xl border border-gray-800 pointer-events-auto max-h-40 overflow-y-auto shadow-lg">
             {debugLog.map((log, i) => (
               <div key={i} className="text-[10px] font-mono text-gray-300 border-b border-gray-800/50 pb-1 mb-1 last:border-0 last:mb-0 break-words">{log}</div>
             ))}
          </div>
        </div>
      )}

      {/* Loading Overlay with Bypass */}
      {!cvReady && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 backdrop-blur-sm z-50 text-white p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-gray-700 mb-6"></div>
            <h2 className="text-xl font-bold mb-2">Initialize Vision</h2>
            <p className="font-mono text-sm text-gray-400 mb-4">{loadingMsg}</p>
            
            <button 
              onClick={() => { setCvReady(true); addLog("Loading bypassed by user"); }}
              className="mt-4 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 px-4 rounded-lg transition-colors border border-gray-600"
            >
              Skip Loading (Debug UI)
            </button>
            
            {cameraError && (
              <div className="mt-8 p-4 bg-red-900/50 border border-red-500 rounded-xl">
                <p className="text-red-200 text-sm font-bold">⚠️ Camera Error</p>
                <p className="text-red-300 text-xs mt-1">If testing in AI Studio or CodeSandbox, camera access is likely blocked. Please deploy to Vercel.</p>
              </div>
            )}
         </div>
      )}
    </div>
  );
};