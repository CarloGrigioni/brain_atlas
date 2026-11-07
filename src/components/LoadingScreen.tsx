import { useProgress } from '@react-three/drei'

export function LoadingScreen() {
  const { progress } = useProgress()
  return <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-orbit"><span /></div>
    <p>Preparing your perspective</p>
    <div className="loading-track"><span style={{ width: `${Math.max(5, progress)}%` }} /></div>
    <span className="micro-label">LOADING ANATOMICAL MODEL</span>
  </div>
}
