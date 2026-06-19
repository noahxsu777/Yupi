import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Heart } from 'lucide-react';
import { SuperFanAlertData } from '../types';

export interface AlertData {
  id: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  giftName: string;
  describe: string;
  repeatCount: number;
  giftPictureUrl: string;
  soundId: string;
  customSoundUrl?: string;
  volume: number;
}

interface SoundAlertOverlayProps {
  activeAlerts: AlertData[];
  onFinishAlert: (id: string) => void;
  activeSuperFanAlerts: SuperFanAlertData[];
  onFinishSuperFanAlert: (id: string) => void;
}

interface StarParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
}

export default function SoundAlertOverlay({ 
  activeAlerts, 
  onFinishAlert,
  activeSuperFanAlerts = [],
  onFinishSuperFanAlert
}: SoundAlertOverlayProps) {
  const [displayedAlert, setDisplayedAlert] = useState<AlertData | null>(null);
  const [displayedSuperFanAlert, setDisplayedSuperFanAlert] = useState<SuperFanAlertData | null>(null);
  const [particles, setParticles] = useState<StarParticle[]>([]);

  // Safe helper to proxy only external HTTP images, leaving base64 data: intact
  const getProxyUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  // Simple sequential queuing handler for alerts overlay
  useEffect(() => {
    if (activeAlerts.length > 0 && !displayedAlert) {
      const nextAlert = activeAlerts[0];
      setDisplayedAlert(nextAlert);
      triggerConfetti();

      // Clear alert after 3.8 seconds
      const timer = setTimeout(() => {
        setDisplayedAlert(null);
        onFinishAlert(nextAlert.id);
      }, 3800);

      return () => clearTimeout(timer);
    }
  }, [activeAlerts, displayedAlert, onFinishAlert]);

  // Queue handler for Super Fan Alerts
  useEffect(() => {
    if (activeSuperFanAlerts && activeSuperFanAlerts.length > 0 && !displayedSuperFanAlert) {
      const nextAlert = activeSuperFanAlerts[0];
      setDisplayedSuperFanAlert(nextAlert);
      triggerConfetti();

      // Clear after 4 seconds
      const timer = setTimeout(() => {
        setDisplayedSuperFanAlert(null);
        if (onFinishSuperFanAlert) {
          onFinishSuperFanAlert(nextAlert.id);
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [activeSuperFanAlerts, displayedSuperFanAlert, onFinishSuperFanAlert]);

  // Fun custom sparkle burst generator
  const triggerConfetti = () => {
    const newParticles: StarParticle[] = [];
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ffd700', '#ff00ae'];
    
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        id: Math.random() + i,
        x: 50, // center x in %
        y: 45, // center y in %
        angle: Math.random() * 360,
        speed: 1.5 + Math.random() * 3,
        size: 8 + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setParticles(newParticles);
    
    // Smooth fade/fall timer for particles
    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + Math.cos((p.angle * Math.PI) / 180) * p.speed * 0.15,
            y: p.y + Math.sin((p.angle * Math.PI) / 180) * p.speed * 0.15 + 0.2, // Gravity factor
            size: Math.max(0, p.size - 0.25),
          }))
          .filter(p => p.size > 0)
      );
    }, 16);

    setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center gap-4 overflow-hidden">
      {/* Dynamic Star/Sparkle Particles Layer */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full shadow-lg"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: 'translate(-50%, -50%)',
            opacity: p.size / 20,
            transition: 'opacity 0.1s ease',
          }}
        />
      ))}

      {/* Screen Alert Card Renderer - Standard Gifts */}
      <AnimatePresence mode="wait">
        {displayedAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 120 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
              transition: { 
                type: 'spring', 
                stiffness: 180, 
                damping: 14,
                duration: 0.8
              } 
            }}
            exit={{ opacity: 0, scale: 0.65, y: -80, transition: { duration: 0.4 } }}
            className="flex flex-col items-center justify-center p-1"
          >
            {/* Outer Premium Sparkle Card Overlay wrapper */}
            <div className="relative bg-[#16161D] border-2 border-[#ff0050] rounded-lg p-6 px-10 flex flex-col items-center shadow-[0_0_50px_-5px_rgba(255,0,80,0.5)] text-center max-w-[90%] sm:max-w-md">
              {/* Backlight Glow effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#ff0050] to-[#00f2ea] rounded-lg blur opacity-30 transition duration-1000" />

              {/* Top alert label banner */}
              <div className="relative bg-gradient-to-r from-[#ff0050] to-[#00f2ea] text-black text-[10px] uppercase font-mono font-bold tracking-wider px-3 py-1 rounded mb-4 shadow flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                NUEVO REGALO RECIBIDO!
              </div>

              {/* Main Avatar + Gift layout row */}
              <div className="relative flex items-center justify-center gap-6 mb-4">
                {/* Sender Avatar Circle */}
                <div className="relative w-16 h-16 rounded-full border-2 border-[#00f2ea] p-0.5 bg-black shadow-md">
                  {displayedAlert.profilePictureUrl ? (
                    <img
                      src={getProxyUrl(displayedAlert.profilePictureUrl)}
                      alt={displayedAlert.nickname}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-display text-white font-bold text-lg">
                      {displayedAlert.uniqueId[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {/* Small overlay badge */}
                  <div className="absolute -bottom-1 -right-1 bg-[#00f2ea] text-black text-[9px] font-mono font-bold px-1 py-0.2 rounded border border-black shadow">
                    LIVE
                  </div>
                </div>

                {/* Animated Flying Bouncing Gift Image */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.35, 0.95, 1.15, 1],
                    rotate: [0, 15, -15, 10, 0]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    repeatType: "loop", 
                    duration: 2.2,
                    ease: "easeInOut"
                  }}
                  className="w-20 h-20 rounded bg-black/55 border border-white/10 p-2 flex items-center justify-center shadow-lg"
                >
                  {displayedAlert.giftPictureUrl ? (
                    <img
                      src={getProxyUrl(displayedAlert.giftPictureUrl)}
                      alt={displayedAlert.giftName}
                      className="w-16 h-16 object-contain drop-shadow-[0_4px_10px_rgba(255,0,80,0.3)]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-3xl">🎁</span>
                  )}
                </motion.div>
              </div>

              {/* Descriptive details */}
              <div className="relative z-10">
                <h4 className="font-sans font-bold text-base text-white tracking-tight">
                  @{displayedAlert.uniqueId}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {displayedAlert.nickname}
                </p>
                
                {/* Highlight Gift Sentence */}
                <div className="mt-4 px-6 py-2.5 bg-[#ff0050]/5 rounded border border-[#ff0050]/20 inline-flex flex-col items-center gap-1 shadow-inner">
                  <span className="text-xs text-white uppercase font-sans font-semibold tracking-wider">
                    {displayedAlert.describe}
                  </span>
                  
                  {/* Repetition Block Multiplier */}
                  <motion.span 
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 8 }}
                    className="text-2xl sm:text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-[#ff0050] to-[#00f2ea]"
                  >
                    x{displayedAlert.repeatCount}
                  </motion.span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Alert Card Renderer - SUPER FAN CONECTADO STICKER */}
      <AnimatePresence mode="wait">
        {displayedSuperFanAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.2, rotate: -15, y: -100 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              rotate: 0,
              y: 0,
              transition: { 
                type: 'spring', 
                stiffness: 200, 
                damping: 12,
                duration: 0.9
              } 
            }}
            exit={{ opacity: 0, scale: 0.5, rotate: 10, y: 100, transition: { duration: 0.4 } }}
            className="flex flex-col items-center justify-center p-1"
          >
            {/* outer sticker card utilizing generous space and neon purple-gold-cyan styling cues */}
            <div className="relative bg-gradient-to-br from-[#12121e] via-[#1a1132] to-[#0f0f18] border-4 border-yellow-400 rounded-2xl p-6 px-12 flex flex-col items-center shadow-[0_0_60px_rgba(234,179,8,0.45)] text-center max-w-[90%] sm:max-w-md overflow-hidden">
              
              {/* Animated holographic background shine line */}
              <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
              
              {/* Backlight Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#00f2ea] via-yellow-400 to-[#ff0050] rounded-2xl blur opacity-35" />

              {/* Sticker Label Header with Hype badge */}
              <div className="relative bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-black text-[10.5px] uppercase font-mono font-black tracking-widest px-4 py-1.5 rounded-full mb-4 shadow-lg flex items-center gap-1.5 border border-yellow-250 animate-pulse">
                <Trophy className="w-3.5 h-3.5 text-black" />
                ⚡ SÚPER FAN ACTIVO ⚡
              </div>

              {/* Sparkles background circle avatar wrapper */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-[#ff0050] via-yellow-400 to-[#00f2ea] animate-spin opacity-40 blur-sm pointer-events-none" />
                
                {/* Main Avatar holding standard custom dimensions */}
                <div className="relative w-20 h-20 rounded-full border-4 border-yellow-400 p-0.5 bg-black shadow-2xl shrink-0 z-10">
                  {displayedSuperFanAlert.avatarUrl ? (
                    <img
                      src={getProxyUrl(displayedSuperFanAlert.avatarUrl)}
                      alt={displayedSuperFanAlert.nickname}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-800 to-pink-700 flex items-center justify-center font-bold text-white text-2xl shadow-inner font-sans border border-purple-400">
                      {displayedSuperFanAlert.uniqueId[0]?.toUpperCase() || '★'}
                    </div>
                  )}

                  {/* Fan Level Badge Icon - Gold heart badge on absolute right-bottom edge */}
                  <div className="absolute -bottom-1 -right-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-mono font-black text-[10px] px-2 py-0.5 rounded-full border-2 border-black flex items-center gap-0.5 shadow-md">
                    <Heart className="w-3 h-3 text-red-600 fill-red-600 animate-pulse" />
                    lvl {displayedSuperFanAlert.fanLevel}
                  </div>
                </div>
              </div>

              {/* Name Details */}
              <div className="relative z-10 text-center mt-2">
                <h4 className="font-sans font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-[#00f2ea] tracking-tight drop-shadow">
                  @{displayedSuperFanAlert.uniqueId}
                </h4>
                <p className="text-xs text-yellow-300/80 font-mono font-bold uppercase tracking-widest mt-0.5">
                  ★ {displayedSuperFanAlert.nickname} ★
                </p>

                {/* Personalized dynamic action entry intro sentence text */}
                <div className="mt-4 px-6 py-2.5 bg-black/60 rounded-xl border border-yellow-500/20 shadow-inner max-w-xs mx-auto">
                  <p className="text-xs text-gray-300 leading-normal italic font-semibold">
                    "{displayedSuperFanAlert.actionText}"
                  </p>
                  <p className="text-[10px] text-[#00f2ea] font-bold font-mono uppercase tracking-wider mt-1.5">
                    🔊 LLAMADA DE VOZ ACTIVA
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

