export interface LiveEvent {
  id: string;
  type: 'chat' | 'gift' | 'like' | 'follow' | 'share' | 'system';
  timestamp: number;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  isModerator?: boolean;
  comment?: string;
  gift?: {
    giftId: number | string;
    giftName: string;
    describe: string;
    repeatCount: number;
    repeatEnd: boolean;
    giftPictureUrl: string;
    diamondCount: number;
  };
  like?: {
    likeCount: number;
    totalLikeCount: number;
  };
}

export interface GiftSoundMapping {
  giftName: string; // Used to match the gift
  giftId?: string | number;
  iconUrl?: string; // Cache the gift icon
  soundId: string; // Assigned sound ID (synthesized or loaded URL)
  volume: number; // 0 to 1
  label: string; // Display name
  customSoundUrl?: string; // Uploaded/pasted URL
}

export interface PresetSound {
  id: string;
  name: string;
  type: 'synth' | 'url';
  synthType?: 'coin' | 'triumph' | 'laser' | 'airhorn' | 'bubble' | 'magic';
  url?: string;
}

export interface SuperFan {
  uniqueId: string;
  nickname: string;
  fanLevel: number;
  avatarUrl: string;
  badgeLevel: string; // "Estrella" | "Corona" | "Leyenda"
  joinMessage: string;
}

export interface SuperFanAlertData {
  id: string;
  uniqueId: string;
  nickname: string;
  fanLevel: number;
  avatarUrl: string;
  actionText: string;
}

