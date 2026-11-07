import { Color, Float32BufferAttribute } from 'three'
import type { BufferGeometry } from 'three'

// IDs and weight order come from the GLB's region metadata, not spatial guesses.
export const ANATOMY_COLORS = [
  { id: 'prefrontal-cortex', label: 'Corteccia prefrontale', color: '#dc929f' },
  { id: 'frontal-lobe', label: 'Lobo frontale', color: '#e3ad70' },
  { id: 'parietal-lobe', label: 'Lobo parietale', color: '#83bba1' },
  { id: 'temporal-lobe', label: 'Lobo temporale', color: '#82abd4' },
  { id: 'occipital-lobe', label: 'Lobo occipitale', color: '#b49ad2' },
  { id: 'cerebellum', label: 'Cervelletto', color: '#d38c75' },
  { id: 'brain-stem', label: 'Tronco encefalico', color: '#ccb879' },
] as const
export type PartId = (typeof ANATOMY_COLORS)[number]['id']

const palette = new Map<string, Color>(ANATOMY_COLORS.map((region) => [region.id, new Color(region.color)]))

export function makeRegionColors(geometry: BufferGeometry, regionOrder: string[], regionId?: string) {
  const positions = geometry.getAttribute('position')
  const ao = geometry.getAttribute('color')
  const weights = geometry.getAttribute('_region_weights')
  const lastWeight = geometry.getAttribute('_region_weight4')
  const colors = new Float32Array(positions.count * 3)
  const uniform = palette.get(regionId ?? '') ?? new Color('#e3c9bd')
  const regionPalette = regionOrder.map((id) => palette.get(id) ?? uniform)

  for (let vertex = 0; vertex < positions.count; vertex++) {
    let r = 0, g = 0, b = 0, total = 0
    if (weights && lastWeight && regionPalette.length === 5) {
      for (let region = 0; region < 5; region++) {
        const weight = region === 4 ? lastWeight.getX(vertex) : weights.getComponent(vertex, region)
        const color = regionPalette[region]
        r += color.r * weight; g += color.g * weight; b += color.b * weight
        total += weight
      }
    }
    const offset = vertex * 3
    colors[offset] = (total > 0 ? r / total : uniform.r) * (ao?.getX(vertex) ?? 1)
    colors[offset + 1] = (total > 0 ? g / total : uniform.g) * (ao?.getY(vertex) ?? 1)
    colors[offset + 2] = (total > 0 ? b / total : uniform.b) * (ao?.getZ(vertex) ?? 1)
  }
  return new Float32BufferAttribute(colors, 3)
}
