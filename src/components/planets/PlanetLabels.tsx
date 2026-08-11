import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp01, type FlightState } from './flight';
import type { PlanetDef } from './planets.data';

export type ElementMap = Map<string, HTMLElement | null>;
export type ObjectMap = Map<string, THREE.Object3D | null>;

interface ProjectorProps {
  labels: React.RefObject<ElementMap>;
  objects: React.RefObject<ObjectMap>;
  radiusOf: (id: string) => number;
  flight: React.RefObject<FlightState>;
}

/**
 * Lives inside the Canvas and pins each DOM label under its planet by
 * projecting the planet's world position every frame. Writing straight to
 * `style` keeps this off React's render path — labels are the only DOM that
 * needs to track a 60fps camera.
 */
export function LabelProjector({ labels, objects, radiusOf, flight }: ProjectorProps) {
  const world = useRef(new THREE.Vector3());
  const below = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3());
  const lastOpacity = useRef(new Map<string, number>());

  useFrame((state) => {
    const { camera, size } = state;
    // Fade the whole HUD out as soon as a dive begins.
    const flightFade = flight.current.id ? clamp01(1 - flight.current.t * 4) : 1;

    up.current.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    for (const [id, el] of labels.current) {
      if (!el) continue;
      const object = objects.current.get(id);
      if (!object) continue;

      object.getWorldPosition(world.current);
      below.current.copy(world.current).addScaledVector(up.current, -radiusOf(id));

      world.current.project(camera);
      below.current.project(camera);

      // Behind the camera, or pushed off-screen by the dive.
      const visible = world.current.z < 1 && flightFade > 0.01;
      const opacity = visible ? flightFade : 0;

      if (lastOpacity.current.get(id) !== opacity) {
        lastOpacity.current.set(id, opacity);
        el.style.opacity = String(opacity);
        el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      }
      if (!visible) continue;

      const x = (world.current.x * 0.5 + 0.5) * size.width;
      const y = (-below.current.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, 0) translate3d(${x.toFixed(1)}px, ${(y + 14).toFixed(1)}px, 0)`;
    }
  });

  return null;
}

interface PlanetLabelsProps {
  planets: PlanetDef[];
  hovered: string | null;
  labels: React.RefObject<ElementMap>;
  onHover: (id: string | null) => void;
  onActivate: (id: string) => void;
  disabled: boolean;
}

/**
 * The DOM half of the labels. These are real buttons: they are what makes the
 * scene keyboard-navigable and screen-reader friendly, since a mesh in a canvas
 * is invisible to assistive tech.
 */
export function PlanetLabels({ planets, hovered, labels, onHover, onActivate, disabled }: PlanetLabelsProps) {
  return (
    <div className="planet-labels">
      {planets.map((planet) => {
        const locked = !planet.to;
        const active = hovered === planet.id;

        return (
          <div
            key={planet.id}
            className="planet-label"
            ref={(el) => {
              labels.current.set(planet.id, el);
            }}
          >
            <button
              type="button"
              className={`planet-label-button${locked ? ' is-locked' : ''}${active ? ' is-active' : ''}`}
              aria-disabled={locked || undefined}
              disabled={disabled}
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') onHover(planet.id);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== 'touch') onHover(null);
              }}
              onFocus={() => onHover(planet.id)}
              onBlur={() => onHover(null)}
              onClick={() => onActivate(planet.id)}
            >
              <span className="planet-label-name">{planet.name}</span>
              {/* Faded out until hover/focus, but always in the accessibility
                  tree — the state is part of the button's name, not decoration. */}
              <span className="planet-label-detail">{locked ? 'Bientôt disponible' : 'Entrer'}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
