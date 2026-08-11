import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="container home-notfound">
      <h1>404</h1>
      <p>Cette page n'existe pas... encore.</p>
      <Link to="/" className="btn btn-primary">
        Retour à l'accueil
      </Link>
    </div>
  );
}
