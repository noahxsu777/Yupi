import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import tiktokLiveConnector from 'tiktok-live-connector';
import * as cheerio from 'cheerio';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini client on server side with safe fallback
let aiClient: any = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('[Gemini] GoogleGenAI client initialized successfully in server.');
  } catch (err) {
    console.error('[Gemini] Failed to initialize GoogleGenAI client:', err);
  }
} else {
  console.log('[Gemini] GEMINI_API_KEY is not defined. DJ Towa recommendations will run on high-quality presets.');
}

const { WebcastPushConnection } = tiktokLiveConnector;

class PremiumHighSpeedConnection extends EventEmitter {
  private ws: any = null;
  private username: string;
  private apiKey: string;
  private isConnected: boolean = false;

  constructor(username: string, apiKey: string) {
    super();
    this.username = username;
    this.apiKey = apiKey;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let resolved = false;
      try {
        const secureKey = this.apiKey.trim() || 'tk_235e481d7e949fa580b3f0b3bf8040223481c16e398d2abb';
        console.log(`[HighSpeed-VIP] Connecting for @${this.username}`);
        const wsUrl = `wss://api.tik.tools?uniqueId=${encodeURIComponent(this.username)}&apiKey=${encodeURIComponent(secureKey)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;
          console.log(`[HighSpeed-VIP] Connection opened for @${this.username}`);
          this.emit('connected', { roomId: `Premium-HighSpeed-${this.username}` });
          resolved = true;
          resolve({ roomId: `Premium-HighSpeed-${this.username}` });
        });

        this.ws.on('message', (raw: any) => {
          try {
            const data = JSON.parse(raw.toString());
            const eventName = data.event || data.type || data.eventName;
            const eventPayload = data.data || data.payload || data;

            if (eventName) {
              const evName = String(eventName).toLowerCase().trim();
              console.log(`[HighSpeed-VIP] Raw Event: ${evName} | Payload keys:`, Object.keys(eventPayload || {}));

              if ((evName === 'chat' || evName === 'chatmessage' || evName === 'comment') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                const nickname = eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId || '';
                const commentText = eventPayload.comment || eventPayload.text || eventPayload.message || eventPayload.content || '';
                
                console.log(`[HighSpeed-VIP] Parsed Comment: @${uniqueId} (${nickname}): ${commentText}`);

                this.emit('chat', {
                  uniqueId,
                  nickname,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl || eventPayload.user.avatarLargeUrl)) || 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png',
                  isModerator: !!(eventPayload.isModerator || eventPayload.moderator || (eventPayload.user && (eventPayload.user.isModerator || eventPayload.user.moderator))),
                  comment: commentText,
                  msgId: eventPayload.msgId || eventPayload.id || `msg_${Date.now()}_${Math.random()}`
                });
              } else if ((evName === 'gift' || evName === 'giftmessage') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                const nickname = eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId || '';
                const giftName = eventPayload.giftName || eventPayload.name || (eventPayload.gift && (eventPayload.gift.giftName || eventPayload.gift.name)) || 'unknown_gift';
                const rCount = eventPayload.repeatCount || eventPayload.count || eventPayload.repeatCount || 1;

                console.log(`[HighSpeed-VIP] Parsed Gift: @${uniqueId} sent ${giftName} x${rCount}`);

                this.emit('gift', {
                  uniqueId,
                  nickname,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl)) || 'https://p16-webcast.tiktokcdn.com/img/webcast/efc948e9cc3fe0710609b5cecf3f6ff3.png~tplv-obj.png',
                  giftId: eventPayload.giftId || eventPayload.id || (eventPayload.gift && (eventPayload.gift.giftId || eventPayload.gift.id)) || 'unknown_id',
                  giftName,
                  describe: eventPayload.describe || eventPayload.description || (eventPayload.gift && eventPayload.gift.describe) || `Sent ${giftName}`,
                  repeatCount: rCount,
                  repeatEnd: eventPayload.repeatEnd !== undefined ? eventPayload.repeatEnd : true,
                  giftPictureUrl: eventPayload.giftPictureUrl || eventPayload.giftIconUrl || (eventPayload.gift && (eventPayload.gift.giftPictureUrl || eventPayload.gift.giftIconUrl)) || '',
                  diamondCount: eventPayload.diamondCount || eventPayload.diamonds || (eventPayload.gift && (eventPayload.gift.diamondCount || eventPayload.gift.diamonds)) || 1,
                  msgId: eventPayload.msgId || eventPayload.id || `gift_${Date.now()}_${Math.random()}`
                });
              } else if ((evName === 'like' || evName === 'likemessage') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                this.emit('like', {
                  uniqueId,
                  nickname: eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl)),
                  likeCount: eventPayload.likeCount || eventPayload.count || 1,
                  totalLikeCount: eventPayload.totalLikeCount || eventPayload.totalCount || eventPayload.count || 1
                });
              } else if (evName === 'roomuser' && eventPayload && (eventPayload.viewerCount !== undefined || eventPayload.likeCount !== undefined)) {
                this.emit('roomUser', {
                  viewerCount: eventPayload.viewerCount,
                  likeCount: eventPayload.likeCount || eventPayload.totalLikeCount || 0
                });
              } else if ((evName === 'member' || evName === 'roomuser' || evName === 'spectator') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                this.emit('member', {
                  uniqueId,
                  nickname: eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl))
                });
              } else if ((evName === 'subscribe' || evName === 'subscribemessage') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                this.emit('subscribe', {
                  uniqueId,
                  nickname: eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl))
                });
              } else if ((evName === 'follow' || evName === 'followmessage') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                this.emit('follow', {
                  uniqueId,
                  nickname: eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl))
                });
              } else if ((evName === 'share' || evName === 'sharemessage') && eventPayload) {
                const uniqueId = eventPayload.uniqueId || eventPayload.username || eventPayload.userId || (eventPayload.user && (eventPayload.user.uniqueId || eventPayload.user.username || eventPayload.user.userId)) || '';
                this.emit('share', {
                  uniqueId,
                  nickname: eventPayload.nickname || eventPayload.displayName || (eventPayload.user && (eventPayload.user.nickname || eventPayload.user.displayName)) || uniqueId,
                  profilePictureUrl: eventPayload.profilePictureUrl || eventPayload.avatarUrl || (eventPayload.user && (eventPayload.user.profilePictureUrl || eventPayload.user.avatarUrl))
                });
              } else if (evName === 'streamend' || evName === 'stream_end') {
                this.emit('streamEnd');
              }
            }
          } catch (e) {
            console.error('[HighSpeed-VIP] Error processing message:', e);
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          this.isConnected = false;
          console.log(`[HighSpeed-VIP] Closed connection to @${this.username}. Code: ${code}`);
          this.emit('disconnected');
        });

        this.ws.on('error', (err: any) => {
          console.error(`[HighSpeed-VIP] Socket error on @${this.username}:`, err);
          this.emit('error', err);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });

      } catch (err) {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Interface for keeping track of active live streams
interface StreamSession {
  connection: any; // WebcastPushConnection instance
  clients: Set<any>; // Res object listeners
  giftRegistry: Map<string, { giftName: string; giftPictureUrl: string; diamondCount: number; giftId: string | number }>;
  userName: string;
  isConnected?: boolean;
  roomId?: string;
  eventBuffer?: any[]; // Track last 200 events for connection continuity
}

const activeStreams = new Map<string, StreamSession>();

// PERSISTENT REGISTRY OF GLOBALLY DISCOVERED GIFTS FOR ALL CREATORS ("en la nube para todos los creadores")
const GLOBAL_GIFTS_FILE_PATH = path.join(process.cwd(), 'global_discovered_gifts.json');

function loadGlobalDiscoveredGifts(): any[] {
  try {
    if (fs.existsSync(GLOBAL_GIFTS_FILE_PATH)) {
      const data = fs.readFileSync(GLOBAL_GIFTS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[GlobalGiftsStore] Error reading global gifts file:', err);
  }
  return [];
}

function saveGlobalDiscoveredGift(newGift: { giftId: any; giftName: string; giftPictureUrl: string; diamondCount: number }) {
  try {
    const gifts = loadGlobalDiscoveredGifts();
    const exists = gifts.some(g => g.giftName.toLowerCase() === newGift.giftName.toLowerCase());
    if (!exists) {
      gifts.push(newGift);
      fs.writeFileSync(GLOBAL_GIFTS_FILE_PATH, JSON.stringify(gifts, null, 2), 'utf-8');
      console.log(`[GlobalGiftsStore] PERSISTED NEW GIFT TO CLOUD FOR ALL CREATORS: ${newGift.giftName}`);
    }
  } catch (err) {
    console.error('[GlobalGiftsStore] Error saving global gift:', err);
  }
}

// API endpoints FIRST

// 1. Fetch current active stream stats
app.get('/api/streams', (req, res) => {
  const streamsList = Array.from(activeStreams.entries()).map(([username, session]) => ({
    username,
    clientsConnected: session.clients.size,
    registryCount: session.giftRegistry.size,
    giftsDiscovered: Array.from(session.giftRegistry.values())
  }));
  res.json({ success: true, streams: streamsList });
});

// 2. Fetch registry of gifts discovered for a particular username merged with all globally discovered cloud gifts
app.get('/api/streams/:username/gifts', (req, res) => {
  const username = req.params.username.toLowerCase().trim();
  const session = activeStreams.get(username);
  
  const localGifts = session ? Array.from(session.giftRegistry.values()) : [];
  const globalGifts = loadGlobalDiscoveredGifts();
  
  // Merge unique by giftName case-insensitive
  const mergedMap = new Map<string, any>();
  globalGifts.forEach(g => {
    mergedMap.set(g.giftName.toLowerCase(), g);
  });
  localGifts.forEach(g => {
    mergedMap.set(g.giftName.toLowerCase(), g);
  });
  
  res.json({ success: true, gifts: Array.from(mergedMap.values()) });
});

// 2.5 Explicit disconnection endpoint to release TikTok live webcast sockets manually
app.post('/api/streams/:username/disconnect', (req, res) => {
  const username = req.params.username.toLowerCase().trim();
  const session = activeStreams.get(username);
  if (session) {
    console.log(`[TikTok-Live] Explicit request to disconnect stream for @${username}`);
    try {
      session.connection.disconnect();
    } catch (err) {
      console.error(`Error explicitly disconnecting stream for @${username}:`, err);
    }
    activeStreams.delete(username);
    return res.json({ success: true, message: `Desconectado exitosamente de @${username}` });
  }
  res.json({ success: true, message: 'Ninguna sesión activa encontrada' });
});

// 3. SECURE IMAGE PROXY: Avoid cross-origin blocks, hotlink protections, and download/stream images 100% reliably
app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ error: 'url parameter is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image from source');
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error proxying image URL:', url, error.message);
    res.status(500).send('Error proxying image: ' + error.message);
  }
});

// Sound audio proxy to bypass CORS/hotlinking restrictions
app.get('/api/proxy-audio', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    let target = url;
    if (target.startsWith('/')) {
      target = `https://www.myinstants.com${target}`;
    }

    console.log(`[AudioProxy] Proxying URL: ${target}`);

    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://www.myinstants.com/',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      console.error(`[AudioProxy] Fetch from remote failed with status ${response.status} for ${target}`);
      return res.status(response.status).send(`Failed to fetch audio: status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross origin
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error: any) {
    console.error('[AudioProxy] Error proxying audio:', url, error.message);
    res.status(500).send('Error proxying audio: ' + error.message);
  }
});

// Cloud TTS proxy endpoints modeled after elements on adventure-8t03kq.fly.dev

// 1. StreamElements TTS endpoint
app.get('/api/tts', async (req, res) => {
  const voice = (req.query.voice as string) || 'Brian';
  const text = (req.query.text as string) || '';
  if (!text) {
    return res.status(400).send('text parameter is required');
  }
  try {
    const seUrl = `https://api.streamelements.com/nexus/v1/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    const response = await fetch(seUrl);
    if (!response.ok) {
      // Fallback proxy to adventure site if direct streamelements is erroring
      const fallbackUrl = `https://adventure-8t03kq.fly.dev/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
      const blockRes = await fetch(fallbackUrl);
      if (!blockRes.ok) {
        return res.status(500).send('TTS synthesis failure');
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(Buffer.from(await blockRes.arrayBuffer()));
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err: any) {
    console.error('[Server] StreamElements TTS Error:', err.message);
    res.status(500).send('StreamElements synthesis error: ' + err.message);
  }
});

// 2. Google Translate TTS endpoint
app.get('/api/gtts', async (req, res) => {
  const lang = (req.query.lang as string) || 'es';
  const text = (req.query.text as string) || '';
  if (!text) {
    return res.status(400).send('text parameter is required');
  }
  try {
    const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const response = await fetch(gttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      // Fallback proxy to adventure site
      const fallbackUrl = `https://adventure-8t03kq.fly.dev/api/gtts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
      const blockRes = await fetch(fallbackUrl);
      if (!blockRes.ok) {
        return res.status(500).send('GTTS synthesis failure');
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(Buffer.from(await blockRes.arrayBuffer()));
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err: any) {
    console.error('[Server] Google Translate TTS Error:', err.message);
    res.status(500).send('Google synthesis error: ' + err.message);
  }
});

// 3. TikTok TTS endpoint
app.get('/api/tiktok-tts', async (req, res) => {
  const voice = (req.query.voice as string) || 'es_002';
  const text = (req.query.text as string) || '';
  if (!text) {
    return res.status(400).send('text parameter is required');
  }
  try {
    // Proxy to adventure-8t03kq.fly.dev since they have complete TikTok sound signatures set up
    const targetUrl = `https://adventure-8t03kq.fly.dev/api/tiktok-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return res.status(500).send('TikTok TTS synthesis failed');
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err: any) {
    console.error('[Server] TikTok TTS Error:', err.message);
    res.status(500).send('TikTok TTS proxy error: ' + err.message);
  }
});

// 4. Edge TTS endpoint
app.get('/api/edge-tts', async (req, res) => {
  const voice = (req.query.voice as string) || 'es-CO-SalomeNeural';
  const text = (req.query.text as string) || '';
  if (!text) {
    return res.status(400).send('text parameter is required');
  }
  try {
    // Proxy to adventure-8t03kq.fly.dev since they have MS neural voices engine working 100%
    const targetUrl = `https://adventure-8t03kq.fly.dev/api/edge-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return res.status(500).send('Edge TTS synthesis failed');
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err: any) {
    console.error('[Server] Edge TTS Error:', err.message);
    res.status(500).send('Edge TTS proxy error: ' + err.message);
  }
});



const POPULAR_SOUNDS = [
  { name: 'Airhorn', url: 'https://www.myinstants.com/media/sounds/airhorn.mp3' },
  { name: 'Bruh', url: 'https://www.myinstants.com/media/sounds/bruh.mp3' },
  { name: 'Vine Boom', url: 'https://www.myinstants.com/media/sounds/vine-boom.mp3' },
  { name: 'Oof', url: 'https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3' },
  { name: 'Siuuu', url: 'https://www.myinstants.com/media/sounds/siuuu.mp3' },
  { name: 'Metal Pipe', url: 'https://www.myinstants.com/media/sounds/metal-pipe-falling-sound.mp3' },
  { name: 'Emotional Damage', url: 'https://www.myinstants.com/media/sounds/emotional-damage.mp3' },
  { name: 'Meme Scream', url: 'https://www.myinstants.com/media/sounds/meme-scream.mp3' },
  { name: 'Minecraft Oof', url: 'https://www.myinstants.com/media/sounds/minecraft-oof.mp3' },
  { name: 'Alert', url: 'https://www.myinstants.com/media/sounds/alert.mp3' },
  { name: 'Fail', url: 'https://www.myinstants.com/media/sounds/fail.mp3' },
  { name: 'Win', url: 'https://www.myinstants.com/media/sounds/win.mp3' },
  { name: 'Sad Violin', url: 'https://www.myinstants.com/media/sounds/sad-violin.mp3' },
  { name: 'Trollol', url: 'https://www.myinstants.com/media/sounds/troll-song.mp3' },
  { name: 'Nani', url: 'https://www.myinstants.com/media/sounds/nani_1.mp3' },
  { name: 'FBI Open Up', url: 'https://www.myinstants.com/media/sounds/fbi-open-up.mp3' },
  { name: 'Get Out', url: 'https://www.myinstants.com/media/sounds/get-out.mp3' },
  { name: 'Hello MF', url: 'https://www.myinstants.com/media/sounds/hello-motherfucker.mp3' },
  { name: 'Windows XP Error', url: 'https://www.myinstants.com/media/sounds/windows-xp-error.mp3' },
  { name: 'Laughing', url: 'https://www.myinstants.com/media/sounds/laughing-track.mp3' }
];

app.get('/api/sounds/popular', async (req, res) => {
  let results = [...POPULAR_SOUNDS];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://myinstants-api.vercel.app/best', { signal: controller.signal });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        results = [...results, ...data.slice(0, 20)];
      }
    }
  } catch (e) {
    console.warn('[PopularSounds] Enrichment failed, using local.');
  }
  res.json(results);
});

