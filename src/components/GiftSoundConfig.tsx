import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { GiftSoundMapping, PresetSound, SuperFan } from '../types';
import { Volume2, Music, AlertCircle, Plus, Play, Sparkles, Sliders, Trash2, HelpCircle, Search, Pause, Square, X, Volume1 } from 'lucide-react';
import { MEME_SOUNDS, MemeSound } from '../data/memeSounds';
import { GIFT_CATALOG } from '../data/gifts';
import { doc, setDoc, collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db, isQuotaExceededError } from '../utils/firebase';
import { playSoundFromUrl } from '../utils/audio';


interface GiftSoundConfigProps {
  mappings: GiftSoundMapping[];
  presetSounds: PresetSound[];
  onUpdateMapping: (updated: GiftSoundMapping[]) => void;
  discoveredGifts: Array<{ giftName: string; giftPictureUrl: string; diamondCount: number }>;
  onTriggerTestEvent: (giftName: string, iconUrl?: string) => void;
  superFans?: SuperFan[];
}

export default function GiftSoundConfig({
  mappings,
  presetSounds,
  onUpdateMapping,
  discoveredGifts,
  onTriggerTestEvent,
  superFans = [],
}: GiftSoundConfigProps) {
  const [newGiftName, setNewGiftName] = useState('');
  const [newSoundId, setNewSoundId] = useState('coin');
  const [newVolume, setNewVolume] = useState(0.8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'mappings' | 'discovered' | 'catalog'>('mappings');
  const [soundboardExpanded, setSoundboardExpanded] = useState(true);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{name: string; url: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingSoundForGift, setSearchingSoundForGift] = useState<string | null>(null);
  const [selectedMemeCategory, setSelectedMemeCategory] = useState<'Todos' | 'Nube' | 'Popular' | 'Graciosos' | 'Voces' | 'Videojuegos' | 'Efectos'>('Todos');
  const [cloudCustomSounds, setCloudCustomSounds] = useState<Array<{ id: string; filename: string; url: string }>>([]);

  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);
  const showStatus = (text: string, type: 'success' | 'warning' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  const loadCloudCustomSounds = async () => {
    try {
      const q = query(collection(db, 'custom_sounds'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const list: Array<{ id: string; filename: string; url: string }> = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          filename: data.filename || 'Sonido sin nombre',
          url: `firestore://custom_sounds/${docSnap.id}`
        });
      });
      setCloudCustomSounds(list);
    } catch (e) {
      isQuotaExceededError(e);
      console.warn('[GiftSoundConfig] Reintentando carga de sonidos de la nube sin ordenamiento...', e);
      try {
        const querySnapshot = await getDocs(collection(db, 'custom_sounds'));
        const list: Array<{ id: string; filename: string; url: string }> = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            filename: data.filename || 'Sonido sin nombre',
            url: `firestore://custom_sounds/${docSnap.id}`
          });
        });
        setCloudCustomSounds(list);
      } catch (err) {
        isQuotaExceededError(err);
        console.error('[GiftSoundConfig] Error total listando sonidos de la nube:', err);
      }
    }
  };

  const handleDeleteCloudSound = async (soundId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este sonido permanentemente de la nube?')) return;
    try {
      showStatus('Eliminando sonido de la nube...', 'success');
      await deleteDoc(doc(db, 'custom_sounds', soundId));
      setCloudCustomSounds(prev => prev.filter(s => s.id !== soundId));
      showStatus('¡Sonido eliminado de la nube con éxito!', 'success');
    } catch (e) {
      isQuotaExceededError(e);
      console.error('[GiftSoundConfig] Fallo de Firestore al eliminar de la nube:', e);
      showStatus('Error al eliminar de la nube.', 'warning');
    }
  };

  const getCustomSoundFilename = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('firestore://custom_sounds/')) {
      const id = url.replace('firestore://custom_sounds/', '');
      const found = cloudCustomSounds.find(s => s.id === id);
      if (found) return found.filename;
      return `Nube (${id.substring(0, 6)}...)`;
    }
    if (url.startsWith('data:')) {
      return 'Archivo propio subido';
    }
    try {
      const decoded = decodeURIComponent(url);
      const lastSegment = decoded.split('/').pop()?.split('?')[0] || '';
      if (lastSegment && lastSegment.endsWith('.mp3')) {
        return lastSegment;
      }
    } catch (e) {}
    return 'Enlace Web';
  };

  useEffect(() => {
    loadCloudCustomSounds();
  }, []);

  // Professional Interactive Audio Preview Player States
  interface PreviewState {
    name: string;
    url: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    audioElement: HTMLAudioElement;
  }
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  // Auto clean up playing preview on unmount
  useEffect(() => {
    return () => {
      if (previewState) {
        try {
          previewState.audioElement.pause();
          previewState.audioElement.src = '';
        } catch (e) {}
      }
    };
  }, []);

  const handlePlayPreview = async (name: string, url: string) => {
    if (previewState) {
      try {
        previewState.audioElement.pause();
        previewState.audioElement.src = '';
      } catch (e) {}
    }

    try {
      const audio = await playSoundFromUrl(url, 0.8);

      const onTimeUpdate = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== audio) return prev;
          return { ...prev, currentTime: audio.currentTime };
        });
      };

      const onDurationChange = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== audio) return prev;
          return { ...prev, duration: audio.duration || 0 };
        });
      };

      const onPlayState = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== audio) return prev;
          return { ...prev, isPlaying: true };
        });
      };

      const onPauseState = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== audio) return prev;
          return { ...prev, isPlaying: false };
        });
      };

      const onEnded = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== audio) return prev;
          return { ...prev, isPlaying: false, currentTime: 0 };
        });
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('play', onPlayState);
      audio.addEventListener('pause', onPauseState);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('loadedmetadata', onDurationChange);

      await audio.play();

      setPreviewState({
        name,
        url,
        isPlaying: true,
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
        audioElement: audio
      });
    } catch (err) {
      console.warn('[PreviewPlayer] playSoundFromUrl failed, trying standard HTMLAudioElement:', err);
      const standardAudio = new Audio(url);
      standardAudio.volume = 0.8;

      const onTimeUpdate = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== standardAudio) return prev;
          return { ...prev, currentTime: standardAudio.currentTime };
        });
      };

      const onDurationChange = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== standardAudio) return prev;
          return { ...prev, duration: standardAudio.duration || 0 };
        });
      };

      const onPlayState = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== standardAudio) return prev;
          return { ...prev, isPlaying: true };
        });
      };

      const onPauseState = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== standardAudio) return prev;
          return { ...prev, isPlaying: false };
        });
      };

      const onEnded = () => {
        setPreviewState(prev => {
          if (!prev || prev.audioElement !== standardAudio) return prev;
          return { ...prev, isPlaying: false, currentTime: 0 };
        });
      };

      standardAudio.addEventListener('timeupdate', onTimeUpdate);
      standardAudio.addEventListener('durationchange', onDurationChange);
      standardAudio.addEventListener('play', onPlayState);
      standardAudio.addEventListener('pause', onPauseState);
      standardAudio.addEventListener('ended', onEnded);
      standardAudio.addEventListener('loadedmetadata', onDurationChange);

      try {
        await standardAudio.play();
      } catch (playErr) {
        console.warn('[PreviewPlayer] Play blocked by user gesture/CORS fallback:', playErr);
      }

      setPreviewState({
        name,
        url,
        isPlaying: true,
        currentTime: standardAudio.currentTime,
        duration: standardAudio.duration || 10,
        audioElement: standardAudio
      });
    }
  };

  const handleStopPreview = () => {
    if (previewState) {
      try {
        previewState.audioElement.pause();
        previewState.audioElement.src = '';
      } catch (e) {}
      setPreviewState(null);
    }
  };

  const handleTogglePreviewPlay = () => {
    if (!previewState) return;
    try {
      if (previewState.isPlaying) {
        previewState.audioElement.pause();
      } else {
        previewState.audioElement.play().catch(e => console.warn(e));
      }
    } catch (e) {}
  };

  const handleScrubPreview = (time: number) => {
    if (!previewState) return;
    try {
      previewState.audioElement.currentTime = time;
      setPreviewState(prev => prev ? { ...prev, currentTime: time } : null);
    } catch (e) {}
  };

  // Individual row search states for configuration tab
  const [expandedGiftSearch, setExpandedGiftSearch] = useState<string | null>(null);
  const [rowSearchTerm, setRowSearchTerm] = useState<{ [giftName: string]: string }>({});
  const [rowSearchResults, setRowSearchResults] = useState<{ [giftName: string]: { name: string; url: string }[] }>({});
  const [rowSearchingState, setRowSearchingState] = useState<{ [giftName: string]: boolean }>({});
  const searchTimers = useRef<{ [giftName: string]: NodeJS.Timeout }>({});

  const triggerRowSearch = (giftName: string, query: string) => {
    if (searchTimers.current[giftName]) {
      clearTimeout(searchTimers.current[giftName]);
    }

    if (!query.trim()) {
      setRowSearchResults(prev => ({ ...prev, [giftName]: [] }));
      return;
    }

    setRowSearchingState(prev => ({ ...prev, [giftName]: true }));

    searchTimers.current[giftName] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sounds/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setRowSearchResults(prev => ({ ...prev, [giftName]: data.map((s: any) => ({ ...s, url: s.url })) }));
      } catch (err) {
        console.error(err);
      } finally {
        setRowSearchingState(prev => ({ ...prev, [giftName]: false }));
      }
    }, 450);
  };

  const triggerRowSearchImmediate = async (giftName: string, query: string) => {
    if (searchTimers.current[giftName]) {
      clearTimeout(searchTimers.current[giftName]);
    }
    if (!query.trim()) {
      setRowSearchResults(prev => ({ ...prev, [giftName]: [] }));
      return;
    }
    setRowSearchingState(prev => ({ ...prev, [giftName]: true }));
    try {
      const res = await fetch(`/api/sounds/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setRowSearchResults(prev => ({ ...prev, [giftName]: data.map((s: any) => ({ ...s, url: s.url })) }));
    } catch (err) {
      console.error(err);
    } finally {
      setRowSearchingState(prev => ({ ...prev, [giftName]: false }));
    }
  };

  const triggerGlobalSearch = async (queryStr: string) => {
    if (!queryStr.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/sounds/search?q=${encodeURIComponent(queryStr)}`);
      const data = await res.json();
      setSearchResults(data.map((s: any) => ({ ...s, url: s.url })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Safely links a custom sound URL to an existing gift mapping in a single state batched update
  const handleLinkSoundToGift = (giftName: string, soundUrl: string) => {
    const updated = mappings.map(m => {
      if (m.giftName === giftName) {
        return { ...m, soundId: 'custom', customSoundUrl: soundUrl };
      }
      return m;
    });
    onUpdateMapping(updated);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/sounds/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.map((s: any) => ({ ...s, url: s.url })));
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Add custom mapping
  const handleAddMapping = () => {
    if (!newGiftName.trim()) return;
    const cleanName = newGiftName.trim();
    
    // Check if exists
    if (mappings.some(m => m.giftName.toLowerCase() === cleanName.toLowerCase())) {
      showStatus(`El regalo "${cleanName}" ya está configurado.`, 'warning');
      return;
    }

    let soundIdToUse = newSoundId;
    let customSoundUrlToUse: string | undefined = undefined;

    if (newSoundId.startsWith('cloud_')) {
      soundIdToUse = 'custom';
      const sId = newSoundId.replace('cloud_', '');
      const found = cloudCustomSounds.find(s => s.id === sId);
      if (found) {
        customSoundUrlToUse = found.url;
      }
    } else if (newSoundId === 'custom') {
      soundIdToUse = 'custom';
      customSoundUrlToUse = (window as any).tempUploadedSound;
    }

    const newMap: GiftSoundMapping = {
      giftName: cleanName,
      soundId: soundIdToUse,
      volume: newVolume,
      label: cleanName,
      customSoundUrl: customSoundUrlToUse,
    };

    onUpdateMapping([newMap, ...mappings]);
    setNewGiftName('');
    // Clear temp cache
    if ((window as any).tempUploadedSound) {
      delete (window as any).tempUploadedSound;
    }
  };

  // Delete mapping
  const handleDeleteMapping = (giftName: string) => {
    onUpdateMapping(mappings.filter(m => m.giftName !== giftName));
  };

  // Modify sound / volume in mapping
  const handleChangeMappingProp = (giftName: string, key: keyof GiftSoundMapping, value: any) => {
    const updated = mappings.map(m => {
      if (m.giftName === giftName) {
        return { ...m, [key]: value };
      }
      return m;
    });
    onUpdateMapping(updated);
  };

  // Modify multiple attributes together to prevent state race condition overrides
  const handleChangeMappingProps = (giftName: string, props: Partial<GiftSoundMapping>) => {
    const updated = mappings.map(m => {
      if (m.giftName === giftName) {
        return { ...m, ...props };
      }
      return m;
    });
    onUpdateMapping(updated);
  };

  // Upload helper to persistent Firestore cloud database / server uploads directory
  const uploadAudioToServer = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // Guide user to smaller audios if needed. Firestore limit is 1MB, so we recommend under 800KB for safety
      if (file.size > 800 * 1024) {
        showStatus('El archivo es demasiado grande (>800KB). Sube un fragmento más corto para guardarlo en la nube.', 'warning');
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          showStatus('Guardando sonido en la nube...', 'success');
          
          // 1. Generate unique Firestore sound reference
          const soundId = `sound_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const docRef = doc(db, 'custom_sounds', soundId);
          
          // Save actual binary data URL inside the Firestore document
          await setDoc(docRef, {
            filename: file.name,
            base64Data,
            createdAt: Date.now()
          });

          // 2. Parallel upload to local fast proxy server backup just in case
          fetch('/api/upload-sound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, base64Data })
          })
            .then(res => res.json())
            .then(data => console.log('[AudioUpload] Secondary proxy upload finished:', data))
            .catch(err => console.warn('[AudioUpload] Secondary proxy upload warning:', err));

          showStatus('¡Sonido guardado permanentemente en la nube!', 'success');
          
          // Reload cloud custom sound list so it populates immediately!
          loadCloudCustomSounds();

          // Return the Firestore reference URI
          resolve(`firestore://custom_sounds/${soundId}`);
        } catch (err) {
          isQuotaExceededError(err);
          console.error('[AudioUpload] Firestore save failed, resorting to fast secondary server:', err);
          showStatus('Error con la nube de Google. Usando servidor secundario...', 'warning');
          
          try {
            const response = await fetch('/api/upload-sound', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, base64Data })
            });
            const data = await response.json();
            if (data.success && data.url) {
              resolve(data.url);
            } else {
              resolve(base64Data);
            }
          } catch (e) {
            resolve(base64Data);
          }
        }
      };
      reader.onerror = () => {
        showStatus('Error leyendo el archivo.', 'warning');
        resolve('');
      };
      reader.readAsDataURL(file);
    });
  };

  // Custom audio file upload
  const handleCustomAudioUpload = async (e: ChangeEvent<HTMLInputElement>, giftName?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showStatus('El archivo de sonido debe ser menor a 5MB.', 'warning');
      return;
    }

    const uploadedUrl = await uploadAudioToServer(file);
    if (uploadedUrl) {
      if (giftName) {
        handleChangeMappingProps(giftName, { soundId: 'custom', customSoundUrl: uploadedUrl });
      } else {
        setNewSoundId('custom');
        (window as any).tempUploadedSound = uploadedUrl;
        showStatus('Sonido personalizado subido con éxito. Agrégalo en la configuración superior.', 'success');
      }
    }
  };

  // Quick import from catalog list or discovered list
  const handleImportGift = (gift: { giftName: string; giftPictureUrl: string; diamondCount?: number }) => {
    if (mappings.some(m => m.giftName.toLowerCase() === gift.giftName.toLowerCase())) {
      handleChangeMappingProp(gift.giftName, 'iconUrl', gift.giftPictureUrl);
      setActiveTab('mappings');
      return;
    }

    const newMap: GiftSoundMapping = {
      giftName: gift.giftName,
      soundId: 'magic',
      volume: 0.8,
      label: gift.giftName,
      iconUrl: gift.giftPictureUrl
    };

    onUpdateMapping([newMap, ...mappings]);
    setActiveTab('mappings');
  };

