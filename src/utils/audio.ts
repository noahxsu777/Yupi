import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Client-side cache for Firestore custom sound files to eliminate loading delay
const firestoreSoundCache = new Map<string, string>();

export async function resolveSoundUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('firestore://custom_sounds/')) {
    const soundId = url.replace('firestore://custom_sounds/', '');
    if (firestoreSoundCache.has(soundId)) {
      return firestoreSoundCache.get(soundId)!;
    }
    try {
      console.log(`[AudioEngine] Resolving custom sound from Firestore: ${soundId}`);
      const docRef = doc(db, 'custom_sounds', soundId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.base64Data) {
          firestoreSoundCache.set(soundId, data.base64Data);
          return data.base64Data;
        }
      }
      console.warn(`[AudioEngine] Firestore sound document not found or lacks base64Data: ${soundId}`);
    } catch (e) {
      console.error('[AudioEngine] Error resolving custom sound from Firestore:', e);
    }
    return ''; // Fails to load
  }
  return url;
}

// Web Audio API Synthesizer and custom Player
let audioCtx: AudioContext | null = null;

export function applyAudioSessionCategory() {
  if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
    try {
      (navigator as any).audioSession.type = 'playback';
      console.log('[Audio] Successfully initialized primary audio category (playback) in iOS/Safari. Bypassing silent switch & keeping active.');
    } catch (err) {
      console.warn('[Audio] Failed to set navigator.audioSession.type:', err);
    }
  }
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioCtx();
    
    // Auto-resume state observer
    audioCtx.onstatechange = () => {
      console.log(`[AudioCtx-State] New State: ${audioCtx?.state}`);
      if (audioCtx?.state === 'suspended') {
        audioCtx?.resume().catch(() => {});
      }
    };
  }
  
  applyAudioSessionCategory();
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// 1. Synthesize cool sound effects on the fly!
export function playSynthesizedSound(type: 'coin' | 'triumph' | 'laser' | 'airhorn' | 'bubble' | 'magic', volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Main master volume node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now); // scale down standard synthesizer amplitude
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'coin': {
        // Classic retro coin sound - two high square wave notes
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5 note
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6 note
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.35);
        
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }
      
      case 'triumph': {
        // Star level up / short triumphant fanfare using 3 layered oscillators
        const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.8, now + idx * 0.06 + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          
          osc.connect(gainNode);
          gainNode.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.5);
        });
        break;
      }
      
      case 'laser': {
        // Futuristic sci-fi laser sweep
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }

      case 'airhorn': {
        // Energetic retro airhorn blast using layered saw wave frequencies
        const baseFreqs = [150, 151, 153, 300, 302];
        baseFreqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          // slight pitch bend up
          osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.4);
          
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.5, now);
          gainNode.gain.linearRampToValueAtTime(0.5, now + 0.35);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          
          osc.connect(gainNode);
          gainNode.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.45);
        });
        break;
      }

      case 'bubble': {
        // Cute popping bubble sounds - multiple fast clicks
        for (let i = 0; i < 3; i++) {
          const t = now + i * 0.08;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          // bubble sweeps from low to high frequency rapidly
          osc.frequency.setValueAtTime(400 + i * 150, t);
          osc.frequency.exponentialRampToValueAtTime(1200 + i * 200, t + 0.05);
          
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.8, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          
          osc.connect(gainNode);
          gainNode.connect(masterGain);
          osc.start(t);
          osc.stop(t + 0.06);
        }
        break;
      }
      
      case 'magic': {
        // High sparkle chime arpeggio (Fairy Dust!)
        const freqs = [880, 987, 1174, 1318, 1567, 1760]; // A5, B5, D6, E6, G6, A6
        freqs.forEach((freq, idx) => {
          const t = now + idx * 0.04;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.6, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          
          // Add a bit of resonance frequency for magical chime effect
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.setValueAtTime(freq, t);
          
          osc.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(masterGain);
          
          osc.start(t);
          osc.stop(t + 0.32);
        });
        break;
      }
    }
  } catch (error) {
    console.error('Failed playing synthesized sound:', error);
  }
}

// Global active audio tracker and stopper to handle instant silencing/mute action
export const activeAudioElements = new Set<HTMLAudioElement>();

export function trackAudio(audio: HTMLAudioElement) {
  activeAudioElements.add(audio);
  const handleStopEvents = () => {
    activeAudioElements.delete(audio);
  };
  audio.addEventListener('ended', handleStopEvents);
  audio.addEventListener('error', handleStopEvents);
  audio.addEventListener('pause', handleStopEvents);
}