app.get('/api/sounds/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.json([]);
  
  let results: any[] = [];
  
  // Strategy 1: Vercel API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://myinstants-api.vercel.app/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      results = Array.isArray(data) ? data : (data.results || []);
      console.log(`[Search] Vercel API succeeded. Found ${results.length} sounds.`);
    }
  } catch (e) {
    console.warn('[Search] Vercel API failed:', e);
  }
  
  // Strategy 2: Scrape fallback
  if (results.length === 0) {
    try {
      const resp = await fetch(`https://www.myinstants.com/en/search/?name=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await resp.text();
      // Log a sample if it might be useful for debugging
      if (html.includes('id="results"')) {
        console.log('[Search] Found results container.');
      } else {
        console.warn('[Search] Results container not found in HTML.');
      }

      const blocks = html.split(/class=["']?instant["']?/i);
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        
        // Match both data-url and onclick for MP3 paths
        const urlMatch = block.match(/(?:data-url=["']|onclick=["']play\(['"])([^"']+?\.mp3)(?:['"]\))?["']/i);
        if (!urlMatch) continue;
        
        let soundPath = urlMatch[1];
        if (soundPath.startsWith('/')) soundPath = `https://www.myinstants.com${soundPath}`;
        
        // Match the title, allowing for nested tags
        const nameMatch = block.match(/class=["']?instant-link["']?[^>]*>([\s\S]*?)<\/a>/i);
        const name = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, '').trim() : 'Sonido';
        
        results.push({ name, url: soundPath });
      }
    } catch (e) {
      console.warn('[Search] Scraping failed:', e);
    }
  }
  res.json(results);
});

