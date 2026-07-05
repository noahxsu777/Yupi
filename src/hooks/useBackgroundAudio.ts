import { useState, useEffect, useRef } from 'react';
import { resolveSoundUrl, trackAudio, playSynthesizedSoundWithCompletion, playSoundFromUrlWithCompletion } from '../utils/audio';

export interface AudioAlertItem {
  id: string;
  giftName: string;
  soundId: string;
  volume: number;
  customUrl?: string;
  giftId?: string | number;
}

export function useBackgroundAudio() {
  const [audioQueue, setAudioQueue] = useState<AudioAlertItem[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const queueRef = useRef<AudioAlertItem[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync ref with state
  useEffect(() => {
    queueRef.current = audioQueue;
  }, [audioQueue]);

  // Unlock Audio helper using 1-frame silent wav sound
  const unlockBackgroundAudio = async () => {
    console.log('[useBackgroundAudio] Unlocking native audio focus with silent loop...');
    const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    try {
      const silentAudio = new Audio(SILENT_WAV);
      silentAudio.volume = 0.001;
      await silentAudio.play();
      console.log('[useBackgroundAudio] Native audio focus unlocked successfully.');
    } catch (err) {
      console.warn('[useBackgroundAudio] Native audio focus unlock failed (requires user gesture):', err);
    }
  };

  // Sync Media Session Playback State
  const updatePlaybackState = (state: 'playing' | 'paused' | 'none') => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state;
      } catch (e) {
        console.warn('[useBackgroundAudio] Failed to sync Media Session playbackState:', e);
      }
    }
  };

  // Sync Media Session Metadata with custom event details
  const updateMediaSessionMetadata = (item: AudioAlertItem) => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Alerta: ${item.giftName}`,
          artist: 'TikTok Live Reader',
          album: item.giftId ? `ID: ${item.giftId}` : 'Notificación de Evento',
          artwork: [
            { src: 'https://adventure-8t03kq.fly.dev/img/logo.png', sizes: '192x192', type: 'image/png' },
            { src: 'https://adventure-8t03kq.fly.dev/img/logo.png', sizes: '512x512', type: 'image/png' }
          ]
        });

        // Register Media Session action handlers to support background audio priority (keeps OS thread alive)
        navigator.mediaSession.setActionHandler('play', () => {
          if (currentAudioRef.current) {
            currentAudioRef.current.play().catch(() => {});
            updatePlaybackState('playing');
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            updatePlaybackState('paused');
          }
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          stopCurrentAlert();
        });
      } catch (e) {
        console.warn('[useBackgroundAudio] Media Session initialization error:', e);
      }
    }
  };

  // Process the queue sequentially
  const processQueue = async () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsAudioPlaying(true);
    updatePlaybackState('playing');

    const nextItem = queueRef.current[0];

    try {
      updateMediaSessionMetadata(nextItem);
      
      const isPreset = ['coin', 'triumph', 'laser', 'airhorn', 'bubble', 'magic'].includes(nextItem.soundId);

      if (isPreset) {
        console.log(`[useBackgroundAudio] Playing preset: ${nextItem.soundId} with system audio focus`);
        // 1. Play silent WAV on real <audio> element to claim/keep native audio focus
        const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        const silentAudio = new Audio(SILENT_WAV);
        silentAudio.volume = 0.001;
        currentAudioRef.current = silentAudio;
        trackAudio(silentAudio);
        
        try {
          await silentAudio.play();
        } catch (e) {
          console.warn('[useBackgroundAudio] Silent audio focus play deferred or blocked:', e);
        }

        // 2. Play the high-quality synthesized sound and wait for it to complete
        await playSynthesizedSoundWithCompletion(nextItem.soundId as any, nextItem.volume);
      } else {
        // Custom sound or fallback
        console.log(`[useBackgroundAudio] Playing custom/url sound: ${nextItem.soundId}`);
        let playUrl = '';
        if (nextItem.soundId === 'custom' && nextItem.customUrl) {
          playUrl = await resolveSoundUrl(nextItem.customUrl);
        }

        if (!playUrl) {
          // If custom URL resolution fails, fallback to magic synthesized sound
          console.warn(`[useBackgroundAudio] Failed to resolve custom sound. Falling back to magic synth.`);
          await playSynthesizedSoundWithCompletion('magic', nextItem.volume);
        } else {
          // Clean prefixes
          while (playUrl.startsWith('mi:')) {
            playUrl = playUrl.substring(3);
          }
          if (playUrl.includes('myinstants.com')) {
            playUrl = `/api/proxy-audio?url=${encodeURIComponent(playUrl)}`;
          }

          // Play real audio with completion
          await playSoundFromUrlWithCompletion(playUrl, nextItem.volume);
        }
      }

    } catch (err) {
      console.error('[useBackgroundAudio] Error processing audio task:', err);
    } finally {
      currentAudioRef.current = null;
      // Remove first element and proceed
      setAudioQueue(prev => {
        const remaining = prev.slice(1);
        queueRef.current = remaining;
        return remaining;
      });

      isPlayingRef.current = false;
      setIsAudioPlaying(false);
      updatePlaybackState('none');

      // Auto trigger next item in sequence
      setTimeout(() => {
        processQueue();
      }, 50);
    }
  };

  // Queue an incoming audio alert
  const queueAudioAlert = (
    giftName: string,
    soundId: string,
    volume: number,
    customUrl?: string,
    giftId?: string | number
  ) => {
    const newItem: AudioAlertItem = {
      id: `${Date.now()}-${Math.random()}`,
      giftName,
      soundId,
      volume,
      customUrl,
      giftId
    };

    setAudioQueue(prev => {
      const updated = [...prev, newItem];
      queueRef.current = updated;
      
      // Handle fallback Web Notification if app is in background/visibility change
      if (document.visibilityState === 'hidden') {
        triggerNotificationFallback(giftName, giftId);
      }

      return updated;
    });
  };

  // Trigger web notification as fallback when tab is completely hidden
  const triggerNotificationFallback = (giftName: string, giftId?: string | number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('¡Regalo Recibido!', {
          body: `Se ha recibido el regalo: ${giftName} ${giftId ? `(ID: ${giftId})` : ''}`,
          icon: 'https://adventure-8t03kq.fly.dev/img/logo.png',
          vibrate: [200, 100, 200]
        } as any);
      } catch (e) {
        console.warn('[Notification] Failed to trigger fallback notification:', e);
      }
    }
  };

  // Stop current playing audio alert
  const stopCurrentAlert = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
    setIsAudioPlaying(false);
    updatePlaybackState('none');
  };

  // VisibilityChange listener to adjust priority / logs
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log(`[useBackgroundAudio] App is now ${document.visibilityState === 'visible' ? 'FOREGROUND' : 'BACKGROUND'}`);
      if (document.visibilityState === 'visible') {
        // Unlock on return to foreground
        unlockBackgroundAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Watch for queue additions to process
  useEffect(() => {
    if (audioQueue.length > 0 && !isPlayingRef.current) {
      processQueue();
    }
  }, [audioQueue]);

  return {
    queueAudioAlert,
    unlockBackgroundAudio,
    isAudioPlaying,
    audioQueue,
    stopCurrentAlert
  };
}
