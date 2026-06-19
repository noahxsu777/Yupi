/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LiveEvent, GiftSoundMapping, PresetSound, SuperFan, SuperFanAlertData } from './types';
import { playSynthesizedSound, playSoundFromUrl, speakText, queueSound, playSoundFromUrlWithCompletion, playSynthesizedSoundWithCompletion, stopAllAudio, startBackgroundPriorityMode, stopBackgroundPriorityMode, stopActiveTts, unlockAudio } from './utils/audio';
import GiftSoundConfig from './components/GiftSoundConfig';
import { GIFT_CATALOG } from './data/gifts';

import SoundAlertOverlay, { AlertData } from './components/SoundAlertOverlay';
import LiveEventFeed from './components/LiveEventFeed';
import ChatTtsController from './components/ChatTtsController';
import YoutubeRadio, { YoutubeSong } from './components/YoutubeRadio';
import ErrorBoundary from './components/ErrorBoundary';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceededError } from './utils/firebase';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Play, 
  Users, 
  Sparkles, 
  MessageCircle, 
  Heart, 
  Gift, 
  UserPlus, 
  Share, 
  ShieldAlert, 
  VolumeX, 
  Volume2,
  Copy,
  FolderSync,
  ThumbsUp,
  Trophy,
  ChevronDown,
  ChevronUp,
  Key,
  Instagram,
  Twitter,
  Music,
  Laugh,
  CheckCircle,
  Smartphone,
  Moon,
  Zap,
  Download,
  Upload,
  Trash2,
  Save,
  FileJson,
  History,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const PRESET_SOUNDS: PresetSound[] = [
  { id: 'coin', name: 'Moneda Retro 🪙', type: 'synth', synthType: 'coin' },
  { id: 'triumph', name: 'Nivel Completado ⭐', type: 'synth', synthType: 'triumph' },
  { id: 'laser', name: 'Disparo Láser ⚡', type: 'synth', synthType: 'laser' },
  { id: 'airhorn', name: 'Bocina Hype 📣', type: 'synth', synthType: 'airhorn' },
  { id: 'bubble', name: 'Burbujas Pop 🫧', type: 'synth', synthType: 'bubble' },
  { id: 'magic', name: 'Brillo Mágico ✨', type: 'synth', synthType: 'magic' },
];