app.get('/api/sounds/play', async (req, res) => {
  const url = req.query.url as string;
  console.log(`[SoundSearch] Proxy play request for URL: ${url}`);
  // Loosen restriction: allow any URL from myinstants.com
  if (!url || !url.startsWith('https://www.myinstants.com/')) {
    console.warn(`[SoundSearch] Proxy play rejected URL: ${url}`);
    return res.status(400).send('Invalid audio URL');
  }
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.status(500).send('Proxy error');
  }
});

// Sound search proxy via the modern MyInstants REST API

app.get('/api/sound-search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.json([]);
  console.log(`[SoundSearch] Searching for term: "${q}"...`);
  try {
    const apiHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Referer': 'https://www.myinstants.com/',
      'Origin': 'https://www.myinstants.com'
    };

    let response;
    try {
      // Use a broader search URL or fallback
      const searchUrl = `https://www.myinstants.com/search/?name=${encodeURIComponent(q)}`;
      console.log(`[SoundSearch] Fetching from: ${searchUrl}`);
      
      response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
    } catch (apiFetchErr: any) {
      console.warn(`[SoundSearch] Official API fetch error: ${apiFetchErr.message}. Cascading to scrape fallback...`);
    }

    if (response) {
      const htmlText = await response.text();
      console.log(`[SoundSearch] Received HTML response length: ${htmlText.length}`);
      console.log(`[SoundSearch] Sample HTML (first 500 chars): ${htmlText.substring(0, 500)}`);
      
      // Regex que busca el bloque "instant" y captura data-url y el nombre dentro de "instant-link"
      const soundRegex = /data-url="([^"]+)"[\s\S]*?class="instant-link"[^>]*>([^<]+)/gi;
      const results = [];
      let match;
      while ((match = soundRegex.exec(htmlText)) !== null) {
        const [_, url, name] = match;
        
        console.log(`[SoundSearch] Regex matched! URL: ${url}, Name: ${name}`);
        
        const soundUrl = url.startsWith('http') ? url : `https://www.myinstants.com${url}`;
        
        results.push({
          name: name.trim() || 'Sin nombre',
          url: soundUrl
        });
      }

      console.log(`[SoundSearch] Scraped ${results.length} sounds from HTML`);
      
      // Si no encuentra nada, loguear un extracto más grande para investigar
      if (results.length === 0) {
        console.log(`[SoundSearch] No results found.`);
      }
    }

    const badStatus = response ? response.status : 'FETCH_ERR';
    console.warn(`[SoundSearch] Official API failed with status ${badStatus}. Executing official MyInstants HTML scrape fallback...`);
    
    // HTML Scrape Fallback
    const scrapeHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Referer': 'https://www.myinstants.com/'
    };

    // Try english or base search route - MyInstants redirects automatically or displays clean search page
    const scrapeResponse = await fetch(`https://www.myinstants.com/en/search/?name=${encodeURIComponent(q)}`, {
      headers: scrapeHeaders
    });

    if (!scrapeResponse.ok) {
      console.error(`[SoundSearch-Scraper] Scraper page also failed with status: ${scrapeResponse.status}`);
      return res.json([]);
    }

    const html = await scrapeResponse.text();
    const blocks = html.split(/class="instant"/i);
    const results: any[] = [];

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      // Search for play('file.mp3') pattern
      const playMatch = block.match(/play\(['"]([^'"]+\.mp3[^'"]*)['"]\)/i);
      if (!playMatch) continue;

      let soundPath = playMatch[1];
      if (soundPath.startsWith('/')) {
        soundPath = `https://www.myinstants.com${soundPath}`;
      }

      // Find descriptive titles - usually inside class="instant-link" anchor
      const nameMatch = block.match(/class="instant-link"[^>]*>([\s\S]*?)<\/a>/i) || block.match(/href="\/instant\/[^>]*>([\s\S]*?)<\/a>/i);
      const name = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, '').trim() : 'Sonido sin título';

      results.push({
        name,
        url: `/api/proxy-audio?url=${encodeURIComponent(soundPath)}`
      });
    }

    console.log(`[SoundSearch-Scraper] HTML Scraper parsed ${results.length} sounds successfully`);
    res.json(results);
  } catch (e: any) {
    console.error('[SoundSearch] Error searching sounds:', e);
    res.status(500).json({ error: String(e.message) });
  }
});

