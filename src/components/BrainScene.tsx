import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, PCFSoftShadowMap, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BrainModel } from './BrainModel'
import type { HemisphereVisibility } from './BrainModel'
import type { PartId } from '../anatomyColors'

export interface ViewCommand {
  type: 'reset' | 'in' | 'out'
  id: number
}

interface SceneProps {
  autoRotate: boolean
  reducedMotion: boolean
  anatomicalColors: boolean
  explosion: number
  hemisphere: HemisphereVisibility
  selectedParts: PartId[]
  command: ViewCommand | null
  onReady: () => void
  onInteraction: (active: boolean) => void
  onContextLost: () => void
}

function CameraRig({ autoRotate, reducedMotion, command, onInteraction }: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size, invalidate } = useThree()
  const resetDestination = useRef<Vector3 | null>(null)
  const initialPosition = useRef(new Vector3())

  useEffect(() => {
    const aspect = size.width / size.height
    const distance = 7.1 * Math.max(1, 0.88 / aspect)
    initialPosition.current.set(-0.78, 0.35, 0.66).normalize().multiplyScalar(distance)
    camera.position.copy(initialPosition.current)
    controls.current?.target.set(0, 0.05, 0)
    controls.current?.update()
    controls.current?.saveState()
    invalidate()
  }, [camera, size.width, size.height, invalidate])

  useEffect(() => {
    const orbit = controls.current
    if (!command || !orbit) return
    if (command.type === 'reset') {
      // Clear accumulated orbit inertia before returning to the presentation view.
      const previousPosition = camera.position.clone()
      orbit.reset()
      orbit.target.set(0, 0.05, 0)
      if (reducedMotion) camera.position.copy(initialPosition.current)
      else {
        camera.position.copy(previousPosition)
        resetDestination.current = initialPosition.current.clone()
      }
    } else {
      resetDestination.current = null
      const offset = camera.position.clone().sub(orbit.target)
      const distance = Math.max(3.1, Math.min(16, offset.length() * (command.type === 'in' ? 0.82 : 1.22)))
      camera.position.copy(orbit.target).add(offset.setLength(distance))
    }
    orbit.update()
    invalidate()
  }, [command, camera, reducedMotion, invalidate])

  useFrame((state, delta) => {
    if (resetDestination.current) {
      camera.position.lerp(resetDestination.current, 1 - Math.exp(-delta * 8))
      if (camera.position.distanceTo(resetDestination.current) < 0.002) {
        camera.position.copy(resetDestination.current)
        resetDestination.current = null
      }
      controls.current?.update()
      state.invalidate()
    }
    if (autoRotate) state.invalidate()
  })

  useEffect(() => { invalidate() }, [autoRotate, invalidate])

  return <OrbitControls
    ref={controls}
    makeDefault
    enablePan={false}
    enableDamping
    dampingFactor={0.075}
    rotateSpeed={0.55}
    zoomSpeed={0.65}
    minDistance={3.1}
    maxDistance={16}
    minPolarAngle={0.04}
    maxPolarAngle={Math.PI - 0.04}
    autoRotate={autoRotate && !resetDestination.current}
    autoRotateSpeed={0.32}
    onStart={() => { resetDestination.current = null; onInteraction(true) }}
    onEnd={() => onInteraction(false)}
  />
}

export function BrainScene(props: SceneProps) {
  return <Canvas
    shadows={{ type: PCFSoftShadowMap }}
    dpr={[1, 1.75]}
    frameloop="demand"
    camera={{ position: [-4.8, 2.3, -5.85], fov: 35, near: 0.1, far: 60 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
    onCreated={({ gl }) => {
      gl.toneMappingExposure = 1.08
      gl.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault()
        props.onContextLost()
      }, { once: true })
    }}
    fallback={<div className="scene-message">WebGL is unavailable. Please use a browser with hardware acceleration enabled.</div>}
  >
    <ambientLight intensity={0.32} color="#c5d5eb" />
    <hemisphereLight args={['#d4e5f5', '#4e3a35', 0.55]} />
    <directionalLight position={[-3, 6, -4]} intensity={3.2} color="#ffe9d8" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.00015} shadow-normalBias={0.018}
      shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3}
      shadow-camera-near={0.5} shadow-camera-far={18} shadow-radius={3} />
    <directionalLight position={[4, 1.5, -2]} intensity={0.8} color="#b4cfdc" />
    <directionalLight position={[1, 4, 4]} intensity={3.6} color="#a9d6e0" />
    <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#a0b9cf" />
    <Suspense fallback={null}>
      <BrainModel reducedMotion={props.reducedMotion} anatomicalColors={props.anatomicalColors} explosion={props.explosion} hemisphere={props.hemisphere} selectedParts={props.selectedParts} onReady={props.onReady} />
    </Suspense>
    <CameraRig {...props} />
  </Canvas>
}
