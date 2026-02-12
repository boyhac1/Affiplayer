import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VideoFile, SortOption, GlobalSettings } from '../types';
import { Icons } from './Icons';

interface VideoListProps {
  videos: VideoFile[];
  favorites: string[];
  progressHistory: Record<string, number>;
  settings: GlobalSettings;
  loadingSheets?: boolean;
  onSettingsChange: (settings: GlobalSettings) => void;
  onSelect: (video: VideoFile) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddNetworkStream: (url: string, name: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteStream?: (id: string) => void;
  onClearData: () => void;
}

const THEME_COLORS = [
  { name: 'Purple', value: '#BB86FC' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Amber', value: '#F59E0B' },
];

const VideoThumbnail: React.FC<{ video: VideoFile }> = ({ video }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(video.thumbnail || null);
  const isAudio = video.type.startsWith('audio');

  useEffect(() => {
    // Use provided thumbnail if available
    if (video.thumbnail) {
      setThumbnail(video.thumbnail);
      return;
    }

    if (video.sourceType === 'googlesheet' && !video.thumbnail) {
        // Fallback for sheets without thumbs
        return; 
    }

    if (video.size === 0 && video.sourceType !== 'local') return; // Don't generate for streams unless local file
    if (thumbnail || isAudio) return;

    const generate = async () => {
      const v = document.createElement('video');
      v.src = video.url;
      v.crossOrigin = "anonymous"; // Try for CORS
      v.muted = true;
      v.preload = "metadata";
      v.currentTime = 2; 

      v.onloadeddata = () => { v.currentTime = 5; };
      v.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
             setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
          }
          v.src = ""; 
        } catch (e) { console.warn("Thumbnail gen failed", e); }
      };
      v.onerror = () => v.src = "";
    };
    generate();
  }, [video, thumbnail, isAudio]);

  if (isAudio) {
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
           <Icons.Volume className="w-12 h-12 text-white/50" />
        </div>
      );
  }

  if (thumbnail) {
    return (
      <img src={thumbnail} alt={video.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setThumbnail(null)} />
    );
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black group-hover:scale-110 transition-transform duration-500">
      <div className="absolute inset-0 flex items-center justify-center">
         {video.sourceType === 'googlesheet' ? (
             <span className="text-4xl">📊</span>
         ) : video.sourceType === 'stream' ? (
             <Icons.Link className="w-12 h-12 text-white/10" />
         ) : (
             <Icons.Video className="w-12 h-12 text-white/10 group-hover:text-primary/50 transition-colors" />
         )}
      </div>
    </div>
  );
};

