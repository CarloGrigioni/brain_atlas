import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { ANATOMY_COLORS, makeRegionColors } from '../anatomyColors'
import type { PartId } from '../anatomyColors'
import { explosionOffset, splitCortex } from '../explodeBrain'

export const MODEL_URL = `${import.meta.env.BASE_URL}models/brain.glb`
export type HemisphereVisibility = 'both' | 'left' | 'right'

interface BrainModelProps {
  reducedMotion: boolean
  anatomicalColors: boolean
  explosion: number
  hemisphere: HemisphereVisibility
  selectedParts: PartId[]
  onReady: () => void
}

/** Keep source region metadata intact for future region picking. */
export function BrainModel({ reducedMotion, anatomicalColors, explosion, hemisphere, selectedParts, onReady }: BrainModelProps) {
  const { scene } = useGLTF(MODEL_URL, false, false)
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const separation = useRef(0)
  const framing = useMemo(() => ({ bounds: new Box3(), shifted: new Box3(), center: new Vector3(), size: new Vector3(), axis: new Vector3(0, 1, 0) }), [])
  const invalidate = useThree((state) => state.invalidate)
  const { model, surfaces } = useMemo(() => {
    const clone = scene.clone(true)
    const sourceMeshes: Mesh[] = []
    clone.traverse((object) => { if (object instanceof Mesh) sourceMeshes.push(object) })
    for (const mesh of sourceMeshes) {
      if (!mesh.userData.unifiedCortex) continue
      const parts = splitCortex(mesh)
      if (parts.length > 1 && mesh.parent) {
        const parent = mesh.parent
        parent.remove(mesh)
        parent.add(...parts)
      }
    }
    const surfaces: Array<{ mesh: Mesh; ivory: ReturnType<Mesh['geometry']['getAttribute']>; regions: ReturnType<typeof makeRegionColors>; base: string; origin: Mesh['position']; offset: Mesh['position']; bounds: Box3 }> = []
    let corticalColors: ReturnType<typeof makeRegionColors> | undefined
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const isCerebellum = object.name === 'cerebellum'
      // Cortical partitions already own their geometry and share source buffers.
      if (!object.userData.unifiedCortex) object.geometry = object.geometry.clone()
      const base = isCerebellum ? '#c7b4a9' : '#e3c9bd'
      const colors = object.userData.unifiedCortex
        ? (corticalColors ??= makeRegionColors(object.geometry, object.userData.regionIndexOrder ?? []))
        : makeRegionColors(object.geometry, [], object.userData.brainRegionId)
      // Partition attributes contain the full source vertex buffer: use only
      // referenced vertices to frame the selected region, not the whole cortex.
      const bounds = new Box3()
      const point = new Vector3()
      const positions = object.geometry.getAttribute('position')
      const indices = object.geometry.getIndex()
      for (let i = 0; i < (indices?.count ?? positions.count); i++) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, indices ? indices.getX(i) : i))
      }
      object.updateMatrix()
      bounds.applyMatrix4(object.matrix)
      surfaces.push({ mesh: object, ivory: object.geometry.getAttribute('color'),
        regions: colors, base, origin: object.position.clone(), offset: explosionOffset(object), bounds })
      object.material = new MeshStandardMaterial({
        color: base,
        roughness: 0.64,
        metalness: 0,
        side: DoubleSide,
        vertexColors: Boolean(object.geometry.getAttribute('color')),
      })
      object.castShadow = true
      object.receiveShadow = true
    })
    return { model: clone, surfaces }
  }, [scene])

  useEffect(() => {
    for (const { mesh, ivory, regions, base } of surfaces) {
      mesh.geometry.setAttribute('color', anatomicalColors ? regions : ivory)
      ;(mesh.material as MeshStandardMaterial).color.set(anatomicalColors ? '#ffffff' : base)
    }
    invalidate()
  }, [anatomicalColors, surfaces, invalidate])

  useEffect(() => { invalidate() }, [explosion, reducedMotion, invalidate])

  useEffect(() => {
    for (const { mesh } of surfaces) {
      const side = mesh.userData.hemisphere
      const matchesRegion = selectedParts.includes(mesh.userData.brainRegionId)
      const matchesSide = !side || hemisphere === 'both' || side === hemisphere
      mesh.visible = matchesRegion && matchesSide
    }
    invalidate()
  }, [hemisphere, selectedParts, surfaces, invalidate])

  useEffect(() => {
    onReady()
    return () => {
      model.traverse((object) => {
        if (object instanceof Mesh) {
          (object.material as MeshStandardMaterial).dispose()
          object.geometry.dispose()
        }
      })
    }
  }, [model, onReady])

  useFrame((state, delta) => {
    if (!group.current) return
    const difference = explosion - separation.current
    separation.current = reducedMotion || Math.abs(difference) < 0.001
      ? explosion : separation.current + difference * (1 - Math.exp(-delta * 7))
    for (const { mesh, origin, offset } of surfaces) mesh.position.copy(origin).addScaledVector(offset, separation.current)
    let introScale = 1
    if (!reducedMotion && elapsed.current < 1.8) {
      elapsed.current = Math.min(elapsed.current + delta, 1.8)
      const ease = 1 - Math.pow(1 - elapsed.current / 1.8, 3)
      introScale = 0.94 + 0.06 * ease
      group.current.rotation.y = -0.12 * (1 - ease)
      state.invalidate()
    }
    if (selectedParts.length === ANATOMY_COLORS.length || selectedParts.length === 0) {
      // Restoring all parts also restores the original presentation transform.
      group.current.position.set(0, 0, 0)
      group.current.scale.setScalar(introScale / (1 + 0.65 * separation.current))
    } else {
      framing.bounds.makeEmpty()
      for (const { mesh, bounds, offset } of surfaces) {
        if (!mesh.visible) continue
        framing.shifted.copy(bounds)
        framing.shifted.min.addScaledVector(offset, separation.current)
        framing.shifted.max.addScaledVector(offset, separation.current)
        framing.bounds.union(framing.shifted)
      }
      if (!framing.bounds.isEmpty()) {
        framing.bounds.getSize(framing.size)
        framing.bounds.getCenter(framing.center)
        const scale = introScale * 3 / Math.max(framing.size.x, framing.size.y, framing.size.z, 0.01)
        group.current.scale.setScalar(scale)
        group.current.position.copy(framing.center).applyAxisAngle(framing.axis, group.current.rotation.y).multiplyScalar(-scale)
      }
    }
    if (separation.current !== explosion) state.invalidate()
  })

  return <group ref={group}><primitive object={model} dispose={null} /></group>
}