// Youtube search proxy for stream music playlist queue (!play Command) using Invidious and Piped instances
app.get('/api/youtube-search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.json([]);

  // Curated, fast and highly reliable public Invidious instances ordered by active state
  const invidiousInstances = [
    'https://invidious.nerdvpn.de',
    'https://invidious.privacydev.net',
    'https://invidious.vps.re',
    'https://invidious.lre.io',
    'https://yewtu.be',
    'https://invidious.disroot.org',
    'https://invidious.projectsegfau.lt',
    'https://inv.nadeko.net',
    'https://yt.artemislena.eu',
    'https://y.com.sb',
    'https://invidious.no-logs.com'
  ];

  // Stable Piped API endpoints
  const pipedInstances = [
    'https://pipedapi.lunar.icu',
    'https://pipedapi.colby.cloud',
    'https://pipedapi.sugoma.lol',
    'https://pipedapi.adminforge.de',
    'https://api.piped.yt'
  ];

  let successData = null;

  // 1. Try Invidious instances (Optimized with low timeout to prevent blocking/hanging)
  for (const baseUrl of invidiousInstances) {
    console.log(`[YoutubeSearch] Attempting search via Invidious instance (${baseUrl}) for: "${q}"...`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800); // Snappy 1.8s timeout per instance
      
      const response = await fetch(`${baseUrl}/api/v1/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      clearTimeout(timeout);

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          const formatted = items
            .filter((item: any) => item.type === 'video' || !item.type)
            .map((item: any) => {
              const videoId = item.videoId;
              const lengthSeconds = item.lengthSeconds || 0;
              const mins = Math.floor(lengthSeconds / 60);
              const secs = lengthSeconds % 60;
              const durationStr = lengthSeconds > 0 ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : '3:15';
              
              return {
                videoId,
                title: item.title || 'Video de Youtube',
                thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: durationStr,
                channel: item.author || 'Invidious'
              };
            });
          
          if (formatted.length > 0) {
            console.log(`[YoutubeSearch] Success compiling results from Invidious instance (${baseUrl}). Found ${formatted.length} entries.`);
            successData = formatted.slice(0, 5);
            break; // Exit instances loop
          }
        }
      } else {
        console.warn(`[YoutubeSearch] Invidious instance (${baseUrl}) returned bad status: ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[YoutubeSearch] Failed to fetch from Invidious instance (${baseUrl}): ${err.message}`);
    }
  }

  // 2. Try Piped API instances if Invidious failed
  if (!successData) {
    for (const baseUrl of pipedInstances) {
      console.log(`[YoutubeSearch] Attempting search via Piped instance (${baseUrl}) for: "${q}"...`);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800); // Snappy 1.8s timeout per instance
        
        const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(q)}&filter=videos`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        clearTimeout(timeout);

        if (response.ok) {
          let items = await response.json();
          if (!Array.isArray(items) && items && typeof items === 'object') {
            items = items.items || items.streams || [];
          }

          if (Array.isArray(items) && items.length > 0) {
            const formatted = items
              .map((item: any) => {
                let videoId = item.videoId;
                if (!videoId && item.url) {
                  const urlParts = item.url.split('v=');
                  if (urlParts.length > 1) {
                    videoId = urlParts[1];
                  }
                }
                if (!videoId) return null;

                const lengthSeconds = item.duration || 0;
                let durationStr = '3:15';
                if (typeof lengthSeconds === 'number' && lengthSeconds > 0) {
                  const mins = Math.floor(lengthSeconds / 60);
                  const secs = lengthSeconds % 60;
                  durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                } else if (typeof lengthSeconds === 'string') {
                  durationStr = lengthSeconds;
                }

                return {
                  videoId,
                  title: item.title || 'Video de Youtube',
                  thumbnail: item.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                  duration: durationStr,
                  channel: item.uploaderName || item.author || 'Piped'
                };
              })
              .filter(Boolean);

            if (formatted.length > 0) {
               console.log(`[YoutubeSearch] Success compiling results from Piped instance (${baseUrl}). Found ${formatted.length} entries.`);
              successData = formatted.slice(0, 5);
              break;
            }
          }
        } else {
          console.warn(`[YoutubeSearch] Piped instance (${baseUrl}) returned bad status: ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[YoutubeSearch] Failed to fetch from Piped instance (${baseUrl}): ${err.message}`);
      }
    }
  }

  if (successData) {
    return res.json(successData);
  }

  // 3. Fallback to official YouTube HTML extraction with Cookie bypass headers if all proxies fail
  console.log(`[YoutubeSearch] All Invidious and Piped alternate APIs failed. Executing official YouTube HTML scrape fallback with bypass headers...`);
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        // SOCS and CONSENT cookies bypass the Google consent screen entirely, serving straight search results
        'Cookie': 'CONSENT=YES+cb.20230531-04-p0.es+FX+999; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVzIAEaBgiA_LyaBg; YSC=; VISITOR_INFO1_LIVE='
      }
    });
    const html = await response.text();
    
    // Balanced curly brace parser to safely extract ytInitialData JSON without breaking on embedded strings
    const extractYtInitialData = (rawHtml: string): any => {
      const searchStr = 'ytInitialData';
      const index = rawHtml.indexOf(searchStr);
      if (index === -1) return null;
      
      const braceIndex = rawHtml.indexOf('{', index);
      if (braceIndex === -1) return null;
      
      // Attempt clean script tag end bound parser first (works 99% of cases and handles multiline structures seamlessly)
      const scriptEndIdx = rawHtml.indexOf('</script>', braceIndex);
      if (scriptEndIdx !== -1) {
        let candidateStr = rawHtml.substring(braceIndex, scriptEndIdx).trim();
        if (candidateStr.endsWith(';')) {
          candidateStr = candidateStr.slice(0, -1);
        }
        try {
          return JSON.parse(candidateStr);
        } catch (e) {
          // Failure passes through to brace-by-brace search fallback
        }
      }

      let braceCount = 1;
      let inString = false;
      let escape = false;
      let i = braceIndex + 1;
      const len = rawHtml.length;
      
      while (i < len && braceCount > 0) {
        const char = rawHtml[i];
        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
          }
        }
        i++;
      }
      
      if (braceCount === 0) {
        const jsonStr = rawHtml.substring(braceIndex, i);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('[YoutubeSearch] Balanced JSON parse error:', e);
        }
      }
      return null;
    };

    // Helper to recursively find all videoRenderer occurrences in ytInitialData
    const findVideoRenderers = (obj: any, collected: any[] = []): any[] => {
      if (!obj || typeof obj !== 'object') return collected;
      if (obj.videoRenderer) {
        collected.push(obj.videoRenderer);
      } else {
        for (const key of Object.keys(obj)) {
          findVideoRenderers(obj[key], collected);
        }
      }
      return collected;
    };

    let songs = [];
    const initialData = extractYtInitialData(html);
    if (initialData) {
      try {
        const renderers = findVideoRenderers(initialData);
        for (const vr of renderers) {
          const videoId = vr.videoId;
          if (videoId) {
            const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'Video de Youtube';
            const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            const duration = vr.lengthText?.simpleText || '0:00';
            const channel = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'Youtube';
            songs.push({
              videoId,
              title,
              thumbnail,
              duration,
              channel
            });
          }
        }
      } catch (e) {
        console.error('[YoutubeSearch] Parsing videoRenderers tree error:', e);
      }
    }
    
    // Safety Fallback regex for URLs (only if parsed JSON was empty)
    if (songs.length === 0) {
      console.log('[YoutubeSearch] JSON extraction empty/failed. Attempting HTML parser fallback matcher');
      const regex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      const seen = new Set<string>();
      let rMatch;
      while ((rMatch = regex.exec(html)) !== null && songs.length < 5) {
        const videoId = rMatch[1];
        if (!seen.has(videoId)) {
          seen.add(videoId);
          songs.push({
            videoId,
            title: `Canción de Youtube (ID: ${videoId})`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            duration: '3:00',
            channel: 'Youtube'
          });
        }
      }
    }
    
    // 4. ULTIMATE INTUITIVE FALLBACK: Get exact official YouTube video ID using Gemini Knowledge prediction
    if (songs.length === 0 && aiClient) {
      console.log(`[YoutubeSearch] Scraper/Proxies returned empty. Launching Gemini intelligence search backup for word: "${q}"...`);
      try {
        const geminiResponse = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Provide a highly precise official YouTube 11-char videoId for the search query: "${q}".
Respond with a single JSON object (no markdown, no backticks) with the structure:
{
  "videoId": "string",
  "title": "string",
  "channel": "string",
  "duration": "string"
}`,
          config: {
            responseMimeType: "application/json"
          }
        });
        const responseText = geminiResponse.text?.trim();
        if (responseText) {
          const parsed = JSON.parse(responseText);
          if (parsed && typeof parsed === 'object' && parsed.videoId) {
            console.log(`[YoutubeSearch] Gemini intelligently resolved videoId (${parsed.videoId}) for: "${q}"`);
            songs.push({
              videoId: parsed.videoId,
              title: parsed.title || q,
              thumbnail: `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`,
              duration: parsed.duration || '3:30',
              channel: parsed.channel || 'Artist/Topic'
            });
          }
        }
      } catch (gemIniErr: any) {
        console.warn('[YoutubeSearch] Gemini video ID fallback failed:', gemIniErr.message);
      }
    }

    console.log(`[YoutubeSearch] Scraper/Fallback returned ${songs.length} entries for "${q}"`);
    res.json(songs.slice(0, 5));
  } catch (fallbackErr: any) {
    console.error('[YoutubeSearch] Fallback scraper failed too:', fallbackErr);
    res.status(500).json({ error: fallbackErr.message });
  }
});

// Helper function using token-based similarity to prevent duplicate songs with slightly different names
function isSimilarSongTitle(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;
  
  const clean = (t: string) => {
    return t.toLowerCase()
      .replace(/[\(\[\{\}\]\)\-\/\\_]/g, ' ') // replace symbols and brackets with space
      .replace(/(official|music|video|lyric|audio|remix|feat|ft\.|live|hq|hd|remaster|cover|4k|mix|radio|edit|soundtrack|version|original|clip|studio)/g, '') // remove common metadata labels
      .replace(/[^a-z0-9\s]/g, '') // remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 2); // only keep words/tokens of length > 2
  };
  
  const wordsA = clean(titleA);
  const wordsB = clean(titleB);
  
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  
  // Count keyword overlaps between titleA and titleB
  let matchCount = 0;
  for (const w of wordsA) {
    if (wordsB.includes(w)) matchCount++;
  }
  
  const ratioA = matchCount / wordsA.length;
  const ratioB = matchCount / wordsB.length;
  
  // If more than 55% of key terms match, consider them the same track
  return ratioA > 0.55 || ratioB > 0.55;
}

// DJ AI recommendation endpoint for finding similar stream songs
app.get('/api/similar-song', async (req, res) => {
  const title = (req.query.title as string || '').trim();
  
  // Parse songs to exclude
  let excludeList: string[] = [];
  try {
    const excludeRaw = req.query.exclude as string;
    if (excludeRaw) {
      const parsed = JSON.parse(excludeRaw);
      if (Array.isArray(parsed)) {
        excludeList = parsed.map((item: any) => String(item).trim());
      }
    }
  } catch (err) {
    console.warn('[similar-song] Failed parsing exclude query:', err);
  }

  // Expanded high-fidelity fallback song database (+100 tracks across 7 different stream vibes)
  const STREAM_FALLBACK_SONGS = [
    // EDM / Progressive / Electro
    "Alan Walker - Faded",
    "Darude - Sandstorm",
    "Avicii - Levels",
    "The Fat Rat - Unity",
    "Marshmello - Alone",
    "Martin Garrix - Animals",
    "Skrillex - Bangarang",
    "Gigi D'Agostino - L'Amour Toujours",
    "Calvin Harris - Summer",
    "OMFG - Hello",
    "Daft Punk - One More Time",
    "Vicetone & Tony Igy - Astronomia",
    "PSY - Gangnam Style",
    "Marshmello - Happier",
    "Clean Bandit - Rather Be",
    "Swedish House Mafia - Don't You Worry Child",
    "Avicii - Wake Me Up",
    "Zedd - Clarity",
    "David Guetta - Titanium ft. Sia",
    "Tiësto - The Business",
    "The Chainsmokers - Closer",
    "Calvin Harris - Feel So Close",
    "Kid Cudi - Pursuit Of Happiness (Steve Aoki Remix)",
    "Major Lazer & DJ Snake - Lean On",
    "DJ Snake - Turn Down for What",
    "Daft Punk - Get Lucky",
    "Deadmau5 - Strobe",
    "Alesso - Heroes",
    "Kygo - Firestone",
    "Steve Aoki - Boneless",
    "Martin Garrix - Tremor",
    "Dynoro - In My Mind",
    "Gala - Freed From Desire",
    "Aaron Smith - Dancin (Krono Remix)",
    "SAINt JHN - Roses (Imanbek Remix)",
    "Riton x Nightcrawlers - Friday",
    "Shouse - Love Tonight",
    "Fred again.. - Marea (We've Lost Dancing)",
    "Disclosure - Latch ft. Sam Smith",
    "Rufus Du Sol - On My Knees",
    "Peggy Gou - (It Goes Like) Nanana",
    "Fisher - Losing It",
    "Acraze - Do It To It",
    "Dom Dolla - Rhyme Dust",
    "John Summit - Where You Are",
    "Tiësto - Red Lights",
    "Alice Deejay - Better Off Alone",
    "Eiffel 65 - Blue (Da Ba Dee)",
    "Vengaboys - Boom, Boom, Boom, Boom!!",
    "Corona - The Rhythm of the Night",
    "Haddaway - What Is Love",
    "Robert Miles - Children",
    "Otto Knows - Million Voices",
    "Sebastian Ingrosso - Reload",
    "Kaskade - Disarm You",
    "Disclosure - You & Me (Flume Remix)",
    "RL Grime - Core",
    "San Holo - Light",
    "Illenium - Crawl Outta Love",
    "Gryffin - Feel Good",
    "Zedd - Stay The Night",
    
    // Synthwave / Cyber / Retro
    "Kavinsky - Nightcall",
    "The Midnight - Sunset",
    "M83 - Midnight City",
    "Lazerhawk - King of the Streets",
    "Carpenter Brut - Turbo Killer",
    "FM-84 - Running In the Night",
    "Initial D - Deja Vu",
    "Initial D - Running in the 90s",
    "Dave Rodgers - Space Boy",
    
    // Chillout / Lofi / Study Beats
    "Lofi Girl - Snowman",
    "Idealism - Phantasia",
    "jinsang - Smile from U",
    "shiloh dynasty - losing interest",
    "Nujabes - Feather",
    "Nujabes - Luv(sic) Part 3",
    "Saib - Spike Spiegel",
    "BSY - Floating",
    "Elijah Who - sad and solo",
    "Kalaido - Sasanami",
    "Wun Two - Again",
    
    // Gaming Vibes & NCS classics
    "Alan Walker - Spectre",
    "Tobu - Hope",
    "Cartoon - On & On",
    "Deaf Kev - Invincible",
    "Different Heaven & EH!DE - My Heart",
    "Sub Urban - Cradles",
    "RetroVision - Puzzle",
    
    // Rock / Metal Anthem Energetic Remixes
    "Linkin Park - In The End (Mellen Gi Remix)",
    "Metallica - Master of Puppets",
    "System Of A Down - Chop Suey!",
    "Evanescence - Bring Me To Life",
    "AC/DC - Highway to Hell",
    "Bon Jovi - Livin' On A Prayer",
    "Nirvana - Smells Like Teen Spirit",

    // Latin / Danceable Urban Hits
    "Gente de Zona - La Gozadera ft. Marc Anthony",
    "El Chombo - Chacarron",
    "Don Omar - Danza Kuduro",
    "Daddy Yankee - Gasolina",
    "Enrique Iglesias - Bailando",
    "J Balvin - Mi Gente",
    "Farruko - Pepas"
  ];

  // Filter out any songs that are similar to the ones already present in client queue
  const filteredFallbacks = STREAM_FALLBACK_SONGS.filter(song => {
    return !excludeList.some(exclude => isSimilarSongTitle(song, exclude));
  });

  const getRandomSong = () => {
    const listToChoose = filteredFallbacks.length > 0 ? filteredFallbacks : STREAM_FALLBACK_SONGS;
    const idx = Math.floor(Math.random() * listToChoose.length);
    return listToChoose[idx];
  };

  if (!title) {
    return res.json({ title: getRandomSong(), reason: "Música aleatoria para animar la transmisión sin repetir." });
  }

  // If Gemini client is ready and configured, let's use it for highly personalized recommendations
  if (aiClient) {
    try {
      console.log(`[similar-song] Querying Gemini for a song similar to: "${title}" (excluding ${excludeList.length} tracks)...`);
      
      let systemInstruction = "You are an expert streaming DJ named DJ Towa. Always return a single JSON object. Choose a real, well-known song name and artist.";
      let userPrompt = `Recommend exactly ONE similar popular, high-energy, viral, electro, lofi, or stream-alert friendly song that matches the speed, theme, or feel of the input song: "${title}".`;
      
      if (excludeList.length > 0) {
        userPrompt += `\n\nCRITICAL DO NOT REPEAT RULE: Do NOT recommend any of the following songs, nor any covers/remixes of them, as they have been played recently:\n${excludeList.slice(-15).join(', ')}\nKeep the recommendation completely different, fresh, and exciting!`;
      }
      
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { 
                type: Type.STRING,
                description: "The recommended song name and artist (e.g. 'Avicii - Levels' or 'Slayer - Raining Blood')"
              },
              reason: {
                type: Type.STRING,
                description: "A very brief explanation in Spanish of why this song fits"
              }
            },
            required: ["title", "reason"]
          }
        }
      });

      const textOutput = response.text?.trim() || '';
      console.log(`[similar-song] Gemini recommended response:`, textOutput);
      if (textOutput) {
        const parsed = JSON.parse(textOutput);
        if (parsed && parsed.title) {
          // Double-check recommendation against the smart similarity checker
          const recommendationIsExcluded = excludeList.some(exclude => isSimilarSongTitle(parsed.title, exclude));
          if (!recommendationIsExcluded) {
            return res.json({
              title: parsed.title,
              reason: parsed.reason || "Vibras similares recomendadas por tu DJ Towa."
            });
          } else {
            console.log(`[similar-song] Gemini recommended a duplicate: "${parsed.title}". Dropping it for smart fallback.`);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[similar-song] Gemini call failed or parsed incorrectly, resorting to high-quality fallback:`, err.message);
    }
  }

  // Graceful local smart fallback if Gemini is unconfigured, disabled, or recommends a recent duplicate
  const lowercaseTitle = title.toLowerCase();
  
  let selectedFallback = "";
  let fallbackReason = "Canción viral seleccionada para mantener activa la energía del chat.";

  if (lowercaseTitle.includes("lofi") || lowercaseTitle.includes("sleep") || lowercaseTitle.includes("relax") || lowercaseTitle.includes("chill")) {
    const lofiOptions = filteredFallbacks.filter(s => s.toLowerCase().includes("lofi") || s.toLowerCase().includes("shiloh") || s.toLowerCase().includes("nujabes") || s.toLowerCase().includes("saib"));
    selectedFallback = lofiOptions.length > 0 ? lofiOptions[Math.floor(Math.random() * lofiOptions.length)] : "Lofi Girl - Snowman";
    fallbackReason = "Vibras relajadas de estudio para acompañar el mood lofi del stream.";
  } else if (lowercaseTitle.includes("metal") || lowercaseTitle.includes("rock") || lowercaseTitle.includes("guitar")) {
    const rockOptions = filteredFallbacks.filter(s => s.toLowerCase().includes("metallica") || s.toLowerCase().includes("linkin") || s.toLowerCase().includes("nirvana") || s.toLowerCase().includes("system"));
    selectedFallback = rockOptions.length > 0 ? rockOptions[Math.floor(Math.random() * rockOptions.length)] : "Metallica - Master of Puppets";
    fallbackReason = "Vibras metaleras y rockeras para reventar los parlantes.";
  } else if (lowercaseTitle.includes("reggae") || lowercaseTitle.includes("urbano") || lowercaseTitle.includes("latin") || lowercaseTitle.includes("reggaeton") || lowercaseTitle.includes("dance")) {
    const latinOptions = filteredFallbacks.filter(s => s.toLowerCase().includes("gozadera") || s.toLowerCase().includes("chacarron") || s.toLowerCase().includes("daddy") || s.toLowerCase().includes("don omar") || s.toLowerCase().includes("pepas"));
    selectedFallback = latinOptions.length > 0 ? latinOptions[Math.floor(Math.random() * latinOptions.length)] : "Gente de Zona - La Gozadera ft. Marc Anthony";
    fallbackReason = "Energía bailable y ritmos urbanos imperdibles para el livestream.";
  } else if (lowercaseTitle.includes("anime") || lowercaseTitle.includes("gaming") || lowercaseTitle.includes("cyber") || lowercaseTitle.includes("eurobeat")) {
    const eurobeatOptions = filteredFallbacks.filter(s => s.toLowerCase().includes("deja vu") || s.toLowerCase().includes("90s") || s.toLowerCase().includes("unity") || s.toLowerCase().includes("hello") || s.toLowerCase().includes("hope"));
    selectedFallback = eurobeatOptions.length > 0 ? eurobeatOptions[Math.floor(Math.random() * eurobeatOptions.length)] : "Initial D - Deja Vu";
    fallbackReason = "Hype y eurobeat bailable legendario para animar a full.";
  }

  if (!selectedFallback) {
    selectedFallback = getRandomSong();
  }

  return res.json({
    title: selectedFallback,
    reason: fallbackReason
  });
});

