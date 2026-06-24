import { useEffect, useRef, useState } from 'react';
import { LiveEvent, SuperFan } from '../types';
import { MessageSquare, ThumbsUp, Gift, UserCheck, Share2, Shield, Trash2, ListFilter, Sparkles } from 'lucide-react';

interface LiveEventFeedProps {
  events: LiveEvent[];
  onClearEvents: () => void;
  superFans?: SuperFan[];
}

export default function LiveEventFeed({ events, onClearEvents, superFans = [] }: LiveEventFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'gifts' | 'chats' | 'social'>('all');
  const [searchText, setSearchText] = useState('');

  // Auto-scroll list as new events stream in
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [events]);

  const filteredEvents = events.filter(e => {
    // 1. Filter by category
    let matchesCategory = true;
    if (filter === 'gifts') matchesCategory = e.type === 'gift';
    else if (filter === 'chats') matchesCategory = e.type === 'chat';
    else if (filter === 'social') matchesCategory = ['follow', 'share', 'like'].includes(e.type);
    
    if (!matchesCategory) return false;

    // 2. Filter by search string
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    const uId = (e.uniqueId || '').toLowerCase();
    const nick = (e.nickname || '').toLowerCase();
    const comm = (e.comment || '').toLowerCase();
    const giftDesc = e.gift?.describe ? e.gift.describe.toLowerCase() : '';
    const giftNm = e.gift?.giftName ? e.gift.giftName.toLowerCase() : '';

    return uId.includes(term) || nick.includes(term) || comm.includes(term) || giftDesc.includes(term) || giftNm.includes(term);
  });

  // Calculate live session quick telemetry numbers
  const totalChats = events.filter(e => e.type === 'chat').length;
  const totalGifts = events.filter(e => e.type === 'gift').length;
  const totalLikes = events.filter(e => e.type === 'like').reduce((acc, current) => acc + (current.like?.likeCount || 0), 0);

  return (
    <div id="live-event-feed-panel" className="bg-[#16161D] border border-white/10 rounded-lg overflow-hidden flex flex-col h-full shadow-lg">
      {/* Panel Headers */}
      <div className="bg-black/30 p-4 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[#ff0050]/15 text-[#ff0050]">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-sans text-sm font-bold text-white uppercase tracking-tight">
              Registro <span className="text-[#00f2ea]">Eventos</span>
            </h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Flujo de interacciones en vivo</p>
          </div>
        </div>

        {/* Header control triggers */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Filter toggle */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded">
            <button
              onClick={() => setFilter('all')}
              className={`p-1 px-2 text-[9px] uppercase font-bold rounded transition-all tracking-wider ${
                filter === 'all' ? 'bg-[#00f2ea] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('gifts')}
              className={`p-1 px-2 text-[9px] uppercase font-bold rounded transition-all tracking-wider ${
                filter === 'gifts' ? 'bg-[#ff0050] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Regalos
            </button>
            <button
              onClick={() => setFilter('chats')}
              className={`p-1 px-2 text-[9px] uppercase font-bold rounded transition-all tracking-wider ${
                filter === 'chats' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setFilter('social')}
              className={`p-1 px-2 text-[9px] uppercase font-bold rounded transition-all tracking-wider ${
                filter === 'social' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Social
            </button>
          </div>

          {/* Wipe button */}
          <button
            onClick={onClearEvents}
            className="p-1.5 rounded bg-black/40 border border-white/10 text-gray-400 hover:text-[#ff0050] hover:border-[#ff0050]/50 transition-all"
            title="Limpiar registro"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-time Search Commentary Filter bar */}
      <div className="px-4 pb-3 pt-1 border-b border-white/5 bg-black/10 flex gap-2">
        <input
          type="text"
          placeholder="Buscar por usuario o comentario..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#00f2ea]/50 font-sans"
        />
        {searchText && (
          <button 
            onClick={() => setSearchText('')}
            className="text-[10px] text-gray-500 hover:text-white transition px-1"
            type="button"
          >
            Clear
          </button>
        )}
      </div>

      {/* Internal Telemetry Grid Bar */}
      <div className="grid grid-cols-3 bg-black/35 border-b border-white/10 divide-x divide-white/10 text-center text-[11px] font-sans">
        <div className="py-2.5">
          <span className="text-gray-500 block uppercase text-[8.5px] font-bold tracking-wider">Mensajes Chat</span>
          <span className="text-[#00f2ea] font-mono font-bold text-xs block mt-0.5">{totalChats}</span>
        </div>
        <div className="py-2.5">
          <span className="text-gray-500 block uppercase text-[8.5px] font-bold tracking-wider">Regalos Totales</span>
          <span className="text-[#ff0050] font-mono font-bold text-xs block mt-0.5">{totalGifts}</span>
        </div>
        <div className="py-2.5">
          <span className="text-gray-500 block uppercase text-[8.5px] font-bold tracking-wider">Likes Recibidos</span>
          <span className="text-yellow-400 font-mono font-bold text-xs block mt-0.5">{totalLikes}</span>
        </div>
      </div>

      {/* Scrolling Stream list feed container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[480px] bg-[#121218]/40"
      >
        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <ListFilter className="w-8 h-8 text-gray-700 mb-2 opacity-50 animate-pulse" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">No hay transacciones registradas</p>
            <p className="text-[10px] text-gray-600 mt-1 max-w-[240px] leading-relaxed">
              Escribe el usuario, conéctate o inicia las simulaciones en el panel interactivo de la izquierda.
            </p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const dateStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div
                key={evt.id}
                className="group flex gap-2.5 text-xs p-2.5 bg-black/20 hover:bg-white/5 border border-white/5 rounded transition-all font-sans"
              >
                {/* Visual Category badge */}
                <div className="shrink-0 pt-0.5">
                  {evt.type === 'chat' && (
                    <div className="p-1 rounded bg-blue-500/10 text-blue-400">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {evt.type === 'gift' && (
                    <div className="p-1 rounded bg-[#ff0050]/10 text-[#ff0050]">
                      <Gift className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {evt.type === 'like' && (
                    <div className="p-1 rounded bg-yellow-500/10 text-yellow-500">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {evt.type === 'follow' && (
                    <div className="p-1 rounded bg-purple-500/10 text-purple-400">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {evt.type === 'share' && (
                    <div className="p-1 rounded bg-teal-500/10 text-teal-400">
                      <Share2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {evt.type === 'system' && (
                    <div className="p-1 rounded bg-gray-500/10 text-gray-400">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Event core data */}
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-200">
                      @{evt.uniqueId && !evt.uniqueId.toLowerCase().includes('espectador') ? evt.uniqueId : (evt.nickname && !evt.nickname.toLowerCase().includes('espectador') ? evt.nickname : 'anonimo_live')}
                    </span>
                    {evt.nickname && evt.uniqueId && evt.uniqueId !== evt.nickname && (
                      <span className="text-[10px] text-gray-550 font-normal">({evt.nickname})</span>
                    )}
                    
                    {/* Glowing Super Fan Badge indicator */}
                    {evt.uniqueId && superFans.some(sf => sf.uniqueId && sf.uniqueId.toLowerCase() === evt.uniqueId.toLowerCase()) && (
                      <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-pink-500 text-black text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full border border-yellow-300 flex items-center gap-0.5 animate-pulse shadow">
                        <Sparkles className="w-2 h-2 text-black fill-black" />
                        Súper Fan
                      </span>
                    )}

                    <span className="text-[9px] text-gray-600 font-mono ml-auto">{dateStr}</span>
                  </div>

                  {/* Context Content depends on type */}
                  {evt.type === 'chat' && (
                    <p className="text-gray-300 mt-1 font-sans text-[11.5px]">{evt.comment}</p>
                  )}

                  {evt.type === 'gift' && evt.gift && (
                    <div className="mt-1.5 flex items-center justify-between bg-[#ff0050]/5 border border-[#ff0050]/15 rounded p-1.5 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="relative w-7 h-7 rounded bg-black/55 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {evt.gift.giftPictureUrl ? (
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(evt.gift.giftPictureUrl)}`}
                              alt={evt.gift.giftName}
                              className="w-6 h-6 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-xs">🎁</span>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold text-[11px]">
                            {evt.gift.describe} <span className="text-[#ff0050] font-mono font-bold text-xs bg-[#ff0050]/10 px-1 rounded ml-1">x{evt.gift.repeatCount}</span>
                          </p>
                          <p className="text-[9px] text-yellow-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>💎 {evt.gift.diamondCount} diamantes</span>
                            {evt.gift.giftId && (
                              <span className="text-[#00f2ea] bg-[#00f2ea]/10 border border-[#00f2ea]/25 px-1 rounded text-[8.5px] font-sans font-bold">
                                ID: {evt.gift.giftId}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {evt.type === 'like' && evt.like && (
                    <p className="text-yellow-500 mt-1 text-[11px] font-mono font-medium">
                      Añadió +{evt.like.likeCount} me gusta (Total: {evt.like.totalLikeCount})
                    </p>
                  )}

                  {evt.type === 'follow' && (
                    <p className="text-purple-400 mt-1 font-sans text-[11px]">¡Comenzó a seguir al creador!</p>
                  )}

                  {evt.type === 'share' && (
                    <p className="text-teal-400 mt-1 font-sans text-[11px]">¡Compartió el directo en vivo!</p>
                  )}

                  {evt.type === 'system' && (
                    <p className="text-gray-400 mt-1 font-mono text-[10px]">{evt.comment}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
