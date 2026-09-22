/**
 * Les calques d'ambiance, fixes et inertes : les arcs de la bannière aux
 * coins de l'écran, le vignettage du tube et le bandeau de balayage. Les
 * lignes de balayage elles-mêmes sont sur `body::after` (voir index.css).
 */
export function ArcadeBackdrop() {
  return (
    <>
      <div className="plf-arcs" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="plf-vignette" aria-hidden="true" />
      <div className="plf-scanband" aria-hidden="true" />
    </>
  );
}
