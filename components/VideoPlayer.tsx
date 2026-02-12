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
  seekTime: number; // Configurable seek time
  autoPlayNext: boolean; // Configurable auto play
  onClose: () => void;
  onUpdateProgress: (time: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
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
  onPrev
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

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const pinchStartDistRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);
  const initialValueRef = useRef<number>(0);

  // Initialize video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = state.volume;
      videoRef.current.currentTime = initialTime;
      videoRef.current.playbackRate = initialPlaybackRate;
      videoRef.current.play().catch(() => {});
      // Reset zoom on new video
      setState(s => ({ ...s, scale: 1 }));
      setRotation(0);
    }
    resetControlsTimer();
    return () => clearTimeout(controlsTimeoutRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // Media Session API for Background Play
  useEffect(() => {
    if ('mediaSession' in navigator && videoRef.current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.name,
        artist: 'Affiplayer',
        artwork: [
            { src: 'https://via.placeholder.com/512.png?text=Media', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
         videoRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
         videoRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
         handleSeek(Math.max(0, (videoRef.current?.currentTime || 0) - (details.seekOffset || seekTime)));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
         handleSeek(Math.min(videoRef.current?.duration || 0, (videoRef.current?.currentTime || 0) + (details.seekOffset || seekTime)));
      });
      navigator.mediaSession.setActionHandler('previoustrack', onPrev ? onPrev : null);
      navigator.mediaSession.setActionHandler('nexttrack', onNext ? onNext : null);
    }
  }, [video, onNext, onPrev, seekTime]);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };
    if (state.playing) requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [state.playing]);

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
          handleSeek(Math.min(state.duration, state.currentTime + seekTime));
          break;
        case 'ArrowLeft':
          handleSeek(Math.max(0, state.currentTime - seekTime));
          break;
        case 'ArrowUp':
          e.preventDefault();
          const newVolUp = Math.min(1, state.volume + 0.1);
          if (videoRef.current) videoRef.current.volume = newVolUp;
          setState(s => ({ ...s, volume: newVolUp, showControls: true }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newVolDown = Math.max(0, state.volume - 0.1);
          if (videoRef.current) videoRef.current.volume = newVolDown;
          setState(s => ({ ...s, volume: newVolDown, showControls: true }));
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyN':
           if (onNext) onNext();
           break;
        case 'KeyP':
           if (onPrev) onPrev();
           break;
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isLocked, state.currentTime, state.duration, state.volume, state.playing, onNext, onPrev, seekTime]);

  const resetControlsTimer = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setState(s => ({ ...s, showControls: true }));
    if (!state.playing) return;
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (!state.isLocked && !showSettings) { // Don't auto-hide if settings are open
          setState(s => ({ ...s, showControls: false }));
      }
    }, CONTROLS_HIDE_DELAY);
  }, [state.playing, state.isLocked, showSettings]);

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setState(s => ({ ...s, currentTime: time }));
      if (Math.abs(time - state.currentTime) > 1) {
          onUpdateProgress(time);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      // Restore time if needed
      if (Math.abs(videoRef.current.currentTime - initialTime) > 1) {
         videoRef.current.currentTime = initialTime;
      }
      setState(s => ({ ...s, duration: videoRef.current!.duration }));
    }
  };

  const handleWaiting = () => setState(s => ({ ...s, isBuffering: true }));
  const handlePlaying = () => setState(s => ({ ...s, playing: true, isBuffering: false }));
  const handlePause = () => setState(s => ({ ...s, playing: false }));
  const handleEnded = () => {
      setState(s => ({ ...s, playing: false, showControls: true }));
      // Auto play next logic
      if (autoPlayNext && onNext) {
          onNext();
      }
  };

  // Controls Logic
  const togglePlay = () => {
    if (videoRef.current) {
      if (state.playing) videoRef.current.pause();
      else videoRef.current.play();
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

  const toggleLock = () => {
    setState(s => ({ ...s, isLocked: !s.isLocked, showControls: !s.isLocked }));
    setShowSettings(false); // Close settings when locking
  };

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setState(s => ({ ...s, isPip: false }));
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
        setState(s => ({ ...s, isPip: true }));
      }
    } catch (e) {
      console.error("PiP failed", e);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  };

  const changeSpeed = () => {
    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(state.playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    if (videoRef.current) videoRef.current.playbackRate = newRate;
    setState(s => ({ ...s, playbackRate: newRate }));
    if (onPlaybackRateChange) {
      onPlaybackRateChange(newRate);
    }
  };
  
  const toggleFit = () => {
      const fits: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
      const next = fits[(fits.indexOf(state.videoFit) + 1) % fits.length];
      setState(s => ({ ...s, videoFit: next, scale: 1 })); // Reset zoom on fit change
  };

  const toggleLoop = () => {
    const looping = !state.isLooping;
    if (videoRef.current) videoRef.current.loop = looping;
    setState(s => ({ ...s, isLooping: looping }));
  };

  const handleScreenshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      try {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `screenshot-${video.name}-${Math.round(state.currentTime)}.png`;
          a.click();
      } catch (e) {
          console.error("Screenshot failed", e);
      }
    }
  };

  const handleLoadSubtitle = () => {
    subtitleInputRef.current?.click();
  };

  const onSubtitleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && videoRef.current) {
          const url = URL.createObjectURL(file);
          // Remove old tracks
          const oldTracks = videoRef.current.getElementsByTagName('track');
          while (oldTracks.length > 0) videoRef.current.removeChild(oldTracks[0]);

          const track = document.createElement('track');
          track.kind = "subtitles";
          track.label = "External";
          track.srclang = "en";
          track.src = url;
          track.default = true;
          videoRef.current.appendChild(track);
      }
  };

  const handleToggleSettings = () => {
    setShowSettings(prev => !prev);
    resetControlsTimer();
  };

  const handleSensitivityChange = (key: keyof GestureSensitivity, value: number) => {
    setSensitivity(prev => ({ ...prev, [key]: value }));
  };

  const handleRotate = () => {
      setRotation(prev => (prev + 90) % 360);
      // Reset scale on rotation to avoid weird crops
      setState(s => ({...s, scale: 1}));
  };

  // Zoom Helpers
  const getDistance = (touches: React.TouchList) => {
     const dx = touches[0].clientX - touches[1].clientX;
     const dy = touches[0].clientY - touches[1].clientY;
     return Math.sqrt(dx * dx + dy * dy);
  };

  // Gesture Logic
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    resetControlsTimer();

    // Handle Zoom Start
    if ('touches' in e && e.touches.length === 2) {
       pinchStartDistRef.current = getDistance(e.touches);
       initialScaleRef.current = state.scale;
       setGesture({ active: true, type: GestureAction.ZOOM, value: state.scale, delta: 0, text: 'Zoom' });
       return;
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };

    // Double Tap Detection
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && !state.isLocked && !showSettings) {
      const width = containerRef.current?.clientWidth || 0;
      if (clientX < width * 0.4) {
        handleSeek(Math.max(0, state.currentTime - seekTime)); // Rewind with config
        setDoubleTapAnimation('left');
        setTimeout(() => setDoubleTapAnimation(null), 600);
      } else if (clientX > width * 0.6) {
        handleSeek(Math.min(state.duration, state.currentTime + seekTime)); // Forward with config
        setDoubleTapAnimation('right');
        setTimeout(() => setDoubleTapAnimation(null), 600);
      }
      lastTapRef.current = 0; 
      return;
    }
    lastTapRef.current = now;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (state.isLocked || !touchStartRef.current || showSettings) return;

    // Handle Zoom Move
    if ('touches' in e && e.touches.length === 2) {
       const dist = getDistance(e.touches);
       const scaleFactor = dist / pinchStartDistRef.current;
       const newScale = Math.min(Math.max(0.5, initialScaleRef.current * scaleFactor), 4.0);
       setState(s => ({ ...s, scale: newScale }));
       setGesture({ 
         active: true, 
         type: GestureAction.ZOOM, 
         value: newScale, 
         delta: 0, 
         text: `${Math.round(newScale * 100)}%` 
       });
       return;
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const deltaX = clientX - touchStartRef.current.x;
    const deltaY = touchStartRef.current.y - clientY;

    const width = containerRef.current?.clientWidth || 1;
    const height = containerRef.current?.clientHeight || 1;

    let currentGesture = gesture?.type || GestureAction.NONE;
    if (currentGesture === GestureAction.NONE || currentGesture === GestureAction.ZOOM) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > 20) currentGesture = GestureAction.SEEK;
      } else {
        if (Math.abs(deltaY) > 20) {
          if (touchStartRef.current.x < width / 2) currentGesture = GestureAction.BRIGHTNESS;
          else currentGesture = GestureAction.VOLUME;
        }
      }
    }

    if (currentGesture === GestureAction.NONE) return;

    if (currentGesture === GestureAction.BRIGHTNESS) {
       if (!gesture) initialValueRef.current = state.brightness;
       const sensitivityMultiplier = sensitivity.brightness;
       const change = (deltaY / height) * sensitivityMultiplier;
       const newVal = Math.max(0, Math.min(1, initialValueRef.current + change));
       setState(s => ({ ...s, brightness: newVal }));
       setGesture({ 
           active: true, 
           type: GestureAction.BRIGHTNESS, 
           value: newVal, 
           delta: change,
           text: `${Math.round(newVal * 100)}%` 
       });
    } else if (currentGesture === GestureAction.VOLUME) {
       if (!gesture) initialValueRef.current = state.volume;
       const sensitivityMultiplier = sensitivity.volume;
       const change = (deltaY / height) * sensitivityMultiplier;
       const newVal = Math.max(0, Math.min(1, initialValueRef.current + change));
       if (videoRef.current) videoRef.current.volume = newVal;
       setState(s => ({ ...s, volume: newVal }));
       setGesture({ 
           active: true, 
           type: GestureAction.VOLUME, 
           value: newVal, 
           delta: change,
           text: `${Math.round(newVal * 100)}%` 
       });
    } else if (currentGesture === GestureAction.SEEK) {
       if (!gesture) initialValueRef.current = state.currentTime;
       const sensitivityMultiplier = sensitivity.seek;
       const seekDelta = ((deltaX / width) * 90) * sensitivityMultiplier; 
       const newVal = Math.max(0, Math.min(state.duration, initialValueRef.current + seekDelta));
       setGesture({ 
           active: true, 
           type: GestureAction.SEEK, 
           value: newVal, 
           delta: seekDelta,
           text: `${seekDelta > 0 ? '+' : ''}${Math.round(seekDelta)}s` 
       });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    if (gesture) {
        if (gesture.type === GestureAction.SEEK) {
             handleSeek(gesture.value);
        }
        setGesture(null);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden group select-none touch-none"
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <input 
        type="file" 
        accept=".srt,.vtt" 
        ref={subtitleInputRef} 
        className="hidden" 
        onChange={onSubtitleFileChange} 
      />

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
           style={{ 
             filter: `brightness(${state.brightness})`,
             transform: `scale(${state.scale}) rotate(${rotation}deg)` 
           }}
         />
      </div>

      {/* Improved Subtle Double Tap Animations */}
      {doubleTapAnimation === 'left' && (
        <div className="absolute left-[15%] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none animate-fade-out">
           <div className="bg-black/40 backdrop-blur-sm rounded-full p-4 flex flex-col items-center">
              <Icons.Replay10 className="w-8 h-8 text-white" />
              <span className="text-white text-xs font-bold mt-1">-{seekTime}s</span>
           </div>
        </div>
      )}
      {doubleTapAnimation === 'right' && (
        <div className="absolute right-[15%] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none animate-fade-out">
           <div className="bg-black/40 backdrop-blur-sm rounded-full p-4 flex flex-col items-center">
              <Icons.Forward10 className="w-8 h-8 text-white" />
              <span className="text-white text-xs font-bold mt-1">+{seekTime}s</span>
           </div>
        </div>
      )}

      {/* Gesture Feedback Overlay */}
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

      {/* Buffering */}
      {state.isBuffering && !gesture && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Controls */}
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
          onToggleLock={toggleLock}
          onTogglePip={togglePip}
          onBack={onClose}
          onChangeSpeed={changeSpeed}
          onToggleFit={toggleFit}
          onToggleLoop={toggleLoop}
          onScreenshot={handleScreenshot}
          onLoadSubtitle={handleLoadSubtitle}
          onToggleSettings={handleToggleSettings}
          onSensitivityChange={handleSensitivityChange}
          onNext={onNext}
          onPrev={onPrev}
          onResetZoom={() => setState(s => ({ ...s, scale: 1 }))}
          onRotate={handleRotate}
        />
      </div>
    </div>
  );
};