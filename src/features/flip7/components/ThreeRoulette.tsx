import { Component, useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';

function Wheel() {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, Math.max(0, (elapsed.current - .3) / 1.5));
    if (group.current) { group.current.rotation.y = (1 - (1 - t) ** 3) * Math.PI * 8; group.current.rotation.z = .16; }
  });
  return <group ref={group} rotation={[.25, 0, .16]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.3, .045, 8, 64]} /><meshStandardMaterial color="#50ff4d" emissive="#50ff4d" emissiveIntensity={.8} metalness={.3} roughness={.35} /></mesh>
    {Array.from({ length: 12 }, (_, i) => {
      const angle = i / 12 * Math.PI * 2;
      return <mesh key={i} position={[Math.sin(angle) * 2.3, 0, Math.cos(angle) * 2.3]} rotation={[0, angle, 0]}>
        <boxGeometry args={[.68, 1.05, .025]} /><meshStandardMaterial color={i % 3 ? '#151515' : '#50ff4d'} emissive={i % 3 ? '#0a1f0a' : '#2db82a'} emissiveIntensity={.7} metalness={.15} roughness={.5} />
      </mesh>;
    })}
  </group>;
}
class Boundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function LostContext({ onFailure }: { onFailure: () => void }) {
  useEffect(() => {
    const canvas = document.querySelector('.f7-three canvas');
    const fail = (e: Event) => { e.preventDefault(); onFailure(); };
    canvas?.addEventListener('webglcontextlost', fail);
    return () => canvas?.removeEventListener('webglcontextlost', fail);
  }, [onFailure]);
  return null;
}
export default function ThreeRoulette({ onFailure }: { onFailure: () => void }) {
  return <Boundary onFailure={onFailure}><div className="f7-three">
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 2.5, 7], fov: 45 }} gl={{ alpha: true, antialias: false }}>
      <ambientLight intensity={1.9} /><pointLight position={[2, 4, 4]} intensity={35} color="#b6ffb4" />
      <Wheel /><LostContext onFailure={onFailure} />
    </Canvas>
  </div></Boundary>;
}
