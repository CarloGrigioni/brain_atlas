import { BufferGeometry, Mesh, Vector3 } from 'three'

/** Partition existing triangles, without adding cut surfaces or changing vertices. */
export function splitCortex(mesh: Mesh): Mesh[] {
  const geometry = mesh.geometry
  const indices = geometry.getIndex()
  const positions = geometry.getAttribute('position')
  const weights = geometry.getAttribute('_region_weights')
  const lastWeight = geometry.getAttribute('_region_weight4')
  const regions: string[] = mesh.userData.regionIndexOrder ?? []
  if (!indices || !weights || !lastWeight || regions.length !== 5) return [mesh]

  const groups = new Map<string, { indices: number[]; region: string; side: string }>()
  for (let face = 0; face < indices.count; face += 3) {
    const vertices = [indices.getX(face), indices.getX(face + 1), indices.getX(face + 2)]
    let dominant = 0, highest = -Infinity
    for (let region = 0; region < regions.length; region++) {
      const weight = vertices.reduce((sum, vertex) => sum + (region === 4 ? lastWeight.getX(vertex) : weights.getComponent(vertex, region)), 0)
      if (weight > highest) { highest = weight; dominant = region }
    }
    const side = vertices.reduce((sum, vertex) => sum + positions.getX(vertex), 0) < 0 ? 'left' : 'right'
    const key = `${side}-${regions[dominant]}`
    if (!groups.has(key)) groups.set(key, { indices: [], region: regions[dominant], side })
    groups.get(key)!.indices.push(...vertices)
  }

  return [...groups.entries()].map(([name, group]) => {
    const part = mesh.clone()
    part.name = name
    part.userData = { ...mesh.userData, brainRegionId: group.region, hemisphere: group.side }
    const partition = new BufferGeometry()
    // Read-only source attributes are shared; only the triangle lists differ.
    for (const [name, attribute] of Object.entries(geometry.attributes)) partition.setAttribute(name, attribute)
    partition.setIndex(group.indices)
    part.geometry = partition
    return part
  })
}

export function explosionOffset(mesh: Mesh): Vector3 {
  if (mesh.userData.brainRegionId === 'brain-stem') return new Vector3(0, -1.45, 0.3)
  if (mesh.userData.brainRegionId === 'cerebellum') return new Vector3(0, -0.75, -1.05)
  const geometry = mesh.geometry
  const positions = geometry.getAttribute('position')
  const indices = geometry.getIndex()
  const unique = new Set<number>()
  if (indices) for (let i = 0; i < indices.count; i++) unique.add(indices.getX(i))
  const center = new Vector3()
  const point = new Vector3()
  for (const index of unique) center.add(point.fromBufferAttribute(positions, index))
  if (unique.size) center.divideScalar(unique.size)
  // The GLB is in MRI coordinates; subtract the brain center in that space.
  center.sub(new Vector3(0.44, 24.59, -9.415)).normalize()
  center.x += mesh.userData.hemisphere === 'left' ? -0.55 : 0.55
  return center.normalize().multiplyScalar(1.25)
}
