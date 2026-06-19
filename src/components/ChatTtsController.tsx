import { useState, useEffect } from 'react';
import { Volume2, Mic, Play, Sparkles } from 'lucide-react';
import { speakText, stopActiveTts } from '../utils/audio';

interface ChatTtsControllerProps {
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
  ttsVolume: number;
  onUpdateTtsVolume: (vol: number) => void;
  ttsProvider: string;
  onUpdateTtsProvider: (provider: string) => void;
  ttsVoiceURI: string;
  onUpdateTtsVoiceURI: (uri: string) => void;
  ttsRate: number;
  onUpdateTtsRate: (rate: number) => void;
  aiVoiceMode: string;
  onUpdateAiVoiceMode: (mode: string) => void;
  ttsReadUsernames: boolean;
  onToggleTtsReadUsernames: () => void;
  ttsReaderTargets: ('todos' | 'moderadores' | 'superfans')[];
  onUpdateTtsReaderTargets: (targets: ('todos' | 'moderadores' | 'superfans')[]) => void;
  superFanWelcomeEnabled: boolean;
  onToggleSuperFanWelcome: () => void;
}

const GOOGLE_VOICES = [
  { value: 'es', label: '🇪🇸 Español (España)' },
  { value: 'es-US', label: '🇺🇸 Español Latino (EE.UU.)' },
  { value: 'en', label: '🇺🇸 English (US)' },
  { value: 'en-GB', label: '🇬🇧 English (UK)' },
  { value: 'pt', label: '🇧🇷 Português (Brasil)' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'zh-CN', label: '🇨🇳 中文 (简体)' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'hi', label: '🇮🇳 हिन्दी' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
];

const STREAMELEMENTS_VOICES = [
  { value: 'Brian', label: '🎙️ Brian (Estilo Streamer - En)' },
  { value: 'Conchita', label: '🇪🇸 Conchita (Español España)' },
  { value: 'Enrique', label: '🇪🇸 Enrique (Español España)' },
  { value: 'Miguel', label: '🇲🇽 Miguel (Español Latino)' },
  { value: 'Penelope', label: '🇲🇽 Penélope (Español Latino)' },
  { value: 'Lucia', label: '🇪🇸 Lucia (Español España)' },
  { value: 'Mia', label: '🇲🇽 Mia (Español México)' },
  { value: 'Amy', label: '🇬🇧 Amy (English UK)' },
  { value: 'Emma', label: '🇬🇧 Emma (English UK)' },
  { value: 'Russell', label: '🇦🇺 Russell (English AU)' },
  { value: 'Nicole', label: '🇦🇺 Nicole (English AU)' },
  { value: 'Joey', label: '🇺🇸 Joey (English US)' },
  { value: 'Justin', label: '🇺🇸 Justin (English US - Niño)' },
  { value: 'Matthew', label: '🇺🇸 Matthew (English US)' },
  { value: 'Ivy', label: '🇺🇸 Ivy (English US - Niña)' },
  { value: 'Joanna', label: '🇺🇸 Joanna (English US)' },
  { value: 'Kendra', label: '🇺🇸 Kendra (English US)' },
  { value: 'Kimberly', label: '🇺🇸 Kimberly (English US)' },
  { value: 'Salli', label: '🇺🇸 Salli (English US)' },
  { value: 'Raveena', label: '🇮🇳 Raveena (English IN)' },
  { value: 'Ricardo', label: '🇧🇷 Ricardo (Português Brasil)' },
  { value: 'Vitoria', label: '🇧🇷 Vitória (Português Brasil)' },
  { value: 'Camila', label: '🇧🇷 Camila (Português Brasil)' },
  { value: 'Lea', label: '🇫🇷 Lea (Français)' },
  { value: 'Celine', label: '🇫🇷 Céline (Français)' },
  { value: 'Mathieu', label: '🇫🇷 Mathieu (Français)' },
  { value: 'Hans', label: '🇩🇪 Hans (Deutsch)' },
  { value: 'Marlene', label: '🇩🇪 Marlene (Deutsch)' },
  { value: 'Vicki', label: '🇩🇪 Vicki (Deutsch)' },
  { value: 'Giorgio', label: '🇮🇹 Giorgio (Italiano)' },
  { value: 'Carla', label: '🇮🇹 Carla (Italiano)' },
  { value: 'Takumi', label: '🇯🇵 Takumi (Japanese)' },
  { value: 'Mizuki', label: '🇯🇵 Mizuki (Japanese)' },
  { value: 'Seoyeon', label: '🇰🇷 Seoyeon (Korean)' },
  { value: 'Maxim', label: '🇷🇺 Maxim (Russian)' },
  { value: 'Tatyana', label: '🇷🇺 Tatyana (Russian)' },
];

const TIKTOK_VOICES = [
  { value: 'es_002', label: '🇪🇸 Español - Voz de Hombre (España)' },
  { value: 'es_mx_002', label: '🇲🇽 Español - Voz Femenina (México)' },
  { value: 'en_us_001', label: '🇺🇸 English - US Female (Voz de TikTok)' },
  { value: 'en_us_006', label: '🇺🇸 English - US Male 1' },
  { value: 'en_us_007', label: '🇺🇸 English - US Male 2' },
  { value: 'en_us_009', label: '🇺🇸 English - US Male 3' },
  { value: 'en_us_010', label: '🇺🇸 English - US Male 4' },
  { value: 'en_uk_001', label: '🇬🇧 English - UK Male 1' },
  { value: 'en_uk_003', label: '🇬🇧 English - UK Male 2' },
  { value: 'en_au_001', label: '🇦🇺 English - AU Female' },
  { value: 'en_au_002', label: '🇦🇺 English - AU Male' },
  { value: 'fr_001', label: '🇫🇷 French - Male 1' },
  { value: 'fr_002', label: '🇫🇷 French - Male 2' },
  { value: 'de_001', label: '🇩🇪 German - Female' },
  { value: 'de_002', label: '🇩🇪 German - Male' },
  { value: 'it_male_m18', label: '🇮🇹 Italian - Male' },
  { value: 'pt_br_001', label: '🇧🇷 Portuguese - Brazil Female 1' },
  { value: 'pt_br_003', label: '🇧🇷 Portuguese - Brazil Female 2' },
  { value: 'jp_001', label: '🇯🇵 Japanese - Female 1' },
  { value: 'jp_006', label: '🇯🇵 Japanese - Male' },
  { value: 'kr_002', label: '🇰🇷 Korean - Male 1' },
  { value: 'kr_003', label: '🇰🇷 Korean - Female' },
  { value: 'id_001', label: '🇮🇩 Indonesian - Female' },
];

const EDGE_VOICES = [
  { value: 'es-CO-SalomeNeural', label: '🇨🇴 Salomé (Colombia - Femenina)' },
  { value: 'es-CO-GonzaloNeural', label: '🇨🇴 Gonzalo (Colombia - Masculino)' },
  { value: 'es-MX-DaliaNeural', label: '🇲🇽 Dalia (México - Femenina)' },
  { value: 'es-MX-JorgeNeural', label: '🇲🇽 Jorge (México - Masculino)' },
  { value: 'es-ES-ElviraNeural', label: '🇪🇸 Elvira (España - Femenina)' },
  { value: 'es-ES-AlvaroNeural', label: '🇪🇸 Álvaro (España - Masculino)' },
  { value: 'es-AR-ElenaNeural', label: '🇦🇷 Elena (Argentina - Femenina)' },
  { value: 'es-AR-TomasNeural', label: '🇦🇷 Tomás (Argentina - Masculino)' },
  { value: 'es-CL-CatalinaNeural', label: '🇨🇱 Catalina (Chile - Femenina)' },
  { value: 'es-CL-LorenzoNeural', label: '🇨🇱 Lorenzo (Chile - Masculino)' },
  { value: 'es-VE-PaolaNeural', label: '🇻🇪 Paola (Venezuela - Femenina)' },
  { value: 'es-VE-SebastianNeural', label: '🇻🇪 Sebastián (Venezuela - Masculino)' },
  { value: 'es-PE-CamilaNeural', label: '🇵🇪 Camila (Perú - Femenina)' },
  { value: 'es-PE-AlexNeural', label: '🇵🇪 Alex (Perú - Masculino)' },
  { value: 'en-US-JennyNeural', label: '🇺🇸 Jenny (USA - Female)' },
  { value: 'en-US-GuyNeural', label: '🇺🇸 Guy (USA - Male)' },
  { value: 'en-US-AriaNeural', label: '🇺🇸 Aria (USA - Female)' },
  { value: 'en-US-DavisNeural', label: '🇺🇸 Davis (USA - Male)' },
  { value: 'en-GB-SoniaNeural', label: '🇬🇧 Sonia (UK - Female)' },
  { value: 'en-GB-RyanNeural', label: '🇬🇧 Ryan (UK - Male)' },
  { value: 'pt-BR-FranciscaNeural', label: '🇧🇷 Francisca (Brasil - Feminina)' },
  { value: 'pt-BR-AntonioNeural', label: '🇧🇷 Antonio (Brasil - Masculino)' },
  { value: 'fr-FR-DeniseNeural', label: '🇫🇷 Denise (France - Féminine)' },
  { value: 'fr-FR-HenriNeural', label: '🇫🇷 Henri (France - Masculin)' },
  { value: 'de-DE-KatjaNeural', label: '🇩🇪 Katja (Deutschland - Weiblich)' },
  { value: 'de-DE-ConradNeural', label: '🇩🇪 Conrad (Deutschland - Männlich)' },
  { value: 'it-IT-ElsaNeural', label: '🇮🇹 Elsa (Italia - Femminile)' },
  { value: 'it-IT-DiegoNeural', label: '🇮🇹 Diego (Italia - Maschile)' },
  { value: 'ja-JP-NanamiNeural', label: '🇯🇵 Nanami (Japan - 女性)' },
  { value: 'ja-JP-KeitaNeural', label: '🇯🇵 Keita (Japan - 男性)' },
  { value: 'ko-KR-SunHiNeural', label: '🇰🇷 SunHi (Korea - 여성)' },
  { value: 'ko-KR-InJoonNeural', label: '🇰🇷 InJoon (Korea - 남성)' },
  { value: 'zh-CN-XiaoxiaoNeural', label: '🇨🇳 Xiaoxiao (China - 女性)' },
  { value: 'zh-CN-YunxiNeural', label: '🇨🇳 Yunxi (China - 男性)' },
];

const CELEBRITY_VOICES = [
  { value: 'trump', label: '🇺🇸 Donald Trump (Realista)' },
  { value: 'obama', label: '🇺🇸 Barack Obama' },
  { value: 'spongebob', label: '🧽 SpongeBob SquarePants (Bob Esponja)' },
  { value: 'homer', label: '🍩 Homer Simpson (Homero)' },
  { value: 'darthvader', label: '🌌 Darth Vader' },
  { value: 'petergriffin', label: '🕶️ Peter Griffin (Padre de Familia)' },
  { value: 'elmo', label: '🔴 Elmo (Barrio Sésamo)' },
];

export default function ChatTtsController({
  ttsEnabled,
  onToggleTts,
  ttsVolume,
  onUpdateTtsVolume,
  ttsProvider,
  onUpdateTtsProvider,
  ttsVoiceURI,
  onUpdateTtsVoiceURI,
  ttsRate,
  onUpdateTtsRate,
  aiVoiceMode,
  onUpdateAiVoiceMode,
  ttsReadUsernames,
  onToggleTtsReadUsernames,
  ttsReaderTargets,
  onUpdateTtsReaderTargets,
  superFanWelcomeEnabled,
  onToggleSuperFanWelcome,
}: ChatTtsControllerProps) {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testText, setTestText] = useState('¡Hola! El lector de chat se encuentra configurado correctamente y listo para leer en vivo.');

  // Load browser voice list in case that provider is used
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const seen = new Set<string>();
      const uniqueVoices: SpeechSynthesisVoice[] = [];
      for (const voice of allVoices) {
        if (!voice.voiceURI) continue;
        if (!seen.has(voice.voiceURI)) {
          seen.add(voice.voiceURI);
          uniqueVoices.push(voice);
        }
      }
      const sorted = uniqueVoices.sort((a, b) => a.lang.localeCompare(b.lang));
      setBrowserVoices(sorted);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleTestTts = () => {
    if (!testText.trim()) return;
    stopActiveTts();
    speakText(testText, ttsVolume, ttsVoiceURI, ttsRate, 1.0, ttsProvider);
  };

  return (
    <section id="chat-tts-section" className="bg-[#16161D] border border-white/10 rounded p-4 flex flex-col gap-3.5 shadow-md">
      {/* Header with cool TTS logo indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[#ff0050]/15 text-[#ff0050]">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              Lector de Chat en Vivo (TTS)
            </h2>
            <p className="text-[9px] text-gray-500 font-mono">TEXT TO SPEECH SYSTEM</p>
          </div>
        </div>

        {/* Dynamic active badge or switch */}
        <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
          ttsEnabled 
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
            : 'bg-black/35 text-gray-500 border border-white/5'
        }`}>
          {ttsEnabled ? 'Activado' : 'Desactivado'}
        </span>
      </div>

      {/* Main toggle control */}
      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded border border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-white">Activar Lector por Voz</span>
          <span className="text-[9.5px] text-gray-500 leading-tight pr-2">
            Lee automáticamente todos los comentarios recibidos en tiempo real.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleTts(!ttsEnabled)}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer focus:outline-none ${
            ttsEnabled ? 'bg-[#00f2ea]' : 'bg-gray-700'
          }`}
          aria-label="Toggle Text to Speech"
        >
          <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 transform ${
            ttsEnabled ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
      
      {/* Read Usernames toggle control */}
      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded border border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-white">Leer nombre de usuario</span>
          <span className="text-[9.5px] text-gray-500 leading-tight pr-2">
            Lee el nombre antes de cada comentario.
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleTtsReadUsernames}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer focus:outline-none ${
            ttsReadUsernames ? 'bg-[#00f2ea]' : 'bg-gray-700'
          }`}
          aria-label="Toggle Read Usernames"
        >
          <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 transform ${
            ttsReadUsernames ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Super Fan Welcome Alerts toggle control */}
      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded border border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-white">Alertas de Bienvenida de Súper Fans</span>
          <span className="text-[9.5px] text-gray-500 leading-tight pr-2">
            Habilita anuncios y stickers gigantes al ingresar Súper Fans. (Desactivado por defecto)
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleSuperFanWelcome}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer focus:outline-none ${
            superFanWelcomeEnabled ? 'bg-[#00f2ea]' : 'bg-gray-700'
          }`}
          aria-label="Toggle Super Fan Welcome Alerts"
        >
          <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 transform ${
            superFanWelcomeEnabled ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* TTS Reader Target Filter Option */}
      <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded border border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-white">¿A quiénes leer en voz alta? (Multiselección)</span>
          <span className="text-[9.5px] text-gray-500 leading-tight">
            Marca las opciones deseadas. Si marcas "👥 Todos" se leerá el chat completo.
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {(['todos', 'moderadores', 'superfans'] as const).map((option) => {
            const isSelected = ttsReaderTargets.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  let next: ('todos' | 'moderadores' | 'superfans')[];
                  if (isSelected) {
                    next = ttsReaderTargets.filter((t) => t !== option);
                  } else {
                    next = [...ttsReaderTargets, option];
                  }
                  onUpdateTtsReaderTargets(next);
                }}
                className={`py-1.5 px-1 rounded font-sans text-[10px] font-bold uppercase tracking-wider text-center border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#00f2ea]/15 border-[#00f2ea] text-[#00f2ea]'
                    : 'bg-black/20 border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {option === 'todos' ? '👥 Todos' : option === 'moderadores' ? '🛡️ Moderadores' : '👑 Super Fan'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Grid Panel */}
      <div className="space-y-3">
        {/* TTS Providers */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-400 font-mono font-bold uppercase">Proveedor de Voz TTS</label>
          <select
            value={ttsProvider}
            onChange={(e) => onUpdateTtsProvider(e.target.value)}
            className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f2ea]/50 font-sans"
          >
            <option value="celebrity">🎭 Clonación IA (Donald Trump, Obama, Bob Esponja...)</option>
            <option value="google">🌐 Básico (Google Translate)</option>
            <option value="edge">🔷 Dyno Voice (Edge TTS Neural)</option>
            <option value="streamelements">🎙️ StreamElements (Amazon Polly)</option>
            <option value="tiktok">🎵 Voces de TikTok</option>
            <option value="browser">🖥️ Voces del Dispositivo / Navegador</option>
          </select>
        </div>

        {/* Dynamic Voice Selector based on the active provider */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-400 font-mono font-bold uppercase">Seleccionar Voz o Idioma</label>
          {ttsProvider === 'celebrity' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              className="w-full bg-black/45 border border-pink-500/35 rounded px-2.5 py-1.5 text-xs text-pink-300 focus:outline-none focus:border-pink-500/60 font-sans animate-in fade-in"
            >
              {CELEBRITY_VOICES.map((v) => (
                <option key={v.value} value={v.value} className="text-white bg-slate-900">{v.label}</option>
              ))}
            </select>
          )}

          {ttsProvider === 'google' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 font-sans"
            >
              {GOOGLE_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}

          {ttsProvider === 'streamelements' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 font-sans"
            >
              {STREAMELEMENTS_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}

          {ttsProvider === 'tiktok' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 font-sans"
            >
              {TIKTOK_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}

          {ttsProvider === 'edge' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 font-sans animate-in fade-in"
            >
              {EDGE_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}

          {ttsProvider === 'browser' && (
            <select
              value={ttsVoiceURI}
              onChange={(e) => onUpdateTtsVoiceURI(e.target.value)}
              disabled={browserVoices.length === 0}
              className="w-full bg-black/45 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00f2ea]/50 font-sans disabled:opacity-50"
            >
              {browserVoices.length === 0 ? (
                <option value="">(Cargando voces del sistema...)</option>
              ) : (
                <>
                  <option value="">Predeterminado del navegador</option>
                  {/* Prioritize Spanish voices first */}
                  {browserVoices.filter(v => v.lang.toLowerCase().includes('es')).map((voice, idx) => (
                    <option key={`es-${voice.voiceURI}-${voice.lang}-${idx}`} value={voice.voiceURI}>
                      🇪🇸 {voice.name} ({voice.lang})
                    </option>
                  ))}
                  {browserVoices.filter(v => !v.lang.toLowerCase().includes('es')).map((voice, idx) => (
                    <option key={`other-${voice.voiceURI}-${voice.lang}-${idx}`} value={voice.voiceURI}>
                      🌐 {voice.name} ({voice.lang})
                    </option>
                  ))}
                </>
              )}
            </select>
          )}
        </div>

        {/* AI Personas Voice selector */}
        <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
          <label className="text-[9px] text-[#00f2ea] uppercase font-mono font-bold flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#00f2ea]" /> Modulación de Voz IA
          </label>
          <select
            value={aiVoiceMode}
            onChange={(e) => onUpdateAiVoiceMode(e.target.value)}
            className="w-full bg-black/45 border border-[#00f2ea]/30 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f2ea]/60 font-sans"
          >
            <option value="normal">Normal (Sin efectos)</option>
            <option value="trump">Donald Trump 🇺🇸 (AI Mimic)</option>
            <option value="announcer">🎙️ Locutor de Cine (Grave y Épico)</option>
            <option value="robot">🤖 Robot Cibernético (BEEP BOOP)</option>
            <option value="elon">🚀 Elon Musk Drone (SpaceX Boss)</option>
            <option value="gamer">🎮 Gamer Caster Hype (Twitch Style)</option>
          </select>
          <span className="text-[8.5px] text-gray-400 leading-tight">
            Modifica velocidad y añade intro automática del personaje seleccionado.
          </span>
        </div>

        {/* Controls Layout sliders */}
        <div className="grid grid-cols-2 gap-3">
          {/* Slider 1: Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-gray-500 uppercase font-mono font-bold flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-[#ff0050]" />
                Volumen:
              </label>
              <span className="text-[10px] text-[#ff0050] font-mono font-bold">
                {Math.round(ttsVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ttsVolume}
              onChange={(e) => onUpdateTtsVolume(parseFloat(e.target.value))}
              className="accent-[#ff0050] h-1 rounded bg-[#121218] mt-1"
            />
          </div>

          {/* Slider 2: Rate/Speed */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Velocidad:</label>
              <span className="text-[10px] text-[#00f2ea] font-mono font-bold">
                {ttsRate.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={ttsRate}
              onChange={(e) => onUpdateTtsRate(parseFloat(e.target.value))}
              className="accent-[#00f2ea] h-1 rounded bg-[#121218] mt-1"
            />
          </div>
        </div>

        {/* Test Speech sandbox */}
        <div className="border-t border-white/5 pt-3 mt-1 space-y-2">
          <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Testear lector</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Prueba a escribir algo aquí..."
              className="flex-1 bg-black/40 border border-white/10 rounded py-1.5 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00f2ea]/40 font-sans"
            />
            <button
              type="button"
              onClick={handleTestTts}
              className="bg-white hover:bg-gray-200 text-black rounded p-1.5 px-2.5 transition-colors flex items-center justify-center cursor-pointer"
              title="Escuchar Test TTS"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
