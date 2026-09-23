import { createContext } from 'react';
import type { Cosmetics, PlafeeEvent, Standing, Wallet } from './api';

export interface PlafeeValue {
  standing: Standing | null;
  isAdmin: boolean;
  banned: boolean;
  wallet: Wallet | null;
  refreshWallet: () => void;
  mine: Cosmetics | null;
  refreshMine: () => void;
  /** Événements en cours ou qui démarrent dans la semaine. */
  events: PlafeeEvent[];
  refreshEvents: () => void;
}

export const PlafeeContext = createContext<PlafeeValue | null>(null);
