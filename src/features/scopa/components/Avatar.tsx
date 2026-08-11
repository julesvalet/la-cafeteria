import { CircleUserRound } from 'lucide-react';

interface AvatarProps {
  active?: boolean;
  disconnected?: boolean;
}

export function Avatar({ active, disconnected }: AvatarProps) {
  return (
    <div className={`scopa-avatar ${active ? 'is-active' : ''} ${disconnected ? 'is-disconnected' : ''}`}>
      <CircleUserRound size={22} strokeWidth={1.6} />
    </div>
  );
}