export function stopAllAudio() {
  console.log('[Audio] Stopping all active speech, sounds, and draining queues.');
  
  stopActiveTts();

  // Pause all playing audio elements
  activeAudioElements.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  });
  activeAudioElements.clear();
  
  // Clear sequential Gift sounds queue
  giftAudioQueue.length = 0;
  giftQueueProcessing = false;

  // Clear sequential TTS queue
  ttsAudioQueue.length = 0;
  ttsQueueProcessing = false;
}

// 2. Play custom Sound URLs or uploaded sound blobs with robust browser direct-load fallback
export function playSoundFromUrl(url: string, volume: number = 0.5): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    resolveSoundUrl(url).then(resolvedUrl => {
      if (!resolvedUrl) {
        playSynthesizedSound('magic', volume);
        reject(new Error('Failed to resolve sound url'));
        return;
      }
      try {
        let rawUrl: string | null = null;
        
        // Handle MyInstants prefixed URLs
        let finalUrl = resolvedUrl;
        // Strip all 'mi:' prefixes if they exist
        while (finalUrl.startsWith('mi:')) {
          finalUrl = finalUrl.substring(3);
        }
        rawUrl = finalUrl;
        
        // If it looks like a direct MyInstants URL, we need to proxy it because of CORS.
        if (finalUrl.includes('myinstants.com')) {
          finalUrl = `/api/proxy-audio?url=${encodeURIComponent(finalUrl)}`;
        }

        applyAudioSessionCategory();
        const audio = new Audio(finalUrl);
        audio.volume = volume;
        trackAudio(audio);

        const triggerFallback = (originalErr: any) => {
          if (rawUrl) {
            console.warn('[Audio] Proxy play failed. Falling back to browser-direct direct load:', rawUrl);
            const fallbackAudio = new Audio(rawUrl);
            fallbackAudio.volume = volume;
            trackAudio(fallbackAudio);
            fallbackAudio.play()
              .then(() => resolve(fallbackAudio))
              .catch(fallbackErr => {
                console.warn('[Audio] Both proxy and raw direct-load failed. Playing synth.', fallbackErr);
                playSynthesizedSound('magic', volume);
                reject(fallbackErr);
              });
          } else {
            playSynthesizedSound('magic', volume);
            reject(originalErr);
          }
        };

        audio.play()
          .then(() => resolve(audio))
          .catch(err => {
            triggerFallback(err);
          });
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

// 2.5 Separate audio queues for Gift Sound Alerts and Chat TTS Speech
type QueueTask = () => Promise<void>;

// Separate Queue for Gift Sound Alerts (sequential among gifts, concurrent with TTS)
const giftAudioQueue: QueueTask[] = [];
let giftQueueProcessing = false;

async function runGiftQueue() {
  if (giftQueueProcessing) return;
  giftQueueProcessing = true;
  while (giftAudioQueue.length > 0) {
    const task = giftAudioQueue.shift();
    if (task) {
      try {
        await task();
      } catch (e) {
        console.error('[GiftAudioQueue] Error executing audio task:', e);
      }
    }
  }
  giftQueueProcessing = false;
}

export function queueSound(task: QueueTask) {
  giftAudioQueue.push(task);
  runGiftQueue();
}

// Separate Queue for Chat TTS Speech (sequential among chat, concurrent with Gift sounds)
const ttsAudioQueue: QueueTask[] = [];
let ttsQueueProcessing = false;

async function runTtsQueue() {
  if (ttsQueueProcessing) return;
  ttsQueueProcessing = true;
  while (ttsAudioQueue.length > 0) {
    const task = ttsAudioQueue.shift();
    if (task) {
      try {
        await task();
      } catch (e) {
        console.error('[TtsAudioQueue] Error executing TTS task:', e);
      }
    }
  }
  ttsQueueProcessing = false;
}

export function queueTts(task: QueueTask) {
  ttsAudioQueue.push(task);
  runTtsQueue();
}

export function updateMediaSessionMetadata(title: string, artist: string, album: string = 'TikTok Live Reader', artworkUrl?: string) {
  if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
    try {
      const artwork = artworkUrl ? [{ src: artworkUrl, sizes: '128x128 256x256 512x512', type: 'image/png' }] : [
        { src: 'https://adventure-8t03kq.fly.dev/img/logo.png', sizes: '192x192', type: 'image/png' }
      ];
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork
      });
    } catch (e) {
      console.warn('Error setting Media Session Metadata:', e);
    }
  }
}

