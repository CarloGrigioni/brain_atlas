// Offline only: add deterministic ambient-occlusion vertex colors. Never alters anatomy.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { BufferGeometry, Float32BufferAttribute, Ray, Vector3, DoubleSide } from 'three'
import { MeshBVH } from 'three-mesh-bvh'

const original = 'docs/model-source/mri-brain.glb'
const source = readFileSync(original)
const jsonLength = source.readUInt32LE(12)
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
const bin = source.subarray(28 + jsonLength)

function accessor(index) {
  const a = gltf.accessors[index]
  const view = gltf.bufferViews[a.bufferView]
  const dimensions = { SCALAR: 1, VEC3: 3 }[a.type]
  const bytes = { 5126: 4, 5125: 4, 5123: 2 }[a.componentType]
  const out = new Float64Array(a.count * dimensions)
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  for (let i = 0; i < a.count; i++) {
    for (let k = 0; k < dimensions; k++) {
      const at = offset + i * (view.byteStride ?? dimensions * bytes) + k * bytes
      out[i * dimensions + k] = a.componentType === 5126 ? bin.readFloatLE(at) : a.componentType === 5125 ? bin.readUInt32LE(at) : bin.readUInt16LE(at)
    }
  }
  return out
}

const selected = new Set(['unified-cortex', 'cerebellum', 'brain-stem'])
gltf.scenes[0].nodes = gltf.nodes.flatMap((node, index) => {
  if (!selected.has(node.name)) return []
  node.scale = [0.02, 0.02, 0.02]
  node.translation = [-0.0088, -0.4918, 0.1883]
  return [index]
})
const data = gltf.meshes.filter((mesh) => selected.has(mesh.name)).flatMap((mesh) => mesh.primitives.map((p) => ({ name: mesh.name, positions: accessor(p.attributes.POSITION), normals: accessor(p.attributes.NORMAL), indices: accessor(p.indices), primitive: p })))
const positions = [], indices = []
for (const mesh of data) {
  const start = positions.length / 3
  for (const v of mesh.positions) positions.push(v)
  for (const v of mesh.indices) indices.push(v + start)
}
const geometry = new BufferGeometry()
geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
geometry.setIndex(indices)
const bvh = new MeshBVH(geometry)
const ray = new Ray(), normal = new Vector3(), tangent = new Vector3(), bitangent = new Vector3(), direction = new Vector3()
const up = new Vector3(0, 1, 0), right = new Vector3(1, 0, 0)
const additions = []
let byteOffset = bin.length
const samples = 32
for (let meshIndex = 0; meshIndex < data.length; meshIndex++) {
  const mesh = data[meshIndex]
  const count = mesh.positions.length / 3
  const colors = Buffer.alloc(Math.ceil(count * 3 / 4) * 4, 255)
  for (let vertex = 0; vertex < count; vertex++) {
    const at = vertex * 3
    normal.fromArray(mesh.normals, at).normalize()
    tangent.crossVectors(Math.abs(normal.y) > 0.95 ? right : up, normal).normalize()
    bitangent.crossVectors(normal, tangent)
    ray.origin.fromArray(mesh.positions, at).addScaledVector(normal, 0.2)
    let occlusion = 0
    for (let sample = 0; sample < samples; sample++) {
      const radius = Math.sqrt((sample + 0.5) / samples)
      const phi = sample * 2.399963229728653
      direction.copy(tangent).multiplyScalar(radius * Math.cos(phi))
        .addScaledVector(bitangent, radius * Math.sin(phi))
        .addScaledVector(normal, Math.sqrt(1 - radius * radius)).normalize()
      ray.direction.copy(direction)
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, 12)
      if (hit) occlusion += 1 - hit.distance / 12
    }
    const value = Math.round(255 * Math.max(0.38, 1 - 0.85 * occlusion / samples))
    colors[at] = colors[at + 1] = colors[at + 2] = value
  }
  const viewIndex = gltf.bufferViews.length
  gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: count * 3, target: 34962 })
  mesh.primitive.attributes.COLOR_0 = gltf.accessors.length
  gltf.accessors.push({ bufferView: viewIndex, componentType: 5121, normalized: true, count, type: 'VEC3' })
  additions.push(colors)
  byteOffset += colors.length
  console.log(`Ambient shading: ${mesh.name} (${count} vertices)`)
}
// Strip unreferenced internal meshes and hit proxies from the shipped asset.
const combined = Buffer.concat([bin, ...additions])
const compactViews = [], compactAccessors = [], compactChunks = []
const viewMap = new Map(), accessorMap = new Map()
let compactOffset = 0
function compactAccessor(oldIndex) {
  if (accessorMap.has(oldIndex)) return accessorMap.get(oldIndex)
  const a = structuredClone(gltf.accessors[oldIndex])
  const oldViewIndex = a.bufferView
  if (!viewMap.has(oldViewIndex)) {
    const view = structuredClone(gltf.bufferViews[oldViewIndex])
    const bytes = combined.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)])
    view.byteOffset = compactOffset
    compactOffset += padded.length
    viewMap.set(oldViewIndex, compactViews.length)
    compactViews.push(view)
    compactChunks.push(padded)
  }
  a.bufferView = viewMap.get(oldViewIndex)
  accessorMap.set(oldIndex, compactAccessors.length)
  compactAccessors.push(a)
  return compactAccessors.length - 1
}
const selectedNodes = gltf.scenes[0].nodes.map((index) => gltf.nodes[index])
const selectedMeshes = selectedNodes.map((node, index) => {
  const mesh = gltf.meshes[node.mesh]
  node.mesh = index
  for (const p of mesh.primitives) {
    for (const attribute of Object.keys(p.attributes)) p.attributes[attribute] = compactAccessor(p.attributes[attribute])
    p.indices = compactAccessor(p.indices)
  }
  return mesh
})
gltf.nodes = selectedNodes
gltf.meshes = selectedMeshes
gltf.scenes[0].nodes = selectedNodes.map((_, index) => index)
gltf.accessors = compactAccessors
gltf.bufferViews = compactViews
gltf.buffers[0].byteLength = compactOffset
gltf.asset.extras = { ...gltf.asset.extras, neuroatlas: 'Vertex ambient occlusion only; original geometry preserved. See ATTRIBUTION.md.' }
let json = Buffer.from(JSON.stringify(gltf))
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const binary = Buffer.concat(compactChunks)
const header = Buffer.alloc(20)
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + json.length + binary.length, 8)
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
const result = Buffer.concat([header, json, binHeader, binary])
writeFileSync('public/models/brain.glb', result)
writeFileSync('docs/model-source/neuroatlas-asset.json', JSON.stringify({
  source: 'https://github.com/StarKnightt/brain-explorer/blob/master/public/models/brain-atlas.glb',
  originalSha256: createHash('sha256').update(source).digest('hex'),
  runtimeSha256: createHash('sha256').update(result).digest('hex'),
  modifications: 'Selected unified-cortex, cerebellum and brain-stem; uniform scale and translation; 32-ray vertex ambient occlusion. Surface geometry, normals and region attributes unchanged. Runtime neutral material override.',
  vertexCount: positions.length / 3,
  triangles: indices.length / 3,
}, null, 2) + '\n')
console.log('Saved shaded GLB:', result.length, 'bytes')
