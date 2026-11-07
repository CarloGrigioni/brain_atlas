# NeuroAtlas — anatomical asset attribution

## Source data

OpenNeuro **ds006128**, snapshot **1.0.11**, subject **sub-01**.
“Data for Modeling 2D Spatio-Tactile Population Receptive Fields of the Fingertip in Human Primary Somatosensory Cortex.”

Authors: Susanne Stoll, Falk Luesebrink, D. Samuel Schwarzkopf, Hendrik Mattern, Peng Liu, Johanna Noelle, Esther Kuehn.

- Dataset: https://doi.org/10.18112/openneuro.ds006128.v1.0.11
- Source repository: https://github.com/OpenNeuroDatasets/ds006128/tree/1.0.11
- License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/
- Local license text: [CC0-1.0.txt](CC0-1.0.txt)
- The dataset's `dataset_description.json`, including its CC0 declaration, is preserved in `docs/model-source/`.

## GLB derivative

Retrieved 2026-11-06 from **StarKnightt / brain-explorer**:
https://github.com/StarKnightt/brain-explorer/blob/master/public/models/brain-atlas.glb

The upstream asset notice identifies the CC0 source data and transformations:
https://github.com/StarKnightt/brain-explorer/blob/master/THIRD_PARTY_NOTICES.md

Upstream work: extraction of bilateral FreeSurfer pial surfaces, conservative topology-preserving decimation, region grouping, shared smooth normals, and segmentation-derived envelopes for cerebellum and brain stem. Source URLs, data checksums and region mappings are preserved in [manifest.json](manifest.json). Original downloaded GLB and upstream notice are preserved in `docs/model-source/`.

NeuroAtlas changes: retain unified cortical surface, cerebellum and brain stem; omit internal structures and invisible picking proxies; translate and uniformly scale for presentation; add 32-ray ambient-occlusion vertex colors. **No anatomical surface vertices or normals are modified.** Materials and lighting are illustrative. Region attributes remain in the GLB for future extensions. The preparation script is `scripts/bake-ao.mjs`; runtime and source hashes are recorded in `docs/model-source/neuroatlas-asset.json`.

## Scientific limitations

The cortex shows MRI-derived folds of one individual, not a universal brain. The mesh is reduced; fine detail is limited by MRI resolution, segmentation and decimation. Cerebellum and brain stem are coarser segmentation envelopes: **cerebellar folia and brainstem nuclei are not resolved**. No synthetic folds are added. Internal regions, labels and circuits are not presented in this MVP. Educational visualization, not a diagnostic application.

The data license applies to the anatomical asset. No upstream application code is included. Crediting these authors does not imply their endorsement.
