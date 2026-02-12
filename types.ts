export type VideoSourceType = 'local' | 'stream' | 'googlesheet';

export interface VideoFile {
  id: string;
  file?: File; 
  name: string;
  url: string;
  size: number;
  type: string;
  lastModified: number;
  duration?: number;
  thumbnail?: string;
  sourceType: VideoSourceType;
  sheetName?: string; 
}

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  brightness: number; 
  playbackRate: number;
  isBuffering: boolean;
  showControls: boolean;
  isPip: boolean;
  isLocked: boolean;
  videoFit: 'contain' | 'cover' | 'fill';
  isLooping: boolean;
  scale: number; 
}

export interface VideoPreferences {
  playbackRate: number;
  subtitlesEnabled: boolean;
}

export interface GlobalSettings {
  themeColor: string;
  seekTime: number; 
  defaultSpeed: number;
  autoPlayNext: boolean;
  performanceMode: boolean; 
  enableOnlineDB: boolean; 
  googleSheetUrls: string[]; 
  savedStreams: VideoFile[]; 
}

export interface GestureSensitivity {
  volume: number;
  brightness: number;
  seek: number;
}

export enum GestureAction {
  NONE,
  VOLUME,
  BRIGHTNESS,
  SEEK,
  ZOOM
}

export type SortOption = 'date' | 'name' | 'size' | 'source';