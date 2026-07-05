import { useState } from 'react';
import { SuperFan } from '../types';
import { Trash2, Plus, Users, Sparkles, ChevronDown, ChevronUp, Edit, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuperFansControllerProps {
  superFans: SuperFan[];
  onUpdateSuperFans: (fans: SuperFan[]) => void;
}

export default function SuperFansController({ superFans, onUpdateSuperFans }: SuperFansControllerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form states
  const [uniqueId, setUniqueId] = useState('');
  const [nickname, setNickname] = useState('');
  const [fanLevel, setFanLevel] = useState<number>(10);
  const [badgeLevel, setBadgeLevel] = useState<'Estrella' | 'Corona' | 'Leyenda'>('Estrella');
  const [joinMessage, setJoinMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [formError, setFormError] = useState('');

  const handleAddOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanId = uniqueId.replace('@', '').trim();
    if (!cleanId) {
      setFormError('El ID único de usuario es obligatorio');
      return;
    }

    if (!nickname.trim()) {
      setFormError('El apodo o nickname es obligatorio');
      return;
    }

    const defaultAvatar = avatarUrl.trim() || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(cleanId)}`;

    const newFan: SuperFan = {
      uniqueId: cleanId,
      nickname: nickname.trim(),
      fanLevel: Number(fanLevel),
      badgeLevel,
      avatarUrl: defaultAvatar,
      joinMessage: joinMessage.trim() || `¡Súper Fan ${nickname.trim()} se unió al directo!`
    };

    if (editingIndex !== null) {
      // Edit mode
      const updated = [...superFans];
      updated[editingIndex] = newFan;
      onUpdateSuperFans(updated);
      setEditingIndex(null);
    } else {
      // Add mode - check for duplicate uniqueId
      const exists = superFans.some(sf => sf.uniqueId.toLowerCase() === cleanId.toLowerCase());
      if (exists) {
        setFormError(`El usuario @${cleanId} ya está registrado como Súper Fan`);
        return;
      }
      onUpdateSuperFans([...superFans, newFan]);
    }

    // Reset Form
    setUniqueId('');
    setNickname('');
    setFanLevel(10);
    setBadgeLevel('Estrella');
    setAvatarUrl('');
    setJoinMessage('');
  };

  const handleEditClick = (index: number) => {
    const target = superFans[index];
    setEditingIndex(index);
    setUniqueId(target.uniqueId);
    setNickname(target.nickname);
    setFanLevel(target.fanLevel);
    setBadgeLevel(target.badgeLevel as 'Estrella' | 'Corona' | 'Leyenda');
    setAvatarUrl(target.avatarUrl || '');
    setJoinMessage(target.joinMessage || '');
    setFormError('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setUniqueId('');
    setNickname('');
    setFanLevel(10);
    setBadgeLevel('Estrella');
    setAvatarUrl('');
    setJoinMessage('');
    setFormError('');
  };

  const handleDelete = (index: number) => {
    if (confirm(`¿Estás seguro de que deseas eliminar a este Súper Fan?`)) {
      const updated = superFans.filter((_, idx) => idx !== index);
      onUpdateSuperFans(updated);
      if (editingIndex === index) {
        handleCancelEdit();
      }
    }
  };

  return (
    <section id="superfans-controller-section" className="bg-[#121218] border border-white/5 rounded p-4 flex flex-col gap-3 shadow-md relative overflow-hidden">
      {/* Header clickable to toggle collapse */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full cursor-pointer select-none"
      >
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-yellow-400" />
          <span>Gestión de Súper Fans ({superFans.length})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 font-mono px-1.5 py-0.2 rounded uppercase select-none animate-pulse">
            VIP
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      <p className="text-gray-455 text-[10px] leading-relaxed">
        Configura los usuarios estrella del canal que tendrán alertas personalizadas al entrar, TTS exclusivo cuando el chat esté restringido y saludos especiales.
      </p>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {/* List of current superfans */}
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 mt-1">
              {superFans.length === 0 ? (
                <div className="text-center py-6 bg-black/25 border border-white/5 rounded text-gray-500 text-[10.5px] italic">
                  No hay Súper Fans registrados. Usa el formulario de abajo para agregar a tu primer seguidor VIP.
                </div>
              ) : (
                superFans.map((sf, idx) => (
                  <div 
                    key={sf.uniqueId + '-' + idx} 
                    className="flex items-center gap-3 bg-black/40 border border-white/5 rounded p-2.5 hover:border-yellow-500/20 transition-all group"
                  >
                    <img 
                      src={sf.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${sf.uniqueId}`} 
                      alt={sf.nickname}
                      className="w-8 h-8 rounded-full border border-yellow-500/30 object-cover bg-slate-800 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${sf.uniqueId}`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11.5px] font-bold text-white truncate">
                          {sf.nickname}
                        </span>
                        <span className="text-[9px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-1 font-mono font-bold leading-none shrink-0">
                          Nivel {sf.fanLevel}
                        </span>
                        <span className="text-[9px] text-pink-400 bg-pink-400/10 border border-pink-400/20 rounded px-1 font-mono font-bold leading-none shrink-0">
                          {sf.badgeLevel}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-450 truncate mt-0.5">
                        <span className="text-gray-500 font-mono">@{sf.uniqueId}</span>
                        {sf.joinMessage && <span className="text-gray-300 italic ml-1.5">"{sf.joinMessage}"</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleEditClick(idx)}
                        className="p-1 rounded bg-black/40 border border-white/10 text-gray-400 hover:text-yellow-400 hover:border-yellow-400/30 transition-all cursor-pointer"
                        title="Editar Súper Fan"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        className="p-1 rounded bg-black/40 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer"
                        title="Eliminar Súper Fan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Form to Add/Edit Superfan */}
            <form onSubmit={handleAddOrEdit} className="bg-black/25 border border-white/5 rounded p-3 flex flex-col gap-2.5 mt-1">
              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                  {editingIndex !== null ? 'Editar Súper Fan' : 'Agregar Nuevo Súper Fan'}
                </span>
                {editingIndex !== null && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-[9px] text-red-400 hover:underline uppercase font-mono cursor-pointer flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                )}
              </div>

              {formError && (
                <div className="text-[9.5px] text-red-400 bg-red-400/5 border border-red-400/15 p-1.5 rounded uppercase font-mono font-medium">
                  ⚠️ {formError}
                </div>
              )}

              {/* TikTok ID & Nickname fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Usuario de TikTok (ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: carlos_vip"
                    value={uniqueId}
                    onChange={(e) => setUniqueId(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-yellow-400/50 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Apodo / Nickname</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos el Patrón 👑"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-yellow-400/50"
                  />
                </div>
              </div>

              {/* Level & Badge dropdown */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Nivel de Fan: {fanLevel}</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={fanLevel}
                    onChange={(e) => setFanLevel(Number(e.target.value))}
                    className="accent-yellow-400 h-1 rounded bg-[#121218] mt-1"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Insignia VIP</label>
                  <select
                    value={badgeLevel}
                    onChange={(e) => setBadgeLevel(e.target.value as any)}
                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-yellow-400/50 font-sans"
                  >
                    <option value="Estrella">⭐ Estrella</option>
                    <option value="Corona">👑 Corona</option>
                    <option value="Leyenda">🔥 Leyenda</option>
                  </select>
                </div>
              </div>

              {/* Message on entry */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">Mensaje de Entrada (Opcional)</label>
                <input
                  type="text"
                  placeholder="Mensaje de bienvenida personalizado..."
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-yellow-400/50"
                />
              </div>

              {/* Profile Image URL */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 uppercase font-mono font-bold">URL del Avatar (Opcional)</label>
                <input
                  type="text"
                  placeholder="Deja vacío para avatar aleatorio..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded py-1 px-2 text-xs text-white focus:outline-none focus:border-yellow-400/50 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/35 hover:border-yellow-500/50 text-yellow-400 font-bold font-mono text-[9.5px] py-1.5 rounded uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                {editingIndex !== null ? (
                  <>
                    <Save className="w-3.5 h-3.5" /> Guardar Cambios
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Agregar Súper Fan
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
