import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, Check, Expand, Info, Minus, MousePointer2, Pause, Play, Plus, RotateCcw, Shrink, X } from 'lucide-react'
import { BrainScene } from './components/BrainScene'
import type { ViewCommand } from './components/BrainScene'
import { SceneBoundary } from './components/SceneBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useGLTF } from '@react-three/drei'
import { MODEL_URL, type HemisphereVisibility } from './components/BrainModel'
import { ANATOMY_COLORS } from './anatomyColors'
import type { PartId } from './anatomyColors'
import { PartSelector } from './components/PartSelector'

export default function App() {
  const reducedMotion = useReducedMotion()
  const [rotationEnabled, setRotationEnabled] = useState(true)
  const [anatomicalColors, setAnatomicalColors] = useState(false)
  const [explosion, setExplosion] = useState(0)
  const [hemisphere, setHemisphere] = useState<HemisphereVisibility>('both')
  const [selectedParts, setSelectedParts] = useState<PartId[]>(() => ANATOMY_COLORS.map((part) => part.id))
  const [interacting, setInteracting] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [command, setCommand] = useState<ViewCommand | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const infoDialog = useRef<HTMLDialogElement>(null)
  const autoRotate = rotationEnabled && !reducedMotion && !interacting && ready && !error && selectedParts.length > 0

  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => setError(true), [])
  const sendCommand = (type: ViewCommand['type']) => setCommand((previous) => ({ type, id: (previous?.id ?? 0) + 1 }))
  const onInteraction = useCallback((active: boolean) => {
    if (timer.current) clearTimeout(timer.current)
    setInteracting(true)
    if (!active) timer.current = setTimeout(() => setInteracting(false), 1800)
  }, [])

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    setFullscreenAvailable(document.fullscreenEnabled)
    document.addEventListener('fullscreenchange', update)
    return () => { document.removeEventListener('fullscreenchange', update); if (timer.current) clearTimeout(timer.current) }
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setFullscreenError('Fullscreen is unavailable in this browser.')
    }
  }

  return <main className="app-shell relative isolate overflow-hidden bg-[#090f17] text-[#e8ecec]">
    <div className="ambient-glow" aria-hidden="true" />
    <header className="masthead flex items-start justify-between">
      <div className="brand flex items-center gap-3.5">
        <div className="brand-icon"><Brain size={25} strokeWidth={1.3} /></div>
        <div><h1>NEUROATLAS<span className="brand-dot">.</span></h1><p>Explore the human brain</p></div>
      </div>
      <div className="edition"><span className="status-dot" /> INTERACTIVE ANATOMY <span className="edition-number">01 / HUMAN BRAIN</span></div>
    </header>

    <aside className="anatomy-panel" aria-label="Controlli anatomici">
      <label className="anatomy-toggle">
        <input type="checkbox" checked={anatomicalColors} disabled={!ready || error}
          onChange={(event) => setAnatomicalColors(event.target.checked)} aria-controls="anatomy-legend" />
        <span>Colori anatomici</span>
      </label>
      <label className="anatomy-toggle">
        <input type="checkbox" checked={explosion > 0} disabled={!ready || error}
          onChange={(event) => { setExplosion(event.target.checked ? 1 : 0); onInteraction(false) }} aria-controls="explosion-controls" />
        <span>Esplodi parti</span>
      </label>
      <PartSelector selected={selectedParts} disabled={!ready || error}
        onChange={(parts) => { setSelectedParts(parts); onInteraction(false) }} />
      <fieldset className="hemisphere-control" disabled={!ready || error || !selectedParts.some((part) => part !== 'cerebellum' && part !== 'brain-stem')} title="Il filtro emisferi si applica alla corteccia cerebrale.">
        <legend>Emisferi cerebrali</legend>
        <div className="hemisphere-options">
          {([{ value: 'both', label: 'Entrambi' }, { value: 'left', label: 'Solo sinistro' }, { value: 'right', label: 'Solo destro' }] as const).map((option) =>
            <label key={option.value}>
              <input type="radio" name="hemisphere" value={option.value} checked={hemisphere === option.value}
                onChange={() => { setHemisphere(option.value); onInteraction(false) }} />
              <span>{option.label}</span>
            </label>,
          )}
        </div>
      </fieldset>
      {explosion > 0 && <div className="explosion-controls" id="explosion-controls">
        <div className="explosion-label"><label htmlFor="separation">Separazione</label><output htmlFor="separation">{Math.round(explosion * 100)}%</output></div>
        <input id="separation" type="range" min="0" max="100" step="1" value={Math.round(explosion * 100)}
          onChange={(event) => { setExplosion(Number(event.target.value) / 100); onInteraction(false) }} />
        <div className="explosion-caption"><span>Separazione illustrativa</span><button onClick={() => setExplosion(0)}>Ricomponi</button></div>
      </div>}
      {anatomicalColors && <ul id="anatomy-legend" className="anatomy-legend" aria-label="Legenda delle regioni">
        {ANATOMY_COLORS.map((region) => <li key={region.id}><span style={{ backgroundColor: region.color }} aria-hidden="true" />{region.label}</li>)}
      </ul>}
    </aside>

    <section
      className="viewport"
      aria-label="Interactive 3D human brain. Drag to rotate, scroll or pinch to zoom. Press plus or minus to zoom, R to reset."
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (['+', '=', '-', 'r', 'R'].includes(event.key)) {
          event.preventDefault()
          onInteraction(false)
          sendCommand(event.key === '-' ? 'out' : event.key.toLowerCase() === 'r' ? 'reset' : 'in')
        }
      }}
    >
      <SceneBoundary key={attempt} onError={onError}>
        <BrainScene autoRotate={autoRotate} reducedMotion={reducedMotion} anatomicalColors={anatomicalColors} explosion={explosion} hemisphere={hemisphere} selectedParts={selectedParts} command={command}
          onReady={onReady} onInteraction={onInteraction} onContextLost={onError} />
      </SceneBoundary>
      {!ready && !error && <LoadingScreen />}
      {ready && !error && selectedParts.length === 0 && <div className="empty-selection">
        <p role="status">Nessuna parte selezionata</p>
        <button onClick={() => setSelectedParts(ANATOMY_COLORS.map((part) => part.id))}>Mostra tutte le parti</button>
      </div>}
      {error && <div className="loading-screen error-screen" role="alert">
        <Brain size={36} strokeWidth={1} /><h2>The view couldn’t be loaded</h2>
        <p>Check that WebGL is enabled, then try again.</p>
        <button className="retry-button" onClick={() => { useGLTF.clear(MODEL_URL); setError(false); setReady(false); setAttempt((n) => n + 1) }}>Reload model <RotateCcw size={14} /></button>
      </div>}
    </section>

    <footer className="viewer-footer">
      <div className="specimen"><span className="micro-label">THE HUMAN BRAIN</span></div>
      <div className="control-area">
        <div className="toolbar" role="toolbar" aria-label="3D view controls">
          <button className={`rotation-button ${rotationEnabled && !reducedMotion ? 'is-active' : ''}`} aria-pressed={rotationEnabled && !reducedMotion}
            disabled={!ready || error || reducedMotion} title={reducedMotion ? 'Automatic motion disabled by your system preference' : 'Toggle automatic rotation'}
            onClick={() => setRotationEnabled((value) => !value)}>
            {rotationEnabled && !reducedMotion ? <Pause size={15} /> : <Play size={15} />}<span>Auto-rotate</span>
            <span className={`toggle-dot ${autoRotate ? 'on' : ''}`} />
          </button>
          <span className="toolbar-divider" />
          <button aria-label="Zoom out" title="Zoom out (−)" disabled={!ready || error} onClick={() => { onInteraction(false); sendCommand('out') }}><Minus size={18} /></button>
          <button aria-label="Zoom in" title="Zoom in (+)" disabled={!ready || error} onClick={() => { onInteraction(false); sendCommand('in') }}><Plus size={18} /></button>
          <span className="toolbar-divider" />
          <button aria-label="Reset view" title="Reset view (R)" disabled={!ready || error} onClick={() => { onInteraction(false); sendCommand('reset') }}><RotateCcw size={17} /></button>
          {fullscreenAvailable && <><span className="toolbar-divider" /><button aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen" onClick={toggleFullscreen}>{fullscreen ? <Shrink size={17} /> : <Expand size={17} />}</button></>}
        </div>
        <p className="interaction-hint"><MousePointer2 size={11} /><span className="desktop-hint">Drag to rotate<span className="hint-dot">·</span>Scroll to zoom</span><span className="mobile-hint">Drag to rotate<span className="hint-dot">·</span>Pinch to zoom</span></p>
        {fullscreenError && <p className="fullscreen-error" role="status">{fullscreenError}</p>}
      </div>
      <button className="source-button" onClick={() => infoDialog.current?.showModal()} aria-label="Model source and credits"><Info size={15} /><span>Model & credits</span></button>
    </footer>
    <div className="bottom-rule" aria-hidden="true"><span>NEUROATLAS / EXPLORER</span><span><span className="status-dot" /> {error ? 'VIEW UNAVAILABLE' : ready ? 'ANATOMICAL REFERENCE' : 'INITIALIZING'}</span></div>

    <dialog ref={infoDialog} className="credits-dialog" onClick={(event) => { if (event.target === event.currentTarget) infoDialog.current?.close() }}>
      <button className="dialog-close" onClick={() => infoDialog.current?.close()} aria-label="Close credits"><X size={20} /></button>
      <span className="micro-label">BEHIND THE MODEL</span><h2>Anatomy with a source.</h2>
      <p>Derived from an MRI of OpenNeuro dataset <a href="https://doi.org/10.18112/openneuro.ds006128.v1.0.11" target="_blank" rel="noreferrer">ds006128, subject sub-01</a>, by Susanne Stoll and colleagues. Source data: <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0 Universal</a>.</p>
      <p>Surface extraction and GLB conversion by <a href="https://github.com/StarKnightt/brain-explorer" target="_blank" rel="noreferrer">StarKnightt / brain-explorer</a>. NeuroAtlas adds a neutral material, ambient shading and studio lighting, preserving the surface geometry and region metadata.</p>
      <p>The cortex retains MRI-derived folds. Cerebellum and brain stem are coarser segmentation envelopes; fine cerebellar folds are not resolved. An individual reference, not a diagnostic tool.</p>
      <p>The exploded view separates existing surface triangles by their dominant source region and hemisphere. Boundaries are approximate; surfaces remain open, with no invented interior tissue or cut faces.</p>
      <a className="credit-link" href="models/ATTRIBUTION.md" target="_blank" rel="noreferrer"><Check size={14} /> Full attribution & provenance</a>
    </dialog>
  </main>
}
