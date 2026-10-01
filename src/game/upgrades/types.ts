// Tipe definisi upgrade (data-driven).
import type { PlayerState } from '../playerState';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string; // nama aset ui_icon_<id> (atau ikon khusus)
  maxLevel: number;
  tags: string[];
  // Deskripsi singkat untuk level tertentu (boleh berubah tiap level).
  description: (level: number) => string;
  // Terapkan efeknya ke state pemain pada level tsb.
  apply: (state: PlayerState, level: number) => void;
}
