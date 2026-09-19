import {
  Award,
  Brain,
  Coffee,
  Crown,
  Flame,
  Footprints,
  Gem,
  Grid3x3,
  Hand,
  HeartHandshake,
  HeartPulse,
  Layers,
  Medal,
  MessagesSquare,
  Sparkles,
  Stars,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Les icônes des trophées, par le nom que la base leur donne. Une table
 * explicite plutôt qu'un import dynamique de toute la bibliothèque : seules
 * ces icônes entrent dans le bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  Footprints, Swords, Trophy, Crown, HeartPulse, Hand, Sparkles, Gem, Zap, Layers,
  Grid3x3, Brain, Users, MessagesSquare, HeartHandshake, Medal, Flame, TrendingUp, Stars, Coffee,
};

export const achievementIcon = (name: string): LucideIcon => ICONS[name] ?? Award;
