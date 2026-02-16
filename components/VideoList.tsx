import React, { useState, useMemo, useEffect } from 'react';
import { VideoFile, SortOption, GlobalSettings, NavTab } from '../types';
import { Icons } from './Icons';

interface VideoListProps {
  videos: VideoFile[];
  favorites: string[];
  history: string[];
  progressHistory: Record<string, number>;
  settings: GlobalSettings;
  loadingSheets?: boolean;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onSettingsChange: (settings: GlobalSettings) => void;
  onSelect: (video: VideoFile) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddNetworkStream: (url: string, name: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteStream?: (id: string) => void;
  onClearData: () => void;
  onRefresh: () => void;
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
    if (video.thumbnail) { setThumbnail(video.thumbnail); return; }
    if (video.sourceType === 'googlesheet' && !video.thumbnail) return;
    if (video.size === 0 && video.sourceType !== 'local') return;
    if (thumbnail || isAudio) return;

    const generate = async () => {
      const v = document.createElement('video');
      v.src = video.url;
      v.crossOrigin = "anonymous";
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
        } catch (e) {}
      };
      v.onerror = () => v.src = "";
    };
    generate();
  }, [video, thumbnail, isAudio]);

  if (isAudio) return (
    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
        <Icons.Volume className="w-12 h-12 text-white/50" />
    </div>
  );

  if (thumbnail) return (
    <img src={thumbnail} alt={video.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setThumbnail(null)} />
  );

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black group-hover:scale-110 transition-transform duration-500">
      <div className="absolute inset-0 flex items-center justify-center">
         {video.sourceType === 'googlesheet' ? <span className="text-4xl">📊</span> : 
          video.sourceType === 'stream' ? <Icons.Link className="w-12 h-12 text-white/10" /> : 
          <Icons.Video className="w-12 h-12 text-white/10 group-hover:text-primary/50 transition-colors" />}
      </div>
    </div>
  );
};

const VideoSkeleton = () => (
    <div className="bg-[#1E1E1E] rounded-xl overflow-hidden shadow-md animate-pulse">
        <div className="aspect-video bg-white/5 relative">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-white/10 rounded-full" />
            </div>
        </div>
        <div className="p-3 space-y-2">
            <div className="h-4 bg-white/10 rounded w-3/4" />
            <div className="flex justify-between items-center">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="w-4 h-4 bg-white/5 rounded-full" />
            </div>
        </div>
    </div>
);

