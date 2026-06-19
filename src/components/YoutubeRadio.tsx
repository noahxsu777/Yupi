import { useEffect, useState, useRef } from 'react';
import { Youtube, Play, Pause, SkipForward, Trash2, Search, ListMusic, Radio, Sparkles, Volume2, Disc, Headphones, Sparkle } from 'lucide-react';

export interface YoutubeSong {
  id: string; // Unique queue identifier
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
  requestedBy: string;
}

interface YoutubeRadioProps {
  onSongAdded?: (song: YoutubeSong) => void;
  playCommandTrigger?: {
    command: 'play' | 'skip';
    query?: string;
    user: string;
    isModerator: boolean;
    isSuperFan: boolean;
    timestamp?: number;
  } | null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// Convert MM:SS format or HH:MM:SS to total numeric seconds
function parseDurationToSeconds(durationStr: string | number | undefined | null): number {
  if (durationStr === undefined || durationStr === null) {
    return 180;
  }
  if (typeof durationStr === 'number') {
    return durationStr;
  }
  if (typeof durationStr !== 'string') {
    return 180;
  }
  const str = durationStr.toUpperCase();
  if (str === 'LIVE' || str === 'EN VIVO') {
    return 240; // Default fallback for live streams
  }
  const parts = durationStr.split(':').map(Number);
  if (parts.some(isNaN)) return 180;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 180;
}

// Format raw numeric seconds into MM:SS format
function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function YoutubeRadio({ playCommandTrigger }: YoutubeRadioProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queue, setQueue] = useState<YoutubeSong[]>(() => {
    try {
      const saved = localStorage.getItem('tiktok_radio_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validated = parsed.filter(song => song && typeof song === 'object' && song.videoId && song.title);
          if (validated.length > 0) {
            return validated;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse queue from local storage', e);
    }
    return [
      {
        id: 'initial-1',
        videoId: '5qap5aO4i9A',
        title: 'Lofi Hip Hop Radio 🌌 Beats to Relax/Study to',
        thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/hqdefault.jpg',
        duration: 'LIVE',
        channel: 'Lofi Girl',
        requestedBy: 'Sistema'
      },
      {
        id: 'initial-2',
        videoId: '9UMxZof0kHM',
        title: 'Gente de Zona - La Gozadera ft. Marc Anthony',
        thumbnail: 'https://img.youtube.com/vi/9UMxZof0kHM/hqdefault.jpg',
        duration: '3:23',
        channel: 'GenteDeZonaVEVO',
        requestedBy: 'Moderador'
      }
    ];
  });

  const [currentSongIndex, setCurrentSongIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tiktok_radio_index');
      if (saved) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    } catch (e) {
      console.warn('Failed to parse current index from local storage', e);
    }
    return 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [continuousPlay, setContinuousPlay] = useState(true);
  const [djMode, setDjMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tiktok_radio_dj_mode');
      return saved ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [isDjSearching, setIsDjSearching] = useState(false);
  const [djNotification, setDjNotification] = useState<string | null>(null);
  const [volume, setVolume] = useState(50); // percentage (0-100)
  
  // Radio Permissions Configurations
  const [musicPermission, setMusicPermission] = useState<'todos' | 'moderadores' | 'superfans' | 'nadie'>(() => {
    return (localStorage.getItem('tiktok_radio_permission') as any) || 'todos';
  });

  const [allowSkipCommand, setAllowSkipCommand] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tiktok_radio_allow_skip');
      return saved ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  // Real-time exact playback statuses
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trackDuration, setTrackDuration] = useState(180);

  // Equalizer visual simulation state
  const [eqHeights, setEqHeights] = useState<number[]>([15, 30, 45, 20, 10, 25, 35, 15, 40, 20]);

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const queueContainerRef = useRef<HTMLDivElement>(null);

  // Create highly stable state references for async player event triggers to completely bypass closures lag
  const queueRef = useRef(queue);
  const currentSongIndexRef = useRef(currentSongIndex);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const continuousPlayRef = useRef(continuousPlay);
  const djModeRef = useRef(djMode);
  const initRetryCountRef = useRef(0);
  const lastCommandTimestampRef = useRef<number | null>(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { continuousPlayRef.current = continuousPlay; }, [continuousPlay]);
  useEffect(() => { djModeRef.current = djMode; }, [djMode]);

  // Keep selected index strictly inside array boundaries
  useEffect(() => {
    if (queue.length > 0 && (currentSongIndex < 0 || currentSongIndex >= queue.length)) {
      setCurrentSongIndex(0);
    }
  }, [queue, currentSongIndex]);

  const activeSong = (queue && queue.length > 0 && currentSongIndex >= 0 && currentSongIndex < queue.length)
    ? queue[currentSongIndex]
    : (queue && queue.length > 0 ? queue[0] : null);

  // Persist queue and current song index in state
  useEffect(() => {
    localStorage.setItem('tiktok_radio_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('tiktok_radio_index', currentSongIndex.toString());
  }, [currentSongIndex]);

  useEffect(() => {
    localStorage.setItem('tiktok_radio_dj_mode', JSON.stringify(djMode));
  }, [djMode]);

  // Auto-scroll to the bottom of the queue list when a new song is placed/added
  useEffect(() => {
    if (queueContainerRef.current) {
      queueContainerRef.current.scrollTo({
        top: queueContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [queue.length]);

  const fetchAndPlaySimilarSong = async (referenceSongTitle: string) => {
    if (isDjSearching) return;
    setIsDjSearching(true);
    setDjNotification("💿 DJ Towa está buscando una canción similar...");
    
    try {
      const currentQueue = queueRef.current;
      const songTitles = currentQueue.map(s => s.title);
      const excludeQuery = encodeURIComponent(JSON.stringify(songTitles));
      const resp = await fetch(`/api/similar-song?title=${encodeURIComponent(referenceSongTitle)}&exclude=${excludeQuery}`);
      if (!resp.ok) throw new Error("API de DJ no disponible");
      const data = await resp.json();
      
      if (data && data.title) {
        console.log(`[DJ Mode] Recomendado por DJ Towa: "${data.title}" - Motivo: ${data.reason}`);
        setDjNotification(`🎧 DJ Towa recomendó: "${data.title}" (${data.reason})`);
        
        const searchResp = await fetch(`/api/youtube-search?q=${encodeURIComponent(data.title)}`);
        if (!searchResp.ok) throw new Error("API de Youtube Search no disponible");
        const results = await searchResp.json();
        
        if (results && results.length > 0) {
          const topResult = results[0];
          const newSong: YoutubeSong = {
            id: `dj-${Date.now()}-${Math.random()}`,
            videoId: topResult.videoId,
            title: topResult.title,
            thumbnail: topResult.thumbnail,
            duration: topResult.duration,
            channel: topResult.channel,
            requestedBy: '🎧 DJ Towa'
          };
          
          setQueue(prev => {
            const updated = [...prev, newSong];
            setCurrentSongIndex(updated.length - 1);
            setIsPlaying(true);
            return updated;
          });
          
          setTimeout(() => {
            setDjNotification(null);
          }, 8000);
          return;
        }
      }
      
      // Fallback if no recommendation or results
      console.warn("[DJ Mode] No se pudieron obtener resultados idóneos de DJ Towa. Volviendo al inicio.");
      setDjNotification("⚠️ DJ Towa no encontró resultados idóneos. Reiniciando lista.");
      setCurrentSongIndex(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("[DJ Mode] Error:", err);
      setDjNotification("⚠️ Error de conexión con DJ Towa. Reiniciando lista.");
      setCurrentSongIndex(0);
      setIsPlaying(true);
    } finally {
      setIsDjSearching(false);
    }
  };

  // Handle Song Ended Trigger
  const handleSongEnded = () => {
    const currentQueue = queueRef.current;
    const currentIndex = currentSongIndexRef.current;
    const currentSong = currentQueue[currentIndex];

    if (currentIndex < currentQueue.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      // We are at the end of the queue.
      if (djModeRef.current && currentSong) {
        fetchAndPlaySimilarSong(currentSong.title);
      } else if (continuousPlayRef.current && currentQueue.length > 0) {
        // Fallback: Wrap around back to the beginning of the radio queue
        setCurrentSongIndex(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  };

  // Setup/Initialize YouTube Iframe API Player
  const initPlayer = () => {
    const currentQueue = queueRef.current;
    const currentIndex = currentSongIndexRef.current;
    const currentSong = currentQueue[currentIndex];
    
    if (!currentSong) {
      console.log('[YoutubeRadio] No current song available, skipping player initialization.');
      return;
    }

    if (!window.YT || !window.YT.Player) {
      if (initRetryCountRef.current < 10) {
        initRetryCountRef.current += 1;
        console.log(`[YoutubeRadio] YouTube Iframe API not ready, deferring player initialization (attempt ${initRetryCountRef.current})...`);
        setTimeout(() => initPlayer(), 1000);
      } else {
        console.warn('[YoutubeRadio] YouTube Iframe API failed to load after 10 attempts.');
      }
      return;
    }
    initRetryCountRef.current = 0;

    try {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }

      if (!playerContainerRef.current) return;
      // Completely clear previous DOM inside parent to prevent React reconciliation crashes
      playerContainerRef.current.innerHTML = '';
      
      const placeholder = document.createElement('div');
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      playerContainerRef.current.appendChild(placeholder);

      // Create player object using a direct element node instead of a string ID callback to avoid DOM collisions
      playerRef.current = new window.YT.Player(placeholder, {
        height: '100%',
        width: '100%',
        videoId: currentSong.videoId,
        playerVars: {
          autoplay: isPlayingRef.current ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (evt: any) => {
            try {
              evt.target.setVolume(volumeRef.current);
              if (isPlayingRef.current) {
                evt.target.playVideo();
              }
            } catch (e) {
              console.warn('[YoutubeRadio] Player onReady warning:', e);
            }
          },
          onStateChange: (evt: any) => {
            try {
              // YT.PlayerState.PLAYING is 1
              if (evt.data === 1) {
                setIsPlaying(true);
              }
              // YT.PlayerState.PAUSED is 2
              if (evt.data === 2) {
                setIsPlaying(false);
              }
              // YT.PlayerState.ENDED is 0
              if (evt.data === 0) {
                handleSongEnded();
              }
            } catch (e) {
              console.warn('[YoutubeRadio] Player onStateChange warning:', e);
            }
          },
          onError: (evt: any) => {
            console.warn(`[YoutubeRadio] YouTube Player Error (${evt.data}) on song: "${currentSong?.title}"`);
            // Automatically skip the video in 2.5 seconds to keep the radio continuously playing!
            setTimeout(() => {
              if (continuousPlayRef.current) {
                console.log('[YoutubeRadio] Auto-skipping dead or blocked video...');
                handleSkipNext();
              }
            }, 2500);
          }
        }
      });
    } catch (e) {
      console.warn('YouTube API player fail init:', e);
    }
  };

  // Load YouTube script on mount
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      initPlayer();
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
    };
  }, []);

  // Sync state machine when selected index or video id updates
  useEffect(() => {
    const currentSong = queue[currentSongIndex];
    if (currentSong) {
      setElapsedSeconds(0);
      setTrackDuration(parseDurationToSeconds(currentSong.duration));
    }
    // Recreate the player to prevent stale loadVideoById crashes or cross-origin autoplay restrictions
    initPlayer();
  }, [currentSongIndex, activeSong?.videoId]);

  // High frame-rate direct timer synchronization from the YouTube player APIs
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const currentSec = Math.floor(playerRef.current.getCurrentTime());
            const totalDurationSec = Math.floor(playerRef.current.getDuration());
            
            setElapsedSeconds(currentSec || 0);
            if (totalDurationSec && totalDurationSec > 0) {
              setTrackDuration(totalDurationSec);
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  // Equalizer loop simulation when playing
  useEffect(() => {
    let eqTimer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      eqTimer = setInterval(() => {
        setEqHeights(Array.from({ length: 14 }, () => Math.floor(Math.random() * 32) + 4));
      }, 120);
    } else {
      setEqHeights(Array.from({ length: 14 }, () => 4));
    }
    return () => {
      if (eqTimer) clearInterval(eqTimer);
    };
  }, [isPlaying]);

  // React to volume changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
      } catch (err) {
        console.warn('Failed setting YT volume:', err);
      }
    }
  }, [volume]);

  // Controller Functions
  const handlePlay = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        playerRef.current.playVideo();
        setIsPlaying(true);
      } catch (e) {
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(true);
      initPlayer();
    }
  };

  const handlePause = () => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } catch (e) {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const handleSkipNext = () => {
    const currentQueue = queueRef.current;
    const currentIndex = currentSongIndexRef.current;
    const currentActive = currentQueue[currentIndex];

    if (currentQueue.length === 0) return;
    if (currentIndex < currentQueue.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      if (djModeRef.current && currentActive) {
        fetchAndPlaySimilarSong(currentActive.title);
      } else {
        setCurrentSongIndex(0);
        setIsPlaying(true);
      }
    }
  };

  const handleRemoveSong = (id: string, idx: number) => {
    if (queue.length <= 1) {
      console.warn('Debe haber al menos una canción en la radio streamer.');
      return;
    }
    const filtered = queue.filter(item => item.id !== id);
    setQueue(filtered);

    if (idx === currentSongIndex) {
      setCurrentSongIndex(0);
    } else if (idx < currentSongIndex) {
      setCurrentSongIndex(prev => Math.max(0, prev - 1));
    }
  };

  const handleClearQueue = () => {
    const liveItem = queue[currentSongIndex];
    if (liveItem) {
      setQueue([{ ...liveItem, id: 'kept-' + Date.now() }]);
      setCurrentSongIndex(0);
    }
  };

  const syncAddSongQuery = async (query: string, requester: string, silent = false) => {
    try {
      const resp = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
      const results = await resp.json();
      if (results && results.length > 0) {
        const topResult = results[0];
        const newSong: YoutubeSong = {
          id: `cmd-${Date.now()}-${Math.random()}`,
          videoId: topResult.videoId,
          title: topResult.title,
          thumbnail: topResult.thumbnail,
          duration: topResult.duration,
          channel: topResult.channel,
          requestedBy: requester
        };

        const active = queue[currentSongIndex];
        const isDefaultSystemBeat = !active || (
          active.id === 'initial-1' || 
          active.id === 'initial-2' || 
          active.requestedBy === 'Sistema' || 
          active.requestedBy === 'Moderador'
        );

        const nextQueue = [...queue, newSong];
        setQueue(nextQueue);

        // Force instant skip and playback for !play requests if player was idle or playing initial placeholders
        if (!isPlaying || isDefaultSystemBeat) {
          setCurrentSongIndex(nextQueue.length - 1);
          setIsPlaying(true);
        }

        // Log to console rather than calling a screen-blocking alert popup
        console.log(`🎵 [Música] ${requester} pidió: "${topResult.title}"`);
      } else {
        console.warn(`No results found for YouTube search query: "${query}"`);
      }
    } catch (err) {
      console.error('[YoutubeRadio] Failed searching from command trigger', err);
    }
  };

  // External commands listener for !play <cancion> and !skip
  useEffect(() => {
    if (playCommandTrigger) {
      if (playCommandTrigger.timestamp) {
        if (lastCommandTimestampRef.current === playCommandTrigger.timestamp) {
          return; // Already executed this command before! Helps ignore unrelated re-renders
        }
        lastCommandTimestampRef.current = playCommandTrigger.timestamp;
      }

      const { command, query, user, isModerator, isSuperFan } = playCommandTrigger;
      
      // Verify if sender has necessary permissions to trigger music actions
      let isAllowed = false;
      if (musicPermission === 'todos') {
        isAllowed = true;
      } else if (musicPermission === 'moderadores') {
        isAllowed = isModerator;
      } else if (musicPermission === 'superfans') {
        isAllowed = isSuperFan;
      } else if (musicPermission === 'nadie') {
        isAllowed = false;
      }

      if (!isAllowed) {
        console.warn(`[YoutubeRadio] Command skipped - User ${user} does not have required permissions: ${musicPermission}`);
        return;
      }

      if (command === 'play') {
        if (query && query.trim()) {
          syncAddSongQuery(query, user, true);
        }
      } else if (command === 'skip') {
        if (allowSkipCommand) {
          handleSkipNext();
          console.log(`🎵 [Música] ${user} ejecutó !skip para saltar la canción`);
        } else {
          console.warn(`[YoutubeRadio] Command skipped - !skip is disabled`);
        }
      }
    }
  }, [playCommandTrigger, musicPermission, allowSkipCommand]);

  // Search manual utility
  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const resp = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchQuery)}`);
      const data = await resp.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const triggerAddManualSong = (item: any) => {
    const newSong: YoutubeSong = {
      id: `manual-${Date.now()}-${Math.random()}`,
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
      channel: item.channel,
      requestedBy: 'Tú (Streamer)'
    };
    setQueue(prev => [...prev, newSong]);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <section id="youtube-radio-reproducer" className="bg-[#0c0c10]/95 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full shadow-[0_0_40px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all duration-300">
      
      {/* Header Premium - Glowing Cyberpunk theme */}
      <div className="bg-gradient-to-r from-pink-600/15 via-purple-600/10 to-cyan-500/15 p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`p-2 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center ${isPlaying ? 'shadow-[0_0_15px_rgba(0,242,234,0.3)]' : ''}`}>
              <Radio className={`w-5 h-5 text-[#00f2ea] ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none">
                Estación de Radio Streamer
              </h3>
              <span className="bg-pink-500/20 text-pink-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-pink-500/30 uppercase tracking-wide font-mono animate-pulse">
                !play [canción]
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">La comunidad puede pedir canciones directamente desde el chat</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botón de DJ Towa */}
          <button
            onClick={() => setDjMode(!djMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 tracking-tight flex items-center gap-1.5 cursor-pointer border ${
              djMode 
                ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/40 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.3)] hover:brightness-110' 
                : 'bg-black/40 border border-white/10 text-gray-500 hover:text-white hover:bg-black/60'
            }`}
            title="Modo DJ Towa: Recomienda y reproduce automáticamente canciones similares cuando se acaba la cola!"
          >
            <Sparkles className={`w-3.5 h-3.5 ${djMode ? 'animate-pulse text-pink-500' : ''}`} />
            <span>{djMode ? '🎧 DJ Towa ON' : '🎧 DJ Towa OFF'}</span>
          </button>

          {/* Live Continuous radio switch indicator */}
          <button
            onClick={() => setContinuousPlay(!continuousPlay)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 tracking-tight flex items-center gap-1.5 cursor-pointer border ${
              continuousPlay 
                ? 'bg-[#00f2ea]/20 border-[#00f2ea]/40 text-[#00f2ea] shadow-[0_0_12px_rgba(0,242,234,0.15)] hover:bg-[#00f2ea]/30' 
                : 'bg-black/40 border border-white/10 text-gray-500 hover:text-white hover:bg-black/60'
            }`}
            title="Toggles whether next queue song loads sequentially when current one concludes"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${continuousPlay ? 'bg-[#00f2ea] animate-pulse' : 'bg-gray-500'}`} />
            {continuousPlay ? 'Autoplay On' : 'Autoplay Off'}
          </button>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="bg-[#0b0b10] border-b border-white/10 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-gray-400 font-mono font-bold uppercase tracking-wider text-[10px]">¿Quiénes pueden usar comandos?</span>
            <div className="flex gap-1 mt-1 sm:mt-0">
              {(['todos', 'moderadores', 'superfans', 'nadie'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setMusicPermission(opt);
                    localStorage.setItem('tiktok_radio_permission', opt);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    musicPermission === opt
                      ? 'bg-pink-500/15 border-pink-500/50 text-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.15)] font-black'
                      : 'bg-black/40 border-white/5 text-gray-400 hover:text-white hover:bg-black/60'
                  }`}
                >
                  {opt === 'todos' ? '👥 Todos' : opt === 'moderadores' ? '🛡️ Mods' : opt === 'superfans' ? '👑 Super Fan' : '🚫 Nadie'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowSkipCommand}
              onChange={(e) => {
                const val = e.target.checked;
                setAllowSkipCommand(val);
                localStorage.setItem('tiktok_radio_allow_skip', JSON.stringify(val));
              }}
              className="accent-[#00f2ea] rounded bg-black/50 border-white/10 w-3.5 h-3.5 focus:ring-0 cursor-pointer"
            />
            <span className="text-gray-300 font-mono font-bold text-[10px] uppercase tracking-wider">Permitir !skip en chat</span>
          </label>
        </div>
      </div>

      {/* Embedded YouTube IFrame ready target container with custom styling overlays */}
      <div className="bg-black relative aspect-video w-full flex items-center justify-center overflow-hidden border-b border-white/10 group">
        
        {/* DJ Notification Banner Overlay */}
        {(djNotification || isDjSearching) && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-purple-950/85 border border-purple-500/40 text-purple-200 px-3.5 py-2.5 rounded-xl backdrop-blur-md flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(168,85,247,0.25)] animate-pulse">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
              <span className="font-semibold">{djNotification || "💿 DJ Towa buscando un temazo..."}</span>
            </div>
            {isDjSearching && (
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping inline-block shrink-0" />
            )}
          </div>
        )}

        {/* Aspect Frame Wrapper */}
        <div className="absolute inset-0 w-full h-full bg-slate-950">
          <div ref={playerContainerRef} className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Floating Neon Equalizer Graphic Overlay */}
        {activeSong && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex items-end justify-between z-10 select-none bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 rounded-xl border border-white/5 backdrop-blur-xs opacity-85 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <Headphones className={`w-4 h-4 text-[#00f2ea] ${isPlaying ? 'animate-bounce' : ''}`} />
              <div className="text-[10px] font-mono whitespace-nowrap overflow-hidden">
                <span className="text-pink-400 font-bold block leading-none">REPRODUCIENDO</span>
                <span className="text-white/80 block max-w-[170px] truncate leading-none mt-1">{activeSong.title}</span>
              </div>
            </div>

            {/* Simulated Live Equalizer Waveform Lines */}
            <div className="flex items-end gap-0.8 h-8 px-2 shrink-0">
              {eqHeights.map((h, i) => (
                <span 
                  key={i} 
                  className="w-1 rounded-t bg-gradient-to-t from-pink-500 to-[#00f2ea] transition-all duration-150"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {!activeSong && (
          <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center gap-3 z-10 border border-white/5">
            <div className="p-4 rounded-full bg-white/5 border border-white/10">
              <Youtube className="w-8 h-8 text-gray-400 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase font-mono tracking-wider">Cola de Radio Vacía</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[280px]">Utiliza !play en el chat o agrega música manualmente abajo</p>
            </div>
          </div>
        )}
      </div>

      {/* Panel of State Controls & Currently Playing track data Card */}
      {activeSong && (
        <div className="bg-[#0e0e13] p-4 border-b border-white/10 flex flex-col gap-3.5">
          <div className="flex gap-3.5 items-start">
            <div className="relative shrink-0">
              <img 
                src={activeSong.thumbnail} 
                alt={activeSong.title} 
                className="w-14 h-14 rounded-xl object-cover border border-white/15" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 p-1 bg-black/90 rounded-full border border-white/20">
                <Disc className={`w-3.5 h-3.5 text-pink-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black bg-cyan-500/10 text-[#00f2ea] border border-cyan-500/20 px-1.5 py-0.5 rounded-md font-mono uppercase tracking-widest">
                  Live Stream Sound
                </span>
                <span className="text-[9px] font-mono bg-pink-500/15 text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded-md">
                  Petición: @{activeSong.requestedBy || 'Moderador'}
                </span>
              </div>
              
              <h4 className="text-sm text-white font-extrabold leading-tight tracking-tight mt-1.5 truncate" title={activeSong.title}>
                {activeSong.title}
              </h4>
              
              <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">{activeSong.channel}</p>
            </div>
          </div>

          {/* Luxury timeline tracking UI bar */}
          <div className="space-y-1.5 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
              <span className="text-[#00f2ea] font-bold">{formatSeconds(elapsedSeconds)}</span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                {activeSong.duration === 'LIVE' ? 'EN VIVO' : formatSeconds(trackDuration)}
              </span>
            </div>
            
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative cursor-pointer" title="Barra de reproducción">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-full absolute left-0 top-0 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(3,218,198,0.5)]"
                style={{ width: `${Math.min(100, (elapsedSeconds / Math.max(1, trackDuration)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Action Player Control Hub grid */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              {isPlaying ? (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/60 text-amber-400 font-black text-xs rounded-xl transition-all duration-200 flex items-center gap-1.5 uppercase font-mono shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                >
                  <Pause className="w-3.5 h-3.5" /> Pausa
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  className="px-4 py-2 bg-[#00f2ea]/20 hover:bg-[#00f2ea]/35 border border-[#00f2ea]/50 hover:border-[#00f2ea] text-[#00f2ea] font-black text-xs rounded-xl transition-all duration-200 flex items-center gap-1.5 uppercase font-mono shadow-[0_0_15px_rgba(0,242,234,0.1)]"
                >
                  <Play className="w-3.5 h-3.5" /> Reproducir
                </button>
              )}

              <button
                onClick={handleSkipNext}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/50 text-white hover:text-pink-400 font-black text-xs rounded-xl transition-all duration-200 flex items-center gap-1.5 uppercase font-mono"
                title="Siguiente canción de la lista"
              >
                <SkipForward className="w-3.5 h-3.5" /> Saltar
              </button>
            </div>

            {/* Quick volume dashboard dial slider */}
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 max-w-[150px] flex-1">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              <input 
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="flex-1 accent-[#00f2ea] h-1 rounded bg-gray-800 cursor-pointer"
                title="Ajustar Volumen"
              />
              <span className="text-[10px] font-mono font-bold text-gray-300 w-6 text-right shrink-0">
                {volume}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Invidious Search Console widget */}
      <div className="p-4 bg-[#09090c] border-b border-white/10 flex flex-col gap-2.5">
        <label className="text-xs text-gray-400 uppercase font-black tracking-wider font-mono flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#00f2ea]" />
          Consola de Búsqueda Manual
        </label>
        
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Buscar artista, canción o género en YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              className="w-full bg-black/60 border border-white/15 focus:border-[#00f2ea] rounded-xl pl-3 pr-10 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00f2ea]/20 placeholder-gray-500 transition-all duration-250 font-sans"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-550 hover:text-white text-xs font-mono font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          
          <button
            onClick={handleManualSearch}
            disabled={isSearching}
            className="bg-gradient-to-r from-[#00f2ea] to-cyan-500 hover:brightness-110 text-black font-extrabold px-4 rounded-xl text-xs shrink-0 transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_15px_rgba(0,242,234,0.2)] disabled:opacity-50"
          >
            {isSearching ? (
              <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>Buscar</span>
          </button>
        </div>

        {/* Searching results premium floating container */}
        {searchResults.length > 0 && (
          <div className="bg-black/95 border border-white/10 rounded-xl p-2 mt-1 space-y-1.5 max-h-[175px] overflow-y-auto z-20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex items-center justify-between px-1.5 pb-1 border-b border-white/5 mb-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase font-mono">Resultados encontrados</span>
              <button 
                onClick={() => setSearchResults([])}
                className="text-[9.5px] text-pink-400 hover:text-white uppercase font-mono font-bold"
              >
                Cerrar ✕
              </button>
            </div>
            {searchResults.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between gap-3 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex gap-2 items-center min-w-0 flex-1">
                  <img src={item.thumbnail} className="w-9 h-9 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[11.5px] text-white font-bold truncate leading-tight">{item.title}</p>
                    <p className="text-[9.5px] text-gray-400 truncate leading-none mt-1 font-mono">{item.duration} • {item.channel}</p>
                  </div>
                </div>
                <button
                  onClick={() => triggerAddManualSong(item)}
                  className="bg-[#00f2ea]/20 hover:bg-[#00f2ea] text-[#00f2ea] hover:text-black border border-[#00f2ea]/30 px-3 py-1 rounded-lg text-[10.5px] font-extrabold uppercase transition-all duration-150 shrink-0 font-mono"
                >
                  + Añadir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Styled Song Queue List */}
      <div ref={queueContainerRef} className="flex-1 overflow-y-auto max-h-[220px] p-4 space-y-2 bg-[#08080b] scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-1.5 font-mono">
            <ListMusic className="w-4 h-4 text-pink-500" />
            Cola de reproducción ({queue.length})
          </span>
          {queue.length > 1 && (
            <button
              onClick={handleClearQueue}
              className="text-[10px] text-gray-500 hover:text-pink-500 font-bold transition-colors uppercase font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
            >
              ✕ Vaciar Cola
            </button>
          )}
        </div>

        <div className="space-y-2">
          {queue.map((song, idx) => {
            const isActive = idx === currentSongIndex;
            return (
              <div
                key={song.id}
                className={`p-2.5 rounded-xl border transition-all text-left flex items-center justify-between gap-3 ${
                  isActive 
                    ? 'bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-[#00f2ea]/10 border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.05)]' 
                    : 'bg-black/35 hover:bg-black/55 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail / Indicator */}
                  <div 
                    className="relative w-10 h-10 rounded-lg border border-white/10 overflow-hidden shrink-0 cursor-pointer group-list-thumb"
                    onClick={() => {
                      setCurrentSongIndex(idx);
                      setIsPlaying(true);
                    }}
                    title="Reproducir esta canción de inmediato"
                  >
                    <img src={song.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {isActive ? (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Sparkle className="w-4 h-4 text-[#00f2ea] animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Song Title Content Info */}
                  <div className="min-w-0 flex-1">
                    <p 
                      onClick={() => {
                        setCurrentSongIndex(idx);
                        setIsPlaying(true);
                      }}
                      className={`text-xs font-bold truncate leading-tight cursor-pointer transition-colors ${
                        isActive ? 'text-[#00f2ea]' : 'text-gray-200 hover:text-white'
                      }`}
                    >
                      {idx + 1}. {song.title}
                    </p>
                    
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 leading-normal">
                      <span className="font-mono text-[9px] bg-black/40 px-1.5 py-0.2 rounded text-pink-400 font-bold shrink-0">
                        @{song.requestedBy || 'Anónimo'}
                      </span>
                      <span className="truncate max-w-[140px] font-sans text-[10px] text-gray-500">{song.channel}</span>
                      <span className="text-[9.5px] font-mono text-gray-500 ml-auto bg-black/20 px-1 rounded">{song.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Queue Options buttons */}
                <div className="flex items-center shrink-0">
                  <button
                    onClick={() => handleRemoveSong(song.id, idx)}
                    className="text-gray-500 hover:text-pink-500 bg-white/0 hover:bg-pink-500/15 p-1.5 rounded-lg transition-all"
                    title="Eliminar de la lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}