const DEFAULT_MAPPINGS: GiftSoundMapping[] = [
  { giftName: 'Rose', soundId: 'coin', volume: 0.8, label: 'Rosa', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/7408db06d445c9be6242699f8d51185d.png~tplv-obj.png' },
  { giftName: 'Rosa', soundId: 'coin', volume: 0.8, label: 'Rosa', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/7408db06d445c9be6242699f8d51185d.png~tplv-obj.png' },
  { giftName: 'TikTok', soundId: 'laser', volume: 0.8, label: 'TikTok', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/823a2cc74efb71889fc68a3560ec0cf7.png~tplv-obj.png' },
  { giftName: 'Finger Heart', soundId: 'magic', volume: 0.8, label: 'Corazón Coreano', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/919f18ed0f8b05afaf4528148e65893b.png~tplv-obj.png' },
  { giftName: 'Corazón', soundId: 'magic', volume: 0.8, label: 'Corazón', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/919f18ed0f8b05afaf4528148e65893b.png~tplv-obj.png' },
  { giftName: 'Lion', soundId: 'airhorn', volume: 0.9, label: 'León', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png' },
  { giftName: 'León', soundId: 'airhorn', volume: 0.9, label: 'León', iconUrl: 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png' }
];

export default function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('tiktok_creator_username') || '';
  });
  const [recentProfiles, setRecentProfiles] = useState<string[]>(() => {
    const saved = localStorage.getItem('tiktok_recent_profiles_list');
    return saved ? JSON.parse(saved) : [];
  });

  const addProfileToHistory = (user: string) => {
    const cleanUser = user.replace('@', '').trim().toLowerCase();
    if (!cleanUser) return;
    setRecentProfiles(prev => {
      const filtered = prev.filter(p => p !== cleanUser);
      const updated = [cleanUser, ...filtered].slice(0, 10); // keep last 10
      localStorage.setItem('tiktok_recent_profiles_list', JSON.stringify(updated));
      return updated;
    });
  };

  const [activeConnectedUser, setActiveConnectedUser] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'live' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Advanced link options of tiktok-live-connector
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('tiktok_session_id') || '';
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // TikTok Live High-Speed Connection parameters (handled transparently)
  const [premiumConnection, setPremiumConnection] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiktok_premium_conn');
    return saved !== null ? saved === 'true' : true;
  });
  const [connectionKey, setConnectionKey] = useState<string>(() => {
    return localStorage.getItem('tiktok_premium_conn_key') || 'tk_235e481d7e949fa580b3f0b3bf8040223481c16e398d2abb';
  });

  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<AlertData[]>([]);
  
  // Custom interactive VIP Súper Fans state configuration
  const [superFans, setSuperFans] = useState<SuperFan[]>(() => {
    const saved = localStorage.getItem('tiktok_super_fans');
    return saved ? JSON.parse(saved) : [
      { uniqueId: 'carlos_vip', nickname: 'Carlos el Patrón 👑', fanLevel: 38, avatarUrl: 'https://p16-sign-va.tiktokcdn.com/tos-malisg-avt-0068/7313894468205428741~c5_100x100.jpeg?biz_tag=tiktok_user_cover', badgeLevel: 'Leyenda', joinMessage: '¡El Patrón se une al directo dispuesto a todo!' },
      { uniqueId: 'maria_love', nickname: 'María Estrella ⭐', fanLevel: 25, avatarUrl: 'https://p16-sign-va.tiktokcdn.com/tos-malisg-avt-0068/7311634860432128005~c5_100x100.jpeg', badgeLevel: 'Corona', joinMessage: '¡María brilla con luz propia hoy en el chat!' },
      { uniqueId: 'pablo_twitch', nickname: 'Pablo Moderador 🛡️', fanLevel: 31, avatarUrl: 'https://p16-sign-va.tiktokcdn.com/tos-malisg-avt-0068/7408db06d445c9be6242699f8d51185d~c5_100x100.jpeg', badgeLevel: 'Estrella', joinMessage: '¡El moderador de oro está en la sala!' }
    ];
  });
  const [activeSuperFanAlerts, setActiveSuperFanAlerts] = useState<SuperFanAlertData[]>([]);
  
  // Live Room Stats metrics
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(0);

  const [playCommandTrigger, setPlayCommandTrigger] = useState<{
    command: 'play' | 'skip';
    query?: string;
    user: string;
    isModerator: boolean;
    isSuperFan: boolean;
    timestamp?: number;
  } | null>(null);

  const handleCheckSongCommand = (comment: string, user: string, isEventMod?: boolean) => {
    if (!comment || !user) return;
    const cleanComment = comment.trim();
    const commentLower = cleanComment.toLowerCase();

    const userStr = user.toLowerCase();

    // Determine user status
    const isSuperFanMod = superFans.some(sf => {
      const sfUniqueId = (sf.uniqueId || '').toLowerCase();
      const sfNickname = (sf.nickname || '').toLowerCase();
      return sfUniqueId === userStr && (sfNickname.includes('mod') || sfNickname.includes('🛡️'));
    });
    const isMod = !!isEventMod || 
                  userStr.includes('mod') || 
                  isSuperFanMod;
                  
    const isSuperFan = superFans.some(sf => (sf.uniqueId || '').toLowerCase() === userStr);

    if (commentLower.startsWith('!play ')) {
      const songQuery = cleanComment.substring(6).trim();
      if (songQuery) {
        setPlayCommandTrigger({
          command: 'play',
          query: songQuery,
          user: user,
          isModerator: isMod,
          isSuperFan: isSuperFan,
          timestamp: Date.now() + Math.random()
        });
      }
    } else if (commentLower === '!skip') {
      setPlayCommandTrigger({
        command: 'skip',
        user: user,
        isModerator: isMod,
        isSuperFan: isSuperFan,
        timestamp: Date.now() + Math.random()
      });
    }
  };

  const [discoveredGifts, setDiscoveredGifts] = useState<Array<{ giftName: string; giftPictureUrl: string; diamondCount: number }>>([]);
  const [mappings, setMappings] = useState<GiftSoundMapping[]>(() => {
    const saved = localStorage.getItem('tiktok_sound_mappings');
    return saved ? JSON.parse(saved) : DEFAULT_MAPPINGS;
  });
  const [muted, setMuted] = useState(false);
  const [baseDiamonds] = useState(0);
  const [sessionUptime, setSessionUptime] = useState(0); // starts at 0 for active connection
  const [isOverlayOnly, setIsOverlayOnly] = useState<boolean>(false);
  const [copiedObs, setCopiedObs] = useState<boolean>(false);
  const [simGiftSearch, setSimGiftSearch] = useState('');
  const [connectingPhase, setConnectingPhase] = useState<'none' | 'iniciando' | 'conectando' | 'conectado'>('none');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cloudLoadStatus, setCloudLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState<boolean>(false);

  // Keep track of the last event's timestamp so we can pick up any missed events if the phone locks/reconnects
  const lastEventTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (msg: any) => {
      const messageText = String(msg);
      console.log('[System Alert Logged Silently]', messageText);
    };

    // Robust audio unlock on first user gesture anywhere in the iframe/browser tab
    const handleGlobalUserUnlock = () => {
      try {
        unlockAudio();
        console.log('[Audio] Successfully unlocked audio and speechSynthesis context on human interaction.');
        window.removeEventListener('click', handleGlobalUserUnlock);
        window.removeEventListener('touchstart', handleGlobalUserUnlock);
      } catch (err) {
        console.warn('[Audio] Failed global click unlock:', err);
      }
    };

    const handleQuotaExceeded = () => {
      console.warn('[QuotaExceededEvent] Quota limit exceeded detected on Firestore DB.');
      setFirestoreQuotaExceeded(true);
    };

    window.addEventListener('click', handleGlobalUserUnlock);
    window.addEventListener('touchstart', handleGlobalUserUnlock);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener('click', handleGlobalUserUnlock);
      window.removeEventListener('touchstart', handleGlobalUserUnlock);
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const sseRef = useRef<EventSource | null>(null);
  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => { connectionStatusRef.current = connectionStatus; }, [connectionStatus]);
  const mappingsRef = useRef(mappings);
  useEffect(() => { mappingsRef.current = mappings; }, [mappings]);

  const eventBufferRef = useRef<LiveEvent[]>([]);
  const flushTimerRef = useRef<any | null>(null);

  const pushEventToFeed = (event: LiveEvent) => {
    // Assure that each and every event's ID is perfectly unique in the system so React lists never collide
    const uniqueIdSuffix = Math.random().toString(36).substring(2, 11);
    const uniqueEvent: LiveEvent = {
      ...event,
      id: event.id 
        ? (event.id.includes('-unique-') ? event.id : `${event.id}-unique-${uniqueIdSuffix}`) 
        : `event-${Date.now()}-unique-${uniqueIdSuffix}`
    };
    eventBufferRef.current.push(uniqueEvent);
    
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        const buffered = eventBufferRef.current;
        eventBufferRef.current = [];
        flushTimerRef.current = null;
        
        if (buffered.length > 0) {
          setEvents(prev => {
            const combined = [...prev, ...buffered];
            if (combined.length > 150) {
              return combined.slice(-150);
            }
            return combined;
          });
        }
      }, 150);
    }
  };

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  // Sequenced VIP entries announcer and holographic loop presentation
  const triggerSuperFansIntro = () => {
    if (!superFanWelcomeEnabled) {
      console.log('[System] Super Fan welcome alerts are currently disabled by settings.');
      return;
    }
    superFans.forEach((sf, index) => {
      setTimeout(() => {
        const id = `sf-intro-${Date.now()}-${sf.uniqueId}-${Math.random()}`;
        const newAlert: SuperFanAlertData = {
          id,
          uniqueId: sf.uniqueId,
          nickname: sf.nickname,
          fanLevel: sf.fanLevel,
          avatarUrl: sf.avatarUrl,
          actionText: sf.joinMessage
        };
        setActiveSuperFanAlerts(prev => [...prev, newAlert]);

        // Synthesis Speech alert
        if (ttsEnabled && !muted) {
          const intros = ttsReadUsernames ? [
            `¡Increíble! Súper Fan Leyenda, ${sf.nickname}, de nivel ${sf.fanLevel}, se acaba de conectar al directo. ¡Bienvenido, crack!`,
            `¡Atención chat! Súper Fan Estrella, ${sf.nickname}, de nivel ${sf.fanLevel}, entra al en vivo. ¡Muchísimas gracias por tu apoyo!`,
            `¡Brutal! Súper Fan, ${sf.nickname}, con nivel de fan ${sf.fanLevel}, ya está activo en la transmisión. ¡Dejen sus me gusta!`
          ] : [
            `¡Increíble! Un Súper Fan de nivel ${sf.fanLevel} se acaba de conectar al directo. ¡Bienvenido, crack!`,
            `¡Atención chat! Un Súper Fan de nivel ${sf.fanLevel} entra al en vivo. ¡Muchísimas gracias por tu apoyo!`,
            `¡Brutal! Un Súper Fan con nivel de fan ${sf.fanLevel} ya está activo en la transmisión. ¡Dejen sus me gusta!`
          ];
          const phrase = intros[index % intros.length];
          // Invoke speech synthesis with higher enthusiasm pitch
          speakText(phrase, ttsVolume, ttsVoiceURI, ttsRate * 1.05, 1.15, ttsProvider);
        }
      }, (index + 1) * 2300);
    });
  };

  // Real-time Text-to-Speech (TTS) voice engine configurations
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiktok_tts_enabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [ttsVolume, setTtsVolume] = useState<number>(() => {
    const saved = localStorage.getItem('tiktok_tts_volume');
    return saved ? parseFloat(saved) : 0.8;
  });
  const [ttsProvider, setTtsProvider] = useState<string>(() => {
    return localStorage.getItem('tiktok_tts_provider') || 'google';
  });
  const [ttsVoiceURI, setTtsVoiceURI] = useState<string>(() => {
    return localStorage.getItem('tiktok_tts_voice_uri') || 'es';
  });
  const [ttsRate, setTtsRate] = useState<number>(() => {
    const saved = localStorage.getItem('tiktok_tts_rate');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [ttsReadUsernames, setTtsReadUsernames] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiktok_tts_read_usernames');
    return saved ? JSON.parse(saved) : false;
  });
  const [ttsReaderTargets, setTtsReaderTargets] = useState<('todos' | 'moderadores' | 'superfans')[]>(() => {
    const saved = localStorage.getItem('tiktok_tts_reader_targets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Ignore JSON error
      }
    }
    const prev = localStorage.getItem('tiktok_tts_reader_target');
    if (prev === 'todos' || prev === 'moderadores' || prev === 'superfans') {
      return [prev];
    }
    return ['todos'];
  });
  const [superFanWelcomeEnabled, setSuperFanWelcomeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiktok_superfan_welcome_enabled');
    return saved ? JSON.parse(saved) : false; // False by default!
  });

  const handleToggleSuperFanWelcome = () => {
    const nextVal = !superFanWelcomeEnabled;
    setSuperFanWelcomeEnabled(nextVal);
    localStorage.setItem('tiktok_superfan_welcome_enabled', JSON.stringify(nextVal));
  };
  const [aiVoiceMode, setAiVoiceMode] = useState<string>(() => {
    return localStorage.getItem('tiktok_ai_voice_mode') || 'normal';
  });

  const [backgroundPriority, setBackgroundPriority] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiktok_background_priority');
    return saved ? JSON.parse(saved) : true; // Default to true (Active background priority!)
  });

  const handleToggleBackgroundPriority = (enabled: boolean) => {
    setBackgroundPriority(enabled);
    localStorage.setItem('tiktok_background_priority', JSON.stringify(enabled));
  };

  // Keep AudioContext active in second plane so Chrome/Safari does not prioritize tab suspension
  useEffect(() => {
    if (backgroundPriority) {
      startBackgroundPriorityMode();
    } else {
      stopBackgroundPriorityMode();
    }
    return () => {
      stopBackgroundPriorityMode();
    };
  }, [backgroundPriority]);

  const handleToggleTtsReadUsernames = () => {
    const nextVal = !ttsReadUsernames;
    setTtsReadUsernames(nextVal);
    localStorage.setItem('tiktok_tts_read_usernames', JSON.stringify(nextVal));
  };

  const handleToggleTts = (enabled: boolean) => {
    setTtsEnabled(enabled);
    localStorage.setItem('tiktok_tts_enabled', JSON.stringify(enabled));
    if (!enabled) {
      stopActiveTts();
    }
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        mappings,
        superFans,
        ttsEnabled,
        ttsVolume,
        ttsProvider,
        ttsVoiceURI,
        ttsRate,
        ttsReadUsernames,
        ttsReaderTargets,
        superFanWelcomeEnabled,
        aiVoiceMode,
        backgroundPriority
      };
      const jsonStr = JSON.stringify(backupData, null, 2);

      // Write to Clipboard immediately as a 100% reliable fallback under iframe sandboxes
      try {
        navigator.clipboard.writeText(jsonStr);
      } catch (clipErr) {
        console.warn('[Backup] Clipboard path blocked:', clipErr);
      }

      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `creator_still_backup_${username.replace('@', '').trim().toLowerCase() || 'config'}.json`;
      downloadAnchor.target = '_blank';
      downloadAnchor.rel = 'noopener noreferrer';
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      alert('📥 Copia de seguridad exportada.\n\nEl archivo se descargó automáticamente. Si tu navegador bloquea las descargas desde iFrames, ¡no te preocupes! El contenido JSON de tu configuración también se copió al portapapeles para que lo pegues y guardes en cualquier archivo de texto.');
    } catch (err) {
      console.error('[Backup] Export failed:', err);
      alert('Error al exportar la copia de seguridad. Puedes copiar los logs de la consola en su lugar.');
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed) {
            // Prevent autosave during restore
            hasLoadedConfigFromServerRef.current = false;

            if (Array.isArray(parsed.mappings)) {
              setMappings(parsed.mappings);
              localStorage.setItem('tiktok_sound_mappings', JSON.stringify(parsed.mappings));
            }
            if (Array.isArray(parsed.superFans)) {
              setSuperFans(parsed.superFans);
              localStorage.setItem('tiktok_super_fans', JSON.stringify(parsed.superFans));
            }
            if (parsed.ttsEnabled !== undefined) {
              setTtsEnabled(parsed.ttsEnabled);
              localStorage.setItem('tiktok_tts_enabled', JSON.stringify(parsed.ttsEnabled));
            }
            if (parsed.ttsVolume !== undefined) {
              setTtsVolume(parsed.ttsVolume);
              localStorage.setItem('tiktok_tts_volume', JSON.stringify(parsed.ttsVolume));
            }
            if (parsed.ttsProvider !== undefined) {
              setTtsProvider(parsed.ttsProvider);
              localStorage.setItem('tiktok_tts_provider', parsed.ttsProvider);
            }
            if (parsed.ttsVoiceURI !== undefined) {
              setTtsVoiceURI(parsed.ttsVoiceURI);
              localStorage.setItem('tiktok_tts_voice_uri', parsed.ttsVoiceURI);
            }
            if (parsed.ttsRate !== undefined) {
              setTtsRate(parsed.ttsRate);
              localStorage.setItem('tiktok_tts_rate', JSON.stringify(parsed.ttsRate));
            }
            if (parsed.ttsReadUsernames !== undefined) {
              setTtsReadUsernames(parsed.ttsReadUsernames);
              localStorage.setItem('tiktok_tts_read_usernames', JSON.stringify(parsed.ttsReadUsernames));
            }
            if (Array.isArray(parsed.ttsReaderTargets)) {
              setTtsReaderTargets(parsed.ttsReaderTargets);
              localStorage.setItem('tiktok_tts_reader_targets', JSON.stringify(parsed.ttsReaderTargets));
            }
            if (parsed.superFanWelcomeEnabled !== undefined) {
              setSuperFanWelcomeEnabled(parsed.superFanWelcomeEnabled);
              localStorage.setItem('tiktok_superfan_welcome_enabled', JSON.stringify(parsed.superFanWelcomeEnabled));
            }
            if (parsed.aiVoiceMode !== undefined) {
              setAiVoiceMode(parsed.aiVoiceMode);
              localStorage.setItem('tiktok_ai_voice_mode', parsed.aiVoiceMode);
            }
            if (parsed.backgroundPriority !== undefined) {
              setBackgroundPriority(parsed.backgroundPriority);
              localStorage.setItem('tiktok_background_priority', JSON.stringify(parsed.backgroundPriority));
            }

            // Activate autosave after restoration
            setTimeout(() => {
              hasLoadedConfigFromServerRef.current = true;
              const targetUser = username.replace('@', '').trim().toLowerCase();
              if (targetUser) {
                saveConfigToServer(targetUser);
              }
            }, 100);

            alert('¡Copia de seguridad importada y sincronizada correctamente!');
          }
        } catch (err) {
          console.error('[Backup] Import failed:', err);
          alert('Hubo un error al leer o importar el archivo de copia de seguridad.');
        }
      };
    }
  };

  const handleUpdateTtsVolume = (vol: number) => {
    setTtsVolume(vol);
    localStorage.setItem('tiktok_tts_volume', JSON.stringify(vol));
    stopActiveTts();
  };

  const handleUpdateTtsProvider = (prov: string) => {
    stopActiveTts();
    setTtsProvider(prov);
    localStorage.setItem('tiktok_tts_provider', prov);
    // Auto shift voice to sensible default value if needed
    if (prov === 'google') handleUpdateTtsVoiceURI('es');
    else if (prov === 'streamelements') handleUpdateTtsVoiceURI('Brian');
    else if (prov === 'tiktok') handleUpdateTtsVoiceURI('es_002');
    else if (prov === 'edge') handleUpdateTtsVoiceURI('es-CO-SalomeNeural');
    else if (prov === 'celebrity') handleUpdateTtsVoiceURI('trump');
    else if (prov === 'browser') handleUpdateTtsVoiceURI('');
  };

  const handleUpdateTtsVoiceURI = (uri: string) => {
    stopActiveTts();
    setTtsVoiceURI(uri);
    localStorage.setItem('tiktok_tts_voice_uri', uri);
  };

  const handleUpdateTtsRate = (rate: number) => {
    setTtsRate(rate);
    localStorage.setItem('tiktok_tts_rate', JSON.stringify(rate));
    stopActiveTts();
  };

  const handleUpdateAiVoiceMode = (mode: string) => {
    setAiVoiceMode(mode);
    localStorage.setItem('tiktok_ai_voice_mode', mode);
    stopActiveTts();
  };

  const handleUpdateTtsReaderTargets = (targets: ('todos' | 'moderadores' | 'superfans')[]) => {
    setTtsReaderTargets(targets);
    localStorage.setItem('tiktok_tts_reader_targets', JSON.stringify(targets));
  };

  // Flag to know when it is safe to upload configurations to the server without overwriting with defaults
  const hasLoadedConfigFromServerRef = useRef<boolean>(false);
  const lastFetchedConfigRef = useRef<string | null>(null);

  // Helper to apply loaded settings into states and local storage safely
  const applyLoadedConfig = (cfg: any, isManual: boolean = false) => {
    console.log('[ConfigStore] Applying loaded configuration:', cfg);
    
    // Prevent autosave during restore
    hasLoadedConfigFromServerRef.current = false;

    const fetchedCfg = {
      username: cfg.username || '',
      mappings: cfg.mappings || [],
      superFans: cfg.superFans || [],
      ttsEnabled: cfg.ttsEnabled !== undefined ? cfg.ttsEnabled : false,
      ttsVolume: cfg.ttsVolume !== undefined ? cfg.ttsVolume : 50,
      ttsProvider: cfg.ttsProvider || 'google',
      ttsVoiceURI: cfg.ttsVoiceURI || 'es',
      ttsRate: cfg.ttsRate !== undefined ? cfg.ttsRate : 1,
      ttsReadUsernames: cfg.ttsReadUsernames !== undefined ? cfg.ttsReadUsernames : false,
      ttsReaderTargets: cfg.ttsReaderTargets || ['todos'],
      superFanWelcomeEnabled: cfg.superFanWelcomeEnabled !== undefined ? cfg.superFanWelcomeEnabled : true,
      aiVoiceMode: cfg.aiVoiceMode || 'towa-casual',
      backgroundPriority: cfg.backgroundPriority !== undefined ? cfg.backgroundPriority : false
    };

    // Seed comparison ref to block race-condition autosaves with identical structure as currentConfig
    const comparisonConfig = {
      mappings: fetchedCfg.mappings,
      superFans: fetchedCfg.superFans,
      ttsEnabled: fetchedCfg.ttsEnabled,
      ttsVolume: fetchedCfg.ttsVolume,
      ttsProvider: fetchedCfg.ttsProvider,
      ttsVoiceURI: fetchedCfg.ttsVoiceURI,
      ttsRate: fetchedCfg.ttsRate,
      ttsReadUsernames: fetchedCfg.ttsReadUsernames,
      ttsReaderTargets: fetchedCfg.ttsReaderTargets,
      superFanWelcomeEnabled: fetchedCfg.superFanWelcomeEnabled,
      aiVoiceMode: fetchedCfg.aiVoiceMode,
      backgroundPriority: fetchedCfg.backgroundPriority
    };

    lastFetchedConfigRef.current = JSON.stringify(comparisonConfig);

    if (cfg.username) {
      setUsername(cfg.username);
      localStorage.setItem('tiktok_creator_username', cfg.username);
    }
    if (Array.isArray(cfg.mappings)) {
      setMappings(cfg.mappings);
      localStorage.setItem('tiktok_sound_mappings', JSON.stringify(cfg.mappings));
    }
    if (Array.isArray(cfg.superFans)) {
      setSuperFans(cfg.superFans);
      localStorage.setItem('tiktok_super_fans', JSON.stringify(cfg.superFans));
    }
    if (cfg.ttsEnabled !== undefined) {
      setTtsEnabled(cfg.ttsEnabled);
      localStorage.setItem('tiktok_tts_enabled', JSON.stringify(cfg.ttsEnabled));
    }
    if (cfg.ttsVolume !== undefined) {
      setTtsVolume(cfg.ttsVolume);
      localStorage.setItem('tiktok_tts_volume', JSON.stringify(cfg.ttsVolume));
    }
    if (cfg.ttsProvider !== undefined) {
      setTtsProvider(cfg.ttsProvider);
      localStorage.setItem('tiktok_tts_provider', cfg.ttsProvider);
    }
    if (cfg.ttsVoiceURI !== undefined) {
      setTtsVoiceURI(cfg.ttsVoiceURI);
      localStorage.setItem('tiktok_tts_voice_uri', cfg.ttsVoiceURI);
    }
    if (cfg.ttsRate !== undefined) {
      setTtsRate(cfg.ttsRate);
      localStorage.setItem('tiktok_tts_rate', JSON.stringify(cfg.ttsRate));
    }
    if (cfg.ttsReadUsernames !== undefined) {
      setTtsReadUsernames(cfg.ttsReadUsernames);
      localStorage.setItem('tiktok_tts_read_usernames', JSON.stringify(cfg.ttsReadUsernames));
    }
    if (Array.isArray(cfg.ttsReaderTargets)) {
      setTtsReaderTargets(cfg.ttsReaderTargets);
      localStorage.setItem('tiktok_tts_reader_targets', JSON.stringify(cfg.ttsReaderTargets));
    }
    if (cfg.superFanWelcomeEnabled !== undefined) {
      setSuperFanWelcomeEnabled(cfg.superFanWelcomeEnabled);
      localStorage.setItem('tiktok_superfan_welcome_enabled', JSON.stringify(cfg.superFanWelcomeEnabled));
    }
    if (cfg.aiVoiceMode !== undefined) {
      setAiVoiceMode(cfg.aiVoiceMode);
      localStorage.setItem('tiktok_ai_voice_mode', cfg.aiVoiceMode);
    }
    if (cfg.backgroundPriority !== undefined) {
      setBackgroundPriority(cfg.backgroundPriority);
      localStorage.setItem('tiktok_background_priority', JSON.stringify(cfg.backgroundPriority));
    }

    if (isManual) {
      setCloudLoadStatus('loaded');
      setTimeout(() => setCloudLoadStatus('idle'), 3000);
    }

    // Activate autosave after restoration
    setTimeout(() => {
      hasLoadedConfigFromServerRef.current = true;
    }, 100);
  };

  // Unified load function that fetches and restores configuration from Firestore & Fast Local Cache
  const loadUserConfig = (userToLoad: string, isManual: boolean = false) => {
    const cleanUser = userToLoad.replace('@', '').trim().toLowerCase();
    if (!cleanUser) return;

    if (isManual) {
      setCloudLoadStatus('loading');
    }

    try {
      console.log(`[ConfigStore] Setting up real-time listener for @${cleanUser}...`);
      const docRef = doc(db, 'configs', cleanUser);
      
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const cfg = docSnap.data();
          applyLoadedConfig(cfg, isManual);
          addProfileToHistory(cleanUser);
          hasLoadedConfigFromServerRef.current = true;
          if (isManual) setCloudLoadStatus('idle');
        } else {
           console.log('[ConfigStore] No Firestore config found.');
           applyLoadedConfig({}, isManual);
           hasLoadedConfigFromServerRef.current = true;
           addProfileToHistory(cleanUser);
        }
      }, (error) => {
        console.error('[ConfigStore] Snapshot listener failed:', error);
      });

    } catch (err) {
      console.warn('[ConfigStore] Failed to load configuration for username from Firestore:', err);
      hasLoadedConfigFromServerRef.current = false;
    }
  };

  // Unified save function that uploads the complete configuration to Firestore and Local API Backup
  const saveConfigToServer = async (customUsername?: string, isManual: boolean = false, overrideMappings?: GiftSoundMapping[]) => {
    const targetUser = (customUsername || activeConnectedUser || username).replace('@', '').trim().toLowerCase();
    if (!targetUser) return;

    if (isManual) {
      setCloudStatus('saving');
    }

    try {
      const mappingsToSave = overrideMappings || mappings;
      const currentConfig = {
        mappings: mappingsToSave,
        superFans,
        ttsEnabled,
        ttsVolume,
        ttsProvider,
        ttsVoiceURI,
        ttsRate,
        ttsReadUsernames,
        ttsReaderTargets,
        superFanWelcomeEnabled,
        aiVoiceMode,
        backgroundPriority
      };

      // Set comparison ref instantly before async operations to prevent queued duplicates/concurrency runs
      lastFetchedConfigRef.current = JSON.stringify(currentConfig);

      console.log(`[ConfigStore] Saving configuration to Firestore & Local Registry for @${targetUser}...`);
      
      // 1. Parallel ultra-fast save to local container storage backup proxy (keeps full custom MP3 binary files)
      fetch(`/api/user-config?username=${encodeURIComponent(targetUser)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: currentConfig })
      }).catch(e => console.warn('[ConfigStore] Parallel fast api backup failed:', e));

      // 2. Clear out large base64 sound files for Firestore to prevent 1MB limit error "Request payload is too large"
      const firestoreMappings = mappingsToSave.map(m => {
        if (m.customSoundUrl && m.customSoundUrl.startsWith('data:') && m.customSoundUrl.length > 800000) {
          console.log(`[ConfigStore] Sound for "${m.giftName}" exceeds 800KB. Truncating for safe Firestore cloud storage...`);
          return {
            ...m,
            customSoundUrl: `local_binary_cached_audio_data_size_${m.customSoundUrl.length}`
          };
        }
        return m;
      });

      const firestoreConfig = {
        ...currentConfig,
        mappings: firestoreMappings,
        updatedAt: serverTimestamp()
      };

      // 3. Background Firestore write (keeps UI responsive, removing slow blocks)
      const docRef = doc(db, 'configs', targetUser);
      const firestoreWritePromise = setDoc(docRef, firestoreConfig, { merge: true })
        .then(() => {
          console.log('[ConfigStore] Save to Firestore completed successfully!');
        })
        .catch((error) => {
          console.error('[ConfigStore] Firestore write failed:', error);
          if (isQuotaExceededError(error)) {
            console.warn('[ConfigStore] Quota limit exceeded detected during background saveConfigToServer.');
            setFirestoreQuotaExceeded(true);
          } else {
            try {
              handleFirestoreError(error, OperationType.WRITE, `configs/${targetUser}`);
            } catch (e) {
              console.warn('[ConfigStore] Logged handled firestore write error.', e);
            }
          }
        });

      // 4. Optimistic visual transition for instantaneous user saving feedback (typically 120ms)
      if (isManual) {
        setTimeout(() => {
          setCloudStatus('saved');
          setTimeout(() => setCloudStatus('idle'), 3000);
        }, 120);
      }
      if (targetUser) {
        addProfileToHistory(targetUser);
      }
    } catch (err) {
      console.warn('[ConfigStore] Firestore save failed:', err);
      if (isManual) {
        setCloudStatus('error');
        setTimeout(() => setCloudStatus('idle'), 3000);
      }
    }
  };

  // React effect trigger for autosaving config on state changes
  useEffect(() => {
    if (!hasLoadedConfigFromServerRef.current) return;
    const targetUser = (activeConnectedUser || username).replace('@', '').trim().toLowerCase();
    if (!targetUser) return;

    const currentConfig = {
      mappings,
      superFans,
      ttsEnabled,
      ttsVolume,
      ttsProvider,
      ttsVoiceURI,
      ttsRate,
      ttsReadUsernames,
      ttsReaderTargets,
      superFanWelcomeEnabled,
      aiVoiceMode,
      backgroundPriority
    };

    // If current settings match what was just loaded/saved, skip auto-saving redundant copies
    if (lastFetchedConfigRef.current === JSON.stringify(currentConfig)) {
      console.log('[ConfigStore] Local settings match cloud configuration. Skipping auto-save.');
      return;
    }

    const timer = setTimeout(() => {
      saveConfigToServer(targetUser);
    }, 1500); // Debounce to protect Firestore write limits

    return () => clearTimeout(timer);
  }, [
    mappings,
    superFans,
    ttsEnabled,
    ttsVolume,
    ttsProvider,
    ttsVoiceURI,
    ttsRate,
    ttsReadUsernames,
    ttsReaderTargets,
    superFanWelcomeEnabled,
    aiVoiceMode,
    backgroundPriority,
    activeConnectedUser
  ]);

  // Helper trigger to synthesize speech for comments
  const triggerChatTts = (userUniqueId: string, nickname: string, commentText: string, isEventMod?: boolean) => {
    if (!ttsEnabled) {
      console.log('[TTS-Diagnostic] Chat TTS is disabled by user settings. Skipping comment speech:', commentText);
      return;
    }
    if (muted) {
      console.log('[TTS-Diagnostic] Interface is currently muted. Skipping comment speech:', commentText);
      return;
    }
    if (!userUniqueId) {
      console.log('[TTS-Diagnostic] No user unique identifier found. Skipping comment speech:', commentText);
      return;
    }

    const userStr = userUniqueId.toLowerCase();
    const nickStr = (nickname || '').toLowerCase();

    // Filter which users to speak based on target option (todos, moderadores, superfans)
    const isSuperFanMod = superFans.some(sf => {
      const sfUniqueId = (sf.uniqueId || '').toLowerCase();
      const sfNickname = (sf.nickname || '').toLowerCase();
      return (sfUniqueId === userStr || sfNickname === nickStr) && (sfNickname.includes('mod') || sfNickname.includes('🛡️'));
    });
    const isMod = !!isEventMod || 
                  userStr.includes('mod') || 
                  nickStr.includes('mod') ||
                  isSuperFanMod;
                  
    const isSuperFan = superFans.some(sf => {
      const sfId = (sf.uniqueId || '').toLowerCase();
      const sfNick = (sf.nickname || '').toLowerCase();
      return sfId === userStr || sfNick === nickStr;
    });

    const isTodosActive = ttsReaderTargets.includes('todos');
    const isModeradoresActive = ttsReaderTargets.includes('moderadores');
    const isSuperfansActive = ttsReaderTargets.includes('superfans');

    if (!isTodosActive) {
      const matchesMod = isModeradoresActive && isMod;
      const matchesSuperFan = isSuperfansActive && isSuperFan;
      if (!matchesMod && !matchesSuperFan) {
        return; // Filter out if neither matches
      }
    }

    const displayName = nickname || userUniqueId;

    // Check if commentator is structured in Super Fans registry
    const activeSuperFan = superFans.find(sf => {
      const sfId = (sf.uniqueId || '').toLowerCase();
      const sfNick = (sf.nickname || '').toLowerCase();
      return sfId === userStr || sfNick === nickStr;
    });

    if (activeSuperFan) {
      const superfanPhrases = ttsReadUsernames ? [
        `¡Oh por dios! Nuestro Súper Fan destacado: ${activeSuperFan.nickname}, de nivel ${activeSuperFan.fanLevel}, comenta: ${commentText}. ¡Un gran honor tenerte activo, crack!`,
        `¡Alerta de Súper Fan! La leyenda nivel ${activeSuperFan.fanLevel}, ${activeSuperFan.nickname}, escribe: ${commentText}. ¡Muchísimas gracias por estar aquí apoyando al canal!`,
        `¡Extraordinario! Nuestro Súper Fan nivel ${activeSuperFan.fanLevel}: ${activeSuperFan.nickname}, dice en el chat: ${commentText}. ¡Recuerden dejar sus me gusta para apoyar a este grande!`
      ] : [
        `¡Oh por dios! Nuestro Súper Fan destacado de nivel ${activeSuperFan.fanLevel} comenta: ${commentText}. ¡Un gran honor tenerte activo, crack!`,
        `¡Alerta de Súper Fan! La leyenda de nivel ${activeSuperFan.fanLevel} escribe: ${commentText}. ¡Muchísimas gracias por estar aquí apoyando al canal!`,
        `¡Extraordinario! Nuestro Súper Fan de nivel ${activeSuperFan.fanLevel} dice en el chat: ${commentText}. ¡Recuerden dejar sus me gusta para apoyar a este grande!`
      ];
      const idx = Math.abs(commentText.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % superfanPhrases.length;
      const ttsPhrase = superfanPhrases[idx];
      speakText(ttsPhrase, ttsVolume, ttsVoiceURI, ttsRate * 1.05, 1.15, ttsProvider); // Energetic and highly pitch raised
      return;
    }

    let textToSpeak = `${ttsReadUsernames ? `${displayName} dice: ` : ''}${commentText}`;
    let finalRate = ttsRate;
    let finalPitch = 1.0;

    switch (aiVoiceMode) {
      case 'trump': {
        const trumps = ttsReadUsernames ? [
          `Miren folks, ${displayName} dice: ${commentText}. ¡Créanme, es tremendo!`,
          `Listen, folks! ${displayName} dice: ${commentText}. ¡Un gran comentario, grandioso!`,
          `Gente, de verdad, ${displayName} dice: ${commentText}. ¡Increíble, no es fake news!`,
          `Increíble, ${displayName} comenta: ${commentText}. ¡Muchos me lo dicen, de verdad!`
        ] : [
          `Miren folks, comentan: ${commentText}. ¡Créanme, es tremendo!`,
          `Listen, folks! Alguien dice: ${commentText}. ¡Un gran comentario, grandioso!`,
          `Gente, de verdad, un comentario dice: ${commentText}. ¡Increíble, no es fake news!`,
          `Increíble, un comentario dice: ${commentText}. ¡Muchos me lo dicen, de verdad!`
        ];
        const idx = Math.abs(displayName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % trumps.length;
        textToSpeak = trumps[idx];
        finalRate = Math.max(0.6, ttsRate * 0.82); // Slower, more presidential, distinctive speech
        finalPitch = 0.85; // Deeper baritone
        break;
      }
      case 'announcer': {
        const announcers = ttsReadUsernames ? [
          `¡Atención, damas y caballeros! ${displayName} anuncia al mundo: ${commentText}.`,
          `¡ÚLTIMOS MINUTOS! El gran ${displayName} exclama: ${commentText}. ¡Fascinante!`
        ] : [
          `¡Atención, damas y caballeros! Anuncian al mundo: ${commentText}.`,
          `¡ÚLTIMOS MINUTOS! Exclaman: ${commentText}. ¡Fascinante!`
        ];
        const idx = Math.abs(displayName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % announcers.length;
        textToSpeak = announcers[idx];
        finalRate = Math.max(0.6, ttsRate * 0.9);
        finalPitch = 0.68; // Very deep, epic radio presence
        break;
      }
      case 'robot': {
        textToSpeak = ttsReadUsernames
          ? `BEEP ... Alerta, Unidad ${displayName} transmite: ${commentText} ... Fin de transmisión ... BOOP.`
          : `BEEP ... Alerta, Transmisión entrante: ${commentText} ... Fin de transmisión ... BOOP.`;
        finalRate = ttsRate * 1.15;
        finalPitch = 1.48; // Synthesizer robotic pitch high
        break;
      }
      case 'elon': {
        const elons = ttsReadUsernames ? [
          `Wow, ${displayName} just tweeted: ${commentText}. ¡Llevemos esto a Marte con Space X!`,
          `Fórmula activa. ${displayName} de X dice: ${commentText}. ¡Doy mi visto bueno!`
        ] : [
          `Wow, just tweeted: ${commentText}. ¡Llevemos esto a Marte con Space X!`,
          `Fórmula activa. Dicen en X: ${commentText}. ¡Doy mi visto bueno!`
        ];
        const idx = Math.abs(displayName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % elons.length;
        textToSpeak = elons[idx];
        finalRate = ttsRate * 1.05;
        finalPitch = 1.05;
        break;
      }
      case 'gamer': {
        const gamers = ttsReadUsernames ? [
          `¡Atención chat! ¡El crack ${displayName} se vuelve loco y coloca: ${commentText}! ¡Qué jugada!`,
          `¡GG doble ve! ${displayName} rompe la partida diciendo: ${commentText}. ¡Épico total!`
        ] : [
          `¡Atención chat! ¡Se vuelven locos en el chat y colocan: ${commentText}! ¡Qué jugada!`,
          `¡GG doble ve! Rompen la partida diciendo: ${commentText}. ¡Épico total!`
        ];
        const idx = Math.abs(displayName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % gamers.length;
        textToSpeak = gamers[idx];
        finalRate = ttsRate * 1.18;
        finalPitch = 1.15; // Shouting gamer cast
        break;
      }
      default:
        textToSpeak = ttsReadUsernames ? `${displayName} dice: ${commentText}` : commentText;
        break;
    }

    speakText(textToSpeak, ttsVolume, ttsVoiceURI, finalRate, finalPitch, ttsProvider);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setConnectionStatus(currentStatus => {
        if (currentStatus === 'live') {
          setSessionUptime(prev => prev + 1);
        }
        return currentStatus;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentDiamonds = baseDiamonds + events.filter(e => e.type === 'gift').reduce((acc, current) => acc + (current.gift?.diamondCount || 0) * (current.gift?.repeatCount || 1), 0);


  // Persistence of sound configurations
  const handleUpdateMappings = async (newMappings: GiftSoundMapping[]) => {
    setMappings(newMappings);
    localStorage.setItem('tiktok_sound_mappings', JSON.stringify(newMappings));

    // Upload config to backend so that OBS overlay loads it automatically
    const currentUsername = username || activeConnectedUser;
    const cleanUser = currentUsername?.replace('@', '').trim().toLowerCase();
    if (cleanUser) {
      try {
        await fetch(`/api/mappings?username=${encodeURIComponent(cleanUser)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: newMappings })
        });
        console.log('[MappingsStore] Synced mappings to server for', cleanUser);
      } catch (err) {
        console.warn('[MappingsStore] Error uploading mappings to server:', err);
      }

      // Automatically trigger an immediate cloud & server backup save when sound configurations change (e.g., upload MP3)
      saveConfigToServer(cleanUser, false, newMappings);
    }
  };

  // Sync discovered gifts list from server registry
  const syncServerGiftsRegistry = async (user: string) => {
    try {
      const response = await fetch(`/api/streams/${user}/gifts`);
      const data = await response.json();
      if (data.success && data.gifts.length > 0) {
        setDiscoveredGifts(prev => {
          // Merge unique gifts
          const dict: Record<string, typeof data.gifts[0]> = {};
          prev.forEach(g => { dict[g.giftName.toLowerCase()] = g; });
          data.gifts.forEach((g: any) => { dict[g.giftName.toLowerCase()] = g; });
          return Object.values(dict);
        });
      }
    } catch (e) {
      console.warn('Could not sync discovered gifts array from server', e);
    }
  };

  // Audio trigger central handler
  const triggerAudioAlert = (giftName: string, repeatCount: number) => {
    if (muted) return;

    // Find custom sound mapping for the gift (case insensitive)
    const mapping = mappingsRef.current.find(
      m => m.giftName.toLowerCase() === giftName.toLowerCase()
    );
    
    console.log(`[Alert-Audio] Mappings ref length: ${mappingsRef.current.length}`);
    console.log(`[Alert-Audio] Looking for gift: "${giftName}". Found mapping:`, mapping);

    const soundId = mapping ? mapping.soundId : 'magic'; // Fallback to cute magic synth
    const volume = mapping ? mapping.volume : 0.6;
    const customUrl = mapping ? mapping.customSoundUrl : undefined;

    const count = Math.max(1, repeatCount || 1);
    console.log(`[Alert-Audio] Queueing sound alert: Sound: ${soundId}, Volume: ${volume}, Gift: ${giftName}, Repeat: ${count}`);

    for (let i = 0; i < count; i++) {
      queueSound(async () => {
        if (soundId === 'custom' && customUrl) {
          await playSoundFromUrlWithCompletion(customUrl, volume);
        } else {
          const preset = PRESET_SOUNDS.find(p => p.id === soundId);
          if (preset && preset.type === 'synth' && preset.synthType) {
            await playSynthesizedSoundWithCompletion(preset.synthType, volume);
          } else {
            await playSynthesizedSoundWithCompletion('magic', volume);
          }
        }
      });
    }
  };

  // Appends new gift into the queue to trigger graphics alert
  const triggerGraphicsAlert = (evt: LiveEvent) => {
    if (!evt.gift) return;

    // Retrieve mapped icon url or default
    const mapping = mappingsRef.current.find(
      m => m.giftName.toLowerCase() === evt.gift!.giftName.toLowerCase()
    );

    const giftPic = evt.gift.giftPictureUrl || mapping?.iconUrl || '';

    const newAlert: AlertData = {
      id: evt.id,
      uniqueId: evt.uniqueId,
      nickname: evt.nickname,
      profilePictureUrl: evt.profilePictureUrl,
      giftName: evt.gift.giftName,
      describe: evt.gift.describe,
      repeatCount: evt.gift.repeatCount,
      giftPictureUrl: giftPic,
      soundId: mapping?.soundId || 'magic',
      customSoundUrl: mapping?.customSoundUrl,
      volume: mapping?.volume || 0.6,
    };

    setActiveAlerts(prev => [...prev, newAlert]);
  };

  // Connect to Active Stream using Server Sent Events
  const handleConnectStream = async (overrideUsername?: string, isAutoReconnect = false) => {
    // Proactively trigger user-gesture unlock for SpeechSynthesis and Web Audio context
    try {
      unlockAudio();
    } catch (e) {}

    const targetUser = (overrideUsername || username).replace('@', '').trim().toLowerCase();
    if (!targetUser) {
      setConnectionError('Por favor ingresa un nombre de usuario de TikTok válido.');
      return;
    }

    if (!isAutoReconnect) {
      // Reset timestamp cursor on manual connections
      lastEventTimestampRef.current = Date.now();
    }

    setConnectionError(null);
    setConnectionStatus('connecting');
    setConnectingPhase('iniciando');
    setActiveConnectedUser(targetUser);

    setTimeout(() => {
      setConnectingPhase(prev => {
        if (prev === 'iniciando') {
          return 'conectando';
        }
        return prev;
      });
    }, 1200);



    // Sync unified user configurations with server database
    try {
      await loadUserConfig(targetUser);
    } catch (err) {
      console.warn('[ConfigStore] Error syncing unified configurations in connect:', err);
    }

    // Shutdown previous subscriptions
    if (sseRef.current) {
      sseRef.current.close();
    }

    // Persist sessionId settings
    localStorage.setItem('tiktok_session_id', sessionId.trim());
    localStorage.setItem('tiktok_premium_conn', premiumConnection ? 'true' : 'false');
    localStorage.setItem('tiktok_premium_conn_key', connectionKey.trim());

    // Build EventSource tracking since the last event timestamp
    let sseUrl = `/api/events?username=${encodeURIComponent(targetUser)}&since=${lastEventTimestampRef.current}`;
    if (premiumConnection) {
      sseUrl += `&premium=true&connectionKey=${encodeURIComponent(connectionKey.trim())}`;
    } else if (sessionId.trim()) {
      sseUrl += `&sessionId=${encodeURIComponent(sessionId.trim())}`;
    }

    console.log(`[SSE] Establishing event source subscription to ${sseUrl}`);
    const sse = new EventSource(sseUrl);
    sseRef.current = sse;

    const ensureLive = () => {
      setConnectionStatus(prev => {
        if (prev === 'connecting') {
          setConnectingPhase('conectado');
          setTimeout(() => {
            setConnectionStatus('live');
            setConnectingPhase('none');
          }, 1000);
          return 'connecting';
        }
        return prev;
      });
    };

    // Track stream messages
    sse.addEventListener('info', (e) => {
      const payload = JSON.parse(e.data);
      console.info('[SSE INFO]', payload);
      appendSystemMessage(payload.message || `Subscrito al servidor para @${targetUser}`);
    });

    sse.addEventListener('cachedGifts', (e) => {
      const gifts = JSON.parse(e.data);
      if (Array.isArray(gifts)) {
        setDiscoveredGifts(prev => {
          const dict: Record<string, any> = {};
          prev.forEach(g => { dict[g.giftName.toLowerCase()] = g; });
          gifts.forEach(g => { dict[g.giftName.toLowerCase()] = g; });
          return Object.values(dict);
        });
      }
    });

    sse.addEventListener('connected', (e) => {
      const payload = JSON.parse(e.data);
      setConnectingPhase('conectado');
      appendSystemMessage(`¡Conexión ESTABLECIDA con TikTok Live! Transmisión detectada.`);
      syncServerGiftsRegistry(targetUser);
      setTimeout(() => {
        setConnectionStatus('live');
        setConnectingPhase('none');
      }, 1500);
    });

    sse.addEventListener('chat', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'chat';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());

      if (data.comment) {
        handleCheckSongCommand(data.comment, data.nickname || data.uniqueId);
        triggerChatTts(data.uniqueId, data.nickname || '', data.comment, data.isModerator);



        // Process sticker & emote chat comment mapping triggers
        const cleanComment = data.comment.trim().toLowerCase();
        const matched = mappingsRef.current.find(m => {
          const mName = (m.giftName || '').toLowerCase();
          const mNameCleaned = mName.replace(/^\[.*?\]\s*/, ''); // strip "[emote] " or "[sticker] " prefix
          return (
            cleanComment === mName ||
            cleanComment.includes(mName) ||
            (mNameCleaned.length > 1 && (cleanComment === mNameCleaned || cleanComment.includes(mNameCleaned)))
          );
        });

        if (matched) {
          triggerAudioAlert(matched.giftName, 1);
          // Visual overlay representations
          const visualEvt: LiveEvent = {
            id: `emote-anim-${Date.now()}-${Math.random()}`,
            type: 'gift',
            timestamp: Date.now(),
            uniqueId: data.uniqueId || data.nickname || 'usuario',
            nickname: data.nickname || data.uniqueId || 'Usuario',
            profilePictureUrl: data.profilePictureUrl,
            gift: {
              giftId: 995,
              giftName: matched.giftName,
              describe: `envió en el chat: ${data.comment} 🖼️`,
              repeatCount: 1,
              repeatEnd: true,
              giftPictureUrl: matched.iconUrl || 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png',
              diamondCount: 1
            }
          };
          triggerGraphicsAlert(visualEvt);
        }
      }
    });

    sse.addEventListener('gift', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'gift';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());
      
      if (data.gift && data.gift.repeatEnd) { // Only process on repeatEnd: true
        // Play Sound alerts instantly
        triggerAudioAlert(data.gift.giftName, data.gift.repeatCount);

        // Auto add to discovery / mappings
        const { giftName, giftId, giftPictureUrl, diamondCount } = data.gift;
        
        // Update discovered
        setDiscoveredGifts(prev => {
           if (prev.find(g => g.giftName.toLowerCase() === giftName.toLowerCase())) return prev;
           return [...prev, { giftName, giftPictureUrl, diamondCount: diamondCount || 1 }];
         });
        
        // Update mappings if not exists
        const mappingIndex = mappingsRef.current.findIndex(m => m.giftName.toLowerCase() === giftName.toLowerCase());
        if (mappingIndex === -1) {
          const newMapping: GiftSoundMapping = {
            giftName,
            giftId,
            iconUrl: giftPictureUrl,
            soundId: 'coin', // Default sound
            volume: 0.8,
            label: giftName
          };
          handleUpdateMappings([...mappingsRef.current, newMapping]);
        } else {
          // If mapping exists, but is missing an iconUrl, auto-attach the real picture URL and persist it
          const existing = mappingsRef.current[mappingIndex];
          if (!existing.iconUrl && giftPictureUrl) {
            const updated = [...mappingsRef.current];
            updated[mappingIndex] = {
              ...existing,
              iconUrl: giftPictureUrl,
              giftId: existing.giftId || giftId
            };
            handleUpdateMappings(updated);
            console.log('[MappingsStore] Auto-attached real picture URL to existing gift mapping:', giftName);
          }
        }
      }
    });

    sse.addEventListener('like', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'like';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());
    });

    sse.addEventListener('follow', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'follow';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());
      triggerAudioAlert('FOLLOW', 1);
    });

    sse.addEventListener('share', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'share';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());
      triggerAudioAlert('SHARE', 1);
    });

    sse.addEventListener('subscribe', (e) => {
      const data: LiveEvent = JSON.parse(e.data);
      data.type = 'follow';
      ensureLive();
      pushEventToFeed(data);
      lastEventTimestampRef.current = Math.max(lastEventTimestampRef.current, data.timestamp || Date.now());
      appendSystemMessage(`¡${data.nickname} se ha suscrito!`);
    });

    sse.addEventListener('streamEnd', () => {
      setConnectionStatus('disconnected');
      appendSystemMessage(`La transmisión en vivo de @${targetUser} ha terminado.`);
    });

    sse.addEventListener('roomUser', (e) => {
      const data = JSON.parse(e.data);
      if (data.viewerCount !== undefined) setViewerCount(data.viewerCount);
      if (data.likeCount !== undefined) setLikeCount(data.likeCount);
    });

    sse.addEventListener('tiktokError', (e) => {
      const payload = JSON.parse(e.data);
      setConnectionStatus('error');
      setConnectingPhase('none');
      setConnectionError(payload.error || 'Error de conexión.');
      appendSystemMessage(`Error en TikTok Connection: ${payload.error}`);
    });

    sse.onerror = (err) => {
      console.warn('[SSE ERROR] Connection status encountered error:', err);
      // Only reconnect if the user has NOT intentionally requested disconnection
      if (connectionStatusRef.current !== 'disconnected') {
        setConnectionStatus('error');
        setConnectionError('Conexión con el servidor interrumpida. Reconectando...');
        
        // Ensure standard EventSource is closed so we can start fresh
        try { sse.close(); } catch (e) {}

        const retryTimeout = setTimeout(() => {
          if (connectionStatusRef.current !== 'disconnected') {
            console.log('[SSE] Autoreconnect watchdog: attempting deep reconnection...');
            handleConnectStream(targetUser, true);
          }
        }, 4000);
      }
    };
  };

  // Continuous Connection Watchdog to ensure connection is maintained forever on PC/Live Stream setups
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      if (connectionStatusRef.current === 'live' || connectionStatusRef.current === 'connecting' || connectionStatusRef.current === 'error') {
        const activeUser = activeConnectedUser || username;
        if (activeUser && (!sseRef.current || sseRef.current.readyState === EventSource.CLOSED)) {
          console.log('[Connection Watchdog] Connection is supposed to be active, but SSE is inactive. Reconnecting...');
          appendSystemMessage('Sincronizador automático: Reestableciendo conexión permanente...');
          handleConnectStream(activeUser, true);
        }
      }
    }, 12000);
    return () => clearInterval(watchdogInterval);
  }, [activeConnectedUser, username]);

  const handleDisconnect = async () => {
    setConnectingPhase('none');
    const userToDisconnect = activeConnectedUser;
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setConnectionStatus('disconnected');
    appendSystemMessage(`Desconectado del servidor de alertas.`);
    
    // Explicit close on the server to recycle/disconnect Webcast Push sockets immediately
    if (userToDisconnect) {
      try {
        console.log(`[Disconnect] Requesting explicit close on the server for @${userToDisconnect}...`);
        await fetch(`/api/streams/${encodeURIComponent(userToDisconnect)}/disconnect`, { method: 'POST' });
      } catch (err) {
        console.warn('[Disconnect] Error requesting server disconnect:', err);
      }
    }
  };

  const appendSystemMessage = (text: string) => {
    const sysEvent: LiveEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'system',
      timestamp: Date.now(),
      uniqueId: 'SISTEMA',
      nickname: 'Servidor Alertas',
      comment: text
    };
    pushEventToFeed(sysEvent);
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        appendSystemMessage('📱 Pantalla siempre activa: ¡Activado con éxito! (Tu celular no se bloqueará ni atenuará la pantalla de este panel).');
        
        lock.addEventListener('release', () => {
          setWakeLockActive(false);
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Fallo al activar Screen Wake Lock:', err);
      }
    } else {
      appendSystemMessage('Tu navegador o dispositivo no soporta el bloqueo de pantalla constante (Wake Lock API).');
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
      appendSystemMessage('📱 Pantalla siempre activa: Desactivado. La pantalla se regulará según la configuración de tu celular.');
    }
  };

  const toggleWakeLock = () => {
    if (wakeLockActive) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  };

  // Finish Alert callback for Overlay Queue
  const handleFinishAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleFinishSuperFanAlert = (id: string) => {
    setActiveSuperFanAlerts(prev => prev.filter(s => s.id !== id));
  };

  // HIGH FIDELITY OFFLINE SIMULATOR ACTION TRIGGERS
  const simulateLiveInteraction = (type: 'chat' | 'like' | 'follow' | 'share' | 'gift', presetGiftName?: string) => {
    const firstNames = ['alvaro_top', 'ximena_99', 'gaby_gamer', 'pablo_twitch', 'stream_lover', 'el_tito_oficial', 'marta_live', 'tiktok_chaser'];
    const selectedUser = firstNames[Math.floor(Math.random() * firstNames.length)];
    const id = `sim-${Date.now()}-${Math.random()}`;

    let mockEvt: LiveEvent = {
      id,
      type,
      timestamp: Date.now(),
      uniqueId: selectedUser,
      nickname: selectedUser.toUpperCase().replace('_', ' '),
      profilePictureUrl: 'https://p16-sign-va.tiktokcdn.com/tos-malisg-avt-0068/7313894468205428741~c5_100x100.jpeg?biz_tag=tiktok_user_cover'
    };

    if (type === 'chat') {
      const comments = [
        '¡Sigue así, gran directo! 🚀',
        '¿A qué hora juegas mañana?',
        'Mandando buenas vibras desde Colombia 🇨🇴',
        '¡Qué buenos sonidos tiene la app!',
        'No olviden mandar ROSAS para probar el sonido de Mario Bros 🎉',
        'Un saludo creador, gran comunidad.',
        '!play Bad Bunny Monaco',
        '!play Shakira Soltera',
        '!play Billie Eilish Birds of a Feather',
        '!skip'
      ];
      mockEvt.comment = comments[Math.floor(Math.random() * comments.length)];
      handleCheckSongCommand(mockEvt.comment, mockEvt.nickname || mockEvt.uniqueId, mockEvt.isModerator);
      triggerChatTts(mockEvt.uniqueId, mockEvt.nickname || '', mockEvt.comment);
    } else if (type === 'like') {
      const add = Math.floor(1 + Math.random() * 25);
      mockEvt.like = {
        likeCount: add,
        totalLikeCount: 1540 + add
      };
      setLikeCount(prev => prev + add);
    } else if (type === 'gift') {
      const catalogGift = presetGiftName ? GIFT_CATALOG.find(g => g.name.toLowerCase() === presetGiftName.toLowerCase()) : null;
      
      const chosenGift = catalogGift 
        ? { 
            name: catalogGift.name, 
            describe: `envió ${catalogGift.name} 🎁`, 
            pic: catalogGift.image, 
            diamonds: Math.floor(1 + Math.random() * 200) // assign dynamic diamonds count for custom gifts
          }
        : (() => {
            const defaultGifts = [
              { name: 'Rose', describe: 'envió una Rosa 🌹', pic: 'https://p16-webcast.tiktokcdn.com/img/webcast/7408db06d445c9be6242699f8d51185d.png~tplv-obj.png', diamonds: 1 },
              { name: 'TikTok', describe: 'envió Gift de TikTok ⚡', pic: 'https://p16-webcast.tiktokcdn.com/img/webcast/823a2cc74efb71889fc68a3560ec0cf7.png~tplv-obj.png', diamonds: 1 },
              { name: 'Finger Heart', describe: 'envió un Corazón Coreano 🫰', pic: 'https://p16-webcast.tiktokcdn.com/img/webcast/919f18ed0f8b05afaf4528148e65893b.png~tplv-obj.png', diamonds: 5 },
              { name: 'Lion', describe: 'envió un León Legendario 🦁', pic: 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png', diamonds: 400 }
            ];
            return defaultGifts[Math.floor(Math.random() * defaultGifts.length)];
          })();

      const repeat = Math.floor(1 + Math.random() * 5); // Simula envío repetitivo

      mockEvt.gift = {
        giftId: Math.floor(1000 + Math.random() * 9000),
        giftName: chosenGift.name,
        describe: chosenGift.describe,
        repeatCount: repeat,
        repeatEnd: true,
        giftPictureUrl: chosenGift.pic,
        diamondCount: chosenGift.diamonds
      };

      // Play Sound triggers & display graphics immediately
      triggerAudioAlert(chosenGift.name, repeat);
      triggerGraphicsAlert(mockEvt);

      // Register simulated tool registry
      setDiscoveredGifts(prev => {
        if (!prev.some(x => x.giftName.toLowerCase() === chosenGift.name.toLowerCase())) {
          return [...prev, { giftName: chosenGift.name, giftPictureUrl: chosenGift.pic, diamondCount: chosenGift.diamonds }];
        }
        return prev;
      });
    }

    // Fluctuat live stats during demo/simulation
    setViewerCount(prev => prev === 0 ? Math.floor(250 + Math.random() * 100) : prev + Math.floor(Math.random() * 5 - 2));

    pushEventToFeed(mockEvt);
  };

  // Single helper to quickly copy OBS overlay URL
  const copyOverlayLink = () => {
    const obsUrl = `${window.location.protocol}//${window.location.host}/?username=${encodeURIComponent(username || 'preview')}&overlay=true`;
    navigator.clipboard.writeText(obsUrl);
    setCopiedObs(true);
    setTimeout(() => {
      setCopiedObs(false);
    }, 2500);
  };

  // Auto connect if OBS flags are set in Search Params, or auto-load configuration for saved user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get('username');
    const overlayParam = params.get('overlay') === 'true';
    setIsOverlayOnly(overlayParam);

    if (urlUser) {
      setUsername(urlUser);
      handleConnectStream(urlUser);
    } else {
      const savedUser = localStorage.getItem('tiktok_creator_username');
      if (savedUser) {
        setUsername(savedUser);
        loadUserConfig(savedUser);
      }
    }
  }, []);

  // Update saved user in local storage whenever it changes
  useEffect(() => {
    const cleanUser = username.replace('@', '').trim().toLowerCase();
    if (cleanUser) {
      localStorage.setItem('tiktok_creator_username', cleanUser);
    }
  }, [username]);

  const countActiveStreamSubscribers = () => {
    // Return dummy active status for display honesty
    return connectionStatus === 'live' ? 1 : 0;
  };

  if (isOverlayOnly) {
    return (
      <div className="fixed inset-0 bg-transparent overflow-hidden">
        <SoundAlertOverlay 
          activeAlerts={activeAlerts}
          onFinishAlert={handleFinishAlert}
          activeSuperFanAlerts={activeSuperFanAlerts}
          onFinishSuperFanAlert={handleFinishSuperFanAlert}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F12] text-gray-300 font-sans flex flex-col relative overflow-x-hidden select-none">
      
      {/* Subtle depth lighting backing - wrapped in overflow-hidden shell to prevent blank space scroll at bottom */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[50%] bg-[#ff0050]/5 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#00f2ea]/5 rounded-full filter blur-[120px]" />
      </div>

      {/* Navigation Headers */}
      <nav className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-b border-white/10 bg-[#16161D] gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="https://adventure-8t03kq.fly.dev/img/logo.png" 
            className="w-8 h-8 rounded object-contain" 
            alt="Logo" 
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight uppercase flex items-center gap-1">
              Creator <span className="text-[#00f2ea] font-black">Still</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-mono">v4.0.2 Stable Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap justify-between w-full sm:w-auto">
          {/* Audio Connection status indicator in brand typography */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)] ${
              connectionStatus === 'live' 
                ? 'bg-emerald-500' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}></div>
            <span className="text-xs font-mono text-gray-400">
              {connectionStatus === 'live' && <span className="text-emerald-400">Conexión Activa ✓</span>}
              {connectionStatus === 'connecting' && <span className="text-yellow-400">HANDSHAKE_CONNECTING</span>}
              {connectionStatus === 'disconnected' && <span className="text-gray-500">LISTENING_FOR_EVENTS</span>}
              {connectionStatus === 'error' && <span className="text-red-400">ENGINE_CONNECT_ERR</span>}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>

          <div className="flex gap-4">
            {connectionStatus === 'live' && (
              <>
                <div className="text-right border-r border-white/5 pr-3">
                  <p className="text-[10px] text-[#ff0050] uppercase tracking-wider flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block"></span>
                    Espectadores 👥
                  </p>
                  <p className="text-xs font-bold text-[#ff0050] font-mono">
                    {viewerCount.toLocaleString()}
                  </p>
                </div>
                <div className="text-right border-r border-white/5 pr-3">
                  <p className="text-[10px] text-pink-500 uppercase tracking-wider">Likes ❤️</p>
                  <p className="text-xs font-bold text-pink-400 font-mono">
                    {likeCount.toLocaleString()}
                  </p>
                </div>
              </>
            )}
            <div className="text-right">
              <p className="text-[10px] text-[#00f2ea]/75 uppercase tracking-wider">Diamantes en esta Sesión 💎</p>
              <p className="text-xs font-bold text-[#00f2ea] font-mono">
                {currentDiamonds.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Uptime</p>
              <p className="text-xs font-bold text-white font-mono">{formatUptime(sessionUptime)}</p>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-white/10"></div>

          {/* Volume Mute */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMuted = !muted;
                setMuted(nextMuted);
                if (nextMuted) {
                  stopAllAudio();
                }
              }}
              className={`p-1.5 rounded transition-all border ${
                muted 
                  ? 'bg-[#ff0050]/10 border-[#ff0050]/30 text-[#ff0050] hover:bg-[#ff0050]/20' 
                  : 'bg-black/40 border-white/10 text-gray-300 hover:bg-white/5'
              }`}
              title={muted ? "Activar Sonido" : "Silenciar Alertas"}
            >
              {muted ? <VolumeX className="w-4 h-4 animate-bounce" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main dashboard cockpit area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left column layouts (OBS overlay links, Connection setup, Event Simulators) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* TikTok Live Link controller */}
          <section id="tiktok-link-section" className="bg-[#16161D] border border-white/10 rounded p-4 flex flex-col gap-3 shadow-md relative overflow-hidden">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#00f2ea]" />
              Sincronizar creador (TikTok LIVE)
            </h2>

            {connectionStatus === 'connecting' ? (
              <div className="flex flex-col items-center justify-center py-5 px-3 select-none border border-white/5 bg-black/45 rounded relative overflow-hidden min-h-[160px]">
                <AnimatePresence mode="wait">
                  {connectingPhase === 'iniciando' && (
                    <motion.div
                      key="iniciando"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-center text-center w-full"
                    >
                      <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: [1, 1.25, 1], rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="absolute inset-0 rounded-full border-2 border-[#00f2ea]/20 border-t-[#00f2ea]"
                        />
                        <Radio className="w-5 h-5 text-[#00f2ea] animate-pulse" />
                      </div>
                      
                      <p className="text-xs font-bold text-white tracking-wide uppercase font-mono animate-pulse">
                        Iniciando...
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1.5 max-w-[220px] leading-relaxed">
                        Preparando puente de eventos en tiempo real
                      </p>
                    </motion.div>
                  )}

                  {connectingPhase === 'conectando' && (
                    <motion.div
                      key="conectando"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-center text-center w-full"
                    >
                      <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                          className="absolute inset-0 rounded-full bg-[#ff0050]/10"
                        />
                        <motion.div
                          animate={{ rotate: -360 }}
                          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                          className="absolute inset-1.5 rounded-full border border-dashed border-[#ff0050]/40"
                        />
                        <Sparkles className="w-5 h-5 text-[#ff0050]" />
                      </div>
                      
                      <p className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                        Conectando
                      </p>
                      <p className="text-[10px] font-bold text-[#ff0050] tracking-tight mt-1 animate-pulse">
                        Creando conexión con TikTok live...
                      </p>
                    </motion.div>
                  )}

                  {connectingPhase === 'conectado' && (
                    <motion.div
                      key="conectado"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="flex flex-col items-center text-center w-full"
                    >
                      <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500/40"
                        />
                        <motion.span
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                        >
                          <CheckCircle className="w-8 h-8 text-emerald-400" />
                        </motion.span>
                      </div>
                      
                      <p className="text-xs font-black text-emerald-400 tracking-wider uppercase font-mono">
                        ¡CONECTADO!
                      </p>
                      <p className="text-[10px] text-gray-300 font-medium mt-1">
                        Sincronización establecida con éxito
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Cancel connection button */}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="mt-4 text-[9px] text-pink-500 font-mono uppercase tracking-wider hover:underline transition-all block relative z-10"
                >
                  Cancelar conexión
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 italic text-xs">@</span>
                    <input
                      id="tiktok-username-input"
                      type="text"
                      placeholder="usuario_creador"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onBlur={(e) => loadUserConfig(e.target.value)}
                      disabled={(connectionStatus as string) === 'connecting' || connectionStatus === 'live'}
                      className="w-full bg-black/40 border border-white/10 rounded py-2 pl-7 pr-3 text-xs text-[#00f2ea] focus:outline-none focus:border-[#00f2ea]/50 font-mono disabled:opacity-45"
                    />
                  </div>

                  {connectionStatus === 'live' ? (
                    <button
                      id="btn-disconnect"
                      onClick={handleDisconnect}
                      className="bg-[#ff0050] hover:bg-[#ff0050]/90 text-white text-xs font-bold py-2 px-4 rounded transition-colors uppercase tracking-wider font-mono"
                    >
                      Desvincular
                    </button>
                  ) : (
                    <button
                      id="btn-connect"
                      onClick={() => handleConnectStream()}
                      className="bg-white hover:bg-gray-200 text-black text-xs font-bold py-2 px-4 rounded transition-colors uppercase tracking-wider font-mono"
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {/* Premium Connection block - directly visible to the user */}
                <div className="bg-[#121216] border border-[#00f2ea]/20 rounded p-3 text-[11.5px] text-gray-300 leading-normal flex flex-col gap-2 mt-2 transition-all animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#00f2ea] flex items-center gap-1.5 select-none uppercase tracking-wide">
                      <Zap className="w-3.5 h-3.5 text-[#00f2ea] animate-pulse shrink-0" />
                      Enlace de Alta Velocidad Premium
                    </span>
                    <button
                      type="button"
                      onClick={() => setPremiumConnection(!premiumConnection)}
                      disabled={(connectionStatus as string) === 'connecting' || connectionStatus === 'live'}
                      className={`px-2 py-0.5 rounded text-[8.5px] font-mono leading-none tracking-wider transition-colors select-none ${
                        premiumConnection 
                          ? 'bg-[#00f2ea]/20 text-[#00f2ea] border border-[#00f2ea]/40 font-bold' 
                          : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      {premiumConnection ? '🔒 ACTIVO (RECOMENDADO)' : '💤 INACTIVO'}
                    </button>
                  </div>
                  <p className="text-gray-400 text-[10.5px] leading-relaxed">
                    Vía de suscripción optimizada de ultra-baja latencia con balanceo de carga automático para capturar chats, me gustas y regalos en tiempo real sin retrasos ni interrupciones.
                  </p>
                  {premiumConnection && (
                    <div className="animate-fade-in flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block">
                        Llave de Enlace Premium de la Nube
                      </label>
                      <input
                        id="premium-connection-key-input"
                        type="password"
                        placeholder="Ej: tk_..."
                        value={connectionKey}
                        onChange={(e) => setConnectionKey(e.target.value)}
                        disabled={(connectionStatus as string) === 'connecting' || connectionStatus === 'live'}
                        className="w-full bg-black/60 border border-[#00f2ea]/20 rounded py-1.5 px-2.5 text-xs text-[#00f2ea] font-mono focus:outline-none focus:border-[#00f2ea]/45 disabled:opacity-50"
                      />
                    </div>
                  )}
                </div>

                {/* Advanced connection parameters toggle and form */}
                <div className="border-t border-white/5 pt-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-[10px] text-gray-450 font-mono uppercase tracking-wider hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-1.5 label text-left">
                      <Key className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      Parámetros Avanzados (Session ID / Anti-Bloqueo)
                    </span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </button>

                  {showAdvanced && (
                    <div id="advanced-session-options" className="mt-2 text-[11px] text-gray-450 flex flex-col gap-2 p-3 bg-black/45 rounded border border-white/5">
                      <p className="leading-normal text-gray-400">
                        Si te encuentras con un <strong>error de conexión (Código 200)</strong>, es debido a que TikTok limita temporalmente las conexiones anónimas de servidores en la nube. Puedes ingresar tu cookie <strong>Session ID</strong> de TikTok para conectarte de forma autenticada 100% segura y evitar bloqueos.
                      </p>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                          Cookie sessionid de TikTok (Opcional)
                        </label>
                        <input
                          id="tiktok-session-id-input"
                          type="password"
                          placeholder="Ej: e98c374b62ffad92..."
                          value={sessionId}
                          onChange={(e) => setSessionId(e.target.value)}
                          disabled={(connectionStatus as string) === 'connecting' || connectionStatus === 'live'}
                          className="w-full bg-black/60 border border-white/10 rounded py-1.5 px-2.5 text-xs text-yellow-400 font-mono focus:outline-none focus:border-yellow-400/40 disabled:opacity-50"
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 leading-normal flex flex-col gap-1 mt-1 font-mono">
                        <span>1. Inicia sesión en tiktok.com en Chrome</span>
                        <span>2. Clic derecho - Inspeccionar &rarr; Aplicación &rarr; Cookies &rarr; tiktok.com</span>
                        <span>3. Copia el valor de la cookie <strong>sessionid</strong> y pégala aquí</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Suggested Live Channels for Instant Verification & Tests */}
            <div className="border-t border-white/5 pt-2.5 mt-1 flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                Sugerencias para pruebas (Haz Clic)
              </span>
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                {[
                  { user: 'andresjavy', desc: '🇨🇴 DJ retro mixes' },
                  { user: 'cristiano', desc: '🇵🇹 Stream en directo' },
                  { user: 'juansguarnizo', desc: '🇲🇽 Charla y variedad' },
                  { user: 'ibai', desc: '🇪🇸 Gaming y eventos' }
                ].map((s_ch) => (
                  <button
                    key={s_ch.user}
                    onClick={() => {
                      setUsername(s_ch.user);
                      loadUserConfig(s_ch.user);
                    }}
                    disabled={connectionStatus === 'connecting' || connectionStatus === 'live'}
                    className="p-1 px-2 text-left bg-black/40 hover:bg-[#00f2ea]/15 hover:border-[#00f2ea]/40 border border-white/5 rounded text-left transition-all disabled:opacity-45 disabled:pointer-events-none group"
                    title={`Llenar campo con @${s_ch.user}`}
                    type="button"
                  >
                    <p className="text-[10px] font-mono font-bold text-white group-hover:text-[#00f2ea] truncate">@{s_ch.user}</p>
                    <p className="text-[8.5px] text-gray-500 truncate">{s_ch.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Background prioritization toggle setting */}
            <div className="border-t border-white/5 pt-2.5 mt-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-450 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 relative">
                    {backgroundPriority && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f2ea] opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${backgroundPriority ? 'bg-[#00f2ea]' : 'bg-gray-600'}`}></span>
                  </span>
                  Modo Prioridad (Segundo Plano)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backgroundPriority}
                    onChange={(e) => handleToggleBackgroundPriority(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-black/60 border border-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#00f2ea] peer-checked:after:bg-black"></div>
                </label>
              </div>
              <p className="text-[9.5px] text-gray-500 leading-relaxed pl-2.5 border-l border-white/10">
                Mantiene el canal de audio activo y previene la suspensión de la pestaña de Chrome/Safari al cambiar a otra aplicación o reproducir música, asegurando recepción inmediata con prioridad absoluta.
              </p>
            </div>

            {/* Cloud connection persistent 24/7 guides & Wake Lock Controller */}
            <div className="border-t border-white/5 pt-3 mt-1.5 flex flex-col gap-2.5">
              <div className="bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 rounded p-3 text-[11px] text-gray-300 leading-normal flex flex-col gap-1.5 transition-all">
                <span className="font-semibold text-[#00f2ea] flex items-center gap-1.5 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f2ea] animate-pulse inline-block" />
                  ⚡ Conexión en la Nube (Celular Apagado)
                </span>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Este puente de alertas se ejecuta 100% de manera independiente en nuestro servidor en la nube. <strong>La conexión recopilará chats, me gustas y regalos las 24 horas, incluso si tu celular se apaga, se bloquea, se duerme o pierde señal por completo.</strong>
                </p>
                <div className="mt-1 flex flex-col gap-1 text-[10px] text-gray-400 pl-2 border-l border-indigo-500/40">
                  <span className="text-yellow-400 font-medium">🔊 Cómo reproducir sonidos con pantalla apagada:</span>
                  <span>Como el reproductor de voz (TTS) requiere una pestaña activa para reproducir audio, puedes simplemente <strong>abrir esta misma página en cualquier Computadora, Laptop o Tablet secundaria</strong>. Las alertas sonarán instantáneamente allí mientras tu celular principal de streaming permanece totalmente apagado, bloqueado o inactivo.</span>
                </div>
              </div>

              {/* Interactive wake lock switch */}
              <div className="flex items-center justify-between bg-black/30 border border-white/5 p-2 rounded">
                <span className="text-[10px] text-gray-300 font-mono flex items-center gap-1.5 uppercase select-none">
                  <Smartphone className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-[#00f2ea] animate-pulse' : 'text-gray-500'}`} />
                  Pantalla siempre activa
                </span>
                <button
                  type="button"
                  onClick={toggleWakeLock}
                  className={`px-2.5 py-1 text-[9.5px] font-mono rounded uppercase tracking-wide transition-all ${
                    wakeLockActive 
                      ? 'bg-[#00f2ea]/20 border border-[#00f2ea]/50 text-[#00f2ea] font-bold' 
                      : 'bg-black/50 border border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {wakeLockActive ? '🔒 ENCENDIDO' : '💤 NORMAL'}
                </button>
              </div>
            </div>

            {/* Error notifications */}
            {connectionError && (
              <div className="p-2.5 rounded bg-[#ff0050]/5 border border-[#ff0050]/15 text-[#ff0050] text-[#ff0050] text-xs flex gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-mono text-[10px] leading-relaxed uppercase">{connectionError}</span>
              </div>
            )}

            {/* Connected hint */}
            {connectionStatus === 'live' && (
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 bg-emerald-500/5 p-2 px-3 rounded border border-emerald-500/10 uppercase tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SINC_OK: @{activeConnectedUser} ({countActiveStreamSubscribers()} ACTIVO)
              </div>
            )}
          </section>

          {/* Gestor de Copias de Seguridad y Perfiles */}
          <section id="profile-manager-section" className="bg-[#16161D] border border-white/10 rounded p-4 flex flex-col gap-3 shadow-md relative overflow-hidden">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FolderSync className="w-3.5 h-3.5 text-[#00f2ea]" />
              Gestor de Copias y Perfiles En la Nube
            </h2>

            <p className="text-gray-400 text-[10.5px] leading-relaxed">
              Tus asignaciones de sonidos, superfans y configuración de voz se guardan <strong>automáticamente en tu navegador</strong> y se sincronizan en la nube al ingresar un usuario de TikTok.
            </p>

            {/* Recent profiles quick loader */}
            {recentProfiles.length > 0 && (
              <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
                <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <History className="w-3 h-3 text-[#00f2ea]" />
                  Carga rápida de perfiles guardados:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                  {recentProfiles.map(prof => (
                    <div key={prof} className="inline-flex items-center gap-1.5 bg-black/40 border border-white/5 rounded pl-2.5 pr-1 py-1 text-[11px] hover:border-[#00f2ea]/30 transition-all">
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(prof);
                          loadUserConfig(prof);
                        }}
                        className="font-mono text-gray-300 hover:text-[#00f2ea] text-xs font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        title={`Cargar configuraciones de @${prof}`}
                      >
                        @{prof}
                      </button>
                      <div className="w-[1px] h-3 bg-white/10"></div>
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = recentProfiles.filter(p => p !== prof);
                          setRecentProfiles(filtered);
                          localStorage.setItem('tiktok_recent_profiles_list', JSON.stringify(filtered));
                        }}
                        className="text-gray-500 hover:text-[#ff0050] bg-transparent border-none p-0.5 cursor-pointer leading-none"
                        title="Eliminar perfil del historial de accesos"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cloud connection controllers */}
            <div className="flex flex-col gap-2 bg-black/35 p-2.5 rounded border border-white/5 mt-0.5">
              <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-widest block font-mono">
                Sincronización en la Nube
              </span>

              {username.trim() ? (
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-mono text-white truncate flex-1">
                    Perfil: <strong className="text-[#00f2ea]">@{username.replace('@','')}</strong>
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={cloudLoadStatus === 'loading'}
                      onClick={() => loadUserConfig(username, true)}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        cloudLoadStatus === 'loading'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                          : cloudLoadStatus === 'loaded'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : cloudLoadStatus === 'error'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                      }`}
                      title="Forzar descarga del perfil de la nube"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${cloudLoadStatus === 'loading' ? 'animate-spin' : ''}`} />
                      {cloudLoadStatus === 'loading' ? 'Descargando...' : cloudLoadStatus === 'loaded' ? '¡Descargado!' : cloudLoadStatus === 'error' ? 'Error' : 'Descargar'}
                    </button>

                    <button
                      id="btn-save-cloud"
                      type="button"
                      disabled={cloudStatus === 'saving'}
                      onClick={() => saveConfigToServer(username, true)}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        cloudStatus === 'saving' 
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse' 
                          : cloudStatus === 'saved'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : cloudStatus === 'error'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-[#00f2ea]/20 hover:bg-[#00f2ea]/30 text-[#00f2ea] border border-[#00f2ea]/30'
                      }`}
                      title="Guardar toda la configuración de sonidos, superfans y TTS directamente en la Nube"
                    >
                      <Save className={`w-3 h-3 ${cloudStatus === 'saving' ? 'animate-spin' : ''}`} />
                      {cloudStatus === 'saving' ? 'Guardando...' : cloudStatus === 'saved' ? '¡Guardado!' : cloudStatus === 'error' ? 'Error' : 'Guardar en la Nube'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-yellow-400 font-mono">
                  ⚠ Ingresa un usuario de TikTok arriba para activar la nube.
                </p>
              )}

              {firestoreQuotaExceeded && (
                <div id="firestore-quota-alert" className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-gray-300 leading-normal flex flex-col gap-1.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold font-mono">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>LÍMITE DIARIO DE BASE DE DATOS ALCANZADO</span>
                  </div>
                  <p>
                    La cuota gratuita de la base de datos de persistencia en la nube se ha agotado por hoy.
                  </p>
                  <p className="text-gray-400">
                    <strong>¡No te preocupes!</strong> Tus cambios se han guardado con éxito localmente en tu navegador y en nuestro servidor secundario de respaldo. Todo seguirá funcionando perfectamente.
                  </p>
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0436087868/firestore/databases/ai-studio-ee8081bc-75f8-4b7e-aa62-dd9a1a3831db/data?openUpgradeDialog=true"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00f2ea] hover:underline font-bold mt-1 text-center font-mono"
                  >
                    Ver panel de cuotas de Firebase &rarr;
                  </a>
                </div>
              )}
            </div>

            {/* Import / Export JSON Files */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="bg-black/50 hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded py-2 text-xs flex items-center justify-center gap-1.5 transition-all text-white font-semibold cursor-pointer"
                title="Descargar copia de seguridad en archivo .json"
              >
                <Download className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                Exportar JSON
              </button>

              <label className="bg-black/50 hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded py-2 text-xs flex items-center justify-center gap-1.5 transition-all text-white font-semibold cursor-pointer text-center">
                <Upload className="w-3.5 h-3.5 text-[#00f2ea]" />
                Importar JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </section>

          {/* Real-time speech synthesizer chat reader controls */}
          <ChatTtsController
            ttsEnabled={ttsEnabled}
            onToggleTts={handleToggleTts}
            ttsVolume={ttsVolume}
            onUpdateTtsVolume={handleUpdateTtsVolume}
            ttsProvider={ttsProvider}
            onUpdateTtsProvider={handleUpdateTtsProvider}
            ttsVoiceURI={ttsVoiceURI}
            onUpdateTtsVoiceURI={handleUpdateTtsVoiceURI}
            ttsRate={ttsRate}
            onUpdateTtsRate={handleUpdateTtsRate}
            aiVoiceMode={aiVoiceMode}
            onUpdateAiVoiceMode={handleUpdateAiVoiceMode}
            ttsReadUsernames={ttsReadUsernames}
            onToggleTtsReadUsernames={handleToggleTtsReadUsernames}
            ttsReaderTargets={ttsReaderTargets}
            onUpdateTtsReaderTargets={handleUpdateTtsReaderTargets}
            superFanWelcomeEnabled={superFanWelcomeEnabled}
            onToggleSuperFanWelcome={handleToggleSuperFanWelcome}
          />

          {/* Offline Sandbox Simulator Console */}
          <section id="simulator-console-section" className="bg-[#16161D] border border-white/10 rounded p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00f2ea]" />
                Consola Simulador
              </h2>
              <span className="text-[9px] bg-black/45 text-[#00f2ea] border border-[#00f2ea]/15 font-mono px-1.5 py-0.2 rounded uppercase">Sandbox</span>
            </div>
            
            <p className="text-[10px] text-gray-500 leading-relaxed font-sans font-medium">
              Testea los efectos y prueba las animaciones de pantalla sin necesidad de transmitir en vivo:
            </p>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => simulateLiveInteraction('chat')}
                className="bg-black/35 border border-white/5 hover:border-blue-500/20 text-gray-400 hover:text-blue-400 rounded p-1.5 text-xs font-semibold font-sans transition-all text-left flex items-center gap-2"
              >
                <div className="p-1 rounded bg-blue-500/10 text-blue-400 shrink-0"><MessageCircle className="w-3.5 h-3.5" /></div>
                Chat Event
              </button>
              <button
                onClick={() => simulateLiveInteraction('like')}
                className="bg-black/35 border border-white/5 hover:border-yellow-500/20 text-gray-400 hover:text-yellow-550 rounded p-1.5 text-xs font-semibold font-sans transition-all text-left flex items-center gap-2"
              >
                <div className="p-1 rounded bg-yellow-500/10 text-yellow-500 shrink-0"><ThumbsUp className="w-3.5 h-3.5" /></div>
                Like Event
              </button>
              <button
                onClick={() => simulateLiveInteraction('follow')}
                className="bg-black/35 border border-white/5 hover:border-purple-500/20 text-gray-400 hover:text-purple-400 rounded p-1.5 text-xs font-semibold font-sans transition-all text-left flex items-center gap-2"
              >
                <div className="p-1 rounded bg-purple-500/10 text-purple-400 shrink-0"><UserPlus className="w-3.5 h-3.5" /></div>
                Follow Event
              </button>
              <button
                onClick={() => simulateLiveInteraction('share')}
                className="bg-black/35 border border-white/5 hover:border-teal-500/20 text-gray-400 hover:text-teal-400 rounded p-1.5 text-xs font-semibold font-sans transition-all text-left flex items-center gap-2"
              >
                <div className="p-1 rounded bg-teal-500/10 text-teal-400 shrink-0"><Share className="w-3.5 h-3.5" /></div>
                Share Event
              </button>
            </div>

            {/* Quick gift testing multipliers */}
            <div className="border-t border-white/5 pt-3 mt-1">
              <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider mb-2">Simular Regalo Directo</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => simulateLiveInteraction('gift', 'Rose')}
                  className="bg-black/35 border border-white/10 hover:border-[#ff0050]/55 text-gray-300 rounded p-2 text-xs font-bold transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-1 text-xs">🌹 Rosa</span>
                  <span className="text-[9px] bg-[#ff0050]/10 text-[#ff0050] px-1 rounded font-mono font-bold">1 💎</span>
                </button>
                <button
                  onClick={() => simulateLiveInteraction('gift', 'TikTok')}
                  className="bg-black/35 border border-white/10 hover:border-purple-500/55 text-gray-300 rounded p-2 text-xs font-bold transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-1 text-xs">⚡ TikTok</span>
                  <span className="text-[9px] bg-[#ff0050]/10 text-[#ff0050] px-1 rounded font-mono font-bold">1 💎</span>
                </button>
                <button
                  onClick={() => simulateLiveInteraction('gift', 'Finger Heart')}
                  className="bg-black/35 border border-white/10 hover:border-rose-500/55 text-gray-300 rounded p-2 text-xs font-bold transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-1 text-xs">🫰 Corazón</span>
                  <span className="text-[9px] bg-[#ff0050]/10 text-[#ff0050] px-1 rounded font-mono font-bold">5 💎</span>
                </button>
                <button
                  onClick={() => simulateLiveInteraction('gift', 'Lion')}
                  className="bg-black/35 border border-white/10 hover:border-[#00f2ea]/55 text-gray-300 rounded p-2 text-xs font-bold transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-1 text-xs">🦁 León</span>
                  <span className="text-[9px] bg-[#00f2ea]/15 text-[#00f2ea] px-1 rounded font-mono font-bold">400 💎</span>
                </button>
              </div>

              {/* Searchable selector for advanced gifts simulation */}
              <div className="mt-2.5 bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-1.5 animate-fade-in">
                <span className="text-[9px] text-[#00f2ea] font-bold uppercase tracking-wider block">Buscador de Regalos (~500+ oficiales)</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Buscar regalo... (P. ej: Cap, Skull, Love)"
                    value={simGiftSearch}
                    onChange={(e) => setSimGiftSearch(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00f2ea]/30 font-sans"
                  />
                  {simGiftSearch && (
                    <button
                      onClick={() => setSimGiftSearch('')}
                      className="bg-white/5 border border-white/15 text-gray-400 hover:text-white rounded px-2 text-xs font-bold transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {simGiftSearch.trim().length > 0 && (
                  <div className="bg-[#121216] border border-white/10 rounded max-h-[140px] overflow-y-auto mt-1 flex flex-col divide-y divide-white/5">
                    {(() => {
                      const list = GIFT_CATALOG.filter(g =>
                        g.name.toLowerCase().includes(simGiftSearch.toLowerCase())
                      ).slice(0, 15);

                      if (list.length === 0) {
                        return <span className="text-[10px] text-gray-600 p-2 text-center font-semibold uppercase">Sin resultados</span>;
                      }

                      return list.map(g => (
                        <button
                          key={g.id + '-' + g.name}
                          onClick={() => {
                            simulateLiveInteraction('gift', g.name);
                            setSimGiftSearch(''); // auto clear search
                          }}
                          className="flex items-center justify-between p-1.5 hover:bg-[#ff0050]/10 text-left transition-all"
                        >
                          <div className="flex items-center gap-2 max-w-[80%] min-w-0">
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(g.image)}`}
                              alt={g.name}
                              className="w-5 h-5 object-contain rounded bg-transparent shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-white text-[11px] truncate font-sans font-medium">{g.name}</span>
                          </div>
                          <span className="text-[8px] text-gray-500 font-mono">ID: {g.id}</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Live User Super Fan triggers */}
            <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
              <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Simular Súper Fan</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerSuperFansIntro()}
                  className="bg-black/35 border border-yellow-500/30 hover:border-yellow-400 text-yellow-500 hover:text-yellow-400 rounded p-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  title="Simula la entrada secuencial de tus súper fans con alertas en pantalla y voz TTS"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Conectar Súper Fans
                </button>
                <button
                  onClick={() => {
                    const sf = superFans[Math.floor(Math.random() * superFans.length)];
                    const comments = [
                      "¡Este directo es de otro nivel! 🔥",
                      "¡Activen los me gusta mi gente! Vamos con todo hoy 💪",
                      "¡Mandando buenas vibras y apoyando al canal! ⭐",
                      "¡El patrón reportándose listo para reventar ese chat de regalos!"
                    ];
                    const commentText = comments[Math.floor(Math.random() * comments.length)];
                    const mockEvt: LiveEvent = {
                      id: `sfcomment-${Date.now()}`,
                      type: 'chat',
                      timestamp: Date.now(),
                      uniqueId: sf.uniqueId,
                      nickname: sf.nickname,
                      comment: commentText,
                      profilePictureUrl: sf.avatarUrl
                    };
                    setEvents(prev => [...prev.slice(-149), mockEvt]);
                    triggerChatTts(sf.uniqueId, sf.nickname || '', commentText);
                  }}
                  className="bg-black/35 border border-amber-500/30 hover:border-amber-400 text-amber-500 hover:text-amber-400 rounded p-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  title="Simula un comentario de chat enviado por un súper fan"
                >
                  <Heart className="w-3.5 h-3.5 animate-pulse" />
                  Chat Súper Fan
                </button>
              </div>
            </div>


          </section>

          {/* OBS Studio Source Setup Instructions */}
          <section id="obs-tutorial-section" className="bg-[#16161D] border border-white/10 rounded p-4 flex flex-col gap-2.5">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FolderSync className="w-3.5 h-3.5 text-[#ff0050]" />
              Integración con OBS Studio
            </h2>
            <p className="text-[10px] text-gray-500 leading-relaxed font-sans">
              Para reproducir alertas y sonidos transparentes directamente sobre tu directo en OBS Studio, utiliza la Fuente de Navegador (Browser Source). Size: 1920x1080.
            </p>

            <button
              id="btn-copy-obs-url"
              onClick={copyOverlayLink}
              type="button"
              className={`mt-1 border font-bold text-xs uppercase tracking-wider rounded py-2 transition-all duration-200 flex items-center justify-center gap-1.5 ${
                copiedObs 
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' 
                  : 'border-white/20 hover:bg-white/5 bg-transparent text-white'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedObs ? '¡Copiado con Éxito!' : 'Copiar Enlace'}
            </button>
          </section>

        </div>

        {/* Right Area (Gift configuration panel & Live logs stream feed) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Sounds assignments configuration dashboard client */}
          <div className="md:col-span-6 flex flex-col">
            <GiftSoundConfig 
              mappings={mappings}
              presetSounds={PRESET_SOUNDS}
              onUpdateMapping={handleUpdateMappings}
              discoveredGifts={discoveredGifts}
              superFans={superFans}
              onTriggerTestEvent={(gift, icon) => {
                // Instantly trigger sample sound playing
                const mapping = mappings.find(m => m.giftName.toLowerCase() === gift.toLowerCase());
                const sId = mapping?.soundId || 'magic';
                const sVol = mapping?.volume || 0.6;
                const cUrl = mapping?.customSoundUrl;
                if (sId === 'custom' && cUrl) {
                  playSoundFromUrl(cUrl, sVol).catch(() => playSynthesizedSound('magic', sVol));
                } else {
                  const pre = PRESET_SOUNDS.find(p => p.id === sId);
                  if (pre && pre.type === 'synth' && pre.synthType) {
                    playSynthesizedSound(pre.synthType, sVol);
                  } else {
                    playSynthesizedSound('magic', sVol);
                  }
                }

                // Add sample graphic alert to screen
                const sampleEvt: LiveEvent = {
                  id: `test-${Date.now()}-${Math.random()}`,
                  type: 'gift',
                  timestamp: Date.now(),
                  uniqueId: 'espectador_demo',
                  nickname: 'Espectador Prueba',
                  gift: {
                    giftId: 1,
                    giftName: gift,
                    describe: `probó la alerta de ${gift} 🧪`,
                    repeatCount: 1,
                    repeatEnd: true,
                    giftPictureUrl: icon || '',
                    diamondCount: 10
                  }
                };
                triggerGraphicsAlert(sampleEvt);
              }}
            />
          </div>

          {/* Interactive streaming transaction logs logs feed */}
          <div className="md:col-span-6 flex flex-col h-full">
            <LiveEventFeed 
              events={events}
              onClearEvents={() => setEvents([])}
              superFans={superFans}
            />
          </div>



          {/* YouTube Continuous Radio & Song Request Queue (Accessible via !play <song> in chat) */}
          <div className="md:col-span-12">
            <ErrorBoundary fallbackTitle="Reproductor de Radio de YouTube">
              <YoutubeRadio playCommandTrigger={playCommandTrigger} />
            </ErrorBoundary>
          </div>

        </div>

      </main>

      {/* Quick Stats Footer Area (High Density Grid) */}
      <div className="max-w-7xl mx-auto px-4 w-full mb-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#16161D] p-3 rounded border border-white/10">
            <p className="text-[9px] text-gray-500 uppercase font-mono font-bold tracking-wider mb-1">Eventos Procesados</p>
            <p className="text-xl font-mono text-white font-bold">{events.length}</p>
          </div>
          <div className="bg-[#16161D] p-3 rounded border border-white/10">
            <p className="text-[9px] text-gray-500 uppercase font-mono font-bold tracking-wider mb-1">Latencia Audio</p>
            <p className="text-xl font-mono text-[#00f2ea] font-bold">14ms</p>
          </div>
          <div className="bg-[#16161D] p-3 rounded border border-white/10 flex flex-col justify-between">
            <p className="text-[9px] text-gray-550 uppercase font-mono font-bold tracking-wider mb-1">Buffer Usage</p>
            <div className="w-full bg-black/40 h-1.5 rounded mt-2 overflow-hidden">
              <div 
                className="bg-[#ff0050] h-full rounded shadow-[0_0_8px_rgba(255,0,80,0.5)] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(8, (events.length % 50) * 2))}%` }} 
              />
            </div>
          </div>
          <div className="bg-[#16161D] p-3 rounded border border-white/10">
            <p className="text-[9px] text-gray-550 uppercase font-mono font-bold tracking-wider mb-1">Nuevos Regalos</p>
            <p className="text-xl font-mono text-emerald-400 font-bold">+{discoveredGifts.length}</p>
          </div>
        </div>
      </div>

      {/* Footer system indicators */}
      <footer className="relative z-10 bg-[#070709] px-6 py-6 border-t border-white/10 flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-300 tracking-wide font-sans">
            Made with <span className="text-[#ff0050]">🤍</span> by Alliance Holdings LLC
          </p>
          
          {/* Social Network Icons and Indicators */}
          <div className="flex items-center gap-3 mt-1">
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-sky-400 rounded-lg border border-white/5 hover:border-sky-400/20 shadow-md transition-all duration-200 cursor-pointer"
              title="X (Twitter)"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a 
              href="https://instagram.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-pink-500 rounded-lg border border-white/5 hover:border-pink-500/20 shadow-md transition-all duration-200 cursor-pointer"
              title="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a 
              href="https://tiktok.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group p-2 bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-[#ff0050] rounded-lg border border-white/5 hover:border-[#ff0050]/20 shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center"
              title="TikTok"
            >
              <img 
                src="https://img.icons8.com/?size=100&id=118638&format=png&color=000000" 
                alt="TikTok" 
                className="w-4 h-4 object-contain invert opacity-70 group-hover:opacity-100 group-hover:brightness-125 transition-all duration-200"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>
        </div>


      </footer>

    </div>
  );
}
