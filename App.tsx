import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VideoList } from './components/VideoList';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoFile, VideoPreferences, GlobalSettings, NavTab, ToastMessage, CachedSheetData } from './types';
import { fetchSheetData } from './utils/googleSheet';
import { Icons } from './components/Icons';

function App() {
  const [localVideos, setLocalVideos] = useState<VideoFile[]>([]);
  const [sheetVideos, setSheetVideos] = useState<VideoFile[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
  
  // Safe JSON parsing helper
  const getStoredItem = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.warn(`Failed to parse ${key} from local storage`, e);
      return defaultValue;
    }
  };

  // State Management
  const [favorites, setFavorites] = useState<string[]>(() => getStoredItem('affi_favorites', []));
  const [history, setHistory] = useState<string[]>(() => getStoredItem('affi_history', [])); // List of IDs
  const [progressHistory, setProgressHistory] = useState<Record<string, number>>(() => getStoredItem('affi_progress', {}));
  const [videoPrefs, setVideoPrefs] = useState<Record<string, VideoPreferences>>(() => getStoredItem('affi_prefs', {}));
  
  const [activeTab, setActiveTab] = useState<NavTab>('library');

  // Global Settings with Defaults
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const defaults: GlobalSettings = {
      themeColor: '#BB86FC',
      seekTime: 10,
      defaultSpeed: 1.0,
      autoPlayNext: true,
      performanceMode: false,
      enableOnlineDB: true,
      googleSheetUrls: [],
      savedStreams: [],
      viewMode: 'grid'
    };
    const saved = getStoredItem<Partial<GlobalSettings>>('affi_global_settings', {});
    return { ...defaults, ...saved };
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem('affi_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('affi_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('affi_progress', JSON.stringify(progressHistory)); }, [progressHistory]);
  useEffect(() => { localStorage.setItem('affi_prefs', JSON.stringify(videoPrefs)); }, [videoPrefs]);
  useEffect(() => { localStorage.setItem('affi_global_settings', JSON.stringify(settings)); }, [settings]);

  // Theme Injection
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', settings.themeColor);
  }, [settings.themeColor]);

  // Toast System
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Fetch Google Sheets Data with Smart Caching
  useEffect(() => {
    const loadSheets = async () => {
      if (!settings.enableOnlineDB || settings.googleSheetUrls.length === 0) {
        setSheetVideos([]);
        return;
      }

      setLoadingSheets(true);
      let allVideos: VideoFile[] = [];
      let hasError = false;

      // Check Cache Strategy (1 hour cache)
      const CACHE_KEY = 'affi_sheet_cache';
      const CACHE_DURATION = 3600 * 1000; 
      const cached = getStoredItem<CachedSheetData | null>(CACHE_KEY, null);
      
      const shouldFetch = !cached || (Date.now() - cached.timestamp > CACHE_DURATION) || (cached.data.length === 0 && settings.googleSheetUrls.length > 0);

      if (!shouldFetch && cached) {
         setSheetVideos(cached.data);
         setLoadingSheets(false);
         // Background refresh if needed could go here
         return;
      }
      
      for (const url of settings.googleSheetUrls) {
        try {
            const videos = await fetchSheetData(url);
            if (videos.length > 0) {
                allVideos = [...allVideos, ...videos];
            }
        } catch (e) {
            console.error(e);
            hasError = true;
        }
      }

      if (hasError && allVideos.length === 0) {
          addToast("Failed to load some online databases", "error");
      } else if (allVideos.length > 0) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: allVideos }));
      }
      
      setSheetVideos(allVideos);
      setLoadingSheets(false);
    };

    loadSheets();
  }, [settings.googleSheetUrls, settings.enableOnlineDB]);

  // Merge videos
  const allVideos = useMemo(() => {
    return [...localVideos, ...settings.savedStreams, ...sheetVideos];
  }, [localVideos, settings.savedStreams, sheetVideos]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newVideos: VideoFile[] = Array.from(e.target.files).map((file: File) => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        sourceType: 'local'
      }));
      setLocalVideos(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const filtered = newVideos.filter(v => !existingIds.has(v.id));
        return [...prev, ...filtered];
      });
      addToast(`Imported ${newVideos.length} videos`, 'success');
    }
  };

  const handleAddNetworkStream = (url: string, name: string) => {
    const newVideo: VideoFile = {
      id: `stream-${Date.now()}`,
      name: name || "Network Stream",
      url: url,
      size: 0,
      type: 'video/mp4',
      lastModified: Date.now(),
      sourceType: 'stream'
    };
    
    setSettings(prev => ({
      ...prev,
      savedStreams: [newVideo, ...prev.savedStreams]
    }));
    
    setCurrentVideo(newVideo);
    addToast("Network stream added", "success");
  };

  const handleRemoveStream = (id: string) => {
     setSettings(prev => ({
       ...prev,
       savedStreams: prev.savedStreams.filter(v => v.id !== id)
     }));
     addToast("Stream removed", "info");
  };

  const handleSelectVideo = (video: VideoFile) => {
    setCurrentVideo(video);
    // Add to history
    setHistory(prev => {
        const newHistory = [video.id, ...prev.filter(id => id !== video.id)];
        return newHistory.slice(0, 50); // Keep last 50
    });
  };

  const handleClosePlayer = () => {
    setCurrentVideo(null);
  };

  const handleNextVideo = useCallback(() => {
    if (!currentVideo || allVideos.length === 0) return;
    const currentIndex = allVideos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex !== -1 && currentIndex < allVideos.length - 1) {
       handleSelectVideo(allVideos[currentIndex + 1]);
    }
  }, [currentVideo, allVideos]);

  const handlePrevVideo = useCallback(() => {
    if (!currentVideo || allVideos.length === 0) return;
    const currentIndex = allVideos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex > 0) {
       handleSelectVideo(allVideos[currentIndex - 1]);
    }
  }, [currentVideo, allVideos]);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAdding = !favorites.includes(id);
    setFavorites(prev => 
      isAdding ? [...prev, id] : prev.filter(fid => fid !== id)
    );
    addToast(isAdding ? "Added to favorites" : "Removed from favorites", "info");
  };

  const handleUpdateProgress = (time: number) => {
      if (currentVideo) {
          setProgressHistory(prev => ({
              ...prev,
              [currentVideo.id]: time
          }));
      }
  };

  const handleUpdatePlaybackRate = (rate: number) => {
    if (currentVideo) {
      setVideoPrefs(prev => ({
        ...prev,
        [currentVideo.id]: { 
          ...prev[currentVideo.id], 
          playbackRate: rate 
        }
      }));
    }
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      localVideos.forEach(v => URL.revokeObjectURL(v.url));
      setFavorites([]);
      setHistory([]);
      setProgressHistory({});
      setVideoPrefs({});
      setLocalVideos([]);
      setSettings({
        themeColor: '#BB86FC',
        seekTime: 10,
        defaultSpeed: 1.0,
        autoPlayNext: true,
        performanceMode: false,
        enableOnlineDB: true,
        googleSheetUrls: [],
        savedStreams: [],
        viewMode: 'grid'
      });
      localStorage.clear();
      addToast("All data cleared", "error");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleManualRefresh = () => {
      localStorage.removeItem('affi_sheet_cache');
      setSettings(s => ({...s})); // Force re-render/effect trigger
      addToast("Refreshing database...", "info");
  };

  // Cleanup
  useEffect(() => {
    return () => {
      // Cleanup logic if needed on unmount
    };
  }, []);

  return (
    <div className="w-full h-full bg-background text-white select-none overflow-hidden flex flex-col" style={{ '--primary-color': settings.themeColor } as React.CSSProperties}>
      <style>{`
        .text-primary { color: var(--primary-color) !important; }
        .bg-primary { background-color: var(--primary-color) !important; }
        .fill-primary { fill: var(--primary-color) !important; }
        .border-primary { border-color: var(--primary-color) !important; }
        .ring-primary { --tw-ring-color: var(--primary-color) !important; }
        ${settings.performanceMode ? `.backdrop-blur-md, .backdrop-blur-sm, .backdrop-blur-xl { backdrop-filter: none !important; background-color: rgba(18, 18, 18, 0.95) !important; }` : ''}
      `}</style>

      {currentVideo ? (
        <VideoPlayer 
          video={currentVideo}
          initialTime={progressHistory[currentVideo.id] || 0}
          initialPlaybackRate={videoPrefs[currentVideo.id]?.playbackRate || settings.defaultSpeed}
          seekTime={settings.seekTime}
          autoPlayNext={settings.autoPlayNext}
          onClose={handleClosePlayer}
          onUpdateProgress={handleUpdateProgress}
          onPlaybackRateChange={handleUpdatePlaybackRate}
          onNext={allVideos.indexOf(currentVideo) < allVideos.length - 1 ? handleNextVideo : undefined}
          onPrev={allVideos.indexOf(currentVideo) > 0 ? handlePrevVideo : undefined}
          addToast={addToast}
        />
      ) : (
        <VideoList 
          videos={allVideos} 
          favorites={favorites}
          history={history}
          progressHistory={progressHistory}
          settings={settings}
          loadingSheets={loadingSheets}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSettingsChange={setSettings}
          onSelect={handleSelectVideo} 
          onImport={handleImport}
          onAddNetworkStream={handleAddNetworkStream}
          onToggleFavorite={handleToggleFavorite}
          onDeleteStream={handleRemoveStream}
          onClearData={handleClearData}
          onRefresh={handleManualRefresh}
        />
      )}

      {/* Toast Container */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[60] pointer-events-none w-full max-w-sm px-4">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-[#252525] border border-white/10 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in backdrop-blur-md">
             <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-primary'}`} />
             <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;