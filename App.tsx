import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VideoList } from './components/VideoList';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoFile, VideoPreferences, GlobalSettings } from './types';
import { fetchSheetData } from './utils/googleSheet';

function App() {
  const [localVideos, setLocalVideos] = useState<VideoFile[]>([]);
  const [sheetVideos, setSheetVideos] = useState<VideoFile[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
  
  // Safe JSON parsing for localStorage
  const getStoredItem = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.warn(`Failed to parse ${key} from local storage`, e);
      return defaultValue;
    }
  };

  const [favorites, setFavorites] = useState<string[]>(() => getStoredItem('affi_favorites', []));
  const [progressHistory, setProgressHistory] = useState<Record<string, number>>(() => getStoredItem('affi_progress', {}));
  const [videoPrefs, setVideoPrefs] = useState<Record<string, VideoPreferences>>(() => getStoredItem('affi_prefs', {}));
  
  // Global Settings with Defaults
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const defaults = {
      themeColor: '#BB86FC',
      seekTime: 10,
      defaultSpeed: 1.0,
      autoPlayNext: true,
      performanceMode: false,
      enableOnlineDB: true,
      googleSheetUrls: [],
      savedStreams: []
    };
    const saved = getStoredItem<Partial<GlobalSettings>>('affi_global_settings', {});
    return { ...defaults, ...saved };
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem('affi_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('affi_progress', JSON.stringify(progressHistory)); }, [progressHistory]);
  useEffect(() => { localStorage.setItem('affi_prefs', JSON.stringify(videoPrefs)); }, [videoPrefs]);
  useEffect(() => { localStorage.setItem('affi_global_settings', JSON.stringify(settings)); }, [settings]);

  // Theme Injection
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', settings.themeColor);
  }, [settings.themeColor]);

  // Fetch Google Sheets Data
  useEffect(() => {
    const loadSheets = async () => {
      if (!settings.enableOnlineDB || settings.googleSheetUrls.length === 0) {
        setSheetVideos([]);
        return;
      }

      setLoadingSheets(true);
      let allVideos: VideoFile[] = [];
      
      for (const url of settings.googleSheetUrls) {
        const videos = await fetchSheetData(url);
        allVideos = [...allVideos, ...videos];
      }
      
      setSheetVideos(allVideos);
      setLoadingSheets(false);
    };

    loadSheets();
  }, [settings.googleSheetUrls, settings.enableOnlineDB]);

  // Merge videos (removed restricted filter)
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
    
    // Save to persistent settings
    setSettings(prev => ({
      ...prev,
      savedStreams: [newVideo, ...prev.savedStreams]
    }));
    
    setCurrentVideo(newVideo);
  };

  const handleRemoveStream = (id: string) => {
     setSettings(prev => ({
       ...prev,
       savedStreams: prev.savedStreams.filter(v => v.id !== id)
     }));
  };

  const handleSelectVideo = (video: VideoFile) => {
    setCurrentVideo(video);
  };

  const handleClosePlayer = () => {
    setCurrentVideo(null);
  };

  const handleNextVideo = useCallback(() => {
    if (!currentVideo || allVideos.length === 0) return;
    const currentIndex = allVideos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex !== -1 && currentIndex < allVideos.length - 1) {
       setCurrentVideo(allVideos[currentIndex + 1]);
    }
  }, [currentVideo, allVideos]);

  const handlePrevVideo = useCallback(() => {
    if (!currentVideo || allVideos.length === 0) return;
    const currentIndex = allVideos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex > 0) {
       setCurrentVideo(allVideos[currentIndex - 1]);
    }
  }, [currentVideo, allVideos]);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
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
    if (window.confirm('আপনি কি নিশ্চিত যে আপনি সমস্ত ডেটা মুছতে চান? (ফেভারিট, হিস্টরি এবং সেটিংস)')) {
      // Revoke URLs before clearing
      localVideos.forEach(v => URL.revokeObjectURL(v.url));
      
      setFavorites([]);
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
        savedStreams: []
      });
      localStorage.removeItem('affi_favorites');
      localStorage.removeItem('affi_progress');
      localStorage.removeItem('affi_prefs');
      localStorage.removeItem('affi_global_settings');
    }
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      // Note: This relies on localVideos closure which might be empty on initial mount if not updated.
      // Ideally handled by browser on page unload, but good practice.
    };
  }, []);

  return (
    <div className="w-full h-full bg-background text-white select-none" style={{ '--primary-color': settings.themeColor } as React.CSSProperties}>
      <style>{`
        .text-primary { color: var(--primary-color) !important; }
        .bg-primary { background-color: var(--primary-color) !important; }
        .fill-primary { fill: var(--primary-color) !important; }
        .border-primary { border-color: var(--primary-color) !important; }
        .ring-primary { --tw-ring-color: var(--primary-color) !important; }
        .decoration-primary { text-decoration-color: var(--primary-color) !important; }
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
        />
      ) : (
        <VideoList 
          videos={allVideos} 
          favorites={favorites}
          progressHistory={progressHistory}
          settings={settings}
          loadingSheets={loadingSheets}
          onSettingsChange={setSettings}
          onSelect={handleSelectVideo} 
          onImport={handleImport}
          onAddNetworkStream={handleAddNetworkStream}
          onToggleFavorite={handleToggleFavorite}
          onDeleteStream={handleRemoveStream}
          onClearData={handleClearData}
        />
      )}
    </div>
  );
}

export default App;