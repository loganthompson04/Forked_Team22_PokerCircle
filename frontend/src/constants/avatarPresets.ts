export type AvatarPreset = { id: string; color: string; icon: string };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'red-spade',     color: '#B22222', icon: '♠' },
  { id: 'red-heart',     color: '#B22222', icon: '♥' },
  { id: 'red-diamond',   color: '#B22222', icon: '♦' },
  { id: 'red-club',      color: '#B22222', icon: '♣' },
  { id: 'blue-spade',    color: '#1565C0', icon: '♠' },
  { id: 'blue-heart',    color: '#1565C0', icon: '♥' },
  { id: 'blue-diamond',  color: '#1565C0', icon: '♦' },
  { id: 'blue-club',     color: '#1565C0', icon: '♣' },
  { id: 'green-spade',   color: '#2E7D32', icon: '♠' },
  { id: 'green-heart',   color: '#2E7D32', icon: '♥' },
  { id: 'green-diamond', color: '#2E7D32', icon: '♦' },
  { id: 'green-club',    color: '#2E7D32', icon: '♣' },
  { id: 'purple-spade',  color: '#6A1B9A', icon: '♠' },
  { id: 'purple-heart',  color: '#6A1B9A', icon: '♥' },
  { id: 'purple-diamond',color: '#6A1B9A', icon: '♦' },
  { id: 'purple-club',   color: '#6A1B9A', icon: '♣' },
];

export const PRESET_MAP = new Map(AVATAR_PRESETS.map((p) => [p.id, p]));
