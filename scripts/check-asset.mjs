import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

function readGlb(path) {
  const file = readFileSync(path)
  assert.equal(file.readUInt32LE(0), 0x46546c67)
  assert.equal(file.readUInt32LE(4), 2)
  assert.equal(file.readUInt32LE(8), file.length)
  const jsonLength = file.readUInt32LE(12)
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString())
  return { file, json, bin: file.subarray(28 + jsonLength) }
}
const source = readGlb('docs/model-source/mri-brain.glb')
const runtime = readGlb('public/models/brain.glb')
const metadata = JSON.parse(readFileSync('docs/model-source/neuroatlas-asset.json'))
const hash = (file) => createHash('sha256').update(file).digest('hex')
assert.equal(hash(source.file), metadata.originalSha256)
assert.equal(hash(runtime.file), metadata.runtimeSha256)
assert.equal(JSON.parse(readFileSync('docs/model-source/dataset_description.json')).License, 'CC0')
assert.equal(runtime.json.nodes.length, 3)
assert.equal(runtime.json.meshes.length, 3)
assert(runtime.json.buffers.every((b) => !b.uri), 'All model buffers must be embedded')
function bytes(asset, accessorIndex) {
  const accessor = asset.json.accessors[accessorIndex]
  const view = asset.json.bufferViews[accessor.bufferView]
  return asset.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
}
let triangles = 0
for (const mesh of runtime.json.meshes) {
  const original = source.json.meshes.find((m) => m.name === mesh.name)
  assert(original)
  mesh.primitives.forEach((primitive, index) => {
    for (const attribute of ['POSITION', 'NORMAL']) {
      assert(bytes(runtime, primitive.attributes[attribute]).equals(bytes(source, original.primitives[index].attributes[attribute])), `${mesh.name}: source ${attribute} must remain unchanged`)
    }
    assert(bytes(runtime, primitive.indices).equals(bytes(source, original.primitives[index].indices)))
    const colors = bytes(runtime, primitive.attributes.COLOR_0)
    assert(new Set(colors).size > 20, 'Baked shading must vary over the surface')
    triangles += runtime.json.accessors[primitive.indices].count / 3
  })
}
assert.equal(triangles, metadata.triangles)
assert(triangles > 150000 && triangles < 300000)
assert(runtime.file.length < 8_000_000)
console.log(`Asset verified: ${triangles.toLocaleString('en')} source-derived triangles; embedded buffers; original geometry preserved; CC0 provenance; SHA-256 match.`)