export function playSoundFromUrlWithCompletion(url: string, volume: number = 0.5): Promise<void> {
  return new Promise((resolve) => {
    resolveSoundUrl(url).then(resolvedUrl => {
      if (!resolvedUrl) {
        playSynthesizedSound('magic', volume);
        setTimeout(resolve, 500);
        return;
      }
      try {
        updateMediaSessionMetadata('Alerta: Sonido de Regalo', 'Efectos de Sonido');
        let rawUrl: string | null = null;
        
        // Handle MyInstants prefixed URLs and proxying
        let finalUrl = resolvedUrl;
        while (finalUrl.startsWith('mi:')) {
          finalUrl = finalUrl.substring(3);
        }
        rawUrl = finalUrl;
        
        if (finalUrl.includes('myinstants.com')) {
          finalUrl = `/api/proxy-audio?url=${encodeURIComponent(finalUrl)}`;
        } else if (resolvedUrl.includes('/api/proxy-audio?url=')) {
          try {
            const parsed = new URL(resolvedUrl, window.location.origin);
            const urlParam = parsed.searchParams.get('url');
            if (urlParam) {
              rawUrl = urlParam;
            }
          } catch (e) {}
        }

        console.log('[AudioQueue] Playing resolved URL:', finalUrl.startsWith('data:') ? 'base64_data' : finalUrl);
        applyAudioSessionCategory();
        const audio = new Audio(finalUrl);
        audio.volume = volume;
        trackAudio(audio);
        
        console.log(`[AudioQueue] Attempting audio.play() for: ${resolvedUrl}`);
        
        const cleanUp = () => {
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
        };

        const handleEnded = () => {
          cleanUp();
          resolve();
        };

        let fallbackStarted = false;
        const playDirectFallbackOnce = () => {
          if (fallbackStarted) return;
          fallbackStarted = true;
          playDirectFallback();
        };

        const playDirectFallback = () => {
          if (!rawUrl) {
            playSynthesizedSound('magic', volume);
            setTimeout(resolve, 500);
            return;
          }

          console.log('[AudioQueue] Attempting direct browser-load play of raw URL:', rawUrl);
          const fallbackAudio = new Audio(rawUrl);
          fallbackAudio.volume = volume;
          trackAudio(fallbackAudio);

          const fallbackCleanUp = () => {
            fallbackAudio.removeEventListener('ended', fallbackHandleEnded);
            fallbackAudio.removeEventListener('error', fallbackHandleError);
          };

          const fallbackHandleEnded = () => {
            fallbackCleanUp();
            resolve();
          };

          let secondFallbackStarted = false;
          const playSecondFallbackOnce = () => {
            if (secondFallbackStarted) return;
            secondFallbackStarted = true;
            playSynthesizedSound('magic', volume);
            setTimeout(resolve, 500);
          };

          const fallbackHandleError = (eFallback: any) => {
            console.warn('[AudioQueue] Direct raw play also failed. Falling back to synth chime.', eFallback);
            fallbackCleanUp();
            playSecondFallbackOnce();
          };

          fallbackAudio.addEventListener('ended', fallbackHandleEnded);
          fallbackAudio.addEventListener('error', fallbackHandleError);

          fallbackAudio.play().catch(err => {
            fallbackCleanUp();
            playSecondFallbackOnce();
          });
        };

        const handleError = (e: any) => {
          console.warn('[AudioQueue] URL failed to play/load. Shifting to direct raw fallback...', e);
          cleanUp();
          playDirectFallbackOnce();
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        audio.play().catch((err) => {
          console.warn('[AudioQueue] Playback blocked or failed. Retrying via raw fallback.', err);
          cleanUp();
          playDirectFallbackOnce();
        });
      } catch (err) {
        console.error('[AudioQueue] Failed playing custom URL sound:', err);
        playSynthesizedSound('magic', volume);
        setTimeout(resolve, 500);
      }
    }).catch(() => {
      playSynthesizedSound('magic', volume);
      setTimeout(resolve, 500);
    });
  });
}

export function playSynthesizedSoundWithCompletion(
  type: 'coin' | 'triumph' | 'laser' | 'airhorn' | 'bubble' | 'magic',
  volume: number = 0.5
): Promise<void> {
  return new Promise((resolve) => {
    try {
      updateMediaSessionMetadata(`Alerta Sintetizador: ${type.toUpperCase()}`, 'Efectos de Sonido');
      playSynthesizedSound(type, volume);
      
      let durationMs = 500;
      if (type === 'coin') durationMs = 350;
      else if (type === 'triumph') durationMs = 500;
      else if (type === 'laser') durationMs = 250;
      else if (type === 'airhorn') durationMs = 450;
      else if (type === 'bubble') durationMs = 350;
      else if (type === 'magic') durationMs = 550;

      setTimeout(resolve, durationMs + 85); // add a slight gap (85ms) between sequential sounds
    } catch (e) {
      resolve();
    }
  });
}

// Queue structure for Chat TTS / Speak text to play one after another
interface TtsTrack {
  text: string;
  volume: number;
  voiceUri?: string;
  rate: number;
  pitch: number;
  provider: string;
  resolve: (value: void | PromiseLike<void>) => void;
}

let currentTtsAudio: HTMLAudioElement | null = null;
let currentTtsUtterance: SpeechSynthesisUtterance | null = null;

export function stopActiveTts() {
  console.log('[Audio] Stopping active TTS.');
  
  // 1. Cancel browser speech translation
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  
  // 2. Clear current uttering trace
  if (currentTtsUtterance) {
    currentTtsUtterance.onend = null;
    currentTtsUtterance.onerror = null;
    currentTtsUtterance = null;
  }

  // 3. Pause active TTS Cloud audio element if playing
  if (currentTtsAudio) {
    try {
      currentTtsAudio.pause();
      currentTtsAudio.currentTime = 0;
    } catch (e) {}
    currentTtsAudio = null;
  }
}

// 3. Text-to-Speech (TTS) engine for reading chat comments in real-time (Independent TTS Queue)
export function speakText(
  text: string, 
  volume: number = 0.8, 
  voiceUri?: string,
  rate: number = 1.0,
  pitch: number = 1.0,
  provider: string = 'browser'
): Promise<void> {
  return new Promise((resolve) => {
    queueTts(async () => {
      const trackItem: TtsTrack = {
        text,
        volume,
        voiceUri,
        rate,
        pitch,
        provider,
        resolve: () => {
          resolve();
        }
      };
      
      try {
        await runSingleSpeak(trackItem);
        trackItem.resolve();
      } catch (err) {
        console.error('[TTS] Error running single speak in independent TTS queue:', err);
        trackItem.resolve();
      }
    });
  });
}

function runSingleSpeak(item: TtsTrack): Promise<void> {
  return new Promise((resolve) => {
    try {
      const { text, volume, voiceUri, rate, pitch, provider } = item;

      if (!text || !text.trim()) {
        resolve();
        return;
      }

      updateMediaSessionMetadata(text, 'Voz del Directo', 'Lector de Voz');
      const activeProvider = provider || 'browser';

      if (activeProvider === 'browser') {
        if (!('speechSynthesis' in window)) {
          console.warn('Speech synthesis not supported in this browser.');
          resolve();
          return;
        }

        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance(text);
        currentTtsUtterance = utterance;
        utterance.volume = volume;
        utterance.rate = rate;
        utterance.pitch = pitch;

        // Select specific voice if voiceUri is provided, otherwise fallback to standard Spanish or default
        const voices = window.speechSynthesis.getVoices();
        
        if (voiceUri) {
          const selectedVoice = voices.find(v => v.voiceURI === voiceUri);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        } else {
          // Look for Spanish voice as natural preference for this app
          const spanishVoice = voices.find(v => v.lang.toLowerCase().includes('es'));
          if (spanishVoice) {
            utterance.voice = spanishVoice;
          }
        }

        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            currentTtsUtterance = null;
            resolve();
          }
        };

        utterance.onend = done;
        utterance.onerror = done;

        // Chrome/Safari speech safety: call resume right before speaking to wake up engine
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.resume();
          } catch (e) {}
        }

        window.speechSynthesis.speak(utterance);
        return;
      }

      // Cloud TTS Provider Player!
      let url = '';
      const voice = voiceUri || '';
      
      if (activeProvider === 'streamelements') {
        url = `/api/tts?voice=${encodeURIComponent(voice || 'Brian')}&text=${encodeURIComponent(text)}`;
      } else if (activeProvider === 'google') {
        url = `/api/gtts?lang=${encodeURIComponent(voice || 'es')}&text=${encodeURIComponent(text)}`;
      } else if (activeProvider === 'tiktok') {
        url = `/api/tiktok-tts?voice=${encodeURIComponent(voice || 'es_002')}&text=${encodeURIComponent(text)}`;
      } else if (activeProvider === 'edge') {
        url = `/api/edge-tts?voice=${encodeURIComponent(voice || 'es-CO-SalomeNeural')}&text=${encodeURIComponent(text)}`;
      } else if (activeProvider === 'celebrity') {
        url = `/api/celebrity-tts?voice=${encodeURIComponent(voice || 'trump')}&text=${encodeURIComponent(text)}`;
      } else {
        url = `/api/gtts?lang=es&text=${encodeURIComponent(text)}`;
      }

      console.log(`[CloudTTS] Playing synthesized speech via ${activeProvider} (voice: ${voice || 'default'}):`, text);
      const audio = new Audio(url);
      currentTtsAudio = audio;
      audio.volume = volume;
      audio.playbackRate = rate;
      trackAudio(audio);

      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          currentTtsAudio = null;
          resolve();
        }
      };

      // Timeout safety (30 seconds max per speech)
      const timeout = setTimeout(() => {
        try {
          audio.pause();
        } catch (e) {}
        done();
      }, 30000);

      let fallbackStarted = false;
      const triggerTtsFallback = () => {
        if (fallbackStarted) return;
        fallbackStarted = true;
        clearTimeout(timeout);
        
        // Fallback to local browser SpeechSynthesis to ensure audio voice is heard
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          console.log('[CloudTTS Fallback] Triggering Browser SpeechSynthesis...');
          try {
            window.speechSynthesis.resume();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = volume;
            utterance.rate = rate;
            utterance.pitch = pitch;
            
            const voices = window.speechSynthesis.getVoices();
            const spanishVoice = voices.find(v => v.lang.toLowerCase().includes('es'));
            if (spanishVoice) {
              utterance.voice = spanishVoice;
            }
            
            utterance.onend = done;
            utterance.onerror = done;
            window.speechSynthesis.speak(utterance);
          } catch (err) {
            console.error('[CloudTTS Fallback] Speech synthesis fallback crashed:', err);
            done();
          }
        } else {
          done();
        }
      };

      audio.onended = () => {
        clearTimeout(timeout);
        done();
      };

      audio.onerror = (e) => {
        console.warn(`[CloudTTS] Audio play failed for provider ${activeProvider}:`, e);
        triggerTtsFallback();
      };
      
      audio.play().catch((err) => {
        console.warn(`[CloudTTS] Play promise failed:`, err);
        triggerTtsFallback();
      });
    } catch (e) {
      console.error('TTS single speak error:', e);
      resolve();
    }
  });
}

