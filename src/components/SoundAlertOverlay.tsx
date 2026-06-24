import { useEffect, useState, useRef } from 'react';
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
  triggerRoulette?: boolean;
}

interface SoundAlertOverlayProps {
  activeAlerts: AlertData[];
  onFinishAlert: (id: string) => void;
  activeSuperFanAlerts: SuperFanAlertData[];
  onFinishSuperFanAlert: (id: string) => void;
  rouletteChallenges?: string[];
  rouletteOnly?: boolean;
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
  onFinishSuperFanAlert,
  rouletteChallenges = [
    "Hacer 5 lagartijas 🏋️",
    "Trompa de elefante por 15s 🐘",
    "Plancha abdominal por 30s ⏱️",
    "Contar un chiste malo 😅",
    "Cantar una canción a capela 🎤",
    "Hacer mímica de un animal 🦁",
    "Beber un vaso de agua completo 🥛",
    "Decir un trabalenguas rápido 🗣️"
  ],
  rouletteOnly = false
}: SoundAlertOverlayProps) {
  const [displayedAlert, setDisplayedAlert] = useState<AlertData | null>(null);
  const [displayedSuperFanAlert, setDisplayedSuperFanAlert] = useState<SuperFanAlertData | null>(null);
  const [particles, setParticles] = useState<StarParticle[]>([]);

  // Roulette overlay states
  const [spinRotation, setSpinRotation] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningChallenge, setWinningChallenge] = useState<string | null>(null);
  const [showWinningDisplay, setShowWinningDisplay] = useState<boolean>(false);
  const [isExploding, setIsExploding] = useState<boolean>(false);

  // Queue tracking refs to prevent duplicate processing or race condition during react batches
  const processedIdsRef = useRef<Set<string>>(new Set());
  const processedSuperFanIdsRef = useRef<Set<string>>(new Set());

  // Safe helper to proxy only external HTTP images, leaving base64 data: intact
  const getProxyUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  // Math helper to generate SVG arc paths for circle segments (Clockwise from top)
  const getSectorPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  const CO_COLORS = [
    '#ff0050', // pink
    '#00f2ea', // cyan
    '#eab308', // yellow
    '#a855f7', // purple
    '#ea580c', // orange
    '#10b981', // emerald
    '#ec4899', // hot pink
    '#2563eb'  // blue
  ];

  // Sparkle explosion particle burst from wheel center
  const triggerExplosionParticles = () => {
    const newParticles: StarParticle[] = [];
    const colors = [
      '#ff0050', // neon pink
      '#00f2ea', // neon cyan
      '#ffd700', // gold sparkle
      '#eab308', // amber
      '#a855f7', // purple
      '#f43f5e', // rose
      '#10b981', // emerald
      '#ffffff'  // white sparkles
    ];
    
    // Create 130 explosive high-velocity sparkles starting from center of screen (around the wheel center)
    for (let i = 0; i < 130; i++) {
      newParticles.push({
        id: Math.random() + i * 1000,
        x: 50, // center x in %
        y: 45, // center y in %
        angle: Math.random() * 360,
        speed: 5 + Math.random() * 15, // high velocity outward velocity burst!
        size: 6 + Math.random() * 20, // large radiant particles
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setParticles(newParticles);
    
    // Custom explosion animation physics with high initial speed slowing down with friction
    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + Math.cos((p.angle * Math.PI) / 180) * p.speed * 0.26,
            y: p.y + Math.sin((p.angle * Math.PI) / 180) * p.speed * 0.26 + 0.16, // gravitational pull downwards
            speed: p.speed * 0.93, // high air friction drag
            size: Math.max(0, p.size - 0.20),
          }))
          .filter(p => p.size > 0)
      );
    }, 16);

    setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
    }, 2800);
  };

  // Cinematic synthesised audio explosion synthesizer using Web Audio API
  const playExplosionAudio = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 1. PUNCHY SUB EXTREME BASS KICK THUD (Pitch Sweep Oscillator)
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      subOsc.connect(subGain);
      subGain.connect(audioCtx.destination);
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(220, audioCtx.currentTime);
      subOsc.frequency.exponentialRampToValueAtTime(24, audioCtx.currentTime + 0.45);
      subGain.gain.setValueAtTime(0.40, audioCtx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.50);
      subOsc.start();
      subOsc.stop(audioCtx.currentTime + 0.55);

      // 2. WHITE NOISE CRASH / DEBRIS DEEP RUSTLE (Handcrafted random generator)
      const bufSize = audioCtx.sampleRate * 1.4; 
      const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(900, audioCtx.currentTime);
      noiseFilter.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 1.2);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.38, audioCtx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.3);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noiseNode.start();
      noiseNode.stop(audioCtx.currentTime + 1.4);

      // 3. ARCADE RETRO SCI-FI LASER SWEEP (Sawtooth wave laser explosion overlay)
      const laserOsc = audioCtx.createOscillator();
      const laserGain = audioCtx.createGain();
      laserOsc.connect(laserGain);
      laserGain.connect(audioCtx.destination);
      laserOsc.type = 'sawtooth';
      laserOsc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      laserOsc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.35);
      laserGain.gain.setValueAtTime(0.09, audioCtx.currentTime);
      laserGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);
      laserOsc.start();
      laserOsc.stop(audioCtx.currentTime + 0.40);

      // 4. CELEBRATORY MAJESTIC BRASS CHORD HOOK (C major glorious synth arpeggio)
      const majorArpeggio = [261.63, 329.63, 392.00, 523.25, 587.33, 659.25, 783.99, 1046.50]; 
      majorArpeggio.forEach((freq, index) => {
        const synthOsc = audioCtx.createOscillator();
        const synthGain = audioCtx.createGain();
        const synthFilter = audioCtx.createBiquadFilter();

        synthOsc.connect(synthFilter);
        synthFilter.connect(synthGain);
        synthGain.connect(audioCtx.destination);

        // Warm majestic sawtooth sound
        synthOsc.type = 'sawtooth';
        synthOsc.frequency.setValueAtTime(freq, audioCtx.currentTime + 0.28 + index * 0.08);

        synthFilter.type = 'lowpass';
        synthFilter.frequency.setValueAtTime(1600, audioCtx.currentTime + 0.28 + index * 0.08);
        synthFilter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.28 + index * 0.08 + 0.45);

        synthGain.gain.setValueAtTime(0.13, audioCtx.currentTime + 0.28 + index * 0.08);
        synthGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28 + index * 0.08 + 0.42);

        synthOsc.start(audioCtx.currentTime + 0.28 + index * 0.08);
        synthOsc.stop(audioCtx.currentTime + 0.28 + index * 0.08 + 0.50);
      });
    } catch (err) {
      console.warn('[WebAudioExplosion] Failed synthesizer audio play:', err);
    }
  };

  // Simple sequential queuing handler for alerts overlay
  useEffect(() => {
    if (activeAlerts.length === 0) {
      processedIdsRef.current.clear();
      return;
    }

    if (activeAlerts.length > 0 && !displayedAlert) {
      // Find the first alert that hasn't been processed yet to prevent race condition loops
      const nextAlert = activeAlerts.find(a => !processedIdsRef.current.has(a.id));
      if (!nextAlert) return;

      // Mark as processed immediately
      processedIdsRef.current.add(nextAlert.id);
      
      // If roulette-only mode is active, filter out any alerts that do not trigger the roulette
      if (rouletteOnly && !nextAlert.triggerRoulette) {
        onFinishAlert(nextAlert.id);
        return;
      }

      setDisplayedAlert(nextAlert);

      if (nextAlert.triggerRoulette) {
        // Trigger challenges list fallback check
        const listToUse = rouletteChallenges.length > 0 ? rouletteChallenges : ["Realizar Reto!"];
        const total = listToUse.length;
        const index = Math.floor(Math.random() * total);
        const challenge = listToUse[index];
        const segmentAngle = 360 / total;

        // Reset state values
        setSpinRotation(0);
        setIsSpinning(true);
        setShowWinningDisplay(false);
        setWinningChallenge(null);
        setIsExploding(false);

        // Custom physical plinking tick sounds that slow down with wheel pace
        const playMechanicalTick = (frequency: number) => {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
            filter.Q.setValueAtTime(1.2, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.07);
          } catch (e) {}
        };

        // Decelerating ticks loop simulating physical inertia peg clicks
        setTimeout(() => {
          let delay = 45;
          const runLoop = () => {
            if (delay > 650) return;
            // Peg click drops pitch as it loses momentum, perfectly mimicking physical reality!
            const dynamicHz = Math.max(380, 980 - delay * 1.05);
            playMechanicalTick(dynamicHz);
            delay = delay * 1.096; // deceleration coefficient
            setTimeout(runLoop, delay);
          };
          runLoop();
        }, 150);

        // Spin rotation animation target stopping on targeted challenge wedge center
        setTimeout(() => {
          const targetAngle = 360 * 5 + (360 - (index * segmentAngle) - (segmentAngle / 2));
          setSpinRotation(targetAngle);
        }, 50);

        // Wheel lands: Fire screen shake, particle fireworks, and giant takeover audio reveal
        const completionTimer = setTimeout(() => {
          setIsSpinning(false);
          setWinningChallenge(challenge);
          setShowWinningDisplay(true);
          setIsExploding(true);
          triggerExplosionParticles();
          playExplosionAudio();
          
          // Clear screenshake trigger after duration
          setTimeout(() => setIsExploding(false), 950);
        }, 4150);

        // Keep the big reward display takeover active for 11 seconds to let streamer/chat read it
        const deleteTimer = setTimeout(() => {
          setDisplayedAlert(null);
          setShowWinningDisplay(false);
          setWinningChallenge(null);
          setIsExploding(false);
          onFinishAlert(nextAlert.id);
        }, 11500);

        return () => {
          clearTimeout(completionTimer);
          clearTimeout(deleteTimer);
        };
      } else {
        triggerConfetti();
        const timer = setTimeout(() => {
          setDisplayedAlert(null);
          onFinishAlert(nextAlert.id);
        }, 3800);
        return () => clearTimeout(timer);
      }
    }
  }, [activeAlerts, displayedAlert, onFinishAlert, rouletteChallenges, rouletteOnly]);

  // Queue handler for Super Fan Alerts
  useEffect(() => {
    if (!activeSuperFanAlerts || activeSuperFanAlerts.length === 0) {
      processedSuperFanIdsRef.current.clear();
      return;
    }

    if (activeSuperFanAlerts && activeSuperFanAlerts.length > 0 && !displayedSuperFanAlert) {
      // Find the first super fan alert that hasn't been processed yet
      const nextAlert = activeSuperFanAlerts.find(s => !processedSuperFanIdsRef.current.has(s.id));
      if (!nextAlert) return;

      // Mark as processed immediately
      processedSuperFanIdsRef.current.add(nextAlert.id);
      
      if (rouletteOnly) {
        if (onFinishSuperFanAlert) {
          onFinishSuperFanAlert(nextAlert.id);
        }
        return;
      }

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
  }, [activeSuperFanAlerts, displayedSuperFanAlert, onFinishSuperFanAlert, rouletteOnly]);

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
            className="flex flex-col items-center justify-center p-1 pointer-events-auto"
          >
            {displayedAlert.triggerRoulette ? (
              /* --- HIGH CLASS OBS CHALLENGE ROULETTE STAGE --- */
              <div id="obs-roulette-stage" className="relative flex flex-col items-center justify-center p-10 max-w-4xl select-none pointer-events-auto">
                
                {/* Decorative header banner */}
                <div id="roulette-header-badge" className="bg-gradient-to-r from-[#ff0050] to-[#00f2ea] text-black text-xs font-black uppercase tracking-widest px-8 py-2.5 rounded-full mb-8 shadow-[0_0_35px_rgba(0,242,234,0.45)] flex items-center gap-2 animate-bounce">
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  🔥 ¡RULETA DE RETOS EXTREMOS! 🔥
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                  
                  {/* LEFT DETAILED SENDER CARD */}
                  <div id="roulette-sender-card" className="bg-[#0f0f16]/98 border-2 border-[#ff0050]/70 rounded-2xl p-6 flex flex-col items-center w-64 text-center shadow-[0_0_40px_rgba(255,0,80,0.35)] backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-24 h-24 rounded-full bg-[#ff0050]/5 blur-xl" />
                    
                    <div className="relative w-22 h-22 rounded-full border-2 border-[#00f2ea] p-1 bg-black shadow-[0_0_15px_rgba(0,242,234,0.3)]">
                      {displayedAlert.profilePictureUrl ? (
                        <img
                          src={getProxyUrl(displayedAlert.profilePictureUrl)}
                          alt={displayedAlert.nickname}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-display text-white font-bold text-xl">
                          {displayedAlert.uniqueId[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1.5 bg-[#00f2ea] text-black text-[8px] font-mono font-black px-1.5 py-0.5 rounded border border-black uppercase">
                        SENDER
                      </div>
                    </div>

                    <h3 className="font-sans font-black text-lg text-white mt-4 tracking-tight">
                      @{displayedAlert.uniqueId}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 mb-5 truncate w-full">
                      {displayedAlert.nickname}
                    </p>

                    <div className="flex flex-col items-center p-3 bg-black/55 rounded-xl border border-white/5 w-full shadow-inner">
                      <div className="relative w-15 h-15 rounded bg-black/30 flex items-center justify-center border border-white/5">
                        {displayedAlert.giftPictureUrl ? (
                          <img
                            src={getProxyUrl(displayedAlert.giftPictureUrl)}
                            alt={displayedAlert.giftName}
                            className="w-12 h-12 object-contain drop-shadow-[0_2px_10px_rgba(255,0,80,0.5)]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl animate-bounce">🎁</span>
                        )}
                      </div>
                      <div className="mt-2.5 text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                        REGALADO {displayedAlert.giftName}
                      </div>
                      <div className="text-yellow-400 font-mono font-black text-2xl leading-none mt-1.5">
                        x{displayedAlert.repeatCount}
                      </div>
                    </div>
                  </div>

                  {/* ROTATING ROULETTE WHEEL WITH SCREENSHAKE ATTACHED */}
                  <motion.div 
                    id="roulette-wheel-container"
                    className="relative flex flex-col items-center"
                    animate={isExploding ? {
                      x: [0, -18, 18, -15, 15, -10, 10, -5, 5, 0],
                      y: [0, 12, -12, 10, -10, 7, -7, 4, -4, 0],
                      scale: [1, 1.12, 0.94, 1.06, 1],
                      rotate: [0, 3, -3, 2, -2, 1, -1, 0]
                    } : {}}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                  >
                    {/* Background Neon Halo glow */}
                    <div className="absolute -inset-8 bg-gradient-to-r from-[#ff0050] to-[#00f2ea] rounded-full blur-3xl opacity-30 animate-pulse" />

                    {/* PHYSICAL TARGET NEEDLE / POINTER AT TOP - GOLD FINISH */}
                    <div className="absolute top-[-16px] left-1/2 -translate-x-1/2 z-40 drop-shadow-[0_5px_15px_rgba(234,179,8,0.65)]">
                      <svg width="42" height="42" viewBox="0 0 34 34">
                        <path d="M17 34 L32 2 L2 2 Z" fill="#eab308" stroke="#ffffff" strokeWidth="2.5" />
                        <circle cx="17" cy="6" r="4.5" fill="#fff" />
                      </svg>
                    </div>

                    {/* Animated flashing LED bulbs around the wheel border */}
                    <div className="absolute inset-[-4px] z-30 rounded-full border border-dashed border-yellow-300/40 pointer-events-none">
                      {Array.from({ length: 16 }).map((_, idx) => {
                        const angle = (idx * 360) / 16;
                        const isEven = idx % 2 === 0;
                        return (
                          <div 
                            key={idx}
                            className={`absolute w-2.5 h-2.5 rounded-full ${isEven ? 'bg-[#ff0050] shadow-[0_0_10px_#ff0050]' : 'bg-[#00f2ea] shadow-[0_0_10px_#00f2ea]'} animate-pulse`}
                            style={{
                              left: `calc(50% + calc(51% * ${Math.cos((angle * Math.PI) / 180)}))`,
                              top: `calc(50% + calc(51% * ${Math.sin((angle * Math.PI) / 180)}))`,
                              transform: 'translate(-50%, -50%)',
                              animationDelay: `${idx * 120}ms`,
                              animationDuration: '0.5s'
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* WHEEL BODY */}
                    <div 
                      id="roulette-wheel-body"
                      className="w-[316px] h-[316px] sm:w-[380px] sm:h-[380px] relative z-20 border-[12px] border-[#1b1b24] rounded-full shadow-[0_0_60px_rgba(0,242,234,0.45),_inset_0_0_30px_rgba(0,0,0,0.8)]"
                      style={{
                        transform: `rotate(${spinRotation}deg)`,
                        transition: isSpinning ? "transform 4.1s cubic-bezier(0.15, 0.85, 0.35, 1)" : "none",
                      }}
                    >
                      <svg viewBox="0 0 300 300" className="w-full h-full rounded-full">
                        {(() => {
                          const list = rouletteChallenges.length > 0 ? rouletteChallenges : ["Reto!"];
                          const segAngle = 360 / list.length;
                          return list.map((challenge, i) => {
                            const startAngle = i * segAngle;
                            const endAngle = (i + 1) * segAngle;
                            const pathStr = getSectorPath(150, 150, 140, startAngle, endAngle);
                            const midAngle = startAngle + segAngle / 2;
                            const color = CO_COLORS[i % CO_COLORS.length];

                            return (
                              <g key={i}>
                                <path d={pathStr} fill={color} stroke="#111116" strokeWidth="2.5" />
                                <g transform={`rotate(${midAngle}, 150, 150)`}>
                                  <text
                                    x={150}
                                    y={44}
                                    textAnchor="middle"
                                    transform={`rotate(90, 150, 44)`}
                                    className="fill-white font-sans text-[7.5px] font-black uppercase tracking-wider select-none"
                                    style={{ 
                                      filter: 'drop-shadow(0px 2.5px 3.5px rgba(0,0,0,1))',
                                      fontWeight: 900
                                    }}
                                  >
                                    {challenge.length > 20 ? challenge.substring(0, 18) + '...' : challenge}
                                  </text>
                                </g>
                              </g>
                            );
                          });
                        })()}
                        {/* Middle premium chrome cap */}
                        <circle cx="150" cy="150" r="30" fill="#1b1b24" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                        <circle cx="150" cy="150" r="16" fill="#00f2ea" className="animate-pulse" />
                        <circle cx="150" cy="150" r="7" fill="#ffffff" />
                      </svg>
                    </div>
                  </motion.div>

                </div>

                {/* BOTTOM PREVIEW BANNER (WHILE SPINNING ONLY) */}
                <div id="roulette-bottom-bar" className="h-28 mt-8 flex items-center justify-center w-full">
                  <AnimatePresence>
                    {!showWinningDisplay && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-slate-400 font-mono tracking-widest animate-pulse"
                      >
                        ⚡ SELECCIONANDO RETO AL AZAR... ⚡
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* EPIC COSDUST FULLVIEW TAKEOVER REVEAL MODAL */}
                <AnimatePresence>
                  {showWinningDisplay && winningChallenge && (
                    <motion.div
                      id="obs-takeover-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-[#06060b]/98 z-50 flex flex-col items-center justify-center p-6 text-center select-none"
                    >
                      {/* Ambient revolving neon sweeping light lasers */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full bg-[#ff0050]/20 blur-[130px] animate-pulse" />
                        <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full bg-[#00f2ea]/20 blur-[130px] animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#9333ea]/15 to-[#eab308]/5 rounded-full blur-[160px]" />
                      </div>

                      {/* Golden marquee luxury card */}
                      <motion.div
                        id="winning-challenge-takeover-card"
                        initial={{ scale: 0.25, rotate: -20, y: 140 }}
                        animate={{ 
                          scale: [0.25, 1.25, 0.95, 1.02, 1], 
                          rotate: 0, 
                          y: 0,
                          transition: { type: "spring", stiffness: 150, damping: 11, duration: 0.85 }
                        }}
                        exit={{ scale: 0.5, opacity: 0, y: -100 }}
                        className="relative max-w-3xl bg-gradient-to-b from-[#181826] to-[#0a0a0f] border-[6px] border-[#eab308] rounded-3xl p-12 shadow-[0_0_100px_rgba(234,179,8,0.55)] flex flex-col items-center z-10"
                      >
                        {/* Gold running dotted marquee lights border */}
                        <div className="absolute -inset-2 rounded-[22px] border border-dashed border-yellow-300 animate-spin opacity-40 duration-1000" style={{ animationDuration: '24s' }} />

                        {/* Pulsing Trophy item */}
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.6 }}
                          className="bg-yellow-400/10 border-2 border-yellow-450/40 p-5 rounded-full mb-6 shadow-[0_0_30px_rgba(234,179,8,0.3)] text-yellow-400"
                        >
                          <Trophy className="w-14 h-14" />
                        </motion.div>

                        {/* Sender details badge */}
                        <div className="flex items-center gap-3.5 bg-black/60 px-6 py-3 rounded-full border border-white/5 mb-8">
                          {displayedAlert.profilePictureUrl ? (
                            <img
                              src={getProxyUrl(displayedAlert.profilePictureUrl)}
                              alt={displayedAlert.nickname}
                              className="w-8 h-8 rounded-full object-cover border border-[#00f2ea]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#ff0050] text-black font-black text-sm flex items-center justify-center">
                              {displayedAlert.uniqueId[0]?.toUpperCase() || 'P'}
                            </div>
                          )}
                          <span className="text-xs font-mono text-gray-300 uppercase tracking-widest font-extrabold">
                            ¡RETO ACTIVADO POR <span className="text-amber-400 font-black font-sans text-sm">@{displayedAlert.uniqueId}</span>!
                          </span>
                        </div>

                        {/* Label */}
                        <div className="text-[11px] text-yellow-400 font-mono font-black tracking-[0.25em] uppercase mb-4 animate-pulse">
                          🍀 EL CONCURSO HA DETERMINADO 🍀
                        </div>

                        {/* GIANT EXPLODING TEXT REVEAL */}
                        <h1 className="text-5xl sm:text-7xl font-sans font-black text-white tracking-tight leading-tight select-none uppercase drop-shadow-[0_6px_25px_rgba(0,0,0,0.95)]">
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-amber-500 animate-pulse">
                            {winningChallenge}
                          </span>
                        </h1>

                        <p className="mt-10 text-slate-400 text-xs uppercase font-mono font-bold tracking-widest leading-relaxed bg-black/50 px-6 py-2.5 rounded-xl border border-white/5 shadow-inner">
                          🎯 CREADOR DEBE COMPLETAR ESTO DE IMEDIATO 🎯
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            ) : (
              /* --- STANDARD PREMIUM ALERTS OVERLAY CARD --- */
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
            )}
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

