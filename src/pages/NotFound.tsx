import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="container nf">
      <p className="nf-code" aria-hidden>
        404
      </p>
      <h1>Game over</h1>
      <p>Ce niveau n'existe pas… encore. La partie continue à l'accueil.</p>
      <Link to="/" className="btn btn-primary">
        Continuer ? <span className="plf-blink">▶</span>
      </Link>
    </div>
  );
}