// Unlocks speech synthesis and web audio context asynchronously upon first human click gesture
export function unlockAudio() {
  console.log('[Audio] Unlocking Web Audio API and SpeechSynthesis on user gesture...');
  
  // 1. Web Audio API Context unlock
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    }
  } catch (err) {
    console.warn('[Audio-Unlock] Fails unlocking Web Audio Context:', err);
  }

  // 2. browser Web Speech synthesized unlock
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      
      // Queuing a micro, sub-audible silent utterance gets browser to flag page as unlocked for Speech synthesis
      const emptyPhrase = new SpeechSynthesisUtterance(' ');
      emptyPhrase.volume = 0.001;
      emptyPhrase.rate = 1.0;
      window.speechSynthesis.speak(emptyPhrase);
    } catch (err) {
      console.warn('[Audio-Unlock] Fails unlocking speechSynthesis:', err);
    }
  }
}

// Global reference holders for Priority Background Audio Mode
let globalKeepAliveAudioContext: AudioContext | null = null;
let globalKeepAliveOscillator: OscillatorNode | null = null;
let globalKeepAliveAudioElement: HTMLAudioElement | null = null;
let backgroundWatchdogInterval: any = null;

export function startBackgroundPriorityMode() {
  console.log('[Audio] Enabling Priority Background Audio Mode (Keep-Alive)...');
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API not supported in this browser environment.');
    
    // Clean up any pre-existing instance first
    stopBackgroundPriorityMode();

    const ctx = new AudioCtx();
    globalKeepAliveAudioContext = ctx;

    // Auto-resume keep alive context state changes
    ctx.onstatechange = () => {
      console.log(`[KeepAlive-CtxState] State: ${ctx.state}`);
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };

    // Create a sub-audible (1Hz) oscillator to keep the dynamic audio pipeline active.
    // Modern desktop & mobile browsers will NOT suspend or throttle JavaScript Execution in a tab
    // that is actively generating/playing audio.
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.frequency.setValueAtTime(1, ctx.currentTime); // 1 Hz sub-audible tone
    gainNode.gain.setValueAtTime(1e-10, ctx.currentTime); // virtually absolute zero silence
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    globalKeepAliveOscillator = osc;

    // --- HTML5 Audio Element Keep-Alive ---
    // High-performance solution for mobile and tablet browsers to guarantee tab execution
    // when the browser tab goes into background or screen locks.
    const SILENT_AUDIO_BASE64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const silentAudio = new Audio(SILENT_AUDIO_BASE64);
    silentAudio.loop = true;
    silentAudio.volume = 0.001; // low volume to prevent any audible hum but keeps engine alive
    
    applyAudioSessionCategory();

    // Recover if browser pauses our silent audio during external music overlays (like Spotify playing)
    silentAudio.addEventListener('pause', () => {
      if (globalKeepAliveAudioElement === silentAudio) {
        console.log('[Audio] Keep-alive audio paused by system interruption. Recovering primary playback in 1s...');
        setTimeout(() => {
          if (globalKeepAliveAudioElement === silentAudio) {
            applyAudioSessionCategory();
            silentAudio.play().catch(() => {});
          }
        }, 1000);
      }
    });

    silentAudio.play().then(() => {
      console.log('[Audio] HTML5 audio keep-alive background track playing successfully.');
    }).catch(err => {
      console.warn('[Audio] HTML5 audio keep-alive play deferred until user interaction:', err);
    });
    globalKeepAliveAudioElement = silentAudio;
    
    // Hook up OS Media Session to let device prioritize this background media thread
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'TikTok Alertas Multivirales (Conexión Estable)',
        artist: 'TTS & Alerts Engine Activo',
        album: 'Prioridad de Ejecución en Segundo Plano'
      });
      // Register standard action handlers to reinforce audio thread status with the OS Scheduler
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('[Audio] MediaSession play action triggered.');
        if (globalKeepAliveAudioElement) {
          globalKeepAliveAudioElement.play().catch(() => {});
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('[Audio] MediaSession pause action triggered.');
        if (globalKeepAliveAudioElement) {
          globalKeepAliveAudioElement.pause();
        }
      });
    }

    // Passive active audio focus/interruption watchdog to auto-recover our background pipeline
    backgroundWatchdogInterval = setInterval(() => {
      recoverBackgroundAudioState();
    }, 4000);
    
    console.log('[Audio] Priority Background Audio Mode launched successfully. Tab won\'t freeze in background!');
  } catch (err) {
    console.warn('[Audio] Failed launching background priority keep-alive oscillator:', err);
  }
}

