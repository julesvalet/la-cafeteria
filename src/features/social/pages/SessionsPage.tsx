import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SocialPage } from '../components/SocialPage';
import { ActiveSessions } from '../components/ActiveSessions';
import { SessionCreator } from '../components/SessionCreator';

export function SessionsPage() {
  const [creating, setCreating] = useState(false);
  return (
    <SocialPage
      title="Sessions en cours"
      subtitle="Les tables publiques de tes amis. Les tables privées n'apparaissent jamais ici."
      wide
    >
      <div className="sess-page-actions">
        <button type="button" className="sess-primary sess-primary-inline" onClick={() => setCreating(true)}>
          <Plus size={17} aria-hidden /> Créer une session
        </button>
      </div>
      <section className="sess-panel">
        <ActiveSessions />
      </section>
      <SessionCreator open={creating} onClose={() => setCreating(false)} />
    </SocialPage>
  );
}