export const VideoList: React.FC<VideoListProps> = ({ 
  videos, 
  favorites, 
  progressHistory,
  settings,
  loadingSheets,
  onSettingsChange,
  onSelect, 
  onImport, 
  onAddNetworkStream,
  onToggleFavorite,
  onDeleteStream,
  onClearData
}) => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamName, setStreamName] = useState('');
  
  // Sheet Management State
  const [newSheetUrl, setNewSheetUrl] = useState('');

  // Pin Code State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);

  const filteredVideos = useMemo(() => {
    let result = [...videos];
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(lower));
    }
    if (showFavoritesOnly) {
      result = result.filter(v => favorites.includes(v.id));
    }
    result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size - a.size;
      if (sort === 'source') return a.sourceType.localeCompare(b.sourceType);
      return b.lastModified - a.lastModified;
    });
    return result;
  }, [videos, search, sort, showFavoritesOnly, favorites]);

  const submitStream = (e: React.FormEvent) => {
      e.preventDefault();
      if (streamUrl) {
          onAddNetworkStream(streamUrl, streamName || "Network Stream");
          setStreamUrl('');
          setStreamName('');
          setShowStreamModal(false);
      }
  };

  const handleAddSheet = () => {
    if (newSheetUrl && !settings.googleSheetUrls.includes(newSheetUrl)) {
      onSettingsChange({
        ...settings,
        googleSheetUrls: [...settings.googleSheetUrls, newSheetUrl]
      });
      setNewSheetUrl('');
    }
  };

  const handleRemoveSheet = (urlToRemove: string) => {
    onSettingsChange({
      ...settings,
      googleSheetUrls: settings.googleSheetUrls.filter(url => url !== urlToRemove)
    });
  };

  const updateSetting = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
      onSettingsChange({ ...settings, [key]: value });
  };

  // Pin Logic
  const handleRestrictedToggle = () => {
    if (settings.enableRestrictedMode) {
        // Turning OFF - No PIN needed to hide (for safety), or maybe require PIN?
        // Let's require PIN to toggle OFF as well if strict, but typically turning OFF visibility is instant, 
        // turning ON requires auth.
        // Actually, let's just turn it OFF immediately for quick hide.
        updateSetting('enableRestrictedMode', false);
    } else {
        // Turning ON
        setPinInput('');
        setShowPinModal(true);
        setIsSettingNewPin(!settings.restrictedPin);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isSettingNewPin) {
          if (pinInput.length >= 4) {
              onSettingsChange({
                  ...settings,
                  restrictedPin: pinInput,
                  enableRestrictedMode: true
              });
              setShowPinModal(false);
          } else {
              alert("PIN must be at least 4 digits");
          }
      } else {
          if (pinInput === settings.restrictedPin) {
              updateSetting('enableRestrictedMode', true);
              setShowPinModal(false);
          } else {
              alert("Incorrect PIN");
              setPinInput('');
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] text-white font-sans">
      {/* App Bar */}
      <div className="bg-[#1E1E1E]/90 backdrop-blur-md px-4 py-3 shadow-lg z-20 border-b border-white/5 sticky top-0">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center">
             <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-primary to-purple-600 rounded-xl mr-3 shadow-lg shadow-primary/20 animate-fade-in transition-colors duration-500">
                 <Icons.Video className="w-5 h-5 text-white" />
             </div>
             <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">Affiplayer</h1>
                <span className="text-[10px] text-white/40 tracking-widest uppercase font-semibold">Pro Media Engine</span>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <button onClick={() => setShowStreamModal(true)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition border border-white/10">
                <Icons.Link className="w-5 h-5 text-blue-400" />
             </button>
             <label className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition border border-white/10">
               <Icons.Folder className="w-5 h-5 text-secondary" />
               <input type="file" multiple accept="video/*,audio/*" className="hidden" onChange={onImport} />
             </label>
             <button onClick={() => setShowSettings(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition border border-white/10">
                <Icons.Settings className="w-5 h-5 text-white" />
             </button>
           </div>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
             <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
             <input type="text" placeholder="মিডিয়া খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition shadow-inner" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition border shadow-sm ${showFavoritesOnly ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
               <Icons.Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-primary' : ''}`} />
               <span className="hidden sm:inline">পছন্দের</span>
            </button>
            <div className="relative group">
               <button className="h-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-sm font-medium text-white/70 hover:bg-white/10 transition shadow-sm">
                  <Icons.Sort className="w-4 h-4" />
                  <span className="capitalize hidden sm:inline">{sort}</span>
               </button>
               <div className="absolute right-0 top-full mt-2 w-32 bg-[#252525] border border-white/10 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-30 ring-1 ring-black/50">
                  {(['date', 'name', 'size', 'source'] as SortOption[]).map(option => (
                     <button key={option} onClick={() => setSort(option)} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 capitalize border-b border-white/5 last:border-0 ${sort === option ? 'text-primary' : 'text-white/80'}`}>{option}</button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal - Enhanced for Database */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
           <div className="bg-[#1E1E1E] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                   <Icons.Settings className="w-5 h-5 text-primary" /> 
                   সেটিংস & ডাটাবেস
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                   <Icons.Close className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-8 no-scrollbar">
                 
                 {/* Google Sheet Database Section */}
                 <div>
                    <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4 flex justify-between items-center">
                        অনলাইন ডাটাবেস (Google Sheets)
                        <button onClick={() => updateSetting('enableOnlineDB', !settings.enableOnlineDB)} className={`text-xs px-2 py-1 rounded border ${settings.enableOnlineDB ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`}>
                            {settings.enableOnlineDB ? 'Active' : 'Disabled'}
                        </button>
                    </h3>
                    
                    {settings.enableOnlineDB && (
                      <div className="space-y-4">
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                placeholder="Paste Google Sheet Link here..." 
                                value={newSheetUrl}
                                onChange={e => setNewSheetUrl(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                             />
                             <button onClick={handleAddSheet} className="px-4 bg-primary text-black font-bold rounded-lg text-sm">Add</button>
                          </div>
                          
                          {/* List of Sheets */}
                          <div className="space-y-2">
                              {settings.googleSheetUrls.map((url, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                          <span className="text-xl">📊</span>
                                          <span className="text-xs text-white/60 truncate max-w-[150px]">{url}</span>
                                      </div>
                                      <button onClick={() => handleRemoveSheet(url)} className="text-red-400 hover:text-red-300 p-1">
                                          <Icons.Trash className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                              {settings.googleSheetUrls.length === 0 && (
                                  <p className="text-xs text-white/30 text-center py-2">কোনো শিট লিংক অ্যাড করা হয়নি</p>
                              )}
                          </div>
                      </div>
                    )}
                 </div>

                 {/* 18+ Feature (Restricted Mode) */}
                 <div>
                    <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">সিকিউরিটি</h3>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                {settings.enableRestrictedMode ? <Icons.Unlock className="w-5 h-5 text-red-400" /> : <Icons.Lock className="w-5 h-5 text-white/60" />}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-red-100">১৮+ রেস্ট্রিক্টেড মোড</div>
                                <div className="text-xs text-white/40">লুকানো কন্টেন্ট দেখার জন্য</div>
                            </div>
                        </div>
                        <button 
                            onClick={handleRestrictedToggle}
                            className={`w-11 h-6 rounded-full relative transition-colors ${settings.enableRestrictedMode ? 'bg-red-500' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableRestrictedMode ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                 </div>

                 {/* Theme Color */}
                 <div>
                    <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">থিম ও কালার</h3>
                    <div className="flex gap-3 justify-between">
                       {THEME_COLORS.map((color) => (
                          <button
                             key={color.name}
                             onClick={() => updateSetting('themeColor', color.value)}
                             className={`w-10 h-10 rounded-full transition-transform hover:scale-110 flex items-center justify-center border-2 ${settings.themeColor === color.value ? 'border-white scale-110' : 'border-transparent'}`}
                             style={{ backgroundColor: color.value }}
                          >
                             {settings.themeColor === color.value && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Controls Config */}
                 <div>
                    <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">প্লেয়ার কন্ট্রোল</h3>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-sm">সিক টাইম</span>
                          <div className="flex bg-black/20 rounded-lg p-1">
                             {[5, 10, 30].map(time => (
                                <button key={time} onClick={() => updateSetting('seekTime', time)} className={`px-3 py-1 text-xs rounded-md transition ${settings.seekTime === time ? 'bg-primary text-black font-bold' : 'text-white/60 hover:text-white'}`}>{time}s</button>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>

                 <button onClick={() => { onClearData(); setShowSettings(false); }} className="w-full text-red-400 text-sm py-2 hover:underline border border-red-500/20 rounded-lg">
                    ফ্যাক্টরি রিসেট (সকল ডেটা মুছুন)
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* PIN Code Modal */}
      {showPinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
              <div className="bg-[#1E1E1E] w-full max-w-sm p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center">
                  <div className="mb-4 p-3 bg-white/5 rounded-full">
                      <Icons.Lock className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">
                      {isSettingNewPin ? "নতুন পিন সেট করুন" : "পিন কোড দিন"}
                  </h3>
                  <p className="text-xs text-white/40 mb-6 text-center">
                      {isSettingNewPin ? "সিকিউর ফোল্ডার অ্যাক্সেস করার জন্য একটি পিন সেট করুন।" : "১৮+ কন্টেন্ট দেখার জন্য আপনার পিন দিন।"}
                  </p>

                  <form onSubmit={handlePinSubmit} className="w-full space-y-4">
                      <input 
                          type="password" 
                          autoFocus
                          value={pinInput}
                          onChange={e => {
                              if (/^\d*$/.test(e.target.value) && e.target.value.length <= 6) {
                                  setPinInput(e.target.value);
                              }
                          }}
                          className="w-full bg-black/40 border border-white/20 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-primary transition font-mono"
                          placeholder="••••"
                      />
                      <div className="flex gap-3">
                          <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); }} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition">বাতিল</button>
                          <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-black font-bold transition shadow-lg shadow-primary/20">
                              {isSettingNewPin ? "সেট করুন" : "আনলক"}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {filteredVideos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50 gap-4 mt-10">
            {loadingSheets ? (
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p>অনলাইন ডাটাবেস লোড হচ্ছে...</p>
                </div>
            ) : (
                <>
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-2 animate-pulse ring-1 ring-white/10">
                    <Icons.Folder className="w-10 h-10 opacity-30" />
                    </div>
                    <p className="text-lg font-medium">কোনো মিডিয়া পাওয়া যায়নি</p>
                    <div className="flex flex-col gap-2 items-center text-center">
                        <p className="text-sm">ফাইল ইম্পোর্ট করুন অথবা সেটিংসে ডাটাবেস লিংক দিন</p>
                        {settings.googleSheetUrls.length > 0 && !settings.enableRestrictedMode && (
                             <p className="text-xs text-white/30 mt-2">(কিছু কন্টেন্ট ১৮+ মোডে লুকানো থাকতে পারে)</p>
                        )}
                    </div>
                </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {filteredVideos.map((video) => {
              const isFav = favorites.includes(video.id);
              const progress = progressHistory[video.id] || 0;
              const hasProgress = progress > 10; 
              const isAudio = video.type.startsWith('audio');
              const isSheet = video.sourceType === 'googlesheet';
              const isStream = video.sourceType === 'stream';
              const isRestricted = video.isRestricted;

              return (
                <div 
                  key={video.id}
                  onClick={() => onSelect(video)}
                  className="bg-[#1E1E1E] rounded-xl overflow-hidden cursor-pointer group hover:ring-2 ring-primary/50 transition-all duration-300 shadow-md hover:shadow-2xl hover:-translate-y-1 relative"
                >
                  <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
                    <VideoThumbnail video={video} />
                    
                    {/* Badge for Source */}
                    <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
                        {isSheet && <span className="bg-green-600/90 text-white text-[10px] px-2 py-0.5 rounded shadow-sm backdrop-blur-md self-start">DATABASE</span>}
                        {isStream && <span className="bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded shadow-sm backdrop-blur-md self-start">STREAM</span>}
                        {isRestricted && <span className="bg-red-600/90 text-white text-[10px] px-2 py-0.5 rounded shadow-sm backdrop-blur-md self-start">18+</span>}
                    </div>

                    {/* Delete Stream Button (Only for streams, not local or sheet items managed via settings) */}
                    {isStream && onDeleteStream && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteStream(video.id); }}
                            className="absolute top-2 left-16 z-20 bg-red-500/80 p-1 rounded text-white hover:bg-red-600"
                        >
                            <Icons.Trash className="w-3 h-3" />
                        </button>
                    )}

                    {hasProgress && !isAudio && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                         <div className="h-full bg-primary w-1/3 shadow-[0_0_10px_rgba(187,134,252,0.8)]" /> 
                         <div className="absolute right-1 bottom-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/90 backdrop-blur-md">Resume</div>
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[1px] z-20">
                       <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-75">
                          {isAudio ? <Icons.Volume className="w-5 h-5 text-black" /> : <Icons.Play className="w-5 h-5 fill-black text-black ml-1" />}
                       </div>
                    </div>

                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                        <button onClick={(e) => onToggleFavorite(video.id, e)} className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white transition hover:text-red-500">
                            <Icons.Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                        </button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-white line-clamp-1 mb-1 group-hover:text-primary transition-colors">{video.name}</h3>
                    <div className="flex items-center justify-between text-xs text-white/40 font-mono">
                      <span>{video.size > 0 ? (video.size / (1024 * 1024)).toFixed(1) + ' MB' : isSheet ? 'Cloud' : 'Live'}</span>
                      <span>{new Date(video.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Network Stream Modal */}
      {showStreamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
           <div className="bg-[#1E1E1E] w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl">
               <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                   <Icons.Link className="w-5 h-5 text-blue-400" />
                   Network Stream
               </h2>
               <form onSubmit={submitStream}>
                   <div className="space-y-4">
                       <div>
                           <label className="text-xs text-white/60 block mb-1.5">Network URL</label>
                           <input type="url" required placeholder="http://..." value={streamUrl} onChange={e => setStreamUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition" />
                       </div>
                       <div>
                           <label className="text-xs text-white/60 block mb-1.5">Name (Optional)</label>
                           <input type="text" placeholder="My Stream" value={streamName} onChange={e => setStreamName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition" />
                       </div>
                       <div className="flex gap-3 pt-2">
                           <button type="button" onClick={() => setShowStreamModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition">Cancel</button>
                           <button type="submit" className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition shadow-lg shadow-blue-500/20">Save & Play</button>
                       </div>
                   </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};