export function recoverBackgroundAudioState() {
  // 1. Recover main sound AudioContext
  if (audioCtx && audioCtx.state === 'suspended') {
    console.log('[AudioWatchdog] Re-activating main AudioContext due to suspension...');
    audioCtx.resume().catch(() => {});
  }
  // 2. Recover keep alive context
  if (globalKeepAliveAudioContext && globalKeepAliveAudioContext.state === 'suspended') {
    console.log('[AudioWatchdog] Re-activating keep-alive AudioContext due to suspension...');
    globalKeepAliveAudioContext.resume().catch(() => {});
  }
  // 3. Recover keep alive audio element play
  if (globalKeepAliveAudioElement && globalKeepAliveAudioElement.paused) {
    console.log('[AudioWatchdog] Re-activating silenter audio loop play...');
    globalKeepAliveAudioElement.play().catch(() => {});
  }
  // 4. Force mix ambient session category for concurrent app playback
  applyAudioSessionCategory();
}

export function stopBackgroundPriorityMode() {
  console.log('[Audio] Disabling Priority Background Audio Mode...');
  
  if (backgroundWatchdogInterval) {
    clearInterval(backgroundWatchdogInterval);
    backgroundWatchdogInterval = null;
  }

  try {
    if (globalKeepAliveOscillator) {
      globalKeepAliveOscillator.stop();
      globalKeepAliveOscillator.disconnect();
      globalKeepAliveOscillator = null;
    }
  } catch (e) {}

  try {
    if (globalKeepAliveAudioElement) {
      globalKeepAliveAudioElement.pause();
      globalKeepAliveAudioElement = null;
    }
  } catch (e) {}

  try {
    if (globalKeepAliveAudioContext && globalKeepAliveAudioContext.state !== 'closed') {
      globalKeepAliveAudioContext.close();
      globalKeepAliveAudioContext = null;
    }
  } catch (e) {}
}