// Standard catalog removed as requested.


  return (
    <div id="gift-config-panel" className="bg-[#16161D] border border-white/10 rounded-lg overflow-hidden flex flex-col h-full shadow-lg">
      {/* Panel Headers */}
      <div className="bg-black/30 p-4 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[#00f2ea]/15 text-[#00f2ea]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-sans text-sm font-bold text-white uppercase tracking-tight">
              Efectos <span className="text-[#00f2ea]">Regalos</span>
            </h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Configurar disparadores de audio</p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex bg-black/40 p-1 rounded border border-white/10 self-start sm:self-center">
          <button
            id="tab-btn-mappings"
            onClick={() => setActiveTab('mappings')}
            className={`px-2.5 py-1 text-[9.5px] font-bold rounded uppercase tracking-wider transition-all ${
              activeTab === 'mappings'
                ? 'bg-[#00f2ea] text-black shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Configuración
          </button>
          <button
            id="tab-btn-catalog"
            onClick={() => setActiveTab('catalog')}
            className={`px-2.5 py-1 text-[9.5px] font-bold rounded uppercase tracking-wider transition-all flex items-center gap-1 ${
              activeTab === 'catalog'
                ? 'bg-[#00f2ea] text-black shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Catálogo Regalos (500+)
          </button>
          <button
            id="tab-btn-discovered"
            onClick={() => setActiveTab('discovered')}
            className={`px-2.5 py-1 text-[9.5px] font-bold rounded uppercase tracking-wider transition-all flex items-center gap-1 ${
              activeTab === 'discovered'
                ? 'bg-[#00f2ea] text-black shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Detectados
            {discoveredGifts.length > 0 && (
              <span className="bg-[#ff0050] text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">
                {discoveredGifts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`mx-4 mt-2 px-3 py-2 text-xs font-semibold rounded flex items-center gap-2 border animate-fade-in ${
          statusMsg.type === 'warning'
            ? 'bg-amber-950/80 border-amber-500/30 text-amber-300'
            : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 leading-normal">{statusMsg.text}</span>
          <button 
            onClick={() => setStatusMsg(null)}
            className="text-gray-400 hover:text-white shrink-0 font-sans text-[10px] pr-1"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'mappings' && (
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 bg-[#121218]/40">
          {/* Create custom input bar */}
          <div className="bg-black/35 p-3 rounded border border-white/10 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
              <span>Agregar Regalo Manual</span>
              <span className="text-[10px] text-gray-600 font-normal">P. ej: "Rose", "TikTok"</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                id="input-new-gift-name"
                type="text"
                placeholder="Nombre del regalo..."
                value={newGiftName}
                onChange={(e) => setNewGiftName(e.target.value)}
                className="bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00f2ea]/50 transition-all font-mono"
              />
              
              <div className="flex gap-1">
                <select
                  id="select-new-gift-sound"
                  value={newSoundId}
                  onChange={(e) => setNewSoundId(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 transition-all flex-1 font-sans"
                >
                  {presetSounds.map(sound => (
                    <option key={sound.id} value={sound.id}>
                      🎵 Synthesizer - {sound.name}
                    </option>
                  ))}
                  <option value="custom">📁 Cargar nuevo archivo propio...</option>
                  {cloudCustomSounds.length > 0 && (
                    <optgroup label="☁️ Base de Datos de Sonidos Nube">
                      {cloudCustomSounds.map(sound => (
                        <option key={sound.id} value={`cloud_${sound.id}`}>
                          ☁️ {sound.filename}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {newSoundId === 'custom' && (
                  <button
                    id="btn-upload-trigger"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="p-1 px-2.5 bg-[#ff0050]/15 border border-[#ff0050]/30 hover:border-[#ff0050]/65 text-[#ff0050] rounded text-xs font-bold transition-all uppercase tracking-wider"
                    title="Upload Custom MP3"
                  >
                    Cargar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-add-gift-map"
                  onClick={handleAddMapping}
                  className="w-full bg-[#00f2ea] hover:bg-[#00f2ea]/90 text-black rounded py-1.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1 uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  Vincular Sonido
                </button>
              </div>
            </div>

            {/* Hidden Input field for files */}
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              onChange={(e) => handleCustomAudioUpload(e)}
              className="hidden"
            />
          </div>

          {/* List of current mappings */}
          <div className="flex-1 space-y-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Vínculos de Alerta Activos ({mappings.length})</h3>
            
            {mappings.length === 0 ? (
              <div className="text-center py-10 bg-black/20 rounded border border-dashed border-white/10">
                <Music className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">No hay alertas personalizadas</p>
                <p className="text-[10px] text-gray-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Configura un regalo arriba, añade desde el Catálogo Estándar 🛍️ o espera a que se detecten regalos en vivo.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {mappings.map((mapping) => {
                  const isExpanded = expandedGiftSearch === mapping.giftName;
                  return (
                    <div
                      key={mapping.giftName}
                      className="bg-black/20 border border-white/5 hover:border-white/10 rounded overflow-hidden transition-all flex flex-col"
                    >
                      {/* Main config row */}
                      <div className="p-2.5 flex flex-col gap-3 sm:flex-row sm:items-center justify-between transition-all">
                        {/* Left details: image & giftName */}
                        <div className="flex items-center gap-2.5">
                          <div 
                            onClick={() => {
                              const fileInput = document.createElement('input');
                              fileInput.type = 'file';
                              fileInput.accept = 'image/*';
                              fileInput.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                  showStatus('La imagen de regalo debe ser menor a 2MB.', 'warning');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  if (result) {
                                    handleChangeMappingProp(mapping.giftName, 'iconUrl', result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              };
                              fileInput.click();
                            }}
                            className="relative w-8 h-8 rounded bg-black/40 border border-[#00f2ea]/30 hover:border-[#00f2ea] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group transition-all"
                            title="Haz clic para subir una imagen personalizada"
                          >
                            {mapping.iconUrl ? (
                              <img
                                src={mapping.iconUrl.startsWith('data:') ? mapping.iconUrl : `/api/proxy-image?url=${encodeURIComponent(mapping.iconUrl)}`}
                                alt={mapping.giftName}
                                className="w-7 h-7 object-contain animate-fade-in group-hover:scale-110 transition-transform"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="text-pink-500 p-1.5 group-hover:text-pink-400">
                                <Plus className="w-4 h-4 animate-pulse" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Plus className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="font-sans text-xs font-semibold text-white">
                              {mapping.giftName}
                            </div>
                            <div className="text-[10px] text-[#ff0050] font-mono font-bold flex items-center gap-1 uppercase tracking-tighter">
                              <Volume2 className="w-3 h-3 text-[#ff0050]" />
                              Vol: {Math.round(mapping.volume * 100)}%
                            </div>
                          </div>
                        </div>

                        {/* Right controls: options inside single row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Sound Selector dropdown */}
                          {(() => {
                            let selectValue = mapping.soundId;
                            if (mapping.soundId === 'custom' && mapping.customSoundUrl) {
                              if (mapping.customSoundUrl.startsWith('firestore://custom_sounds/')) {
                                selectValue = `cloud_${mapping.customSoundUrl.replace('firestore://custom_sounds/', '')}`;
                              } else {
                                selectValue = 'custom';
                              }
                            }
                            return (
                              <select
                                value={selectValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.startsWith('cloud_')) {
                                    const soundIdHex = val.replace('cloud_', '');
                                    const found = cloudCustomSounds.find(s => s.id === soundIdHex);
                                    if (found) {
                                      handleChangeMappingProps(mapping.giftName, {
                                        soundId: 'custom',
                                        customSoundUrl: found.url
                                      });
                                    }
                                  } else {
                                    handleChangeMappingProp(mapping.giftName, 'soundId', val);
                                    if (val === 'custom') {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'audio/*';
                                      input.onchange = (evt) => {
                                        const f = (evt.target as HTMLInputElement).files?.[0];
                                        if (f) {
                                          uploadAudioToServer(f).then(uploadedUrl => {
                                            if (uploadedUrl) {
                                              handleChangeMappingProps(mapping.giftName, { soundId: 'custom', customSoundUrl: uploadedUrl });
                                            }
                                          });
                                        }
                                      };
                                      input.click();
                                    } else if (val === 'search') {
                                      setExpandedGiftSearch(mapping.giftName);
                                      const q = rowSearchTerm[mapping.giftName] || mapping.giftName;
                                      if (!rowSearchTerm[mapping.giftName]) {
                                        setRowSearchTerm(prev => ({ ...prev, [mapping.giftName]: q }));
                                      }
                                      triggerRowSearch(mapping.giftName, q);
                                    }
                                  }
                                }}
                                className="bg-black/60 border border-white/10 rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none font-sans max-w-[140px]"
                              >
                                {presetSounds.map(sound => (
                                  <option key={sound.id} value={sound.id}>
                                    🎵 {sound.name}
                                  </option>
                                ))}
                                <option value="custom">📁 Archivo propio</option>
                                {cloudCustomSounds.length > 0 && (
                                  <optgroup label="☁️ Base de Datos de Sonidos Nube">
                                    {cloudCustomSounds.map(sound => (
                                      <option key={sound.id} value={`cloud_${sound.id}`}>
                                        ☁️ {sound.filename}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <option value="search" className="text-[#00f2ea]">🔍 Buscar en Internet</option>
                              </select>
                            );
                          })()}

                          {/* Quick Internet Search button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedGiftSearch(null);
                              } else {
                                setExpandedGiftSearch(mapping.giftName);
                                const q = rowSearchTerm[mapping.giftName] || mapping.giftName;
                                if (!rowSearchTerm[mapping.giftName]) {
                                  setRowSearchTerm(prev => ({ ...prev, [mapping.giftName]: q }));
                                }
                                triggerRowSearch(mapping.giftName, q);
                              }
                            }}
                            className={`p-1 px-2 border rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 shrink-0 ${
                              isExpanded 
                                ? 'bg-[#00f2ea]/20 border-[#00f2ea] text-[#00f2ea]'
                                : 'bg-[#16161D] border-white/10 text-gray-400 hover:text-[#00f2ea] hover:border-[#00f2ea]'
                            }`}
                            title="Buscar un sonido de Internet para este regalo"
                          >
                            <Search className="w-3 h-3" />
                            Buscar
                          </button>

                          {/* Custom upload button if 'custom' is selected */}
                          {mapping.soundId === 'custom' && (
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'audio/*';
                                input.onchange = (evt) => {
                                  const f = (evt.target as HTMLInputElement).files?.[0];
                                  if (f) {
                                    uploadAudioToServer(f).then(uploadedUrl => {
                                      if (uploadedUrl) {
                                        handleChangeMappingProp(mapping.giftName, 'customSoundUrl', uploadedUrl);
                                      }
                                    });
                                  }
                                };
                                input.click();
                              }}
                              className={`p-1 px-2 rounded text-[9px] font-bold uppercase transition-all font-mono max-w-[120px] truncate ${
                                mapping.customSoundUrl 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-[#ff0050]/10 hover:bg-[#ff0050]/20 text-[#ff0050] border border-[#ff0050]/20 animate-pulse'
                              }`}
                              title={mapping.customSoundUrl ? `Sonido: ${getCustomSoundFilename(mapping.customSoundUrl)}` : "Subir archivo de sonido personalizado"}
                            >
                              {(() => {
                                const rawName = getCustomSoundFilename(mapping.customSoundUrl);
                                return mapping.customSoundUrl ? `✓ ${rawName.length > 15 ? rawName.substring(0, 12) + '...' : rawName}` : '⚠ Subir';
                              })()}
                            </button>
                          )}

                          {/* Volume Slider */}
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={mapping.volume}
                            onChange={(e) => handleChangeMappingProp(mapping.giftName, 'volume', parseFloat(e.target.value))}
                            className="w-14 sm:w-20 accent-[#ff0050] h-1 rounded bg-[#121218]"
                            title="Ajustar Volumen"
                          />

                          {/* Simulation Play Trigger button */}
                          <button
                            onClick={() => onTriggerTestEvent(mapping.giftName, mapping.customSoundUrl || mapping.iconUrl)}
                            className="p-1.5 rounded bg-[#16161D] border border-white/10 hover:border-[#00f2ea] text-gray-400 hover:text-[#00f2ea] transition-all"
                            title="Probar Alerta en Pantalla"
                          >
                            <Play className="w-3 h-3" />
                          </button>

                          {/* Delete cross */}
                          <button
                            onClick={() => handleDeleteMapping(mapping.giftName)}
                            className="p-1.5 rounded bg-transparent text-gray-500 hover:text-red-500 hover:bg-red-500/15 transition-all"
                            title="Eliminar Alerta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded inline MyInstants search panel */}
                      {isExpanded && (
                        <div className="bg-black/35 border-t border-white/5 p-3 flex flex-col gap-2.5 animate-fade-in text-left">
                          <div className="text-[10px] font-bold text-[#00f2ea] uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#00f2ea] animate-pulse" />
                              Buscar sonido para: <span className="underline select-all text-white font-mono">"{mapping.giftName}"</span>
                            </span>
                            <button
                              onClick={() => setExpandedGiftSearch(null)}
                              className="text-gray-500 hover:text-white uppercase font-mono text-[9px]"
                            >
                              ocultar ✕
                            </button>
                          </div>

                          <div className="flex flex-col gap-1.5 bg-black/40 p-2 text-left rounded border border-white/5">
                            <div className="relative flex gap-2">
                              <input
                                type="text"
                                placeholder="Ej: gemelas, gemidos, payaso, scream, slap..."
                                value={rowSearchTerm[mapping.giftName] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRowSearchTerm(prev => ({ ...prev, [mapping.giftName]: val }));
                                  triggerRowSearch(mapping.giftName, val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    triggerRowSearchImmediate(mapping.giftName, rowSearchTerm[mapping.giftName] ?? '');
                                  }
                                }}
                                className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f2ea]/70 font-sans"
                              />
                              <button
                                type="button"
                                onClick={() => triggerRowSearchImmediate(mapping.giftName, rowSearchTerm[mapping.giftName] ?? '')}
                                className="bg-[#16161D] hover:bg-[#00f2ea]/20 hover:text-[#00f2ea] border border-white/10 rounded px-3 py-1 text-xs text-gray-300 font-bold transition-all shrink-0 uppercase tracking-wider flex items-center gap-1 active:scale-95 text-[11px]"
                              >
                                <Search className="w-2.5 h-2.5" /> Buscar
                              </button>
                            </div>

                            {/* Autocomplete Suggestions */}
                            {(() => {
                              const typedQuery = (rowSearchTerm[mapping.giftName] ?? "").trim().toLowerCase();
                              if (!typedQuery) return null;
                              const suggestions = MEME_SOUNDS.filter(s => 
                                s.name.toLowerCase().includes(typedQuery)
                              ).slice(0, 4);
                              if (suggestions.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 items-center mt-0.5">
                                  <span className="text-[9px] text-gray-500 font-mono">Sugeridos:</span>
                                  {suggestions.map((s, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => {
                                        setRowSearchTerm(prev => ({ ...prev, [mapping.giftName]: s.name }));
                                        handleChangeMappingProps(mapping.giftName, { soundId: 'custom', customSoundUrl: s.url });
                                        handlePlayPreview(s.name, s.url);
                                      }}
                                      className="text-[9px] bg-white/5 hover:bg-[#00f2ea]/15 border border-white/5 hover:border-[#00f2ea]/20 text-gray-400 hover:text-[#00f2ea] px-1.5 py-0.5 rounded transition-colors max-w-[130px] truncate"
                                      title={s.name}
                                    >
                                      ✨ {s.name.replace(/(\([^)]+\))|([😂💨👋🐿️🍳👑🦗👊🎭🙀🤡😩♪😘✨😭🥰🛑🤪🤟😤🤨🎙️⚽🪙🦘🍄🎁🔑🏆☠️👾❗💣🕺📣👏🥁🧠😷⏳⌛😮🎆🥊🔫])|\s+/g, ' ').trim()}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}

                            {rowSearchingState[mapping.giftName] && (
                              <div className="absolute right-3 top-2 text-[10px] text-gray-500 font-mono animate-pulse">
                                buscando...
                              </div>
                            )}
                          </div>

                          {/* Search results inside the card block */}
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                            {(() => {
                              const currentQuery = (rowSearchTerm[mapping.giftName] ?? "").trim().toLowerCase();
                              const matchedMemes = currentQuery
                                ? MEME_SOUNDS.filter(s => s.name.toLowerCase().includes(currentQuery) || s.category.toLowerCase().includes(currentQuery))
                                    .map(s => ({ name: `✨ [Biblioteca] ${s.name}`, url: s.url }))
                                : [];
                              const combinedList = [...matchedMemes, ...(rowSearchResults[mapping.giftName] || [])];

                              if (combinedList.length === 0 && !rowSearchingState[mapping.giftName]) {
                                return (
                                  <div className="text-center py-4 text-xs text-gray-500 font-mono">
                                    { currentQuery === "" ? "Escribe un término para buscar sonidos..." : `No se encontraron sonidos para "${rowSearchTerm[mapping.giftName]}"` }
                                  </div>
                                );
                              }

                              return combinedList.map((sound, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="bg-black/40 rounded p-1.5 border border-white/5 hover:border-[#00f2ea]/20 transition-colors flex items-center justify-between gap-3"
                                >
                                  <span className="text-xs text-gray-300 truncate max-w-[190px] md:max-w-[280px]" title={sound.name}>
                                    {sound.name}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handlePlayPreview(sound.name, sound.url)}
                                      className="bg-gray-800 hover:bg-gray-700 text-white px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-transform active:scale-95 duration-100"
                                    >
                                      <Play className="w-2.5 h-2.5 text-[#00f2ea]" /> Probar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChangeMappingProps(mapping.giftName, { soundId: 'custom', customSoundUrl: sound.url });
                                        setExpandedGiftSearch(null); // Collapses drawer
                                      }}
                                      className="bg-[#00f2ea]/90 hover:bg-[#00f2ea] text-black px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-all"
                                    >
                                      ✔ Vincular
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 🎛️ PORTAL DE SONIDOS VIRALES (INSTANT LAUNCHPAD SOUNDBOARD & SEARCH) */}
          <div className="mt-4 border-t border-white/10 pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f2ea] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f2ea]"></span>
                </span>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1.5 font-sans">
                  🎛️ Launchpad de Memes y Buscador Viral
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSoundboardExpanded(!soundboardExpanded)}
                className="text-[9px] font-mono font-bold text-[#00f2ea] hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded border border-white/5 uppercase"
              >
                {soundboardExpanded ? 'Ocultar ▲' : 'Mostrar ▼'}
              </button>
            </div>

            {soundboardExpanded && (
              <div className="bg-black/35 rounded-lg border border-white/5 p-3 flex flex-col gap-3 animate-fade-in">
                
                {/* Search Bar & Category Switcher */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="relative flex gap-2">
                      <input
                        type="text"
                        placeholder="Buscar en biblioteca y en internet (MyInstants)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            triggerGlobalSearch(searchQuery);
                          }
                        }}
                        className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00f2ea]/70 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => triggerGlobalSearch(searchQuery)}
                        className="bg-[#16161D] hover:bg-[#00f2ea]/20 hover:text-[#00f2ea] border border-white/10 rounded px-4 py-1.5 text-xs text-gray-300 font-bold transition-all shrink-0 uppercase tracking-wider flex items-center gap-1.5 active:scale-95 duration-100"
                      >
                        <Search className="w-3.5 h-3.5 text-[#00f2ea]" /> Buscar
                      </button>

                      {isSearching && (
                        <div className="absolute right-[110px] top-2.5 text-[9px] text-[#00f2ea] font-mono animate-pulse uppercase">
                          buscando...
                        </div>
                      )}
                    </div>

                    {/* Autocomplete suggestions of matching library sounds */}
                    {(() => {
                      const typedQuery = searchQuery.trim().toLowerCase();
                      if (!typedQuery) return null;
                      
                      const suggestions = MEME_SOUNDS.filter(s => 
                        s.name.toLowerCase().includes(typedQuery)
                      ).slice(0, 4);

                      if (suggestions.length === 0) return null;

                      return (
                        <div className="flex flex-wrap gap-1.5 items-center mt-0.5 select-none bg-black/20 p-1.5 rounded border border-white/5">
                          <span className="text-[9px] text-gray-500 font-mono">Sugeridos:</span>
                          {suggestions.map((s, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => {
                                setSearchQuery(s.name);
                                handlePlayPreview(s.name, s.url);
                              }}
                              className="text-[9px] bg-white/5 hover:bg-[#00f2ea]/15 border border-white/5 hover:border-[#00f2ea]/30 text-gray-400 hover:text-[#00f2ea] px-2 py-0.5 rounded transition-colors max-w-[150px] truncate"
                              title={s.name}
                            >
                              ✨ {s.name.replace(/(\([^)]+\))|([😂💨👋🐿️🍳👑🦗👊🎭🙀🤡😩♪😘✨😭🥰🛑🤪🤟😤🤨🎙️⚽🪙🦘🍄🎁🔑🏆☠️👾❗💣🕺📣👏🥁🧠😷⏳⌛😮🎆🥊🔫])|\s+/g, ' ').trim()}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Horizontal Category Filters */}
                  <div className="flex gap-1 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                    {(['Todos', 'Nube', 'Popular', 'Graciosos', 'Voces', 'Videojuegos', 'Efectos'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedMemeCategory(cat)}
                        className={`px-2 py-1 text-[8.5px] font-bold rounded border transition-all shrink-0 uppercase tracking-tight ${
                          selectedMemeCategory === cat
                            ? 'bg-[#00f2ea] border-[#00f2ea] text-black font-extrabold shadow-sm shadow-[#00f2ea]/20'
                            : 'bg-[#16161D]/60 border-white/5 text-gray-500 hover:text-white hover:border-white/10'
                        }`}
                      >
                        {cat === 'Todos' ? '📂 Todos' : cat === 'Nube' ? '☁️ Mis Subidos' : cat === 'Popular' ? '🔥 Populares' : cat === 'Graciosos' ? '😂 Risas' : cat === 'Voces' ? '🗣️ Memes' : cat === 'Videojuegos' ? '🎮 Juegos' : '🔔 Sfx'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid of play / bind items */}
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {(() => {
                    const currentQuery = searchQuery.trim().toLowerCase();
                    let combinedResults: Array<{ name: string; url: string; isLocal: boolean; isCloud?: boolean; cloudId?: string }> = [];

                    if (selectedMemeCategory === 'Nube') {
                      combinedResults = cloudCustomSounds.map(s => ({
                        name: s.filename,
                        url: s.url,
                        isLocal: false,
                        isCloud: true,
                        cloudId: s.id
                      }));
                      if (currentQuery) {
                        combinedResults = combinedResults.filter(s => s.name.toLowerCase().includes(currentQuery));
                      }
                    } else {
                      let localToRender = MEME_SOUNDS;
                      if (currentQuery) {
                        localToRender = MEME_SOUNDS.filter(s => 
                          s.name.toLowerCase().includes(currentQuery) || 
                          s.category.toLowerCase().includes(currentQuery)
                        );
                      } else if (selectedMemeCategory !== 'Todos') {
                        localToRender = MEME_SOUNDS.filter(s => s.category === selectedMemeCategory);
                      }

                      combinedResults = [
                        ...localToRender.map(s => ({ name: s.name, url: s.url, isLocal: true })),
                        ...searchResults.map(s => ({ name: s.name, url: s.url, isLocal: false }))
                      ];
                    }

                    if (combinedResults.length === 0) {
                      return (
                        <div className="text-center py-6 text-[10px] text-gray-500 font-mono italic">
                          No se encontraron sonidos. Escribe otro término o sube archivos.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {combinedResults.map((sound, idx) => (
                          <div 
                            key={idx}
                            className="bg-black/40 border border-white/5 rounded p-2 flex flex-col justify-between gap-2 hover:border-[#00f2ea]/30 transition-all group hover:bg-black/60 focus-within:border-[#00f2ea]/40"
                          >
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <span className="text-[11px] font-sans text-gray-200 font-semibold truncate flex-1 leading-tight group-hover:text-white" title={sound.name}>
                                {sound.isCloud ? '☁️' : sound.isLocal ? '✨' : '🌍'} {sound.name}
                              </span>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handlePlayPreview(sound.name, sound.url)}
                                  className="p-1 rounded bg-[#16161D] hover:bg-[#00f2ea]/15 text-gray-400 hover:text-[#00f2ea] border border-white/5 hover:border-[#00f2ea]/30 transition-all shrink-0 active:scale-95 flex items-center justify-center"
                                  title="Probar sonido"
                                >
                                  <Play className="w-2.5 h-2.5 text-[#00f2ea]" />
                                </button>

                                {sound.isCloud && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCloudSound(sound.cloudId!)}
                                    className="p-1 rounded bg-[#16161D] hover:bg-red-500/15 text-gray-500 hover:text-red-500 border border-white/5 hover:border-red-500/20 transition-all shrink-0 active:scale-95 flex items-center justify-center"
                                    title="Eliminar de la nube"
                                  >
                                    <Trash2 className="w-2.5 h-2.5 text-red-500" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Instantly Link or Create New Gift action block */}
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5">
                              <select
                                id={`soundboard-select-${idx}`}
                                className="bg-black/50 border border-white/10 rounded px-1 py-0.5 text-[9.5px] text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 flex-1 font-sans cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>➡️ Vincular a...</option>
                                {mappings.map(m => (
                                  <option key={m.giftName} value={m.giftName}>
                                    🎁 {m.giftName}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  const selectEl = document.getElementById(`soundboard-select-${idx}`) as HTMLSelectElement;
                                  const selectedGift = selectEl?.value;
                                  if (!selectedGift) {
                                    // If they don't select a gift, offer to create one with a clean name
                                    let nameToUse = prompt("Ingresa el nombre del regalo nuevo para este sonido (ej: Rose, TikTok, Chile):");
                                    if (!nameToUse) return;
                                    nameToUse = nameToUse.trim();
                                    if (!nameToUse) return;

                                    if (mappings.some(m => m.giftName.toLowerCase() === nameToUse!.toLowerCase())) {
                                      showStatus(`El regalo "${nameToUse}" ya existe. Elige otro nombre.`, 'warning');
                                      return;
                                    }

                                    const newMap: GiftSoundMapping = {
                                      giftName: nameToUse,
                                      soundId: 'custom',
                                      volume: 0.8,
                                      label: nameToUse,
                                      customSoundUrl: sound.url
                                    };
                                    onUpdateMapping([newMap, ...mappings]);
                                    showStatus(`¡Regalo "${nameToUse}" creado y vinculado al sonido con éxito!`, 'success');
                                    return;
                                  }
                                  
                                  handleLinkSoundToGift(selectedGift, sound.url);
                                  showStatus(`¡Efecto vinculado al regalo "${selectedGift}"!`, 'success');
                                  selectEl.value = ""; // Reset dropdown
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-400 hover:border-transparent text-[9px] font-bold uppercase tracking-wider transition-all"
                                title="Haz clic para vincular al regalo seleccionado o para crear un regalo nuevo"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {activeTab === 'discovered' && (
        /* Discovered Gifts View Tab */
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1 bg-[#121218]/40">
          <div className="text-[11px] text-gray-400 bg-black/30 border border-white/10 p-3 rounded flex gap-2">
            <HelpCircle className="w-4 h-4 text-[#00f2ea] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Estos son los regalos que han sido <strong className="text-white">descubiertos dinámicamente</strong> en tu sesión en vivo actual.
            </span>
          </div>

          <div className="flex-1">
            {discoveredGifts.length === 0 ? (
              <div className="text-center py-12 bg-black/20 rounded border border-dashed border-white/10">
                <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Ningún regalo ha sido detectado</p>
                <p className="text-[10px] text-gray-600 mt-1 leading-relaxed max-w-[280px] mx-auto">
                  Conéctate a un en vivo real para que los regalos se registren aquí de manera automática a medida que entran.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {discoveredGifts.map((gift) => {
                  const isMapped = mappings.some(m => m.giftName.toLowerCase() === gift.giftName.toLowerCase());
                  return (
                    <div
                      key={gift.giftName}
                      className="bg-black/20 border border-white/10 hover:border-[#00f2ea]/20 rounded p-2 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2 max-w-[65%]">
                        <div className="w-8 h-8 bg-black/40 rounded border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {gift.giftPictureUrl && (
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(gift.giftPictureUrl)}`}
                              alt={gift.giftName}
                              className="w-7 h-7 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-sans font-bold text-xs text-white truncate" title={gift.giftName}>
                            {gift.giftName}
                          </div>
                          <div className="text-[9px] text-[#00f2ea] font-mono font-bold">
                            💎 {gift.diamondCount}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleImportGift({ giftName: gift.giftName, giftPictureUrl: gift.giftPictureUrl })}
                        className={`text-[9.5px] font-bold py-1 px-2 rounded uppercase tracking-wider transition-all ${
                          isMapped
                            ? 'bg-black/30 text-gray-500 border border-white/5 cursor-default'
                            : 'bg-[#ff0050]/15 hover:bg-[#ff0050] hover:text-white text-[#ff0050] border border-[#ff0050]/20'
                        }`}
                      >
                        {isMapped ? 'Configurado' : 'Añadir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1 bg-[#121218]/40">
          <div className="text-[11px] text-gray-400 bg-black/30 border border-white/10 p-3 rounded flex gap-2">
            <Sparkles className="w-4 h-4 text-[#00f2ea] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Explora y añade efectos de sonido a cualquiera de los <strong className="text-white">cientos de regalos oficiales</strong> de TikTok.
            </span>
          </div>

          {/* Catalog search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar regalo por nombre... (p. ej: Rose, Coffee, Jet...)"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded py-2 pl-9 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00f2ea]/40 font-sans"
            />
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
            {catalogQuery && (
              <button
                onClick={() => setCatalogQuery('')}
                className="absolute right-3 top-2 text-gray-500 hover:text-white text-xs outline-none border-0 bg-transparent p-0 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex-1">
            {(() => {
              const filtered = GIFT_CATALOG.filter(g =>
                g.name.toLowerCase().includes(catalogQuery.toLowerCase())
              );
              
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 bg-black/20 rounded border border-dashed border-white/10">
                    <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">No se encontraron regalos</p>
                    <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                      Prueba usando otras palabras clave.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {filtered.slice(0, 150).map((gift) => {
                    const isMapped = mappings.some(m => m.giftName.toLowerCase() === gift.name.toLowerCase());
                    return (
                      <div
                        key={gift.id + '-' + gift.name}
                        className="bg-black/20 border border-white/10 hover:border-[#00f2ea]/20 rounded p-2 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-2 max-w-[65%] min-w-0">
                          <div className="w-8 h-8 bg-black/40 rounded border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {gift.image && (
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(gift.image)}`}
                                alt={gift.name}
                                className="w-7 h-7 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-sans font-bold text-[11px] text-white truncate" title={gift.name}>
                              {gift.name}
                            </div>
                            <div className="text-[8px] text-gray-500 font-mono">
                              ID: {gift.id}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleImportGift({ giftName: gift.name, giftPictureUrl: gift.image })}
                          className={`text-[9px] font-bold py-1 px-1.5 rounded uppercase tracking-wider transition-all shrink-0 ${
                            isMapped
                              ? 'bg-[#00f2ea]/15 text-[#00f2ea] border border-[#00f2ea]/20 focus:outline-none'
                              : 'bg-white text-black hover:bg-[#00f2ea] hover:text-black hover:scale-105 border border-transparent'
                          }`}
                        >
                          {isMapped ? 'Configurado' : 'Añadir'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* 🎵 FLOTANTE: REPRODUCTOR DE VISTA PREVIA INTERACTIVO DE SONIDOS (Eliminado) */}
      {false && previewState && (
        <div 
          id="preview-audio-dock"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] bg-[#16161D]/95 backdrop-blur-md border border-[#00f2ea]/30 rounded-xl p-3.5 shadow-2xl z-50 animate-fade-in flex flex-col gap-2.5"
        >
          {/* Header with Title and Close button */}
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded bg-[#00f2ea]/15 text-[#00f2ea] shrink-0 animate-pulse">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider leading-none">VISTA PREVIA REPRODUCIENDO</p>
                <h4 className="text-xs font-sans font-bold text-white truncate leading-tight mt-0.5" title={previewState.name}>
                  {previewState.name}
                </h4>
              </div>
            </div>
            
            <button
              onClick={handleStopPreview}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Cerrar reproductor"
            >
              <X className="w-3.5 h-3.5 animate-pulse" />
            </button>
          </div>

          {/* Controls & Scrubber Progress */}
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={handleTogglePreviewPlay}
              className="p-2.5 rounded-full bg-[#00f2ea] text-black hover:bg-white transition-all transform hover:scale-105 active:scale-95 duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-[#00f2ea]/20"
              title={previewState.isPlaying ? "Pausar" : "Reproducir"}
            >
              {previewState.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Slider Scrubber with duration timestamps */}
            <div className="flex-1 flex flex-col gap-1 select-none">
              <input
                type="range"
                min="0"
                max={previewState.duration || 100}
                step="0.05"
                value={previewState.currentTime}
                onChange={(e) => handleScrubPreview(parseFloat(e.target.value))}
                className="w-full accent-[#00f2ea] cursor-pointer h-1.5 bg-black/40 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-mono leading-none">
                <span>
                  {Math.floor(previewState.currentTime / 60)}:
                  {String(Math.floor(previewState.currentTime % 60)).padStart(2, '0')}
                </span>
                <span>
                  {previewState.duration ? (
                    `${Math.floor(previewState.duration / 60)}:${String(Math.floor(previewState.duration % 60)).padStart(2, '0')}`
                  ) : (
                    "0:00"
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Linking tool block inside play widget */}
          <div className="bg-black/50 p-2 rounded border border-white/5 flex items-center justify-between gap-1.5 mt-1 sm:gap-2">
            <span className="text-[9px] font-mono text-[#00f2ea] uppercase tracking-tight font-extrabold shrink-0">
              🔗 VINCULAR A UN REGALO:
            </span>
            <div className="flex items-center gap-1.5 flex-1 max-w-[210px]">
              <select
                id="preview-assign-select"
                className="bg-[#16161D] border border-white/10 rounded px-1.5 py-0.5 text-[9.5px] text-gray-200 focus:outline-none focus:border-[#00f2ea]/50 flex-1 font-sans cursor-pointer h-7"
                defaultValue=""
              >
                <option value="" disabled>Elegir regalo...</option>
                {mappings.map(m => (
                  <option key={m.giftName} value={m.giftName}>
                    🎁 {m.giftName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const selectEl = document.getElementById('preview-assign-select') as HTMLSelectElement;
                  const selectedGift = selectEl?.value;
                  if (!selectedGift) {
                    showStatus('Selecciona un regalo de la lista para vincularlo.', 'warning');
                    return;
                  }
                  
                  // Link sound url to existing mapping
                  handleChangeMappingProps(selectedGift, { soundId: 'custom', customSoundUrl: previewState.url });
                  showStatus(`¡Sonido "${previewState.name}" vinculado a 🎁 ${selectedGift} con éxito!`, 'success');
                }}
                className="bg-[#00f2ea] hover:bg-[#00f2ea]/90 text-black text-[9.5px] font-extrabold px-3 h-7 rounded transition-all shrink-0 active:scale-95"
              >
                VINCULAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