export const VideoList: React.FC<VideoListProps> = ({ 
  videos, 
  favorites, 
  history,
  progressHistory,
  settings,
  loadingSheets,
  activeTab,
  setActiveTab,
  onSettingsChange,
  onSelect, 
  onImport, 
  onAddNetworkStream,
  onToggleFavorite,
  onDeleteStream,
  onClearData,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date');
  const [showSettings, setShowSettings] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamName, setStreamName] = useState('');
  const [newSheetUrl, setNewSheetUrl] = useState('');

  const filteredVideos = useMemo(() => {
    let result = [...videos];
    
    // Filter by Tab
    if (activeTab === 'favorites') {
        result = result.filter(v => favorites.includes(v.id));
    } else if (activeTab === 'history') {
        // Filter and sort by history order
        result = history.map(id => videos.find(v => v.id === id)).filter((v): v is VideoFile => !!v);
    }

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(lower));
    }

    if (activeTab !== 'history') {
        result.sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'size') return b.size - a.size;
        if (sort === 'source') return a.sourceType.localeCompare(b.sourceType);
        return b.lastModified - a.lastModified;
        });
    }
    
    return result;
  }, [videos, search, sort, activeTab, favorites, history]);

  const submitStream = (e: React.FormEvent) => {
      e.preventDefault();
      if (streamUrl) {
          onAddNetworkStream(streamUrl, streamName || "Network Stream");
          setStreamUrl(''); setStreamName(''); setShowStreamModal(false);
      }
  };

  const updateSetting = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
      onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex h-full bg-[#121212] text-white font-sans overflow-hidden">
        {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) could be implemented here. For now, using a Sidebar layout. */}
        <aside className="w-16 md:w-64 bg-[#1E1E1E] border-r border-white/5 flex-col hidden md:flex z-20">
            <div className="p-4 flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-tr from-primary to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    <Icons.Video className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight hidden md:block">Affiplayer</h1>
            </div>

            <nav className="flex-1 space-y-1 px-2">
                <button onClick={() => setActiveTab('library')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium ${activeTab === 'library' ? 'bg-primary/10 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                    <Icons.Folder className="w-5 h-5" />
                    <span className="hidden md:block">Library</span>
                </button>
                <button onClick={() => setActiveTab('favorites')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium ${activeTab === 'favorites' ? 'bg-primary/10 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                    <Icons.Heart className="w-5 h-5" />
                    <span className="hidden md:block">Favorites</span>
                </button>
                <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium ${activeTab === 'history' ? 'bg-primary/10 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                    <Icons.History className="w-5 h-5" />
                    <span className="hidden md:block">History</span>
                </button>
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2">
                 <button onClick={() => setShowStreamModal(true)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white transition">
                    <Icons.Link className="w-4 h-4" />
                    <span className="hidden md:block">Stream URL</span>
                 </button>
                 <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white transition">
                    <Icons.Settings className="w-4 h-4" />
                    <span className="hidden md:block">Settings</span>
                 </button>
            </div>
        </aside>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1E1E1E] border-t border-white/5 z-30 flex justify-around p-2 pb-safe">
            <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'library' ? 'text-primary' : 'text-white/50'}`}>
                <Icons.Folder className="w-6 h-6" />
                <span className="text-[10px] mt-1">Library</span>
            </button>
            <button onClick={() => setActiveTab('favorites')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'favorites' ? 'text-primary' : 'text-white/50'}`}>
                <Icons.Heart className="w-6 h-6" />
                <span className="text-[10px] mt-1">Favorites</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'history' ? 'text-primary' : 'text-white/50'}`}>
                <Icons.History className="w-6 h-6" />
                <span className="text-[10px] mt-1">History</span>
            </button>
             <button onClick={() => setShowSettings(true)} className={`flex flex-col items-center p-2 rounded-lg text-white/50`}>
                <Icons.Settings className="w-6 h-6" />
                <span className="text-[10px] mt-1">Settings</span>
            </button>
        </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Bar */}
        <div className="bg-[#121212]/90 backdrop-blur-md px-4 py-4 z-20 sticky top-0 border-b border-white/5">
            <div className="flex items-center gap-3 mb-4 md:hidden">
                 <div className="w-8 h-8 bg-gradient-to-tr from-primary to-purple-600 rounded-lg flex items-center justify-center">
                    <Icons.Video className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold">Affiplayer</h1>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full sm:max-w-md">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input type="text" placeholder="Search videos..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1E1E1E] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition" />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* View Mode Toggle */}
                    <div className="flex bg-[#1E1E1E] p-1 rounded-lg border border-white/10">
                        <button onClick={() => updateSetting('viewMode', 'grid')} className={`p-1.5 rounded-md transition ${settings.viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                            <Icons.LayoutGrid className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateSetting('viewMode', 'list')} className={`p-1.5 rounded-md transition ${settings.viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                            <Icons.ListVideo className="w-4 h-4" />
                        </button>
                    </div>

                    <button onClick={onRefresh} className="p-2 bg-[#1E1E1E] border border-white/10 rounded-lg text-white/70 hover:text-primary transition" title="Refresh Online DB">
                        <Icons.Refresh className={`w-5 h-5 ${loadingSheets ? 'animate-spin' : ''}`} />
                    </button>

                    <label className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary hover:bg-primary/90 text-black cursor-pointer transition shadow-lg shadow-primary/20">
                        <Icons.Folder className="w-4 h-4" />
                        <input type="file" multiple accept="video/*,audio/*" className="hidden" onChange={onImport} />
                    </label>

                    <div className="relative group">
                       <button className="h-9 px-3 rounded-lg bg-[#1E1E1E] border border-white/10 flex items-center gap-2 text-sm text-white/70 hover:bg-white/5 transition">
                          <Icons.Sort className="w-4 h-4" />
                          <span className="capitalize hidden sm:inline">{sort}</span>
                       </button>
                       <div className="absolute right-0 top-full mt-2 w-32 bg-[#252525] border border-white/10 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-30">
                          {(['date', 'name', 'size', 'source'] as SortOption[]).map(opt => (
                             <button key={opt} onClick={() => setSort(opt)} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/5 capitalize ${sort === opt ? 'text-primary' : 'text-white/80'}`}>{opt}</button>
                          ))}
                       </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Video Grid/List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 no-scrollbar">
            {filteredVideos.length === 0 && !loadingSheets ? (
                <div className="h-full flex flex-col items-center justify-center text-white/50 gap-4 animate-fade-in">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2">
                            {activeTab === 'favorites' ? <Icons.Heart className="w-8 h-8 opacity-30" /> : 
                             activeTab === 'history' ? <Icons.History className="w-8 h-8 opacity-30" /> :
                             <Icons.Folder className="w-8 h-8 opacity-30" />}
                        </div>
                        <p>No media found</p>
                        <button onClick={() => document.querySelector('input[type="file"]')?.click()} className="text-primary text-sm hover:underline">Import Local Videos</button>
                </div>
            ) : (
                <div className={settings.viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4" : "flex flex-col gap-2"}>
                    {/* Skeletons while loading */}
                    {loadingSheets && Array.from({ length: 8 }).map((_, i) => (
                        <VideoSkeleton key={`skel-${i}`} />
                    ))}

                    {filteredVideos.map((video) => {
                        const isFav = favorites.includes(video.id);
                        const progress = progressHistory[video.id] || 0;
                        const hasProgress = progress > 10; 
                        const isList = settings.viewMode === 'list';

                        return (
                            <div 
                                key={video.id}
                                onClick={() => onSelect(video)}
                                className={`bg-[#1E1E1E] rounded-xl overflow-hidden cursor-pointer group hover:ring-2 ring-primary/50 transition-all shadow-md ${isList ? 'flex h-24 hover:bg-white/5' : 'hover:-translate-y-1'}`}
                            >
                                <div className={`relative flex-shrink-0 bg-black/40 overflow-hidden flex items-center justify-center ${isList ? 'w-36 h-full' : 'aspect-video'}`}>
                                    <VideoThumbnail video={video} />
                                    {/* Badges */}
                                    <div className="absolute top-2 left-2 z-20 flex gap-1">
                                        {video.sourceType === 'googlesheet' && <span className="bg-green-600/90 text-white text-[10px] px-1.5 rounded backdrop-blur-md">CLOUD</span>}
                                        {video.sourceType === 'stream' && <span className="bg-blue-600/90 text-white text-[10px] px-1.5 rounded backdrop-blur-md">LIVE</span>}
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    {hasProgress && !video.type.startsWith('audio') && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                                            <div className="h-full bg-primary w-1/3" /> 
                                        </div>
                                    )}
                                </div>

                                <div className={`flex flex-col justify-center flex-1 p-3 ${isList ? 'justify-between py-2' : ''}`}>
                                    <div>
                                        <h3 className={`font-medium text-white group-hover:text-primary transition-colors ${isList ? 'text-base line-clamp-2' : 'text-sm line-clamp-1 mb-1'}`}>{video.name}</h3>
                                        <div className="flex items-center gap-3 text-xs text-white/40 font-mono mt-1">
                                            <span>{video.size > 0 ? (video.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Stream'}</span>
                                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                                            <span>{new Date(video.lastModified).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    
                                    <div className={`flex items-center justify-between mt-2 ${isList ? 'mt-0' : ''}`}>
                                         {isList && video.sourceType === 'stream' && onDeleteStream ? (
                                             <button onClick={(e) => { e.stopPropagation(); onDeleteStream(video.id); }} className="text-red-400 hover:text-red-300 p-1"><Icons.Trash className="w-4 h-4" /></button>
                                         ) : <div />}
                                         
                                         <button onClick={(e) => onToggleFavorite(video.id, e)} className={`${isFav ? 'text-red-500' : 'text-white/20 hover:text-white/60'} transition p-1`}>
                                             <Icons.Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                         </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
           <div className="bg-[#1E1E1E] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Settings className="w-5 h-5 text-primary" /> Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full"><Icons.Close className="w-5 h-5" /></button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6 no-scrollbar">
                 {/* Google Sheet */}
                 <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-white/70">Online Database</label>
                        <button onClick={() => updateSetting('enableOnlineDB', !settings.enableOnlineDB)} className={`w-10 h-5 rounded-full relative transition-colors ${settings.enableOnlineDB ? 'bg-primary' : 'bg-white/10'}`}>
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.enableOnlineDB ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                    {settings.enableOnlineDB && (
                      <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                          <div className="flex gap-2">
                             <input type="text" placeholder="Google Sheet URL" value={newSheetUrl} onChange={e => setNewSheetUrl(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none" />
                             <button onClick={() => { if(newSheetUrl) { onSettingsChange({...settings, googleSheetUrls: [...settings.googleSheetUrls, newSheetUrl]}); setNewSheetUrl(''); }}} className="px-3 bg-primary text-black text-xs font-bold rounded-lg">Add</button>
                          </div>
                          <div className="space-y-2">
                              {settings.googleSheetUrls.map((url, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs bg-black/20 p-2 rounded">
                                      <span className="truncate max-w-[200px] text-white/60">{url}</span>
                                      <button onClick={() => onSettingsChange({...settings, googleSheetUrls: settings.googleSheetUrls.filter(u => u !== url)})} className="text-red-400"><Icons.Trash className="w-3 h-3" /></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                    )}
                 </div>

                 {/* Colors */}
                 <div>
                    <label className="text-sm font-medium text-white/70 block mb-3">Accent Color</label>
                    <div className="flex gap-3">
                       {THEME_COLORS.map((c) => (
                          <button key={c.name} onClick={() => updateSetting('themeColor', c.value)} className={`w-8 h-8 rounded-full border-2 ${settings.themeColor === c.value ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.value }} />
                       ))}
                    </div>
                 </div>

                 {/* Controls */}
                 <div>
                     <label className="text-sm font-medium text-white/70 block mb-3">Seek Time</label>
                     <div className="flex bg-white/5 rounded-lg p-1">
                        {[5, 10, 30].map(t => (
                            <button key={t} onClick={() => updateSetting('seekTime', t)} className={`flex-1 py-1.5 text-xs rounded transition ${settings.seekTime === t ? 'bg-primary text-black font-bold' : 'text-white/60'}`}>{t}s</button>
                        ))}
                     </div>
                 </div>

                 <button onClick={() => { onClearData(); setShowSettings(false); }} className="w-full text-red-400 text-xs py-3 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition">Reset All Data</button>
              </div>
           </div>
        </div>
      )}

      {/* Stream Modal */}
      {showStreamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-[#1E1E1E] w-full max-w-sm p-6 rounded-2xl border border-white/10">
               <h2 className="text-lg font-bold mb-4">Add Stream</h2>
               <form onSubmit={submitStream} className="space-y-4">
                   <input type="url" required placeholder="Stream URL (m3u8, mp4...)" value={streamUrl} onChange={e => setStreamUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none" />
                   <input type="text" placeholder="Name" value={streamName} onChange={e => setStreamName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none" />
                   <div className="flex gap-2">
                       <button type="button" onClick={() => setShowStreamModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-white/70">Cancel</button>
                       <button type="submit" className="flex-1 py-2 rounded-lg bg-primary text-black font-bold">Add</button>
                   </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};