// 3.5. PERSISTENT REGISTRY OF SOUND AND IMAGE MAPPINGS
const MAPPINGS_FILE_PATH = path.join(process.cwd(), 'mappings.json');

function loadAllMappings(): Record<string, any[]> {
  try {
    if (fs.existsSync(MAPPINGS_FILE_PATH)) {
      const data = fs.readFileSync(MAPPINGS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[MappingsStore] Error reading mappings file:', err);
  }
  return {};
}

function saveAllMappings(mappings: Record<string, any[]>) {
  try {
    fs.writeFileSync(MAPPINGS_FILE_PATH, JSON.stringify(mappings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[MappingsStore] Error writing mappings file:', err);
  }
}

// REST endpoints for mappings CRUD
app.get('/api/mappings', (req, res) => {
  const username = (req.query.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }
  const allMappings = loadAllMappings();
  const userMappings = allMappings[username] || [];
  console.log(`[MappingsStore] Loaded ${userMappings.length} mappings for ${username}`);
  res.json({ success: true, mappings: userMappings });
});

app.post('/api/mappings', (req, res) => {
  const username = (req.query.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }
  const { mappings } = req.body;
  if (!Array.isArray(mappings)) {
    return res.status(400).json({ error: 'Mappings block must be an array' });
  }
  
  const allMappings = loadAllMappings();
  allMappings[username] = mappings;
  saveAllMappings(allMappings);
  
  console.log(`[MappingsStore] Saved ${mappings.length} mappings for ${username}`);
  res.json({ success: true });
});

// 3.6. PERSISTENT REGISTRY OF UNIFIED USER CONFIGS
const CONFIGS_FILE_PATH = path.join(process.cwd(), 'user_configs.json');

function loadAllUserConfigs(): Record<string, any> {
  try {
    if (fs.existsSync(CONFIGS_FILE_PATH)) {
      const data = fs.readFileSync(CONFIGS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[ConfigStore] Error reading user configs file:', err);
  }
  return {};
}

function saveAllUserConfigs(configs: Record<string, any>) {
  try {
    fs.writeFileSync(CONFIGS_FILE_PATH, JSON.stringify(configs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ConfigStore] Error writing user configs file:', err);
  }
}

app.get('/api/user-config', (req, res) => {
  const username = (req.query.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }
  const allConfigs = loadAllUserConfigs();
  const config = allConfigs[username] || null;
  console.log(`[ConfigStore] Loaded config for ${username}`);
  res.json({ success: true, config });
});

app.post('/api/user-config', (req, res) => {
  const username = (req.query.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Config body is required' });
  }
  const allConfigs = loadAllUserConfigs();
  allConfigs[username] = config;
  saveAllUserConfigs(allConfigs);
  console.log(`[ConfigStore] Saved config for ${username}`);
  res.json({ success: true });
});

// Support local public uploads directory for custom MP3 binary sounds
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// REST route to serve custom uploaded MP3 files across all devices 
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// REST endpoint to upload custom base64 encoded MP3 audio data
app.post('/api/upload-sound', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or base64Data' });
    }

    // Strip header if present (e.g., data:audio/mpeg;base64,...)
    let cleanBase64 = base64Data;
    if (base64Data.includes(';base64,')) {
      cleanBase64 = base64Data.split(';base64,')[1];
    }

    // Generate unique name to prevent collisions
    const fileExt = path.extname(filename) || '.mp3';
    const baseName = path.basename(filename, fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFilename = `${Date.now()}_${baseName}${fileExt}`;
    const targetFilePath = path.join(UPLOADS_DIR, uniqueFilename);

    console.log(`[UploadSound] Saving uploaded custom MP3: ${uniqueFilename} (${cleanBase64.length} bytes encoded)`);
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(targetFilePath, buffer);

    // Return the virtual relative URL which can be loaded on any browser or OBS overlay perfectly
    const relativeUrl = `/uploads/${uniqueFilename}`;
    res.json({ success: true, url: relativeUrl });
  } catch (error) {
    console.error('[UploadSound] Error handling custom audio upload:', error);
    res.status(500).json({ error: 'Internal server error processing audio file upload' });
  }
});

// 4. REALTIME SSE CHANNEL: Connecting client directly to live streams
app.get('/api/events', (req, res) => {
  const rawUsername = req.query.username as string;
  if (!rawUsername) {
    return res.status(400).json({ error: 'username parameter is required' });
  }

  const username = rawUsername.toLowerCase().trim();
  const sessionId = (req.query.sessionId as string || '').trim();
  const premium = req.query.premium === 'true';
  const connectionKey = (req.query.connectionKey as string || '').trim();

  // SSE Setup headers optimized for immediate, zero-buffered real-time transmission
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevents Nginx/proxies from buffering SSE stream
  res.flushHeaders();

  // Send a lightweight comment heartbeat every 15 seconds to prevent connection drops by intermediate proxies
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(':\n\n');
    } catch (e) {
      // Ignore write errors to closed sockets
    }
  }, 15000);

  // Helper function to send SSE packet to this connection
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('info', { message: `Subscribed to server loop for @${username} (Premium: ${premium})` });

  // Get or check if TikTok webcast session exists
  let session = activeStreams.get(username);

  if (!session) {
    try {
      let tiktokConn: any;

      if (premium) {
        console.log(`[TikTok-Live] Creating new Premium High-Speed WebSocket client for @${username}`);
        tiktokConn = new PremiumHighSpeedConnection(username, connectionKey);
      } else {
        console.log(`[TikTok-Live] Creating new WebcastPushConnection for @${username} (SessionID: ${sessionId ? 'PROVIDED' : 'NONE'})`);
        const connectionOptions: any = {
          enableExtendedGiftInfo: true,
        };

        if (sessionId) {
          connectionOptions.sessionId = sessionId;
          connectionOptions.requestOptions = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
              'Origin': 'https://www.tiktok.com',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cookie': `sessionid=${sessionId}`
            }
          };
          connectionOptions.websocketOptions = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
              'Origin': 'https://www.tiktok.com',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cookie': `sessionid=${sessionId}`
            }
          };
        } else {
          connectionOptions.requestOptions = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
              'Origin': 'https://www.tiktok.com',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          };
          connectionOptions.websocketOptions = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
              'Origin': 'https://www.tiktok.com',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          };
        }

        tiktokConn = new WebcastPushConnection(username, connectionOptions);
      }

      session = {
        connection: tiktokConn,
        clients: new Set([res]),
        giftRegistry: new Map(),
        userName: username,
        isConnected: false,
        eventBuffer: []
      };

      activeStreams.set(username, session);

      let hasSentError = false;

      // Distribute events helper
      const broadcast = (eventName: string, payload: any) => {
        if (eventName === 'tiktokError') {
          hasSentError = true;
        }
        const streamData = activeStreams.get(username);
        if (streamData) {
          // Store events in circular buffer to replay for sleeping/reconnecting mobile devices
          if (eventName !== 'roomUser' && eventName !== 'connected' && eventName !== 'disconnected') {
            if (!streamData.eventBuffer) streamData.eventBuffer = [];
            streamData.eventBuffer.push({ eventName, payload, timestamp: Date.now() });
            if (streamData.eventBuffer.length > 200) {
              streamData.eventBuffer.shift();
            }
          }

          streamData.clients.forEach((clientRes) => {
            try {
              clientRes.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
            } catch (err) {
              console.error(`[SSE] Failed writing event to active viewer of @${username}`, err);
            }
          });
        }
      };

      // Wire up listeners only once on webcast connection
      tiktokConn.on('connected', (state: any) => {
        console.log(`[TikTok-Live] @${username} connected successfully. Room ID: ${state.roomId}`);
        if (session) {
          session.isConnected = true;
          session.roomId = state.roomId;
        }
        broadcast('connected', { roomId: state.roomId, isLive: true });
      });

      tiktokConn.on('disconnected', () => {
        console.log(`[TikTok-Live] @${username} disconnected from TikTok`);
        if (session) {
          session.isConnected = false;
        }
        broadcast('disconnected', { message: 'Disconnected from TikTok servers' });
        // Clean up dead session from activeStreams map so subsequent client retries recreate clean links
        activeStreams.delete(username);
      });

      tiktokConn.on('chat', (data: any) => {
        broadcast('chat', {
          id: `${data.msgId || Date.now()}-${Math.random()}`,
          type: 'chat',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          isModerator: !!data.isModerator,
          comment: data.comment,
          timestamp: Date.now()
        });
      });

      tiktokConn.on('gift', (data: any) => {
        // Safe check for gift pictures
        const giftPic = data.giftPictureUrl || (data.giftIcon && data.giftIcon.url_list && data.giftIcon.url_list[0]) || '';
        
        const giftObj = {
          giftId: data.giftId,
          giftName: data.giftName,
          giftPictureUrl: giftPic,
          diamondCount: data.diamondCount || 1
        };

        // Save to global session registry so client can inspect discovered gifts!
        if (session && data.giftName) {
          session.giftRegistry.set(data.giftName, giftObj);
          
          // CRITICAL: save to cloud storage for all creators!
          try {
            saveGlobalDiscoveredGift(giftObj);
          } catch (cloudErr) {
            console.error('[GlobalGiftsStore] Failed writing gift to global cloud backup:', cloudErr);
          }
        }

        broadcast('gift', {
          id: `${data.msgId || Date.now()}-${Math.random()}`,
          type: 'gift',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now(),
          gift: {
            giftId: data.giftId,
            giftName: data.giftName,
            describe: data.describe || `Sent ${data.giftName}`,
            repeatCount: data.repeatCount || 1,
            repeatEnd: data.repeatEnd !== undefined ? data.repeatEnd : true,
            giftPictureUrl: giftPic,
            diamondCount: data.diamondCount || 1
          }
        });
      });

      tiktokConn.on('like', (data: any) => {
        broadcast('like', {
          id: `${Date.now()}-${Math.random()}`,
          type: 'like',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now(),
          like: {
            likeCount: data.likeCount || 1,
            totalLikeCount: data.totalLikeCount
          }
        });
      });

      tiktokConn.on('roomUser', (data: any) => {
        broadcast('roomUser', {
          viewerCount: data.viewerCount || 0,
          likeCount: data.likeCount || data.totalLikeCount || 0
        });
      });

      tiktokConn.on('member', (data: any) => {
        broadcast('member', {
          id: `${Date.now()}-${Math.random()}`,
          type: 'member',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now()
        });
      });

      tiktokConn.on('subscribe', (data: any) => {
        broadcast('subscribe', {
          id: `${Date.now()}-${Math.random()}`,
          type: 'subscribe',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now()
        });
      });

      tiktokConn.on('follow', (data: any) => {
        broadcast('follow', {
          id: `${Date.now()}-${Math.random()}`,
          type: 'follow',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now()
        });
      });

      tiktokConn.on('share', (data: any) => {
        broadcast('share', {
          id: `${Date.now()}-${Math.random()}`,
          type: 'share',
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          timestamp: Date.now()
        });
      });

      tiktokConn.on('streamEnd', () => {
        console.log(`[TikTok-Live] @${username} stream ended`);
        broadcast('streamEnd', { message: 'The creator has ended their stream.' });
        // Clean up dead session
        activeStreams.delete(username);
      });

      tiktokConn.on('error', (err: any) => {
        if (err.message && err.message.includes('UserOfflineError')) {
          console.warn(`[TikTok-Live] @${username} is currently offline. Skipping.`);
        } else {
          console.error(`[TikTok-Live] Error on @${username}:`, err);
        }
        let errMsg = 'Error de conexión.';
        if (err) {
          if (typeof err === 'string') {
            errMsg = err;
          } else if (err.exception) {
            errMsg = String(err.exception);
          } else if (err.message) {
            errMsg = err.message;
          } else if (err.info) {
            errMsg = String(err.info);
          } else {
            try {
              errMsg = JSON.stringify(err);
            } catch (e) {
              errMsg = String(err);
            }
          }
        }

        // Translate specific common TikTok webcast session issues
        if (errMsg.includes('Unexpected server response: 200') || errMsg.includes('failed') || errMsg.includes('Websocket connection failed')) {
          errMsg = 'Conexión de servidor rechazada (Código 200). TikTok ha limitado temporalmente las conexiones o la transmisión está inactiva/offline. Intenta con otro creador o reintenta en unos minutos.';
        }

        broadcast('tiktokError', { error: errMsg });
        // Clean up dead session
        activeStreams.delete(username);
      });

      // Initiate connection
      tiktokConn.connect().catch((err: any) => {
        const errStr = err ? (err.message || String(err)) : 'undefined';
        if (errStr.includes('UserOfflineError')) {
          console.warn(`[TikTok-Live] @${username} is currently offline. Skipping.`);
        } else {
          console.error(`[TikTok-Live] @${username} failed basic initial connection:`, errStr);
        }
        activeStreams.delete(username); // Clear failed session
        if (!hasSentError) {
          let errMsg = `No se pudo conectar a @${username}. Asegúrate de que el creador esté EN VIVO`;
          if (errStr.includes('Unexpected server response: 200') || errStr.includes('Websocket connection failed')) {
            errMsg = 'Conexión de servidor rechazada (Código 200). TikTok ha limitado temporalmente las conexiones o la transmisión está inactiva/offline. Intenta con otro creador o reintenta en unos minutos.';
          }
          broadcast('tiktokError', { error: errMsg });
        }
      });

    } catch (e: any) {
      console.error('Error creating WebcastPushConnection:', e);
      return res.status(500).json({ error: e.message || String(e) });
    }
  } else {
    // If the webcast connection is already connected, notify this specific client instantly upon joining
    if (session.isConnected) {
      sendEvent('connected', { roomId: session.roomId || '', isLive: true });
    }
    
    // REPLAY MISSED EVENTS FOR RECONNECTING MOBILE CLIENTS ("aunque se apague el celular")
    const since = parseInt(req.query.since as string || '0', 10);
    if (since > 0 && session.eventBuffer && session.eventBuffer.length > 0) {
      const missed = session.eventBuffer.filter((ev: any) => ev.timestamp > since);
      if (missed.length > 0) {
        console.log(`[SSE] Replaying ${missed.length} missed events to reconnecting client for @${username}`);
        missed.forEach((ev: any) => {
          sendEvent(ev.eventName, ev.payload);
        });
      }
    }
  }

  // Register client
  session.clients.add(res);
  console.log(`[SSE] New subscriber joined loop @${username}. Total active connections: ${session.clients.size}`);

  // Emit currently cached registry to this client on connection so they don't miss already-discovered gifts!
  if (session.giftRegistry.size > 0) {
    sendEvent('cachedGifts', Array.from(session.giftRegistry.values()));
  }

  // Cleanup on close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    if (session) {
      session.clients.delete(res);
      console.log(`[SSE] Client disconnected from @${username}. Remaining clients: ${session.clients.size}`);
      
      // Keep active connection constant in the background even if the mobile device sleeps or locks.
      // We wait for 4 hours (14400000 ms) before terminating the TikTok bridge automatically.
      if (session.clients.size === 0) {
        console.log(`[TikTok-Live] All viewer tabs closed for @${username}. Initiating stable 4-hour background session...`);
        setTimeout(() => {
          const currentSession = activeStreams.get(username);
          if (currentSession && currentSession.clients.size === 0) {
            console.log(`[TikTok-Live] Background session timeout (4 hours) reached with 0 clients. Terminating live listener for @${username}...`);
            try {
              currentSession.connection.disconnect();
            } catch (err) {
              console.error(`Error disconnecting TikTok link for @${username}`, err);
            }
            activeStreams.delete(username);
          } else if (currentSession) {
            console.log(`[TikTok-Live] Background session restored inside timeout window for @${username}!`);
          }
        }, 14400000); // 4 hours in milliseconds
      }
    }
  });
});


// Hook up Vite standard Middleware or Serve built frontend
async function startServer() {

  // Serve custom audio uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TikTok Live Alerts server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
