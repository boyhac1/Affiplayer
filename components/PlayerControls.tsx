import React, { useMemo, useState, useRef } from 'react';
import { PlayerState, GestureSensitivity } from '../types';
import { Icons } from './Icons';
import { formatTime } from '../utils/time';

interface PlayerControlsProps {
  state: PlayerState;
  title: string;
  videoUrl: string;
  sensitivity: GestureSensitivity;
  showSettings: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onScrub?: (time: number) => void;
  onToggleLock: () => void;
  onTogglePip: () => void;
  onBack: () => void;
  onChangeSpeed: (speed: number) => void;
  onToggleFit: () => void;
  onToggleLoop: () => void;
  onScreenshot: () => void;
  onLoadSubtitle: () => void;
  onToggleSettings: () => void;
  onSensitivityChange: (key: keyof GestureSensitivity, value: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onResetZoom: () => void;
  onRotate: () => void;
  onSetSleepTimer: (minutes: number | null) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  state,
  title,
  sensitivity,
  showSettings,
  onPlayPause,
  onSeek,
  onScrub,
  onToggleLock,
  onTogglePip,
  onBack,
  onChangeSpeed,
  onToggleFit,
  onToggleLoop,
  onScreenshot,
  onLoadSubtitle,
  onToggleSettings,
  onSensitivityChange,
  onNext,
  onPrev,
  onResetZoom,
  onRotate,
  onSetSleepTimer
}) => {
  const { playing, currentTime, duration, isLocked, videoFit, playbackRate, isLooping, sleepTimer } = state;
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const currentDisplayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (currentDisplayTime / duration) * 100 : 0;

  const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    handleSeekMove(e);
  };

  const handleSeekMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    setDragTime(newTime);
    if (onScrub) {
      onScrub(newTime);
    }
  };

  const handleSeekEnd = () => {
    if (isDragging) {
      onSeek(dragTime);
      setIsDragging(false);
    }
  };

  // Preset speeds for the button cycle
  const cycleSpeed = () => {
    const speeds = [1.0, 1.5, 2.0, 4.0];
    const nextIndex = speeds.findIndex(s => s > playbackRate);
    const nextSpeed = nextIndex !== -1 ? speeds[nextIndex] : 1.0;
    onChangeSpeed(nextSpeed);
  };

  if (isLocked) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col justify-center items-start p-4 pointer-events-none">
        <button onClick={onToggleLock} className="pointer-events-auto bg-white/10 backdrop-blur-md p-4 rounded-full hover:bg-white/20 transition-all border border-white/20 shadow-lg animate-pulse">
          <Icons.Lock className="w-6 h-6 text-primary" />
        </button>
        <div className="mt-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg text-white/80 text-sm">Locked</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between transition-opacity duration-300 pointer-events-none">
      
      {/* Top Bar */}
      <div className="bg-gradient-to-b from-black/90 via-black/50 to-transparent px-4 py-4 pointer-events-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition active:scale-95">
                <Icons.Back className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-white font-medium truncate text-lg drop-shadow-md">{title}</h2>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="relative">
                <button onClick={() => setShowSleepMenu(!showSleepMenu)} className={`p-2 rounded-full hover:bg-white/10 transition ${sleepTimer ? 'text-primary' : 'text-white'}`}>
                   <Icons.Moon className="w-5 h-5" />
                   {sleepTimer && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />}
                </button>
                {showSleepMenu && (
                   <div className="absolute right-0 top-full mt-2 w-48 bg-[#1E1E1E] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
                       <div className="p-3 text-xs font-bold text-white/50 uppercase tracking-wider border-b border-white/5">Sleep Timer</div>
                       {[15, 30, 45, 60].map(m => (
                           <button key={m} onClick={() => { onSetSleepTimer(m); setShowSleepMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition flex justify-between">
                               {m} Minutes
                               {sleepTimer === m && <Icons.Check className="w-4 h-4 text-primary" />}
                           </button>
                       ))}
                       <button onClick={() => { onSetSleepTimer(null); setShowSleepMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition">Turn Off</button>
                   </div>
                )}
             </div>
             <button onClick={onTogglePip} className="p-2 rounded-full hover:bg-white/10 text-white"><Icons.Pip className="w-5 h-5" /></button>
             <button onClick={onToggleSettings} className="p-2 rounded-full hover:bg-white/10 text-white"><Icons.Settings className="w-5 h-5" /></button>
          </div>
      </div>

      {/* Center Controls (Play/Pause) - Optional, mostly handled by tap now */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
          {/* We can put buffering indicator here if needed */}
      </div>

      {/* Settings Overlay */}
      {showSettings && (
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-[#1E1E1E]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl p-4 overflow-y-auto pointer-events-auto animate-fade-in z-50">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icons.Settings className="w-5 h-5 text-primary"/> Settings</h3>
                  <button onClick={onToggleSettings} className="p-2 hover:bg-white/10 rounded-full"><Icons.Close className="w-5 h-5 text-white"/></button>
              </div>

              <div className="space-y-6">
                  {/* Speed Control */}
                  <div className="bg-white/5 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-white/80">Playback Speed</span>
                          <span className="text-xs font-mono text-primary">{playbackRate}x</span>
                      </div>
                      <input 
                          type="range" 
                          min="0.25" 
                          max="4.0" 
                          step="0.05" 
                          value={playbackRate} 
                          onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
                          className="w-full accent-primary h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-white/40 font-mono">
                          <span>0.25x</span>
                          <button onClick={() => onChangeSpeed(1.0)} className="hover:text-white">Normal</button>
                          <span>4.0x</span>
                      </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={onToggleFit} className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition gap-2">
                          <Icons.Maximize className="w-5 h-5 text-white/80" />
                          <span className="text-xs text-white/60 capitalize">{videoFit}</span>
                      </button>
                      <button onClick={onToggleLoop} className={`flex flex-col items-center justify-center p-3 rounded-xl transition gap-2 ${isLooping ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                          <Icons.Repeat className="w-5 h-5" />
                          <span className="text-xs">Loop</span>
                      </button>
                      <button onClick={onRotate} className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition gap-2">
                          <Icons.Rotate className="w-5 h-5 text-white/80" />
                          <span className="text-xs text-white/60">Rotate</span>
                      </button>
                      <button onClick={onScreenshot} className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition gap-2">
                          <Icons.Camera className="w-5 h-5 text-white/80" />
                          <span className="text-xs text-white/60">Screenshot</span>
                      </button>
                      <button onClick={onLoadSubtitle} className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition gap-2 col-span-2">
                          <Icons.Subtitles className="w-5 h-5 text-white/80" />
                          <span className="text-xs text-white/60">Load Subtitles</span>
                      </button>
                  </div>
                  
                  {/* Gestures Config */}
                  <div className="space-y-4 pt-2 border-t border-white/5">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Sensitivity</h4>
                      {Object.entries(sensitivity).map(([key, val]) => (
                          <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs text-white/60 capitalize">
                                  <span>{key}</span>
                                  <span>{Math.round(val * 100)}%</span>
                              </div>
                              <input 
                                  type="range" min="0.5" max="3" step="0.1" 
                                  value={val} 
                                  onChange={(e) => onSensitivityChange(key as keyof GestureSensitivity, parseFloat(e.target.value))}
                                  className="w-full accent-white/50 h-1 bg-white/10 rounded-full appearance-none"
                              />
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Bottom Bar */}
      <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-6 pt-12 pointer-events-auto space-y-2">
          {/* Progress Bar */}
          <div 
             className="relative h-4 group flex items-center cursor-pointer touch-none"
             ref={progressBarRef}
             onMouseDown={handleSeekStart}
             onTouchStart={handleSeekStart}
             onMouseMove={isDragging ? handleSeekMove : undefined}
             onTouchMove={isDragging ? handleSeekMove : undefined}
             onMouseUp={handleSeekEnd}
             onTouchEnd={handleSeekEnd}
          >
              <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm group-hover:h-1.5 transition-all">
                      <div className="h-full bg-white/40" style={{ width: `${(duration ? (Number(currentTime) + 10) / duration : 0) * 100}%` }} /> {/* Buffer mock */}
                      <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${progressPercent}%` }} />
                  </div>
              </div>
              {/* Thumb */}
              <div 
                className="absolute w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" 
                style={{ left: `${progressPercent}%`, marginLeft: '-6px' }} 
              />
              
              {/* Time Tooltip on Drag */}
              {isDragging && (
                  <div className="absolute bottom-6 -translate-x-1/2 bg-white text-black text-xs font-bold px-2 py-1 rounded" style={{ left: `${progressPercent}%` }}>
                      {formatTime(dragTime)}
                  </div>
              )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                      <button onClick={onPrev} className="p-2 text-white/70 hover:text-white disabled:opacity-30" disabled={!onPrev}><Icons.Replay10 className="w-5 h-5 rotate-180" /></button>
                      <button onClick={onPlayPause} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg">
                          {playing ? <Icons.Pause className="w-5 h-5 fill-current" /> : <Icons.Play className="w-5 h-5 fill-current ml-0.5" />}
                      </button>
                      <button onClick={onNext} className="p-2 text-white/70 hover:text-white disabled:opacity-30" disabled={!onNext}><Icons.Forward10 className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="text-xs font-mono font-medium text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-md">
                      {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
              </div>

              <div className="flex items-center gap-3">
                   <button onClick={onToggleLock} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full"><Icons.Unlock className="w-5 h-5" /></button>
                   <button onClick={cycleSpeed} className="w-10 text-xs font-bold text-white/90 hover:text-primary transition">{playbackRate}x</button>
                   <button onClick={onResetZoom} className={`p-2 rounded-full hover:bg-white/10 transition ${state.scale !== 1 ? 'text-primary' : 'text-white/70'}`}><Icons.Maximize className="w-5 h-5" /></button>
              </div>
          </div>
      </div>
    </div>
  );
};