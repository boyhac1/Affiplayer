import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoFile, PlayerState, GestureAction, GestureSensitivity } from '../types';
import { PlayerControls } from './PlayerControls';
import { CONTROLS_HIDE_DELAY, DOUBLE_TAP_DELAY } from '../constants';
import { Icons } from './Icons';
import clsx from 'clsx';
import { formatTime } from '../utils/time';

interface VideoPlayerProps {
  video: VideoFile;
  initialTime?: number;
  initialPlaybackRate?: number;
  seekTime: number; 
  autoPlayNext: boolean; 
  onClose: () => void;
  onUpdateProgress: (time: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  video, 
  initialTime = 0, 
  initialPlaybackRate = 1,
  seekTime,
  autoPlayNext,
  onClose, 
  onUpdateProgress,
  onPlaybackRateChange,
  onNext,
  onPrev,
  addToast
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<PlayerState>({
    playing: false,
    currentTime: initialTime,
    duration: 0,
    volume: 1,
    brightness: 1,
    playbackRate: initialPlaybackRate,
    isBuffering: false,
    showControls: true,
    isPip: false,
    isLocked: false,
    videoFit: 'contain',
    isLooping: false,
    scale: 1,
    sleepTimer: null,
    error: null
  });

  const [rotation, setRotation] = useState(0);

  const [sensitivity, setSensitivity] = useState<GestureSensitivity>({
    volume: 1,
    brightness: 1,
    seek: 1
  });
  
  const [showSettings, setShowSettings] = useState(false);

  const [gesture, setGesture] = useState<{
    active: boolean;
    type: GestureAction;
    value: number;
    delta: number;
    text: string;
  } | null>(null);

  const [doubleTapAnimation, setDoubleTapAnimation] = useState<'left' | 'right' | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const pinchStartDistRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);
  const initialValueRef = useRef<number>(0);
  
  // Long Press Refs
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSpeedRef = useRef<number>(1);
  const isLongPressingRef = useRef(false);

