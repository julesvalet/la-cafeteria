import { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { SocialPage } from '../../social/components/SocialPage';
import { listEvents, type PlafeeEvent } from '../api';
import { EventCard } from '../components/site';

/** Les événements : en cours, à venir, puis les précédents. */
export function EventsPage() {
  const [events, setEvents] = useState<PlafeeEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents(true)
      .then((e) => !cancelled && setEvents(e))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Chargement impossible.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups: { title: string; list: PlafeeEvent[] }[] = events
    ? [
        { title: 'En cours', list: events.filter((e) => e.status === 'live') },
        { title: 'À venir', list: events.filter((e) => e.status === 'upcoming') },
        { title: 'Terminés', list: events.filter((e) => e.status === 'ended').slice(0, 12) },
      ]
    : [];

  return (
    <SocialPage public>
      <section className="acc-card acc-card-wide">
        <h1 className="acc-title">
          <PartyPopper size={26} aria-hidden /> Événements
        </h1>
        <p className="acc-subtitle">
          Des défis à durée limitée. Remplis l'objectif avant la fin pour gagner un trophée en édition limitée — il disparaît du
          catalogue une fois l'événement passé.
        </p>
        {error && (
          <p className="neon-error" role="alert">
            {error}
          </p>
        )}
        {!events && !error && (
          <p className="neon-hint" role="status">
            Chargement…
          </p>
        )}
        {events && events.length === 0 && <p className="soc-empty">Aucun événement pour l'instant. Reviens bientôt.</p>}
        {groups
          .filter((g) => g.list.length)
          .map((g) => (
            <div key={g.title} className="plf-event-group">
              <h2 className="ach-group-title">{g.title}</h2>
              <div className="plf-event-grid">
                {g.list.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            </div>
          ))}
      </section>
    </SocialPage>
  );
}
