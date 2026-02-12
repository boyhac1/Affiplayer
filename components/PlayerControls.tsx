import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  onToggleLock: () => void;
  onTogglePip: () => void;
  onBack: () => void;
  onChangeSpeed: () => void;
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
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  state,
  title,
  videoUrl,
  sensitivity,
  showSettings,
  onPlayPause,
  onSeek,
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
  onRotate
}) => {
  const { playing, currentTime, duration, isLocked, videoFit, playbackRate, isLooping, scale } = state;

  // Preview Logic State
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ x: number, time: number, image: string | null } | null>(null);

  const progress = useMemo(() => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Scrubbing Preview Logic
  const handleProgressMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const time = percentage * duration;

    setPreview(prev => ({
      x,
      time,
      image: prev?.image || null
    }));

    if (previewVideoRef.current) {
        // Simple throttling by only setting if diff > 1s or direct
        previewVideoRef.current.currentTime = time;
    }
  };

  const handlePreviewSeeked = () => {
      if (!previewVideoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
          ctx.drawImage(previewVideoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          setPreview(prev => prev ? { ...prev, image: canvasRef.current!.toDataURL() } : null);
      }
  };

  const handleProgressLeave = () => {
    setPreview(null);
  };

  // Stop propagation to prevent gestures when interacting with settings
  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  if (isLocked) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col justify-center items-start p-4 pointer-events-none">
        <button 
          onClick={onToggleLock}
          className="pointer-events-auto bg-white/10 backdrop-blur-md p-4 rounded-full hover:bg-white/20 transition-all border border-white/20 shadow-lg animate-pulse"
        >
          <Icons.Lock className="w-6 h-6 text-primary" />
        </button>
        <div className="mt-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg text-white/80 text-sm">
          Screen Locked
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between pt-0 pb-6 transition-opacity duration-300">
      
      {/* Top Bar (Removed Clock/Battery as requested) */}
      <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 sm:px-8 pt-4 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition active:scale-95">
              <Icons.Back className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-white font-medium truncate text-lg text-shadow-sm pr-4">{title}</h2>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3">
             {scale !== 1 && (
                 <button onClick={onResetZoom} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-blue-300" title="Reset Zoom">
                   <Icons.Maximize className="w-5 h-5" />
                 </button>
             )}
             <button onClick={onRotate} className="p-2 rounded-full hover:bg-white/10 transition text-white/90" title="Rotate">
               <Icons.Rotate className="w-5 h-5" />
             </button>
             <button onClick={onLoadSubtitle} className="p-2 rounded-full hover:bg-white/10 transition text-white/90" title="Load Subtitles">
               <Icons.Subtitles className="w-5 h-5" />
             </button>
             <button onClick={onScreenshot} className="p-2 rounded-full hover:bg-white/10 transition text-white/90" title="Screenshot">
               <Icons.Camera className="w-5 h-5" />
             </button>
             <button onClick={onToggleLoop} className={`p-2 rounded-full hover:bg-white/10 transition ${isLooping ? 'text-primary' : 'text-white/90'}`} title="Loop">
               <Icons.Repeat className="w-5 h-5" />
             </button>
             <button onClick={onToggleSettings} className={`p-2 rounded-full hover:bg-white/10 transition ${showSettings ? 'text-primary' : 'text-white/90'}`} title="Settings">
               <Icons.Settings className="w-5 h-5" />
             </button>
             <button onClick={onTogglePip} className="p-2 rounded-full hover:bg-white/10 transition hidden sm:block text-white/90">
               <Icons.Pip className="w-5 h-5" />
             </button>
             <button onClick={onChangeSpeed} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 backdrop-blur-sm transition min-w-[3rem]">
               {playbackRate}x
             </button>
             <button onClick={onToggleFit} className="p-2 rounded-full hover:bg-white/10 transition">
                <span className="text-[10px] font-black text-white uppercase border border-white/50 rounded px-1 py-0.5">{videoFit.substring(0,3)}</span>
             </button>
          </div>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div 
          className="absolute right-4 top-20 sm:right-8 sm:top-24 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl animate-fade-in z-50 pointer-events-auto"
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
        >
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Icons.Settings className="w-4 h-4" /> সেটিংস (Gesture)
            </h3>
            <button onClick={onToggleSettings} className="p-1 hover:bg-white/10 rounded-full">
              <Icons.Close className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1"><Icons.Brightness className="w-3 h-3" /> Brightness</span>
                <span>{sensitivity.brightness}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1"
                value={sensitivity.brightness}
                onChange={(e) => onSensitivityChange('brightness', parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1"><Icons.Volume className="w-3 h-3" /> Volume</span>
                <span>{sensitivity.volume}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1"
                value={sensitivity.volume}
                onChange={(e) => onSensitivityChange('volume', parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1"><Icons.Forward10 className="w-3 h-3" /> Seek</span>
                <span>{sensitivity.seek}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1"
                value={sensitivity.seek}
                onChange={(e) => onSensitivityChange('seek', parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Center Play Button Area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         {/* We can add a subtle gradient center if paused */}
         {!playing && !showSettings && (
            <div className="bg-black/30 rounded-full p-5 backdrop-blur-sm border border-white/10 shadow-2xl animate-fade-in transform scale-100">
                <Icons.Play className="w-12 h-12 text-white fill-white ml-1.5" />
            </div>
         )}
      </div>

      {/* Bottom Controls with Glassmorphism */}
      <div className="px-4 sm:px-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12">
        {/* Seek Bar */}
        <div className="flex items-center gap-4 mb-2">
          <span className="text-xs text-white/90 font-mono min-w-[40px] text-right">{formatTime(currentTime)}</span>
          
          <div 
            ref={progressBarRef}
            className="relative flex-1 h-8 group flex items-center cursor-pointer"
            onMouseMove={handleProgressMove}
            onMouseLeave={handleProgressLeave}
          >
            {/* Preview Tooltip */}
            {preview && (
              <div 
                  className="absolute bottom-10 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-50 animate-fade-in"
                  style={{ left: preview.x }}
              >
                  {/* Thumbnail Box */}
                  <div className="w-40 h-[90px] bg-black border border-white/20 rounded-lg overflow-hidden shadow-2xl relative">
                      {preview.image ? (
                        <img src={preview.image} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-xs text-white font-mono py-1 backdrop-blur-sm">
                        {formatTime(preview.time)}
                      </div>
                  </div>
              </div>
            )}

            <input 
              type="range" 
              min={0} 
              max={duration || 100} 
              value={currentTime} 
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
            />
            {/* Background Track */}
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              {/* Progress Track */}
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary relative" 
                style={{ width: `${progress}%` }}
              >
                {/* Thumb Glow */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-0 group-hover:scale-100 transition-transform duration-200" />
              </div>
            </div>
          </div>
          <span className="text-xs text-white/90 font-mono min-w-[40px]">{formatTime(duration)}</span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
             <button onClick={onToggleLock} className="p-3 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95">
               <Icons.Unlock className="w-5 h-5" />
             </button>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6">
             {/* Previous */}
             <button onClick={onPrev} disabled={!onPrev} className={`p-2 rounded-full transition ${onPrev ? 'hover:bg-white/10 text-white' : 'text-white/20 cursor-not-allowed'}`}>
                 <Icons.Replay10 className="w-6 h-6 rotate-180 transform" style={{ transform: 'scaleX(-1)' }} /> 
             </button>

             <button onClick={() => onSeek(currentTime - 10)} className="p-3 rounded-full hover:bg-white/10 text-white transition active:scale-90 active:bg-white/20">
                <Icons.Replay10 className="w-8 h-8" />
             </button>
             
             <button 
               onClick={onPlayPause} 
               className="p-3 bg-white text-black rounded-full hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.3)] transform hover:scale-105 active:scale-95"
             >
               {playing ? <Icons.Pause className="w-6 h-6 fill-current" /> : <Icons.Play className="w-6 h-6 fill-current ml-1" />}
             </button>
             
             <button onClick={() => onSeek(currentTime + 10)} className="p-3 rounded-full hover:bg-white/10 text-white transition active:scale-90 active:bg-white/20">
                <Icons.Forward10 className="w-8 h-8" />
             </button>

             {/* Next */}
             <button onClick={onNext} disabled={!onNext} className={`p-2 rounded-full transition ${onNext ? 'hover:bg-white/10 text-white' : 'text-white/20 cursor-not-allowed'}`}>
                 <Icons.Forward10 className="w-6 h-6 rotate-180 transform" style={{ transform: 'scaleX(-1)' }} />
             </button>
          </div>

          <div className="flex items-center gap-2">
             <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Hidden elements for generating preview */}
      <video 
         ref={previewVideoRef} 
         src={videoUrl} 
         className="hidden" 
         preload="metadata"
         onSeeked={handlePreviewSeeked}
         muted 
      />
      <canvas ref={canvasRef} width={160} height={90} className="hidden" />

    </div>
  );
};