  // Initialize video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = state.volume;
      videoRef.current.currentTime = initialTime;
      videoRef.current.playbackRate = initialPlaybackRate;
      videoRef.current.play().catch((e) => {
         console.warn("Autoplay blocked or failed", e);
      });
      setState(s => ({ ...s, scale: 1, error: null }));
      setRotation(0);
    }
    resetControlsTimer();
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [video.id]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (state.isLocked) return;
          
          switch(e.code) {
              case 'Space':
              case 'KeyK':
                  e.preventDefault();
                  togglePlay();
                  break;
              case 'ArrowRight':
              case 'KeyL':
                  e.preventDefault();
                  handleSeek(state.currentTime + seekTime);
                  break;
              case 'ArrowLeft':
              case 'KeyJ':
                  e.preventDefault();
                  handleSeek(state.currentTime - seekTime);
                  break;
              case 'ArrowUp':
                  e.preventDefault();
                  const newVolUp = Math.min(1, state.volume + 0.1);
                  if (videoRef.current) videoRef.current.volume = newVolUp;
                  setState(s => ({ ...s, volume: newVolUp }));
                  setGesture({ active: true, type: GestureAction.VOLUME, value: newVolUp, delta: 0, text: `${Math.round(newVolUp * 100)}%` });
                  setTimeout(() => setGesture(null), 1000);
                  break;
              case 'ArrowDown':
                  e.preventDefault();
                  const newVolDown = Math.max(0, state.volume - 0.1);
                  if (videoRef.current) videoRef.current.volume = newVolDown;
                  setState(s => ({ ...s, volume: newVolDown }));
                  setGesture({ active: true, type: GestureAction.VOLUME, value: newVolDown, delta: 0, text: `${Math.round(newVolDown * 100)}%` });
                  setTimeout(() => setGesture(null), 1000);
                  break;
              case 'KeyF':
                  if (document.fullscreenElement) document.exitFullscreen();
                  else containerRef.current?.requestFullscreen();
                  break;
              case 'KeyM':
                  if (videoRef.current) {
                      const newMute = videoRef.current.volume > 0 ? 0 : 1;
                      videoRef.current.volume = newMute;
                      setState(s => ({ ...s, volume: newMute }));
                  }
                  break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isLocked, state.currentTime, state.volume, seekTime]);

  // Sleep Timer
  useEffect(() => {
      if (!state.sleepTimer || !state.playing) return;
      
      const timer = setInterval(() => {
          setState(prev => {
              if (prev.sleepTimer && prev.sleepTimer > 0) {
                  return { ...prev, sleepTimer: prev.sleepTimer - 1 };
              }
              // Timer ended
              videoRef.current?.pause();
              addToast("Sleep timer ended playback", "info");
              return { ...prev, sleepTimer: null, playing: false };
          });
      }, 60000); // Check every minute
      
      return () => clearInterval(timer);
  }, [state.sleepTimer, state.playing]);

  // Media Session & Wake Lock
  useEffect(() => {
      if ('mediaSession' in navigator && videoRef.current) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: video.name });
          navigator.mediaSession.setActionHandler('play', togglePlay);
          navigator.mediaSession.setActionHandler('pause', togglePlay);
          navigator.mediaSession.setActionHandler('seekbackward', () => handleSeek(state.currentTime - seekTime));
          navigator.mediaSession.setActionHandler('seekforward', () => handleSeek(state.currentTime + seekTime));
          if (onNext) navigator.mediaSession.setActionHandler('nexttrack', onNext);
          if (onPrev) navigator.mediaSession.setActionHandler('previoustrack', onPrev);
      }
      // Wake Lock
      let wakeLock: any = null;
      const req = async () => { if ('wakeLock' in navigator && state.playing) { try { wakeLock = await (navigator as any).wakeLock.request('screen'); } catch(e){} } };
      req();
      return () => wakeLock?.release();
  }, [state.playing, video.name, seekTime]);

  const resetControlsTimer = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setState(s => ({ ...s, showControls: true }));
    if (!state.playing) return;
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (!state.isLocked && !showSettings) {
          setState(s => ({ ...s, showControls: false }));
      }
    }, CONTROLS_HIDE_DELAY);
  }, [state.playing, state.isLocked, showSettings]);

  // Video Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setState(s => ({ ...s, currentTime: time }));
      if (Math.abs(time - state.currentTime) > 1) onUpdateProgress(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - initialTime) > 1) videoRef.current.currentTime = initialTime;
      setState(s => ({ ...s, duration: videoRef.current!.duration }));
    }
  };

  const handleError = () => {
      setState(s => ({ ...s, playing: false, isBuffering: false, error: "Playback Error" }));
      addToast("Failed to load video", "error");
  };

  const handlePlaying = () => setState(s => ({ ...s, playing: true, isBuffering: false, error: null }));
  const handlePause = () => setState(s => ({ ...s, playing: false }));
  const handleWaiting = () => setState(s => ({ ...s, isBuffering: true }));
  const handleEnded = () => {
      setState(s => ({ ...s, playing: false, showControls: true }));
      if (autoPlayNext && onNext) onNext();
  };

  // Actions
  const togglePlay = () => {
    if (videoRef.current) {
      if (state.playing) videoRef.current.pause();
      else {
          videoRef.current.play().catch(e => {
              console.error(e);
              setState(s => ({ ...s, error: "Could not play" }));
          });
      }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setState(s => ({ ...s, currentTime: time }));
      resetControlsTimer();
      onUpdateProgress(time);
    }
  };

  // Smooth scrubbing handler
  const handleScrub = useCallback((time: number) => {
    if (videoRef.current) {
        if ('fastSeek' in videoRef.current) {
            (videoRef.current as any).fastSeek(time);
        } else {
            videoRef.current.currentTime = time;
        }
        setState(s => ({ ...s, currentTime: time }));
        resetControlsTimer();
    }
  }, [resetControlsTimer]);

  const changeSpeed = (speed: number) => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setState(s => ({ ...s, playbackRate: speed }));
    if (onPlaybackRateChange) onPlaybackRateChange(speed);
    addToast(`Speed: ${speed}x`, "info");
  };

  // Gestures & Interactions
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (state.isLocked) return;
    
    // Check Double Tap FIRST to prevent conflicts
    const now = Date.now();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const width = containerRef.current?.clientWidth || 0;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && !showSettings) {
      // Zone Based Double Tap (Only Sides)
      if (clientX < width * 0.3) {
        handleSeek(Math.max(0, state.currentTime - seekTime));
        setDoubleTapAnimation('left');
        setTimeout(() => setDoubleTapAnimation(null), 600);
        lastTapRef.current = 0; 
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        return;
      } else if (clientX > width * 0.7) {
        handleSeek(Math.min(state.duration, state.currentTime + seekTime));
        setDoubleTapAnimation('right');
        setTimeout(() => setDoubleTapAnimation(null), 600);
        lastTapRef.current = 0;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        return;
      }
    }
    lastTapRef.current = now;

    // Normal Touch Start
    resetControlsTimer();
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: now };

    // Pinch Zoom Start
    if ('touches' in e && e.touches.length === 2) {
       pinchStartDistRef.current = Math.hypot(
           e.touches[0].clientX - e.touches[1].clientX,
           e.touches[0].clientY - e.touches[1].clientY
       );
       initialScaleRef.current = state.scale;
       setGesture({ active: true, type: GestureAction.ZOOM, value: state.scale, delta: 0, text: 'Zoom' });
       return;
    }

    // Start Long Press Timer
    savedSpeedRef.current = state.playbackRate;
    longPressTimerRef.current = setTimeout(() => {
        if (!touchStartRef.current) return; // Touch ended already
        isLongPressingRef.current = true;
        setIsLongPressing(true);
        if (videoRef.current) videoRef.current.playbackRate = 2.0;
        setState(s => ({ ...s, playbackRate: 2.0 }));
        if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (state.isLocked || !touchStartRef.current || showSettings) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const deltaX = clientX - touchStartRef.current.x;
    const deltaY = touchStartRef.current.y - clientY;

    // Cancel Long Press if moved significantly
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (!isLongPressingRef.current && longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }

    if (isLongPressingRef.current) return;

    if ('touches' in e && e.touches.length === 2) {
       const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
       const scale = Math.min(Math.max(0.5, initialScaleRef.current * (dist / pinchStartDistRef.current)), 4);
       setState(s => ({ ...s, scale }));
       return;
    }

    const width = containerRef.current?.clientWidth || 1;
    const height = containerRef.current?.clientHeight || 1;

    let currentGesture = gesture?.type || GestureAction.NONE;
    if (currentGesture === GestureAction.NONE) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > 20) currentGesture = GestureAction.SEEK;
      } else {
        if (Math.abs(deltaY) > 20) {
          if (touchStartRef.current.x < width / 2) currentGesture = GestureAction.BRIGHTNESS;
          else currentGesture = GestureAction.VOLUME;
        }
      }
    }

    if (currentGesture !== GestureAction.NONE) {
        if (currentGesture === GestureAction.BRIGHTNESS) {
            if (!gesture) initialValueRef.current = state.brightness;
            const newVal = Math.max(0, Math.min(1, initialValueRef.current + (deltaY / height) * sensitivity.brightness));
            setState(s => ({ ...s, brightness: newVal }));
            setGesture({ active: true, type: GestureAction.BRIGHTNESS, value: newVal, delta: 0, text: `${Math.round(newVal * 100)}%` });
        } else if (currentGesture === GestureAction.VOLUME) {
            if (!gesture) initialValueRef.current = state.volume;
            const newVal = Math.max(0, Math.min(1, initialValueRef.current + (deltaY / height) * sensitivity.volume));
            if (videoRef.current) videoRef.current.volume = newVal;
            setState(s => ({ ...s, volume: newVal }));
            setGesture({ active: true, type: GestureAction.VOLUME, value: newVal, delta: 0, text: `${Math.round(newVal * 100)}%` });
        } else if (currentGesture === GestureAction.SEEK) {
            if (!gesture) initialValueRef.current = state.currentTime;
            const seekDelta = ((deltaX / width) * 90) * sensitivity.seek; 
            const newVal = Math.max(0, Math.min(state.duration, initialValueRef.current + seekDelta));
            setGesture({ active: true, type: GestureAction.SEEK, value: newVal, delta: seekDelta, text: `${seekDelta > 0 ? '+' : ''}${Math.round(seekDelta)}s` });
        }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }

    if (isLongPressingRef.current) {
        isLongPressingRef.current = false;
        setIsLongPressing(false);
        if (videoRef.current) videoRef.current.playbackRate = savedSpeedRef.current;
        setState(s => ({ ...s, playbackRate: savedSpeedRef.current }));
        touchStartRef.current = null;
        return;
    }

    if (gesture) {
        if (gesture.type === GestureAction.SEEK) handleSeek(gesture.value);
        setGesture(null);
        touchStartRef.current = null;
        return;
    }

    if (touchStartRef.current) {
        const width = containerRef.current?.clientWidth || 1;
        const x = touchStartRef.current.x;
        const tapDuration = Date.now() - touchStartRef.current.time;

        if (tapDuration < 200) {
             const xPct = x / width;
             if (xPct > 0.3 && xPct < 0.7) {
                 togglePlay();
                 setState(s => ({ ...s, showControls: true }));
                 resetControlsTimer();
             } else {
                 setState(s => ({ ...s, showControls: !s.showControls }));
             }
        }
    }

    touchStartRef.current = null;
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden group select-none touch-none focus:outline-none"
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0} // Make focusable for keyboard events
    >
      <input type="file" accept=".srt,.vtt" ref={subtitleInputRef} className="hidden" />

      <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
         <video
           ref={videoRef}
           src={video.url}
           className={clsx(
               "transition-all duration-300",
               state.videoFit === 'contain' ? 'max-w-full max-h-full' : 'w-full h-full',
               state.videoFit === 'cover' && "object-cover",
               state.videoFit === 'fill' && "object-fill",
           )}
           onTimeUpdate={handleTimeUpdate}
           onLoadedMetadata={handleLoadedMetadata}
           onWaiting={handleWaiting}
           onPlaying={handlePlaying}
           onPause={handlePause}
           onEnded={handleEnded}
           onError={handleError}
           style={{ 
             filter: `brightness(${state.brightness})`,
             transform: `scale(${state.scale}) rotate(${rotation}deg)` 
           }}
         />
      </div>

      {/* Error Overlay */}
      {state.error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80">
            <Icons.Video className="w-16 h-16 text-white/20 mb-4" />
            <p className="text-red-400 font-bold mb-4">{state.error}</p>
            <button 
                onClick={() => {
                    if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.play();
                    }
                    setState(s => ({...s, error: null}));
                }} 
                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium transition"
            >
                Retry
            </button>
        </div>
      )}

      {/* Speed 2x Overlay */}
      {isLongPressing && (
          <div className="absolute top-10 inset-x-0 flex justify-center pointer-events-none animate-fade-in z-40">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 text-white font-bold">
                  <Icons.Forward10 className="w-5 h-5" />
                  <span>2x Speed</span>
              </div>
          </div>
      )}

      {/* Double Tap Animations */}
      {doubleTapAnimation === 'left' && (
        <div className="absolute left-[15%] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none animate-fade-out z-40">
           <div className="bg-black/40 backdrop-blur-sm rounded-full p-4 flex flex-col items-center">
              <Icons.Replay10 className="w-8 h-8 text-white" />
              <span className="text-white text-xs font-bold mt-1">-{seekTime}s</span>
           </div>
        </div>
      )}
      {doubleTapAnimation === 'right' && (
        <div className="absolute right-[15%] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none animate-fade-out z-40">
           <div className="bg-black/40 backdrop-blur-sm rounded-full p-4 flex flex-col items-center">
              <Icons.Forward10 className="w-8 h-8 text-white" />
              <span className="text-white text-xs font-bold mt-1">+{seekTime}s</span>
           </div>
        </div>
      )}

      {/* Gesture Feedback */}
      {gesture && gesture.active && (
         <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md text-white px-8 py-6 rounded-2xl flex flex-col items-center gap-3 animate-fade-in border border-white/10 shadow-2xl">
                {gesture.type === GestureAction.VOLUME && <Icons.Volume className="w-10 h-10 text-primary" />}
                {gesture.type === GestureAction.BRIGHTNESS && <Icons.Brightness className="w-10 h-10 text-yellow-400" />}
                {gesture.type === GestureAction.ZOOM && <Icons.Maximize className="w-10 h-10 text-blue-400" />}
                {gesture.type === GestureAction.SEEK && (gesture.delta > 0 ? <Icons.Forward10 className="w-10 h-10" /> : <Icons.Replay10 className="w-10 h-10" />)}
                <span className="text-2xl font-bold font-mono tracking-wider">
                    {gesture.type === GestureAction.SEEK ? formatTime(gesture.value) : gesture.text}
                </span>
            </div>
         </div>
      )}

      {state.isBuffering && !gesture && !state.playing && !state.error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      <div className={clsx(
        "absolute inset-0 transition-opacity duration-300",
        state.showControls ? "opacity-100" : "opacity-0"
      )}>
        <PlayerControls 
          state={state}
          title={video.name}
          videoUrl={video.url}
          sensitivity={sensitivity}
          showSettings={showSettings}
          onPlayPause={togglePlay}
          onSeek={handleSeek}
          onScrub={handleScrub}
          onToggleLock={() => {
              const locked = !state.isLocked;
              setState(s => ({ ...s, isLocked: locked, showControls: !locked }));
              addToast(locked ? "Screen Locked" : "Screen Unlocked", "info");
          }}
          onTogglePip={async () => {
             if (document.pictureInPictureElement) await document.exitPictureInPicture();
             else await videoRef.current?.requestPictureInPicture();
          }}
          onBack={onClose}
          onChangeSpeed={changeSpeed}
          onToggleFit={() => {
              const fits: any[] = ['contain', 'cover', 'fill'];
              setState(s => ({ ...s, videoFit: fits[(fits.indexOf(s.videoFit) + 1) % fits.length], scale: 1 }));
          }}
          onToggleLoop={() => {
              const looping = !state.isLooping;
              setState(s => ({ ...s, isLooping: looping }));
              addToast(looping ? "Looping Enabled" : "Looping Disabled", "info");
          }}
          onScreenshot={() => { 
              if (videoRef.current) {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current.videoWidth;
                  canvas.height = videoRef.current.videoHeight;
                  canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
                  const link = document.createElement('a');
                  link.download = `screenshot-${Date.now()}.png`;
                  link.href = canvas.toDataURL();
                  link.click();
                  addToast("Screenshot saved", "success");
              }
          }}
          onLoadSubtitle={() => subtitleInputRef.current?.click()}
          onToggleSettings={() => { setShowSettings(p => !p); resetControlsTimer(); }}
          onSensitivityChange={(k, v) => setSensitivity(p => ({ ...p, [k]: v }))}
          onNext={onNext}
          onPrev={onPrev}
          onResetZoom={() => setState(s => ({ ...s, scale: 1 }))}
          onRotate={() => { setRotation(r => (r + 90) % 360); setState(s => ({...s, scale: 1})); }}
          onSetSleepTimer={(m) => {
              setState(s => ({ ...s, sleepTimer: m }));
              addToast(m ? `Sleep timer set: ${m}m` : "Sleep timer off", "info");
          }}
        />
      </div>
    </div>
  );
};