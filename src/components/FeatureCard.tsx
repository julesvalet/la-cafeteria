import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  to?: string;
  comingSoon?: boolean;
}

export function FeatureCard({ title, description, icon: Icon, to, comingSoon }: FeatureCardProps) {
  const content = (
    <>
      <span className="feature-card-icon" aria-hidden="true">
        <Icon size={26} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {comingSoon && <span className="feature-card-badge">Bientôt disponible</span>}
    </>
  );

  if (comingSoon || !to) {
    return (
      <div className="feature-card feature-card-disabled" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className="feature-card">
      {content}
    </Link>
  );
}
