import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { splitCortex, explosionOffset } from '../src/explodeBrain.ts'

const bytes = readFileSync('public/models/brain.glb')
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const cortex = scene.getObjectByName('unified-cortex')
const parts = splitCortex(cortex)
assert.equal(parts.length, 10, 'Five source regions in each hemisphere')
const faces = (geometry) => {
  const index = geometry.getIndex()
  return Array.from({ length: index.count / 3 }, (_, face) => `${index.getX(face * 3)},${index.getX(face * 3 + 1)},${index.getX(face * 3 + 2)}`).sort()
}
assert.deepEqual(parts.flatMap((part) => faces(part.geometry)).sort(), faces(cortex.geometry), 'Every original triangle must appear exactly once with its original winding')
for (const part of parts) {
  assert.equal(part.geometry.getAttribute('position'), cortex.geometry.getAttribute('position'), 'Source vertices remain unchanged')
  assert.equal(part.geometry.getAttribute('normal'), cortex.geometry.getAttribute('normal'), 'Source normals remain unchanged')
  assert(part.userData.brainRegionId && part.userData.hemisphere)
  const offset = explosionOffset(part)
  assert(Number.isFinite(offset.length()) && offset.length() > 0)
  assert(part.userData.hemisphere === 'left' ? offset.x < 0 : offset.x > 0, 'Hemispheres separate in opposite directions')
}
console.log(`Exploded view verified: ${parts.length} cortical parts, ${cortex.geometry.index.count / 3} original triangles preserved exactly once; no new vertices or caps.`)
