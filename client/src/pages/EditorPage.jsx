// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ChevronLeft, ChevronDown, Play, Download, Github, Settings, Check, X, Search, Share2, Video, Music, Table2, Layers, Clock, CloudUpload, History, FileDown, Group, Ungroup, Monitor, FileText } from 'lucide-react'
import { api } from '../utils/api'
import { generateLatexIframeHtml } from '../utils/latexRenderer'
import { downloadHTML, downloadSlideHTML, presentInWindow, presenterInWindow, livePresentInWindow, previewSlideInWindow, exportPDF, generateRevealHTML } from '../utils/generateHTML'
import { exportToPptx } from '../utils/exportPptx'
import { simplifyPoints } from '../utils/drawingUtils'
import { generateOfflineHTML } from '../utils/offlineExport'
import Toolbar from '../components/Toolbar'
import SlidePanel from '../components/SlidePanel'
import SlideCanvas from '../components/SlideCanvas'
import PropertiesPanel from '../components/PropertiesPanel'
import FindReplaceBar from '../components/FindReplaceBar'
import TransitionPreview from '../components/TransitionPreview'
import AnimationTimeline from '../components/AnimationTimeline'
import KineticTextModal from '../components/KineticTextModal'
import MathGridModal from '../components/MathGridModal'
import AnimeModal from '../components/AnimeModal'
import ThreeModal from '../components/ThreeModal'
import BibliographyModal from '../components/BibliographyModal'
import DiagramModal from '../components/DiagramModal'
import EquationPalette from '../components/EquationPalette'
import { formatCitation, getReferencedEntries, parseAuthors, formatAuthorsFull } from '../utils/bibtexParser'
import { MathNode } from '../extensions/MathExtension'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
import { FontWeight } from '../extensions/FontWeight'
import { LineHeight } from '../extensions/LineHeight'
import monokaiCSS from '../../../node_modules/highlight.js/styles/monokai.min.css?raw'
import githubDarkCSS from '../../../node_modules/highlight.js/styles/github-dark.min.css?raw'
import atomOneDarkCSS from '../../../node_modules/highlight.js/styles/atom-one-dark.min.css?raw'
import tokyoNightCSS from '../../../node_modules/highlight.js/styles/tokyo-night-dark.min.css?raw'
import vs2015CSS from '../../../node_modules/highlight.js/styles/vs2015.min.css?raw'
import nightOwlCSS from '../../../node_modules/highlight.js/styles/night-owl.min.css?raw'
import anOldHopeCSS from '../../../node_modules/highlight.js/styles/an-old-hope.min.css?raw'
import atomOneLightCSS from '../../../node_modules/highlight.js/styles/atom-one-light.min.css?raw'
import githubCSS from '../../../node_modules/highlight.js/styles/github.min.css?raw'
import vsCSS from '../../../node_modules/highlight.js/styles/vs.min.css?raw'
import { loadPlugins, getInsertablePluginTypes, createPluginElement } from '../plugins/PluginLoader'

const CODE_THEME_CSS = {
  'monokai': monokaiCSS,
  'github-dark': githubDarkCSS,
  'atom-one-dark': atomOneDarkCSS,
  'tokyo-night-dark': tokyoNightCSS,
  'vs2015': vs2015CSS,
  'night-owl': nightOwlCSS,
  'an-old-hope': anOldHopeCSS,
  'atom-one-light': atomOneLightCSS,
  'github': githubCSS,
  'vs': vsCSS,
}

const THEMES = ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula']
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom', 'differential-rotation']

const SLIDE_TEMPLATES = {
  blank: { label: 'Blank', elements: [] },
  title: { label: 'Title Slide', elements: [
    { type: 'text', x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: '<h1 style="text-align:center">Presentation Title</h1>' },
    { type: 'text', x: 160, y: 300, width: 640, height: 80, zIndex: 2, content: '<p style="text-align:center">Subtitle or author name</p>' },
  ]},
  'two-column': { label: 'Two Column', elements: [
    { type: 'text', x: 40, y: 40, width: 880, height: 80, zIndex: 1, content: '<h2>Title</h2>' },
    { type: 'text', x: 40, y: 140, width: 420, height: 340, zIndex: 2, content: '<p>Left column content</p>' },
    { type: 'text', x: 500, y: 140, width: 420, height: 340, zIndex: 3, content: '<p>Right column content</p>' },
  ]},
  'image-text': { label: 'Image + Text', elements: [
    { type: 'text', x: 40, y: 40, width: 880, height: 80, zIndex: 1, content: '<h2>Title</h2>' },
    { type: 'shape', shape: 'rect', x: 40, y: 140, width: 420, height: 340, zIndex: 2, fill: '#2d2d4e', stroke: 'none', strokeWidth: 0, text: '[ Image ]', fontSize: 18, textColor: '#888888' },
    { type: 'text', x: 500, y: 140, width: 420, height: 340, zIndex: 3, content: '<p>Add your text here</p>' },
  ]},
  'section-header': { label: 'Section Header', elements: [
    { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height: 540, zIndex: 0, fill: '#1a1a4e', stroke: 'none', strokeWidth: 0, opacity: 1, locked: true },
    { type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Section Title</h1>' },
    { type: 'shape', shape: 'rect', x: 280, y: 310, width: 400, height: 4, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
    { type: 'text', x: 200, y: 330, width: 560, height: 60, zIndex: 3, content: '<p style="text-align:center; color: rgba(255,255,255,0.6)">Section description</p>' },
  ]},
  'three-column': { label: 'Three Column', elements: [
    { type: 'text', x: 40, y: 40, width: 880, height: 80, zIndex: 1, content: '<h2>Title</h2>' },
    { type: 'text', x: 20, y: 140, width: 290, height: 340, zIndex: 2, content: '<p>Column 1</p>' },
    { type: 'text', x: 335, y: 140, width: 290, height: 340, zIndex: 3, content: '<p>Column 2</p>' },
    { type: 'text', x: 650, y: 140, width: 290, height: 340, zIndex: 4, content: '<p>Column 3</p>' },
  ]},
  'comparison': { label: 'Comparison', elements: [
    { type: 'text', x: 40, y: 30, width: 880, height: 70, zIndex: 1, content: '<h2 style="text-align:center">Comparison</h2>' },
    { type: 'shape', shape: 'rounded-rect', x: 30, y: 110, width: 440, height: 400, zIndex: 2, fill: 'rgba(99,102,241,0.1)', stroke: '#6366f1', strokeWidth: 1, locked: true },
    { type: 'text', x: 50, y: 120, width: 400, height: 50, zIndex: 3, content: '<h3 style="text-align:center; color: #6366f1">Option A</h3>' },
    { type: 'text', x: 50, y: 170, width: 400, height: 320, zIndex: 4, content: '<p>Details here...</p>' },
    { type: 'shape', shape: 'rounded-rect', x: 490, y: 110, width: 440, height: 400, zIndex: 5, fill: 'rgba(236,72,153,0.1)', stroke: '#ec4899', strokeWidth: 1, locked: true },
    { type: 'text', x: 510, y: 120, width: 400, height: 50, zIndex: 6, content: '<h3 style="text-align:center; color: #ec4899">Option B</h3>' },
    { type: 'text', x: 510, y: 170, width: 400, height: 320, zIndex: 7, content: '<p>Details here...</p>' },
  ]},
  'big-number': { label: 'Big Number', elements: [
    { type: 'text', x: 80, y: 80, width: 800, height: 200, zIndex: 1, content: '<h1 style="text-align:center; font-size: 120px; color: #6366f1">42%</h1>' },
    { type: 'text', x: 160, y: 300, width: 640, height: 120, zIndex: 2, content: '<p style="text-align:center">Key statistic or metric description</p>' },
  ]},

  // ── Typographic System Presets (Elam / Bauhaus) ──────────────────────

  'system-axial': {
    label: 'Axial',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 2, rows: 0, gutter: 0, marginX: 40, marginY: 40, snap: true },
    axisLines: [{ id: 'ax1', axis: 'x', position: 320, visible: true, snap: true }],
    elements: [
      { type: 'text', x: 40, y: 50, width: 260, height: 80, zIndex: 1, content: '<h2 style="text-align:right">Title</h2>' },
      { type: 'text', x: 40, y: 140, width: 260, height: 60, zIndex: 2, content: '<p style="text-align:right; color: rgba(255,255,255,0.6)">Subtitle text</p>' },
      { type: 'text', x: 340, y: 50, width: 580, height: 440, zIndex: 3, content: '<p>Main content arranged to the right of the axis. The asymmetric division creates visual tension.</p>' },
      { type: 'shape', shape: 'rect', x: 318, y: 40, width: 3, height: 460, zIndex: 0, fill: 'rgba(244,114,182,0.4)', stroke: 'none', strokeWidth: 0, locked: true },
    ]
  },

  'system-bilateral': {
    label: 'Bilateral',
    category: 'systems',
    axisLines: [{ id: 'ax1', axis: 'x', position: 480, visible: true, snap: true }],
    elements: [
      { type: 'text', x: 130, y: 60, width: 700, height: 80, zIndex: 1, content: '<h2 style="text-align:center">Title</h2>' },
      { type: 'shape', shape: 'rect', x: 380, y: 150, width: 200, height: 3, zIndex: 0, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
      { type: 'text', x: 130, y: 170, width: 700, height: 60, zIndex: 2, content: '<p style="text-align:center; color: rgba(255,255,255,0.6)">Symmetry centered on a single axis</p>' },
      { type: 'text', x: 130, y: 260, width: 700, height: 220, zIndex: 3, content: '<p style="text-align:center">Content arranged symmetrically. Place the axis off-center for asymmetric bilateral compositions.</p>' },
    ]
  },

  'system-grid': {
    label: 'Grid System',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 3, rows: 2, gutter: 16, marginX: 40, marginY: 40, snap: true },
    elements: [
      { type: 'text', x: 40, y: 40, width: 880, height: 60, zIndex: 1, content: '<h2>Title</h2>' },
      { type: 'shape', shape: 'rect', x: 40, y: 105, width: 880, height: 2, zIndex: 0, fill: 'rgba(99,102,241,0.3)', stroke: 'none', strokeWidth: 0, locked: true },
      { type: 'text', x: 40, y: 116, width: 277, height: 190, zIndex: 2, content: '<p>Cell 1</p>' },
      { type: 'text', x: 333, y: 116, width: 277, height: 190, zIndex: 3, content: '<p>Cell 2</p>' },
      { type: 'text', x: 626, y: 116, width: 277, height: 190, zIndex: 4, content: '<p>Cell 3</p>' },
      { type: 'text', x: 40, y: 322, width: 277, height: 178, zIndex: 5, content: '<p>Cell 4</p>' },
      { type: 'text', x: 333, y: 322, width: 277, height: 178, zIndex: 6, content: '<p>Cell 5</p>' },
      { type: 'text', x: 626, y: 322, width: 277, height: 178, zIndex: 7, content: '<p>Cell 6</p>' },
    ]
  },

  'system-modular': {
    label: 'Modular',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 4, rows: 3, gutter: 8, marginX: 32, marginY: 32, snap: true },
    elements: [
      { type: 'shape', shape: 'rect', x: 32, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1, text: 'Module', fontSize: 12, textColor: 'rgba(255,255,255,0.4)' },
      { type: 'shape', shape: 'rect', x: 254, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'rect', x: 476, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'rect', x: 698, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'text', x: 32, y: 198, width: 436, height: 304, zIndex: 1, content: '<h2>Title</h2><p>Content spans multiple modules</p>' },
      { type: 'shape', shape: 'circle', x: 828, y: 420, width: 80, height: 80, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, opacity: 0.7 },
    ]
  },

  'system-transitional': {
    label: 'Transitional',
    category: 'systems',
    elements: [
      { type: 'text', x: 60, y: 40, width: 500, height: 80, zIndex: 3, content: '<h2>Title</h2>' },
      { type: 'text', x: 120, y: 130, width: 380, height: 50, zIndex: 2, content: '<p style="color: rgba(255,255,255,0.6)">Subtitle floats freely</p>' },
      { type: 'shape', shape: 'rect', x: 0, y: 200, width: 700, height: 3, zIndex: 0, fill: 'rgba(255,255,255,0.15)', stroke: 'none', strokeWidth: 0, locked: true },
      { type: 'text', x: 80, y: 220, width: 500, height: 200, zIndex: 1, content: '<p>Elements relate through massing and texture rather than alignment. The transitional system is the most informal — no axis required.</p>' },
      { type: 'text', x: 520, y: 400, width: 400, height: 120, zIndex: 2, content: '<p style="text-align:right; color: rgba(255,255,255,0.4); font-size: 14px">Details drift toward the lower right, creating natural movement.</p>' },
    ]
  },

  'system-radial': {
    label: 'Radial',
    category: 'systems',
    elements: [
      { type: 'shape', shape: 'circle', x: 380, y: 170, width: 200, height: 200, zIndex: 0, fill: 'rgba(99,102,241,0.12)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'circle', x: 330, y: 120, width: 300, height: 300, zIndex: 0, fill: 'none', stroke: 'rgba(99,102,241,0.15)', strokeWidth: 1 },
      { type: 'shape', shape: 'circle', x: 444, y: 234, width: 72, height: 72, zIndex: 1, fill: '#6366f1', stroke: 'none', strokeWidth: 0 },
      { type: 'text', x: 440, y: 245, width: 80, height: 50, zIndex: 2, content: '<p style="text-align:center; font-size:11px; color:white">Focus</p>' },
      { type: 'text', x: 540, y: 100, width: 380, height: 60, zIndex: 3, content: '<h3>Point 1</h3>' },
      { type: 'text', x: 570, y: 310, width: 350, height: 60, zIndex: 3, content: '<h3>Point 2</h3>' },
      { type: 'text', x: 40, y: 180, width: 300, height: 60, zIndex: 3, content: '<h3 style="text-align:right">Point 3</h3>' },
      { type: 'text', x: 40, y: 420, width: 300, height: 60, zIndex: 3, content: '<h3 style="text-align:right">Point 4</h3>' },
    ]
  },
}

const migrateSlide = (slide) => {
  if (!slide.elements) {
    return {
      ...slide,
      elements: slide.html ? [{
        id: crypto.randomUUID(), type: 'text',
        x: 80, y: 100, width: 800, height: 340, zIndex: 1,
        content: slide.html
      }] : []
    }
  }
  return slide
}

export default function EditorPage({ presentationId, isTemplate = false, onGoHome }) {
  const [presentation, setPresentation] = useState(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [loading, setLoading] = useState(true)
  const [selectedElementIds, setSelectedElementIds] = useState([])
  const [editingElementId, setEditingElementId] = useState(null)

  // Derived from selectedElementIds — must be declared before any useEffect that references it
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null
  const [showGrid, setShowGrid] = useState(false)
  const [gridSize, setGridSize] = useState(40) // synced to presentation.gridSize when changed
  const [clipboard, setClipboard] = useState(null)
  const [htmlEditorState, setHtmlEditorState] = useState(null) // { elementId, content }
  const [p5EditorState, setP5EditorState] = useState(null) // { elementId, content }
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [latexEditorState, setLatexEditorState] = useState(null) // { elementId, content }
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '', hasToken: false })
  const [githubToken, setGithubToken] = useState('')
  const [githubPushing, setGithubPushing] = useState(false)
  const [githubStatus, setGithubStatus] = useState(null) // { type: 'success'|'error', message }
  const [githubCommitMsg, setGithubCommitMsg] = useState('')

  const [showZenodoModal, setShowZenodoModal] = useState(false)
  const [zenodoConfig, setZenodoConfig] = useState({ hasToken: false, sandbox: false })
  const [zenodoToken, setZenodoToken] = useState('')
  const [zenodoPublishing, setZenodoPublishing] = useState(false)
  const [zenodoStatus, setZenodoStatus] = useState(null)
  const [zenodoMeta, setZenodoMeta] = useState({
    creators: [{ name: '', affiliation: '', orcid: '' }],
    description: '',
    keywords: '',
    license: 'cc-by-4.0',
  })
  const [zenodoPubStatus, setZenodoPubStatus] = useState(null)

  // New feature state
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showTransitionPreview, setShowTransitionPreview] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareStatus, setShareStatus] = useState({ shared: false, token: null })
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState(true)
  const [showMasterPanel, setShowMasterPanel] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showSyncDropdown, setShowSyncDropdown] = useState(false)
  const [showDefaultSettings, setShowDefaultSettings] = useState(false)
  const [showPresentDropdown, setShowPresentDropdown] = useState(false)
  const [showKineticModal, setShowKineticModal] = useState(false)
  const [showMathGridModal, setShowMathGridModal] = useState(false)
  const [showAnimeModal, setShowAnimeModal] = useState(false)
  const [showThreeModal, setShowThreeModal] = useState(false)
  const [showBibliographyModal, setShowBibliographyModal] = useState(false)
  const [showDiagramModal, setShowDiagramModal] = useState(false)
  const [liveSession, setLiveSession] = useState(null) // { sessionId, url }
  const [liveViewers, setLiveViewers] = useState(0)
  const [syncStatus, setSyncStatus] = useState(null) // { installed, remotes, hasConfig }
  const [syncConfig, setSyncConfig] = useState({ username: '', password: '', remoteName: 'protondrive' })
  const [syncResult, setSyncResult] = useState(null) // { type, message }
  const [syncing, setSyncing] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')
  const [showGitHistory, setShowGitHistory] = useState(false)
  const [gitCommits, setGitCommits] = useState([])
  const [gitLoading, setGitLoading] = useState(false)
  const [gitRestoring, setGitRestoring] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [showRulers, setShowRulers] = useState(false)
  const [guides, setGuides] = useState([]) // persistent guide lines: [{ axis: 'x'|'y', position: number }]
  const [drawTool, setDrawTool] = useState(null) // null = off, { color, strokeWidth, opacity, smooth } = drawing mode
  const [manimEditorState, setManimEditorState] = useState(null) // { elementId, content, sceneName, quality, rendered, rendering, error }
  const [pendingAddColumn, setPendingAddColumn] = useState(null) // colNum to add slide to when template modal confirms
  const [activeMathNode, setActiveMathNode] = useState(null) // { latex, display, fontSize, color } when inline math node is clicked
  const mathNodeUpdateRef = useRef(null) // holds the TipTap updateAttributes fn for the active math node

  // Track if we're programmatically setting editor content (to avoid loops)
  const settingContent = useRef(false)
  const saveTimerRef = useRef(null)
  const isFirstLoad = useRef(true)
  const historyRef = useRef([]) // undo history: array of presentation snapshots
  const applyingUndoRef = useRef(false)
  const editingElementIdRef = useRef(null)
  const currentSlideIndexRef = useRef(0)
  const selectedElementIdsRef = useRef([])
  const redoStackRef = useRef([])

  // Keep refs in sync with state
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId])

  // Clear active math node when the text element stops being edited
  useEffect(() => {
    if (!editingElementId) {
      setActiveMathNode(null)
      mathNodeUpdateRef.current = null
    }
  }, [editingElementId])

  // Listen for clicks on inline math nodes (fired by MathExtension node view)
  useEffect(() => {
    const handler = (e) => {
      setActiveMathNode({
        latex:    e.detail.latex,
        display:  e.detail.display,
        fontSize: e.detail.fontSize,
        color:    e.detail.color,
      })
      mathNodeUpdateRef.current = e.detail.update
    }
    document.addEventListener('math-node-edit', handler)
    return () => document.removeEventListener('math-node-edit', handler)
  }, [])

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])

  // Load presentation (or template) on mount
  useEffect(() => {
    if (!presentationId) return
    const loadFn = isTemplate ? api.getTemplate : api.getPresentation
    loadFn(presentationId).then(data => {
      // Migrate old slide format to new elements-based format
      const migrated = {
        ...data,
        slides: (data.slides || []).map(migrateSlide)
      }
      setPresentation(migrated)
      if (migrated.gridSize) setGridSize(migrated.gridSize)
      if (migrated.guides && migrated.guides.length) setGuides(migrated.guides)
      setLoading(false)
      isFirstLoad.current = true
    }).catch(err => {
      console.error('Failed to load presentation', err)
      setLoading(false)
    })
  }, [presentationId])

  // Load plugins on mount
  const [pluginsLoaded, setPluginsLoaded] = useState(false)
  useEffect(() => {
    loadPlugins({
      getPresentation: () => presentation,
      updateElement: (id, patch) => {
        setPresentation(prev => {
          if (!prev) return prev
          return { ...prev, slides: prev.slides.map(s => ({ ...s, elements: (s.elements || []).map(el => el.id === id ? { ...el, ...patch } : el) })) }
        })
      },
    }).then(() => setPluginsLoaded(true)).catch(() => setPluginsLoaded(true))
  }, [])

  // Load GitHub + Zenodo config on mount
  useEffect(() => {
    api.getGithubConfig().then(setGithubConfig).catch(() => {})
    api.getZenodoConfig().then(setZenodoConfig).catch(() => {})
  }, [])

  // Load share status
  useEffect(() => {
    if (presentationId) {
      api.getShareStatus(presentationId).then(setShareStatus).catch(() => {})
    }
  }, [presentationId])

  const handleGithubSaveConfig = async () => {
    const data = { owner: githubConfig.owner, repo: githubConfig.repo, pagesUrl: githubConfig.pagesUrl || '' }
    if (githubToken) data.token = githubToken
    const result = await api.saveGithubConfig(data)
    setGithubConfig(result)
    setGithubToken('')
  }

  const handleGithubPush = async () => {
    setGithubPushing(true)
    setGithubStatus(null)
    try {
      const result = await api.pushToGithub(presentationId, githubCommitMsg.trim() || undefined)
      setGithubStatus({ type: 'success', message: 'Pushed to GitHub', url: result.url })
      setGithubCommitMsg('')
    } catch (err) {
      setGithubStatus({ type: 'error', message: err.message })
    } finally {
      setGithubPushing(false)
    }
  }

  const handleZenodoSaveConfig = async () => {
    const data = { sandbox: zenodoConfig.sandbox }
    if (zenodoToken) data.token = zenodoToken
    const result = await api.saveZenodoConfig(data)
    setZenodoConfig(result)
    setZenodoToken('')
  }

  const handleZenodoPublish = async () => {
    setZenodoPublishing(true)
    setZenodoStatus(null)
    try {
      const meta = {
        creators: zenodoMeta.creators.filter(c => c.name.trim()),
        description: zenodoMeta.description.trim() || undefined,
        keywords: zenodoMeta.keywords.trim() ? zenodoMeta.keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
        license: zenodoMeta.license || undefined,
      }
      if (!meta.creators.length) throw new Error('At least one creator name is required')
      const result = await api.publishToZenodo(presentationId, meta)
      setZenodoStatus({ type: 'success', message: `Published! DOI: ${result.doi}`, url: result.url, doi: result.doi })
      setZenodoPubStatus({ published: true, doi: result.doi, url: result.url })
    } catch (err) {
      setZenodoStatus({ type: 'error', message: err.message })
    } finally {
      setZenodoPublishing(false)
    }
  }

  const currentSlide = presentation?.slides[currentSlideIndex]

  const slideW = presentation?.slideWidth || 960
  const slideH = presentation?.slideHeight || 540
  const referencedEntries = presentation ? getReferencedEntries(presentation.bibliography || [], presentation.slides || []) : []
  const hasReferencesSlide = referencedEntries.length > 0
  const referencesSlideIndex = hasReferencesSlide ? presentation.slides.length : -1
  const isViewingReferences = currentSlideIndex === referencesSlideIndex && hasReferencesSlide

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Click to start typing...' }),
      MathNode,
      FontFamily,
      FontSize,
      FontWeight,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Don't trigger if we're setting content programmatically
      if (settingContent.current) return
      const elemId = editingElementIdRef.current
      const slideIdx = currentSlideIndexRef.current
      if (!elemId) return
      const html = editor.getHTML()
      setPresentation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === slideIdx ? {
              ...s,
              elements: s.elements.map(el =>
                el.id === elemId ? { ...el, content: html } : el
              )
            } : s
          )
        }
      })
    }
  })

  // When presentation first loads, clear editor content
  useEffect(() => {
    if (editor && presentation && isFirstLoad.current) {
      isFirstLoad.current = false
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [editor, presentation])

  // When currentSlideIndex changes, reset selection and editing
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    if (editor) {
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  useEffect(() => {
    if (!presentation || isFirstLoad.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      try {
        const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
        await saveFn(presentation.id, presentation)
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(''), 2000)
      } catch (err) {
        console.error('Auto-save failed', err)
        setSaveStatus('')
      }
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [presentation])

  // Undo history: debounce-push presentation snapshots; skip during undo itself
  useEffect(() => {
    if (!presentation || isFirstLoad.current) return
    if (applyingUndoRef.current) {
      applyingUndoRef.current = false
      return
    }
    const timer = setTimeout(() => {
      historyRef.current = [...historyRef.current.slice(-50), JSON.parse(JSON.stringify(presentation))]
      redoStackRef.current = []
    }, 500)
    return () => clearTimeout(timer)
  }, [presentation])

  const updateCurrentSlide = useCallback((updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      if (updates.__replaceAllSlides) {
        return { ...prev, slides: updates.__replaceAllSlides }
      }
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndex ? { ...s, ...updates } : s
        )
      }
    })
  }, [currentSlideIndex])

  const updateElement = useCallback((id, updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === id ? { ...el, ...updates } : el
            )
          } : s
        )
      }
    })
  }, [])

  const deleteElement = useCallback((id) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: s.elements.filter(el => el.id !== id)
          } : s
        )
      }
    })
    setSelectedElementIds(prev => prev.filter(x => x !== id))
    if (editingElementId === id) setEditingElementId(null)
  }, [editingElementId])

  const addTextElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 80, y: 160, width: 600, height: 180, zIndex: 1,
      content: '<p><span style="font-size: 32px; color: #94a3b8">New text</span></p>'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), newEl]
          } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addTextPathElement = useCallback(() => {
    const angle = 15
    const fontSize = 64
    const width = 500
    const dy = Math.abs(width * Math.tan((angle * Math.PI) / 180))
    const height = Math.ceil(dy + fontSize * 2.4)
    const newEl = {
      id: crypto.randomUUID(),
      type: 'textpath',
      x: 230, y: Math.round((slideH - height) / 2),
      width, height, zIndex: 2,
      content: 'Text on path',
      fontSize, fontFamily: 'sans-serif',
      color: '#ffffff', fontWeight: 'normal', fontStyle: 'normal',
      letterSpacing: 0, textAnchor: 'start', startOffset: 0,
      angle, showPath: true, pathSide: 'bottom',
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [slideH])

  const addImageElement = useCallback((src, dropX, dropY) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'image',
      x: dropX !== undefined ? Math.max(0, Math.min(560, dropX - 200)) : 130,
      y: dropY !== undefined ? Math.max(0, Math.min(240, dropY - 150)) : 100,
      width: 400, height: 300, zIndex: 2,
      src,
      objectFit: 'contain',
      alt: ''
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), newEl]
          } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const DEFAULT_HTML = `<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: white; font-family: sans-serif; }</style>
<div style="text-align:center;padding:20px;">
  <h2>HTML Embed</h2>
  <p>Edit this content</p>
</div>`

  const DEFAULT_D3 = `<script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>
<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; }</style>
<svg id="viz" width="100%" height="100%" style="display:block;"></svg>
<script>
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', \`0 0 \${W} \${H}\`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
svg.selectAll('circle').data(data).join('circle')
  .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
  .attr('fill', (d,i) => d3.schemeTableau10[i%10]).attr('opacity', 0.8);
<\/script>`

  const DEFAULT_MANIM = `from manim import *

class MyScene(Scene):
    def construct(self):
        circle = Circle(radius=2, color=BLUE)
        square = Square(side_length=2, color=RED)

        title = Text("Manim Animation", font_size=36).to_edge(UP)
        self.play(Write(title))
        self.play(Create(circle))
        self.wait(0.5)
        self.play(Transform(circle, square))
        self.wait(1)
`

  const addPluginElement = useCallback((fullType) => {
    const el = createPluginElement(fullType)
    if (!el) return
    if (fullType === 'plugin:manim') {
      el.pluginData = { ...el.pluginData, content: DEFAULT_MANIM }
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), el] } : s) }
    })
    setSelectedElementIds([el.id])
    if (fullType === 'plugin:manim') {
      const d = el.pluginData
      setManimEditorState({ elementId: el.id, content: d.content, sceneName: d.sceneName || 'MyScene', quality: d.quality || 'l', rendered: null, rendering: false, error: null, isPlugin: true })
    }
  }, [DEFAULT_MANIM])

  const addHtmlElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_HTML
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_HTML })
  }, [DEFAULT_HTML])

  const addD3Element = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_D3
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_D3 })
  }, [DEFAULT_D3])

  const insertKineticText = useCallback((html, width, height) => {
    const w = width || slideW - 80
    const h = height || 120
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
      width: w, height: h, zIndex: 2,
      content: html
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setShowKineticModal(false)
  }, [slideW])

  const openHtmlEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'html') return
    setHtmlEditorState({ elementId, content: element.content || '' })
  }, [presentation])

  const commitHtmlEdit = useCallback(() => {
    if (!htmlEditorState) return
    updateElement(htmlEditorState.elementId, { content: htmlEditorState.content })
    setHtmlEditorState(null)
  }, [htmlEditorState, updateElement])

  const DEFAULT_P5 = `function setup() {
  createCanvas(windowWidth, windowHeight)
  noLoop()
}

function draw() {
  clear()
  fill(255)
  noStroke()
  textAlign(CENTER, CENTER)
  const str = 'Hello World'
  for (let i = 0; i < str.length; i++) {
    const t = i / (str.length - 1)
    const x = map(t, 0, 1, 80, width - 80)
    const y = height / 2 + sin(t * TWO_PI) * height * 0.2
    const angle = cos(t * TWO_PI) * 0.4
    textSize(map(sin(t * PI), 0, 1, 24, 54))
    push()
    translate(x, y)
    rotate(angle)
    text(str[i], 0, 0)
    pop()
  }
}`

  const addP5Element = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'p5',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_P5,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setP5EditorState({ elementId: newEl.id, content: DEFAULT_P5 })
  }, [DEFAULT_P5, slideW, slideH])

  const openP5Editor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'p5') return
    setP5EditorState({ elementId, content: element.content || '' })
  }, [presentation])

  const commitP5Edit = useCallback(() => {
    if (!p5EditorState) return
    updateElement(p5EditorState.elementId, { content: p5EditorState.content })
    setP5EditorState(null)
  }, [p5EditorState, updateElement])

  const addCodeElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'code',
      x: 80, y: 80, width: 600, height: 320, zIndex: 2,
      content: '// Write your code here\nfunction hello() {\n  return "Hello, World!"\n}',
      language: 'javascript',
      fontSize: 14,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setCodeEditorState({ elementId: newEl.id, content: newEl.content, language: newEl.language })
  }, [])

  const openCodeEditor = useCallback((elementId) => {
    const slide = presentation?.slides[currentSlideIndexRef.current]
    const element = slide?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'code') return
    setCodeEditorState({ elementId, content: element.content || '', language: element.language || 'javascript' })
  }, [presentation])

  const commitCodeEdit = useCallback(() => {
    if (!codeEditorState) return
    updateElement(codeEditorState.elementId, { content: codeEditorState.content, language: codeEditorState.language })
    setCodeEditorState(null)
  }, [codeEditorState, updateElement])

  const DEFAULT_LATEX = `\\begin{tikzpicture}
  \\draw[thick,->] (0,0) -- (4,0) node[right] {$x$};
  \\draw[thick,->] (0,0) -- (0,3) node[above] {$y$};
  \\draw[blue,thick] (0,0) sin (1,1) cos (2,0) sin (3,-1) cos (4,0);
  \\node at (2,-0.8) {$f(x) = \\sin(x)$};
\\end{tikzpicture}`

  const addLatexElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'latex',
      x: 80, y: 80, width: 500, height: 380, zIndex: 2,
      content: DEFAULT_LATEX
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setLatexEditorState({ elementId: newEl.id, content: DEFAULT_LATEX })
  }, [])

  const openLatexEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'latex') return
    setLatexEditorState({ elementId, content: element.content || '' })
  }, [presentation])

  const commitLatexEdit = useCallback(() => {
    if (!latexEditorState) return
    updateElement(latexEditorState.elementId, { content: latexEditorState.content })
    setLatexEditorState(null)
  }, [latexEditorState, updateElement])

  const addMarkdownElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'markdown',
      x: 80, y: 80, width: 600, height: 380, zIndex: 2,
      content: '## Hello Markdown\n\n- Item one\n- Item two\n- Item three\n\n**Bold** and *italic* text with [links](https://example.com).\n\n```python\ndef hello():\n    print("Hello!")\n```'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addChartElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'chart',
      x: 80, y: 80, width: 500, height: 380, zIndex: 2,
      chartType: 'bar',
      chartData: {
        labels: ['A', 'B', 'C', 'D', 'E'],
        datasets: [{ label: 'Series 1', data: [12, 19, 8, 15, 10], color: '#6366f1' }]
      }
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addCalloutElement = useCallback((number) => {
    const num = number || ((currentSlide?.elements || []).filter(el => el.type === 'callout').length + 1)
    const newEl = {
      id: crypto.randomUUID(),
      type: 'callout',
      x: 200, y: 200, width: 36, height: 36, zIndex: 10,
      calloutNumber: num,
      calloutColor: '#ef4444',
      calloutTextColor: '#ffffff',
      fontSize: 16,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide])

  const addIconElement = useCallback((iconName) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'icon',
      x: 200, y: 200, width: 80, height: 80, zIndex: 2,
      iconName: iconName || 'Star',
      iconColor: '#ffffff',
      iconStrokeWidth: 2,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addShapeElement = useCallback((shape) => {
    const defaults = { line: { width: 300, height: 40 }, circle: { width: 200, height: 200 } }
    const dim = defaults[shape] || { width: 200, height: 150 }
    const newEl = {
      id: crypto.randomUUID(),
      type: 'shape',
      shape,
      x: (slideW - dim.width) / 2,
      y: (slideH - dim.height) / 2,
      width: dim.width,
      height: dim.height,
      zIndex: (currentSlide?.elements?.length || 0) + 1,
      fill: '#6366f1',
      stroke: 'none',
      strokeWidth: 0,
      borderRadius: 0,
      opacity: 1,
      text: '',
      fontSize: 16,
      textColor: '#ffffff'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide])

  const addNonobjectiveElement = useCallback((preset) => {
    const presets = {
      'rule-h-thin':    { shape: 'rect', width: 400, height: 2,   fill: 'rgba(255,255,255,0.5)', locked: true },
      'rule-h-medium':  { shape: 'rect', width: 500, height: 4,   fill: 'rgba(255,255,255,0.7)', locked: true },
      'rule-h-heavy':   { shape: 'rect', width: 600, height: 8,   fill: '#ffffff', locked: true },
      'rule-v-thin':    { shape: 'rect', width: 2,   height: 300, fill: 'rgba(255,255,255,0.5)', locked: true },
      'rule-v-medium':  { shape: 'rect', width: 4,   height: 350, fill: 'rgba(255,255,255,0.7)', locked: true },
      'rule-v-heavy':   { shape: 'rect', width: 8,   height: 400, fill: '#ffffff', locked: true },
      'rule-diagonal':  { shape: 'line', width: 500, height: 40,  fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, rotation: -15 },
      'circle-dot':     { shape: 'circle', width: 24,  height: 24,  fill: '#ffffff' },
      'circle-medium':  { shape: 'circle', width: 80,  height: 80,  fill: '#6366f1', opacity: 0.8 },
      'circle-large':   { shape: 'circle', width: 200, height: 200, fill: '#6366f1', opacity: 0.15, stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      'tone-dark':      { shape: 'rect', width: 300, height: 200, fill: '#0a0a14', opacity: 0.9 },
      'tone-medium':    { shape: 'rect', width: 300, height: 200, fill: '#2d2d4e', opacity: 0.8 },
      'tone-light':     { shape: 'rect', width: 300, height: 200, fill: 'rgba(255,255,255,0.08)' },
      'tone-accent':    { shape: 'rect', width: 300, height: 200, fill: 'rgba(99,102,241,0.15)' },
    }
    const p = presets[preset]
    if (!p) return
    const newEl = {
      id: crypto.randomUUID(),
      type: 'shape',
      x: (slideW - p.width) / 2,
      y: (slideH - p.height) / 2,
      zIndex: p.locked ? 0 : (currentSlide?.elements?.length || 0) + 1,
      stroke: 'none',
      strokeWidth: 0,
      borderRadius: 0,
      opacity: 1,
      text: '',
      fontSize: 16,
      textColor: '#ffffff',
      ...p,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide, slideW, slideH])

  const addModularGrid = useCallback((moduleShape, cols, rows, gap) => {
    const mx = 32, my = 32
    const usableW = slideW - 2 * mx
    const usableH = slideH - 2 * my
    const modW = (usableW - (cols - 1) * gap) / cols
    const modH = (usableH - (rows - 1) * gap) / rows
    const newElements = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newElements.push({
          id: crypto.randomUUID(),
          type: 'shape',
          shape: moduleShape,
          x: mx + c * (modW + gap),
          y: my + r * (modH + gap),
          width: modW,
          height: moduleShape === 'circle' ? modW : modH,
          zIndex: 0,
          fill: 'rgba(99,102,241,0.08)',
          stroke: 'rgba(99,102,241,0.25)',
          strokeWidth: 1,
          borderRadius: 0,
          opacity: 1,
          text: '',
          fontSize: 11,
          textColor: 'rgba(255,255,255,0.4)',
        })
      }
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), ...newElements],
            layoutGrid: { enabled: true, columns: cols, rows, gutter: gap, marginX: mx, marginY: my, snap: true },
          } : s
        )
      }
    })
  }, [slideW, slideH])

  const addDrawingStroke = useCallback((stroke) => {
    const pts = simplifyPoints(stroke.points, 1.5)
    if (pts.length < 2) return
    const newPath = { points: pts, color: stroke.color, strokeWidth: stroke.strokeWidth, opacity: stroke.opacity }
    setPresentation(prev => {
      if (!prev) return prev
      const slides = prev.slides.map((s, i) => {
        if (i !== currentSlideIndexRef.current) return s
        const elements = s.elements || []
        const existing = [...elements].reverse().find(el => el.type === 'drawing')
        if (existing) {
          return {
            ...s,
            elements: elements.map(el =>
              el.id === existing.id
                ? { ...el, paths: [...(el.paths || []), newPath], smooth: stroke.smooth }
                : el
            )
          }
        }
        const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0)
        return {
          ...s,
          elements: [...elements, {
            id: crypto.randomUUID(),
            type: 'drawing',
            x: 0, y: 0,
            width: slideW, height: slideH,
            zIndex: maxZ + 1,
            paths: [newPath],
            smooth: stroke.smooth,
          }]
        }
      })
      return { ...prev, slides }
    })
  }, [slideW, slideH])

  const addManimElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'manim',
      x: 160, y: 90, width: 640, height: 360, zIndex: 2,
      content: DEFAULT_MANIM,
      sceneName: 'MyScene',
      quality: 'l',
      rendered: null,
      loop: true,
      autoplay: true,
      muted: true,
      controls: false,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setManimEditorState({ elementId: newEl.id, content: newEl.content, sceneName: newEl.sceneName, quality: newEl.quality, rendered: null, rendering: false, error: null })
  }, [DEFAULT_MANIM])

  const openManimEditor = useCallback((elementId) => {
    const slide = presentation?.slides[currentSlideIndexRef.current]
    const element = slide?.elements?.find(el => el.id === elementId)
    if (!element) return
    if (element.type === 'manim') {
      setManimEditorState({ elementId, content: element.content || DEFAULT_MANIM, sceneName: element.sceneName || 'MyScene', quality: element.quality || 'l', rendered: element.rendered || null, rendering: false, error: null })
    } else if (element.type === 'plugin:manim') {
      const d = element.pluginData || {}
      setManimEditorState({ elementId, content: d.content || DEFAULT_MANIM, sceneName: d.sceneName || 'MyScene', quality: d.quality || 'l', rendered: d.rendered || null, rendering: false, error: null, isPlugin: true })
    }
  }, [presentation, DEFAULT_MANIM])

  const commitManimEdit = useCallback(() => {
    if (!manimEditorState) return
    const patch = {
      content: manimEditorState.content,
      sceneName: manimEditorState.sceneName,
      quality: manimEditorState.quality,
      rendered: manimEditorState.rendered,
    }
    if (manimEditorState.isPlugin) {
      const slide = presentation?.slides[currentSlideIndexRef.current]
      const element = slide?.elements?.find(el => el.id === manimEditorState.elementId)
      updateElement(manimEditorState.elementId, { pluginData: { ...(element?.pluginData || {}), ...patch } })
    } else {
      updateElement(manimEditorState.elementId, patch)
    }
    setManimEditorState(null)
  }, [manimEditorState, updateElement, presentation])

  const renderManim = useCallback(async () => {
    if (!manimEditorState) return
    setManimEditorState(s => ({ ...s, rendering: true, error: null }))
    try {
      const res = await fetch('/api/render-manim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: manimEditorState.content, sceneName: manimEditorState.sceneName, quality: manimEditorState.quality }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed')
      setManimEditorState(s => ({ ...s, rendered: data.url, rendering: false, error: null }))
    } catch (err) {
      setManimEditorState(s => ({ ...s, rendering: false, error: err.message }))
    }
  }, [manimEditorState])

  const addVideoElement = useCallback((src) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'video',
      x: 130, y: 100, width: 480, height: 270, zIndex: 2,
      src,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
      objectFit: 'contain',
      poster: '',
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addAudioElement = useCallback((src) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'audio',
      x: 80, y: 400, width: 400, height: 60, zIndex: 2,
      src,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addTableElement = useCallback((rows = 3, cols = 3) => {
    const data = Array.from({ length: rows }, (_, ri) =>
      Array.from({ length: cols }, (_, ci) => ri === 0 ? `Header ${ci + 1}` : '')
    )
    const newEl = {
      id: crypto.randomUUID(),
      type: 'table',
      x: 80, y: 100, width: 600, height: 300, zIndex: 2,
      data,
      headerRow: true,
      cellPadding: 8,
      borderColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      headerBgColor: 'rgba(99,102,241,0.3)',
      cellBgColor: 'transparent',
      textColor: '#ffffff',
      fontSize: 14,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const startEditingElement = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'text') return
    setEditingElementId(elementId)
    editingElementIdRef.current = elementId
    setSelectedElementIds([elementId])
    settingContent.current = true
    editor?.commands.setContent(element.content || '', false)
    settingContent.current = false
    setTimeout(() => editor?.commands.focus(), 10)
  }, [presentation, editor])

  const stopEditingElement = useCallback(() => {
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [])

  const bringElementForward = useCallback((id) => {
    updateElement(id, {
      zIndex: (currentSlide?.elements?.find(el => el.id === id)?.zIndex || 1) + 1
    })
  }, [currentSlide, updateElement])

  const sendElementBackward = useCallback((id) => {
    updateElement(id, {
      zIndex: Math.max(1, (currentSlide?.elements?.find(el => el.id === id)?.zIndex || 1) - 1)
    })
  }, [currentSlide, updateElement])

  const doUndo = useCallback(() => {
    const hist = historyRef.current
    if (hist.length < 2) return
    applyingUndoRef.current = true
    redoStackRef.current = [...redoStackRef.current.slice(-19), hist[hist.length - 1]]
    const newHist = hist.slice(0, -1)
    historyRef.current = newHist
    const prevState = newHist[newHist.length - 1]
    setPresentation(prevState)
    setCurrentSlideIndex(ci => Math.min(ci, prevState.slides.length - 1))
  }, [])

  const updateMathNode = useCallback((attrs) => {
    setActiveMathNode(prev => prev ? { ...prev, ...attrs } : null)
    if (mathNodeUpdateRef.current) mathNodeUpdateRef.current(attrs)
  }, [])

  const doRedo = useCallback(() => {
    const stack = redoStackRef.current
    if (!stack.length) return
    applyingUndoRef.current = true
    const redoState = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    setPresentation(prev => {
      if (prev) historyRef.current = [...historyRef.current.slice(-49), JSON.parse(JSON.stringify(prev))]
      return redoState
    })
    setCurrentSlideIndex(ci => Math.min(ci, redoState.slides.length - 1))
  }, [])

  // Cut / copy / paste / duplicate keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (drawTool) { setDrawTool(null); e.preventDefault(); return }
        if (editingElementId) { stopEditingElement(); setSelectedElementIds([]); e.preventDefault(); return }
        if (selectedElementIds.length > 0) { setSelectedElementIds([]); e.preventDefault(); return }
      }
      if (editingElementId) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      const element = selectedElementId
        ? presentation?.slides[currentSlideIndex]?.elements?.find(el => el.id === selectedElementId)
        : null
      if (e.key === 'f') {
        setShowFindReplace(v => !v)
        e.preventDefault()
        return
      }
      if (e.key === 'c' && element) {
        setClipboard({ ...element })
        e.preventDefault()
      } else if (e.key === 'x' && element) {
        setClipboard({ ...element })
        deleteElement(selectedElementId)
        e.preventDefault()
      } else if (e.key === 'v' && clipboard) {
        const newEl = {
          ...clipboard,
          id: crypto.randomUUID(),
          x: Math.min((clipboard.x || 0) + 20, slideW - (clipboard.width || 100)),
          y: Math.min((clipboard.y || 0) + 20, slideH - (clipboard.height || 100))
        }
        setPresentation(prev => ({
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === currentSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
          )
        }))
        setSelectedElementIds([newEl.id])
        e.preventDefault()
      } else if (e.key === 'd' && element) {
        const newEl = {
          ...element,
          id: crypto.randomUUID(),
          x: Math.min((element.x || 0) + 20, slideW - (element.width || 100)),
          y: Math.min((element.y || 0) + 20, slideH - (element.height || 100))
        }
        setPresentation(prev => ({
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === currentSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
          )
        }))
        setSelectedElementIds([newEl.id])
        e.preventDefault()
      } else if (e.key === 'z' && !e.shiftKey) {
        doUndo(); e.preventDefault()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        doRedo(); e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedElementId, selectedElementIds, editingElementId, clipboard, presentation, currentSlideIndex, deleteElement, stopEditingElement, doUndo, doRedo, drawTool])

  // Inject hljs theme CSS into the document head for the editor preview
  useEffect(() => {
    const theme = presentation?.codeTheme || 'monokai'
    let style = document.getElementById('hljs-theme-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hljs-theme-css'
      document.head.appendChild(style)
    }
    style.textContent = CODE_THEME_CSS[theme] || CODE_THEME_CSS['monokai']
  }, [presentation?.codeTheme])

  // Inject custom CSS (from template) into editor preview
  useEffect(() => {
    const css = presentation?.customCSS || ''
    let style = document.getElementById('custom-template-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'custom-template-css'
      document.head.appendChild(style)
    }
    style.textContent = css
    return () => { style.textContent = '' }
  }, [presentation?.customCSS])

  const selectedElement = currentSlide?.elements?.find(el => el.id === selectedElementId) || null

  const toggleElementSelection = useCallback((id, multi = false) => {
    if (!id) { setSelectedElementIds([]); return }
    if (multi) {
      setSelectedElementIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      // If element is in a group, select all group members
      const slide = presentation?.slides[currentSlideIndexRef.current]
      const el = slide?.elements?.find(e => e.id === id)
      if (el?.groupId) {
        const groupIds = (slide?.elements || []).filter(e => e.groupId === el.groupId).map(e => e.id)
        setSelectedElementIds(groupIds)
      } else {
        setSelectedElementIds([id])
      }
    }
  }, [presentation])

  const updateElements = useCallback((updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      const map = {}
      updates.forEach(u => { map[u.id] = u })
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: s.elements.map(el => map[el.id] ? { ...el, ...map[el.id] } : el) } : s
        )
      }
    })
  }, [])

  const deleteSelectedElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: s.elements.filter(el => !ids.includes(el.id)) } : s
        )
      }
    })
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [])

  const groupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    const groupId = crypto.randomUUID()
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? {
          ...s,
          elements: s.elements.map(el => ids.includes(el.id) ? { ...el, groupId } : el)
        } : s)
      }
    })
  }, [])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation(prev => {
      if (!prev) return prev
      const slide = prev.slides[currentSlideIndexRef.current]
      // Find all groupIds for selected elements
      const groupIds = new Set((slide?.elements || []).filter(el => ids.includes(el.id) && el.groupId).map(el => el.groupId))
      if (!groupIds.size) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? {
          ...s,
          elements: s.elements.map(el => groupIds.has(el.groupId) ? { ...el, groupId: undefined } : el)
        } : s)
      }
    })
  }, [])

  const alignElements = useCallback((type) => {
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    setPresentation(prev => {
      if (!prev) return prev
      const slide = prev.slides[currentSlideIndexRef.current]
      const els = slide.elements.filter(el => ids.includes(el.id))
      const upd = {}
      if (type === 'left') { const v = Math.min(...els.map(e => e.x)); els.forEach(e => { upd[e.id] = { x: v } }) }
      else if (type === 'right') { const v = Math.max(...els.map(e => e.x + e.width)); els.forEach(e => { upd[e.id] = { x: v - e.width } }) }
      else if (type === 'center-h') { const v = (Math.min(...els.map(e=>e.x)) + Math.max(...els.map(e=>e.x+e.width))) / 2; els.forEach(e => { upd[e.id] = { x: v - e.width/2 } }) }
      else if (type === 'top') { const v = Math.min(...els.map(e => e.y)); els.forEach(e => { upd[e.id] = { y: v } }) }
      else if (type === 'bottom') { const v = Math.max(...els.map(e => e.y + e.height)); els.forEach(e => { upd[e.id] = { y: v - e.height } }) }
      else if (type === 'center-v') { const v = (Math.min(...els.map(e=>e.y)) + Math.max(...els.map(e=>e.y+e.height))) / 2; els.forEach(e => { upd[e.id] = { y: v - e.height/2 } }) }
      else if (type === 'distribute-h') {
        const s = [...els].sort((a,b)=>a.x-b.x)
        if (s.length > 1) { const l=s[0].x, r=s[s.length-1].x+s[s.length-1].width, tw=s.reduce((a,e)=>a+e.width,0), gap=(r-l-tw)/(s.length-1); let cx=l; s.forEach(e=>{upd[e.id]={x:cx};cx+=e.width+gap}) }
      }
      else if (type === 'distribute-v') {
        const s = [...els].sort((a,b)=>a.y-b.y)
        if (s.length > 1) { const t=s[0].y, b=s[s.length-1].y+s[s.length-1].height, th=s.reduce((a,e)=>a+e.height,0), gap=(b-t-th)/(s.length-1); let cy=t; s.forEach(e=>{upd[e.id]={y:cy};cy+=e.height+gap}) }
      }
      return { ...prev, slides: prev.slides.map((sl,i) => i===currentSlideIndexRef.current ? { ...sl, elements: sl.elements.map(el => upd[el.id] ? {...el,...upd[el.id]} : el) } : sl) }
    })
  }, [])

  // Helper: build a map of colNum → flat indices within that column
  const getColumnsMap = (slides) => {
    const colMap = {}
    slides.forEach((s, i) => {
      const c = s.column ?? 0
      if (!colMap[c]) colMap[c] = []
      colMap[c].push(i)
    })
    return colMap
  }

  const addSlide = (templateKey = null, targetColNum = null) => {
    const is2D = presentation.slides.some(s => s.column !== undefined)
    // Determine which column to add to
    const colNum = targetColNum !== null
      ? targetColNum
      : is2D
        ? (presentation.slides[currentSlideIndex]?.column ?? 0)
        : null // 1D mode: append at end

    const template = templateKey && SLIDE_TEMPLATES[templateKey] ? SLIDE_TEMPLATES[templateKey] : null
    const baseElements = template
      ? template.elements.map(el => ({ ...el, id: crypto.randomUUID() }))
      : [{ id: crypto.randomUUID(), type: 'text', x: 80, y: 160, width: 800, height: 220, zIndex: 1, content: '<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>' }]
    const newSlide = {
      id: crypto.randomUUID(),
      ...(colNum !== null ? { column: colNum } : {}),
      elements: baseElements,
      notes: '',
      background: { type: 'color', color: '#1e1e2e' },
      ...(template?.layoutGrid ? { layoutGrid: { ...template.layoutGrid } } : {}),
      ...(template?.axisLines ? { axisLines: template.axisLines.map(a => ({ ...a, id: crypto.randomUUID() })) } : {}),
    }

    if (colNum === null || !is2D) {
      // 1D: append at end
      setPresentation(prev => ({ ...prev, slides: [...prev.slides, newSlide] }))
      setCurrentSlideIndex(presentation.slides.length)
    } else {
      // 2D: insert after the last slide in this column
      const colMap = getColumnsMap(presentation.slides)
      const colSlides = colMap[colNum] || []
      const insertAfterIdx = colSlides.length > 0 ? colSlides[colSlides.length - 1] : presentation.slides.length - 1
      const newFlatIndex = insertAfterIdx + 1
      setPresentation(prev => {
        const slides = [...prev.slides]
        slides.splice(newFlatIndex, 0, newSlide)
        return { ...prev, slides }
      })
      setCurrentSlideIndex(newFlatIndex)
    }
  }

  const addColumn = () => {
    const slides = presentation?.slides || []
    const is2D = slides.some(s => s.column !== undefined)
    const maxCol = is2D ? slides.reduce((m, s) => Math.max(m, s.column ?? 0), 0) : 0
    const newColNum = maxCol + 1
    const newSlide = {
      id: crypto.randomUUID(),
      column: newColNum,
      elements: [{ id: crypto.randomUUID(), type: 'text', x: 80, y: 160, width: 800, height: 220, zIndex: 1, content: '<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>' }],
      notes: '',
      background: { type: 'color', color: '#1e1e2e' }
    }
    setPresentation(prev => ({
      ...prev,
      slides: [
        ...(is2D ? prev.slides : prev.slides.map(s => ({ ...s, column: 0 }))),
        newSlide
      ]
    }))
    setCurrentSlideIndex(slides.length) // new slide appended at end
  }

  const moveSlideToColumn = (flatIndex, newColNum) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === flatIndex ? { ...s, column: newColNum } : s)
      }
    })
  }

  const moveSlideInColumn = (flatIndex, direction) => {
    if (!presentation) return
    const slides = presentation.slides
    const col = slides[flatIndex]?.column ?? 0
    const colItems = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => (s.column ?? 0) === col)
    const rowIdx = colItems.findIndex(({ i }) => i === flatIndex)
    const targetRowIdx = rowIdx + direction
    if (targetRowIdx < 0 || targetRowIdx >= colItems.length) return
    const targetFlatIndex = colItems[targetRowIdx].i
    setPresentation(prev => {
      const arr = [...prev.slides]
      ;[arr[flatIndex], arr[targetFlatIndex]] = [arr[targetFlatIndex], arr[flatIndex]]
      return { ...prev, slides: arr }
    })
    if (currentSlideIndex === flatIndex) setCurrentSlideIndex(targetFlatIndex)
    else if (currentSlideIndex === targetFlatIndex) setCurrentSlideIndex(flatIndex)
  }

  const handleImportPptx = async (file) => {
    if (!file || !presentationId) return
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/presentations/${presentationId}/import-pptx`, { method: 'POST', body: fd })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Import failed') }
    const { urls } = await res.json()
    const sw = presentation.slideWidth || 960
    const sh = presentation.slideHeight || 540
    const newSlides = urls.map(url => ({
      id: crypto.randomUUID(),
      elements: [{ id: crypto.randomUUID(), type: 'image', src: url, x: 0, y: 0, width: sw, height: sh, objectFit: 'contain', zIndex: 1 }],
      notes: '',
      background: { type: 'color', color: '#000000' },
    }))
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(currentSlideIndex + 1, 0, ...newSlides)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(currentSlideIndex + 1)
  }

  const deleteSlide = (index) => {
    if (!presentation || presentation.slides.length <= 1) return
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index)
    }))
    setCurrentSlideIndex(prev => Math.min(prev, presentation.slides.length - 2))
  }

  const duplicateSlide = (index) => {
    if (!presentation) return
    const slide = {
      ...presentation.slides[index],
      id: crypto.randomUUID(),
      elements: (presentation.slides[index].elements || []).map(el => ({
        ...el,
        id: crypto.randomUUID()
      }))
    }
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(index + 1, 0, slide)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(index + 1)
  }

  const moveSlide = (fromIndex, toIndex) => {
    if (!presentation) return
    if (toIndex < 0 || toIndex >= presentation.slides.length) return
    setPresentation(prev => {
      const slides = [...prev.slides]
      const [removed] = slides.splice(fromIndex, 1)
      slides.splice(toIndex, 0, removed)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(toIndex)
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (!presentation) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Presentation not found.{' '}
        <button className="btn btn-ghost" onClick={onGoHome}>Go back</button>
      </div>
    )
  }

  return (
    <div className="editor-page" style={{ position: 'relative' }}>
      {/* Editor Header */}
      <div className="editor-header">
        <button className="back-btn btn-ghost" onClick={onGoHome}>
          <ChevronLeft size={16} />
          Back
        </button>
        {isTemplate && (
          <span style={{ fontSize: 11, background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 4, fontWeight: 600, flexShrink: 0, marginRight: 4 }}>TEMPLATE</span>
        )}
        {presentation.expiresAt && (() => {
          const days = Math.ceil((new Date(presentation.expiresAt) - Date.now()) / 86400000)
          if (days > 14) return null
          return (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, flexShrink: 0, marginRight: 4,
              background: days <= 7 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: days <= 7 ? '#ef4444' : '#f59e0b',
            }}>
              {days <= 0 ? 'EXPIRED' : `Expires in ${days}d`}
            </span>
          )
        })()}
        <input
          className="title-input"
          value={presentation.title || ''}
          onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
          placeholder={isTemplate ? 'Untitled Template' : 'Untitled Presentation'}
        />
        <div className="header-controls">
          {saveStatus === 'saving' && <span className="save-indicator">Saving...</span>}
          {saveStatus === 'saved' && <span className="save-indicator" style={{ color: 'var(--success)' }}>Saved</span>}
          {!saveStatus && lastSavedAt && (
            <span className="save-indicator" style={{ fontSize: 10, color: 'var(--text-muted)' }} title={lastSavedAt.toLocaleString()}>
              {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setShowDefaultSettings(true)}
            title="Default slide settings"
          >
            <Settings size={14} />
            Settings
          </button>


          <button
            className="btn btn-secondary"
            onClick={() => setShowBibliographyModal(true)}
            title="Bibliography & Citations"
          >
            <FileText size={14} />
            Citations
            {(presentation.bibliography || []).length > 0 && (
              <span style={{ fontSize: 9, background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '0 4px', lineHeight: '14px', fontWeight: 700 }}>
                {presentation.bibliography.length}
              </span>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowFindReplace(v => !v)}
            title="Find & Replace (Ctrl+F)"
          >
            <Search size={14} />
            Find
          </button>

          <button
            className={`btn btn-secondary ${showTimeline ? 'active' : ''}`}
            onClick={() => setShowTimeline(v => !v)}
            title="Animation Timeline"
          >
            <Clock size={14} />
            Timeline
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className={`btn btn-secondary ${showExportMenu ? 'active' : ''}`}
              onClick={() => setShowExportMenu(v => !v)}
              title="Export / Share"
            >
              <Download size={14} />
              Export
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 4, zIndex: 1000, minWidth: 170,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 2,
                }}
                onMouseLeave={() => setShowExportMenu(false)}
              >
                {[
                  { label: 'Share link', icon: <Share2 size={13} />, action: async () => { const status = await api.getShareStatus(presentationId); setShareStatus(status); setShowShareModal(true) } },
                  { label: 'Export PDF', icon: <Download size={13} />, action: () => exportPDF(presentation) },
                  { label: 'Export PPTX', icon: <Download size={13} />, action: () => exportToPptx(presentation) },
                  { label: 'Export HTML', icon: <Download size={13} />, action: () => downloadHTML(presentation) },
                  { label: 'Export Slide HTML', icon: <Download size={13} />, action: () => downloadSlideHTML(presentation, currentSlideIndex) },
                  { label: 'Export Offline HTML', icon: <FileDown size={13} />, action: async () => {
                    const html = generateRevealHTML(presentation)
                    const offline = await generateOfflineHTML(html)
                    const blob = new Blob([offline], { type: 'text/html' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}_offline.html`
                    a.click()
                    URL.revokeObjectURL(url)
                  }},
                ].map(({ label, icon, action }) => (
                  <button
                    key={label}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', borderRadius: 5, textAlign: 'left', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowExportMenu(false); action() }}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={async () => {
              const snaps = await api.getSnapshots(presentationId)
              setSnapshots(snaps)
              setShowHistoryModal(true)
            }}
            title="Version History"
          >
            <History size={14} />
            History
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSyncDropdown(v => !v)}
              title="Sync options"
            >
              <CloudUpload size={14} />
              Sync
              <ChevronDown size={12} style={{ marginLeft: 2 }} />
            </button>
            {showSyncDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowSyncDropdown(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, minWidth: 150, overflow: 'hidden' }}>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowSyncDropdown(false); setShowGithubModal(true) }}
                  >
                    <Github size={14} />
                    GitHub
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={async () => {
                      setShowSyncDropdown(false)
                      setZenodoStatus(null)
                      if (presentationId) {
                        api.getZenodoStatus(presentationId).then(setZenodoPubStatus).catch(() => setZenodoPubStatus(null))
                      }
                      setShowZenodoModal(true)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16"/><path d="M4 5l16 14"/><path d="M4 5h16"/></svg>
                    Zenodo
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={async () => {
                      setShowSyncDropdown(false)
                      try { const s = await api.getRcloneStatus(); setSyncStatus(s) } catch { setSyncStatus({ installed: false }) }
                      setSyncResult(null)
                      setShowSyncModal(true)
                    }}
                  >
                    <CloudUpload size={14} />
                    Proton Drive
                  </button>
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={async () => {
                      setShowSyncDropdown(false)
                      setShowGitHistory(true)
                      setGitLoading(true)
                      try {
                        const commits = await api.getGitHistory(presentationId)
                        setGitCommits(commits)
                      } catch (e) { setGitCommits([]); console.error(e) }
                      setGitLoading(false)
                    }}
                  >
                    <History size={14} />
                    Git History
                  </button>
                </div>
              </>
            )}
          </div>

          {liveSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>LIVE</span>
              <input readOnly value={`${window.location.origin}${liveSession.url}`}
                style={{ width: 180, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, padding: '2px 6px' }}
                onClick={e => { e.target.select(); navigator.clipboard.writeText(e.target.value).catch(() => {}) }} />
              <span style={{ color: 'var(--text-muted)' }}>{liveViewers} viewer{liveViewers !== 1 ? 's' : ''}</span>
              <button onClick={async () => { await api.stopLiveSession(presentationId, liveSession.sessionId).catch(() => {}); setLiveSession(null); setLiveViewers(0) }}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '2px 4px' }}>
                Stop
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex' }}>
              <button
                className="btn btn-primary"
                onClick={() => presentInWindow(presentation)}
                title="Present"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Play size={14} />
                Present
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowPresentDropdown(v => !v)}
                title="Present options"
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.2)', padding: '6px 5px' }}
              >
                <ChevronDown size={12} />
              </button>
            </div>
            {showPresentDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowPresentDropdown(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, minWidth: 170, overflow: 'hidden' }}>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowPresentDropdown(false); presentInWindow(presentation) }}
                  >
                    <Play size={14} />
                    Present
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowPresentDropdown(false); presenterInWindow(presentation) }}
                  >
                    <Monitor size={14} />
                    Presenter Mode
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: liveSession ? 'var(--danger)' : '#ef4444', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={async () => {
                      setShowPresentDropdown(false)
                      if (liveSession) {
                        await api.stopLiveSession(presentationId, liveSession.sessionId).catch(() => {})
                        setLiveSession(null)
                        setLiveViewers(0)
                        return
                      }
                      try {
                        const { sessionId, url } = await api.startLiveSession(presentationId)
                        setLiveSession({ sessionId, url })
                        setLiveViewers(0)
                        livePresentInWindow(presentation, sessionId, (count) => setLiveViewers(count))
                      } catch (e) {
                        alert('Failed to start live session: ' + e.message)
                      }
                    }}
                  >
                    <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: liveSession ? '#ef4444' : '#ef4444', display: 'block', animation: liveSession ? 'none' : 'none' }} />
                    </span>
                    {liveSession ? 'Stop Live Session' : 'Live Present'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Default Settings Modal */}
      {showDefaultSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDefaultSettings(false) }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Default Settings</h2>
              <button onClick={() => setShowDefaultSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              {/* Font */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Font</div>
                <select className="prop-input" value={presentation.globalFont || ''}
                  onChange={e => setPresentation(prev => ({ ...prev, globalFont: e.target.value || null }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="">— Default —</option>
                  <optgroup label="Sans-serif">
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Helvetica Neue', sans-serif">Helvetica</option>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="'Inter Tight', sans-serif">Inter Tight</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Source Sans 3', sans-serif">Source Sans 3</option>
                    <option value="'Fira Sans', sans-serif">Fira Sans</option>
                    <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
                    <option value="Manrope, sans-serif">Manrope</option>
                    <option value="Geist, sans-serif">Geist</option>
                    <option value="Figtree, sans-serif">Figtree</option>
                    <option value="Ubuntu, sans-serif">Ubuntu</option>
                    <option value="Rubik, sans-serif">Rubik</option>
                    <option value="'PT Sans', sans-serif">PT Sans</option>
                    <option value="'Didact Gothic', sans-serif">Didact Gothic</option>
                    <option value="Questrial, sans-serif">Questrial</option>
                    <option value="Barlow, sans-serif">Barlow</option>
                  </optgroup>
                  <optgroup label="Rounded">
                    <option value="Comfortaa, sans-serif">Comfortaa</option>
                    <option value="Nunito, sans-serif">Nunito</option>
                    <option value="'Nunito Sans', sans-serif">Nunito Sans</option>
                    <option value="Quicksand, sans-serif">Quicksand</option>
                    <option value="Dosis, sans-serif">Dosis</option>
                    <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded 1c</option>
                    <option value="Jura, sans-serif">Jura</option>
                  </optgroup>
                  <optgroup label="Condensed">
                    <option value="'Barlow Condensed', sans-serif">Barlow Condensed</option>
                    <option value="'Asap Condensed', sans-serif">Asap Condensed</option>
                    <option value="'Roboto Condensed', sans-serif">Roboto Condensed</option>
                  </optgroup>
                  <optgroup label="Serif">
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="Merriweather, serif">Merriweather</option>
                  </optgroup>
                  <optgroup label="Monospace">
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="'Fira Code', monospace">Fira Code</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="Inconsolata, monospace">Inconsolata</option>
                    <option value="'Roboto Mono', monospace">Roboto Mono</option>
                    <option value="'Space Mono', monospace">Space Mono</option>
                  </optgroup>
                  <optgroup label="Display">
                    <option value="Impact, sans-serif">Impact</option>
                    <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                    <option value="Codystar, sans-serif">Codystar</option>
                    <option value="'National Park', sans-serif">National Park</option>
                    <option value="'Futura PT', Futura, 'Century Gothic', sans-serif">Futura</option>
                    <option value="'Bauhaus 93', Impact, sans-serif">Bauhaus 93</option>
                  </optgroup>
                </select>
              </div>

              {/* Theme */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Background</div>
                <select className="prop-input" value={presentation.theme || 'black'}
                  onChange={e => setPresentation(prev => ({ ...prev, theme: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  {THEMES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              {/* Transition */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Transition</div>
                <select className="prop-input" value={presentation.transition || 'slide'}
                  onChange={e => setPresentation(prev => ({ ...prev, transition: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  {TRANSITIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              {/* Resolution */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Resolution</div>
                <select className="prop-input"
                  value={(() => {
                    const w = presentation.slideWidth || 960, h = presentation.slideHeight || 540
                    if (w === 960 && h === 540) return '960x540'
                    if (w === 1280 && h === 720) return '1280x720'
                    if (w === 960 && h === 600) return '960x600'
                    if (w === 960 && h === 720) return '960x720'
                    if (w === 540 && h === 960) return '540x960'
                    return 'custom'
                  })()}
                  onChange={e => {
                    const presets = { '960x540': [960,540], '1280x720': [1280,720], '960x600': [960,600], '960x720': [960,720], '540x960': [540,960] }
                    if (presets[e.target.value]) {
                      const [w, h] = presets[e.target.value]
                      setPresentation(prev => ({ ...prev, slideWidth: w, slideHeight: h }))
                    }
                  }}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="960x540">16:9 (960 x 540)</option>
                  <option value="1280x720">16:9 HD (1280 x 720)</option>
                  <option value="960x600">16:10 (960 x 600)</option>
                  <option value="960x720">4:3 (960 x 720)</option>
                  <option value="540x960">9:16 (540 x 960)</option>
                  <option value="custom">Custom</option>
                </select>
                {!([ [960,540],[1280,720],[960,600],[960,720],[540,960] ].some(([w,h]) => (presentation.slideWidth||960)===w && (presentation.slideHeight||540)===h)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <input type="number" className="prop-input" style={{ flex: 1, padding: '4px 6px' }}
                      value={presentation.slideWidth || 960}
                      onChange={e => setPresentation(prev => ({ ...prev, slideWidth: Number(e.target.value) || 960 }))}
                      min={200} max={3840} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>&times;</span>
                    <input type="number" className="prop-input" style={{ flex: 1, padding: '4px 6px' }}
                      value={presentation.slideHeight || 540}
                      onChange={e => setPresentation(prev => ({ ...prev, slideHeight: Number(e.target.value) || 540 }))}
                      min={200} max={3840} />
                  </div>
                )}
              </div>

              {/* Grid */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Grid</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presentation.showPresentGrid || false}
                    onChange={e => setPresentation(prev => ({ ...prev, showPresentGrid: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)' }} />
                  Show grid in present mode
                </label>
              </div>

              {/* Laser Pointer */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Laser Pointer</div>
                <select className="prop-input" value={presentation.laserPointer || 'off'}
                  onChange={e => setPresentation(prev => ({ ...prev, laserPointer: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="off">Off</option>
                  <option value="dot">Laser Dot</option>
                  <option value="spotlight">Spotlight</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Press L during presentation to toggle</div>
              </div>

              {/* Overview Panel */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Slide Overview (present mode)</div>
                <select className="prop-input" value={presentation.overviewLayout || 'linear'}
                  onChange={e => setPresentation(prev => ({ ...prev, overviewLayout: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="linear">Linear</option>
                  <option value="sections">Group by Section</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presentation.sectionNav || false}
                    onChange={e => setPresentation(prev => ({ ...prev, sectionNav: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)' }} />
                  2D section navigation
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Arrow left/right between sections, up/down within</div>
              </div>

              {/* Footer */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 600 }}>Footer &amp; Page Numbers</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={presentation.showFooter || false}
                      onChange={e => setPresentation(prev => ({ ...prev, showFooter: e.target.checked }))}
                      style={{ accentColor: 'var(--accent)' }} />
                    Show footer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={presentation.showPageNumbers || false}
                      onChange={e => setPresentation(prev => ({ ...prev, showPageNumbers: e.target.checked }))}
                      style={{ accentColor: 'var(--accent)' }} />
                    Show page numbers
                  </label>
                  {presentation.showPageNumbers && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Page number format</div>
                      <select className="prop-input" value={presentation.pageNumberFormat || 'c/t'}
                        onChange={e => setPresentation(prev => ({ ...prev, pageNumberFormat: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px' }}>
                        <option value="c">1</option>
                        <option value="c/t">1 / 10</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Clock / Timer</div>
                    <select className="prop-input" value={presentation.footerTimeMode || 'none'}
                      onChange={e => setPresentation(prev => ({ ...prev, footerTimeMode: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px' }}>
                      <option value="none">No Clock</option>
                      <option value="clock12">Clock 12h</option>
                      <option value="clock24">Clock 24h</option>
                      <option value="timer-up">Timer &uarr;</option>
                      <option value="timer-down">Timer &darr;</option>
                    </select>
                  </div>
                  {presentation.footerTimeMode === 'timer-down' && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Countdown (minutes)</div>
                      <input type="number" className="prop-input"
                        value={presentation.timerDuration ?? 20}
                        onChange={e => setPresentation(prev => ({ ...prev, timerDuration: Math.max(1, Number(e.target.value) || 1) }))}
                        min={1} style={{ width: '100%', padding: '6px 8px' }} />
                    </div>
                  )}
                </div>

                {/* Footer Style */}
                {(presentation.showFooter || presentation.showPageNumbers) && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Footer Style</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {[['basic', 'Basic'], ['sequence', 'Sequence']].map(([mode, label]) => (
                        <button key={mode}
                          onClick={() => setPresentation(prev => ({ ...prev, footerMode: mode }))}
                          style={{ flex: 1, padding: '5px 0', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: (presentation.footerMode || 'basic') === mode ? 'var(--accent)' : 'var(--bg-hover)', color: (presentation.footerMode || 'basic') === mode ? 'white' : 'var(--text-secondary)' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {presentation.footerMode === 'sequence' && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Section Titles</div>
                        {(presentation.sequenceSections || []).map((sec, i) => {
                          const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
                          const secColor = typeof sec === 'object' && sec?.color ? sec.color : ''
                          const updateSec = patch => {
                            const sections = [...(presentation.sequenceSections || [])]
                            sections[i] = { label: secLabel, color: secColor, ...patch }
                            setPresentation(prev => ({ ...prev, sequenceSections: sections }))
                          }
                          return (
                            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                              <input className="prop-input" type="text" value={secLabel}
                                onChange={e => updateSec({ label: e.target.value })}
                                placeholder={`Section ${i + 1}`}
                                style={{ flex: 1, fontSize: 12, padding: '4px 6px' }} />
                              <input type="color" title="Active color override"
                                value={secColor || (presentation.footerColor || '#a8b4c8')}
                                onChange={e => updateSec({ color: e.target.value })}
                                style={{ width: 26, height: 26, padding: 1, background: 'var(--bg-card)', border: secColor ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }} />
                              <button onClick={() => { const sections = [...(presentation.sequenceSections || [])]; sections.splice(i, 1); setPresentation(prev => ({ ...prev, sequenceSections: sections })) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>×</button>
                            </div>
                          )
                        })}
                        <button onClick={() => setPresentation(prev => ({ ...prev, sequenceSections: [...(prev.sequenceSections || []), { label: '', color: '' }] }))}
                          style={{ width: '100%', padding: '4px 0', fontSize: 12, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', marginTop: 2 }}>
                          + Add Section
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 36px', gap: 8, alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Font</div>
                        <select className="prop-input" value={presentation.footerFontFamily || '-apple-system,sans-serif'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerFontFamily: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px' }}>
                          <optgroup label="Sans-serif">
                            <option value="-apple-system,sans-serif">System</option>
                            <option value="Inter,sans-serif">Inter</option>
                            <option value="Roboto,sans-serif">Roboto</option>
                            <option value="'Open Sans',sans-serif">Open Sans</option>
                            <option value="'Source Sans Pro',sans-serif">Source Sans Pro</option>
                          </optgroup>
                          <optgroup label="Serif">
                            <option value="'Playfair Display',serif">Playfair Display</option>
                            <option value="Merriweather,serif">Merriweather</option>
                          </optgroup>
                          <optgroup label="Monospace">
                            <option value="'Fira Code',monospace">Fira Code</option>
                            <option value="'JetBrains Mono',monospace">JetBrains Mono</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Size</div>
                        <input className="prop-input" type="number" min="8" max="32" step="1"
                          value={presentation.footerFontSize || 14}
                          onChange={e => setPresentation(prev => ({ ...prev, footerFontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) }))}
                          style={{ width: '100%', padding: '6px 8px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Color</div>
                        <input type="color" value={presentation.footerColor || '#a8b4c8'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerColor: e.target.value }))}
                          style={{ width: 32, height: 32, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
                      </div>
                    </div>
                    {presentation.footerMode === 'sequence' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inactive color</div>
                        <input type="color" value={presentation.footerInactiveColor || '#404060'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerInactiveColor: e.target.value }))}
                          style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
                      </div>
                    )}
                  </div>
                )}

              {/* Bibliography */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Bibliography</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {(presentation.bibliography || []).length} references
                      {(presentation.bibliography || []).length > 0 && ' — auto-generated references slide'}
                    </div>
                  </div>
                  <button onClick={() => { setShowDefaultSettings(false); setShowBibliographyModal(true) }}
                    className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                    Manage Bibliography
                  </button>
                </div>
              </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Modal */}
      {showGithubModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGithubModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Save to GitHub</h3>
              <button className="btn btn-ghost" onClick={() => setShowGithubModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Owner</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.owner}
                  onChange={e => setGithubConfig(prev => ({ ...prev, owner: e.target.value }))}
                  placeholder="username or org"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Name</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.repo}
                  onChange={e => setGithubConfig(prev => ({ ...prev, repo: e.target.value }))}
                  placeholder="my-presentations"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>
                  Personal Access Token {githubConfig.hasToken && <span style={{ color: '#22c55e' }}>(saved)</span>}
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder={githubConfig.hasToken ? '••••••••  (leave blank to keep)' : 'ghp_...'}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Pages URL <span style={{ color: '#666' }}>(optional)</span></label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.pagesUrl || ''}
                  onChange={e => setGithubConfig(prev => ({ ...prev, pagesUrl: e.target.value }))}
                  placeholder="https://jessicabirky.com/presentations"
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleGithubSaveConfig}
                style={{ alignSelf: 'flex-start' }}
              >
                <Settings size={14} />
                Save Settings
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #3a3a4e', margin: '4px 0' }} />

              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Commit Message (optional)</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubCommitMsg}
                  onChange={e => setGithubCommitMsg(e.target.value)}
                  placeholder={`${presentation?.title || 'Untitled'} ${new Date().toLocaleString()}`}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGithubPush}
                disabled={githubPushing || !githubConfig.hasToken || !githubConfig.owner || !githubConfig.repo}
                style={{ width: '100%', justifyContent: 'center', opacity: (githubPushing || !githubConfig.hasToken || !githubConfig.owner || !githubConfig.repo) ? 0.5 : 1 }}
              >
                <Github size={14} />
                {githubPushing ? 'Pushing...' : 'Push to GitHub'}
              </button>

              {githubStatus && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  background: githubStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: githubStatus.type === 'success' ? '#22c55e' : '#ef4444',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {githubStatus.type === 'success' ? <Check size={14} /> : <X size={14} />}
                  <span>{githubStatus.message}</span>
                  {githubStatus.url && (
                    <a href={githubStatus.url} target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: 'auto', color: 'inherit', textDecoration: 'underline' }}>View</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zenodo Modal */}
      {showZenodoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowZenodoModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Publish to Zenodo</h3>
              <button className="btn btn-ghost" onClick={() => setShowZenodoModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {zenodoPubStatus?.published && (
              <div style={{ padding: '10px 14px', borderRadius: 6, fontSize: 13, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', marginBottom: 16, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Previously published</div>
                <div>DOI: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>{zenodoPubStatus.doi}</code></div>
                <a href={zenodoPubStatus.url} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', fontSize: 12 }}>View on Zenodo</a>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>
                  API Token {zenodoConfig.hasToken && <span style={{ color: '#22c55e' }}>(saved)</span>}
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={zenodoToken}
                  onChange={e => setZenodoToken(e.target.value)}
                  placeholder={zenodoConfig.hasToken ? '••••••••  (leave blank to keep)' : 'Paste your Zenodo token'}
                />
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                  Generate at zenodo.org &rarr; Settings &rarr; Applications &rarr; Personal access tokens (scope: <code style={{ fontSize: 10 }}>deposit:write</code>)
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a0a0b0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={zenodoConfig.sandbox}
                    onChange={e => setZenodoConfig(prev => ({ ...prev, sandbox: e.target.checked }))}
                    style={{ accentColor: '#6366f1' }}
                  />
                  Use Sandbox (sandbox.zenodo.org)
                </label>
              </div>

              <button className="btn btn-secondary" onClick={handleZenodoSaveConfig} style={{ alignSelf: 'flex-start' }}>
                <Settings size={14} />
                Save Settings
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #3a3a4e', margin: '4px 0' }} />

              <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: -4 }}>Metadata</div>

              {zenodoMeta.creators.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Name *</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.name}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], name: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="Last, First"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Affiliation</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.affiliation}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], affiliation: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="University"
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>ORCID</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.orcid}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], orcid: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="0000-0000-..."
                    />
                  </div>
                  {zenodoMeta.creators.length > 1 && (
                    <button onClick={() => setZenodoMeta(m => ({ ...m, creators: m.creators.filter((_, j) => j !== i) }))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '7px 4px', marginTop: i === 0 ? 18 : 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setZenodoMeta(m => ({ ...m, creators: [...m.creators, { name: '', affiliation: '', orcid: '' }] }))}
                style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #3a3a4e', color: '#a0a0b0', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                + Add creator
              </button>

              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Description</label>
                <textarea
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
                  value={zenodoMeta.description}
                  onChange={e => setZenodoMeta(m => ({ ...m, description: e.target.value }))}
                  placeholder="Brief description of the presentation..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Keywords (comma separated)</label>
                  <input
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                    value={zenodoMeta.keywords}
                    onChange={e => setZenodoMeta(m => ({ ...m, keywords: e.target.value }))}
                    placeholder="astronomy, stellar evolution, ..."
                  />
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>License</label>
                  <select
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                    value={zenodoMeta.license}
                    onChange={e => setZenodoMeta(m => ({ ...m, license: e.target.value }))}
                  >
                    <option value="cc-by-4.0">CC BY 4.0</option>
                    <option value="cc-by-sa-4.0">CC BY-SA 4.0</option>
                    <option value="cc-by-nc-4.0">CC BY-NC 4.0</option>
                    <option value="cc0-1.0">CC0 (Public Domain)</option>
                    <option value="MIT">MIT</option>
                    <option value="Apache-2.0">Apache 2.0</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleZenodoPublish}
                disabled={zenodoPublishing || !zenodoConfig.hasToken || !zenodoMeta.creators.some(c => c.name.trim())}
                style={{ width: '100%', justifyContent: 'center', opacity: (zenodoPublishing || !zenodoConfig.hasToken) ? 0.5 : 1 }}
              >
                {zenodoPublishing ? 'Publishing...' : 'Publish to Zenodo'}
              </button>

              {zenodoPublishing && (
                <div style={{ fontSize: 12, color: '#a0a0b0', textAlign: 'center' }}>
                  Uploading files and minting DOI... this may take a moment.
                </div>
              )}

              {zenodoStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, fontSize: 13,
                  background: zenodoStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: zenodoStatus.type === 'success' ? '#22c55e' : '#ef4444',
                  lineHeight: 1.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {zenodoStatus.type === 'success' ? <Check size={14} /> : <X size={14} />}
                    <span>{zenodoStatus.message}</span>
                  </div>
                  {zenodoStatus.doi && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      Copy this DOI for citations: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>{zenodoStatus.doi}</code>
                    </div>
                  )}
                  {zenodoStatus.url && (
                    <a href={zenodoStatus.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 4, color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>View on Zenodo</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync / Proton Drive Modal */}
      {showSyncModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSyncModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Sync to Cloud</h3>
              <button className="btn btn-ghost" onClick={() => setShowSyncModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {!syncStatus?.installed ? (
              <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#ef4444' }}>
                rclone is not installed in the container. Rebuild with the updated Dockerfile to enable cloud sync.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#a0a0b0' }}>{syncStatus.version}</div>

                {syncStatus.remotes?.length > 0 ? (
                  <>
                    <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, color: '#22c55e' }}>
                      Configured remote{syncStatus.remotes.length > 1 ? 's' : ''}: {syncStatus.remotes.join(', ')}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Remote Path</label>
                      <input
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                        value={syncConfig.remotePath || '/slides-backup'}
                        onChange={e => setSyncConfig(prev => ({ ...prev, remotePath: e.target.value }))}
                        placeholder="/slides-backup"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={syncing}
                        onClick={async () => {
                          setSyncing(true); setSyncResult(null)
                          try {
                            const r = await api.syncSingleToRemote({
                              remote: syncStatus.remotes[0],
                              remotePath: syncConfig.remotePath || '/slides-backup',
                              presentationId
                            })
                            setSyncResult({ type: 'success', message: `Synced to ${r.destination}` })
                          } catch (err) {
                            setSyncResult({ type: 'error', message: err.message })
                          } finally { setSyncing(false) }
                        }}
                      >
                        <CloudUpload size={14} />
                        {syncing ? 'Syncing...' : 'Sync This Presentation'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ justifyContent: 'center' }}
                        disabled={syncing}
                        onClick={async () => {
                          setSyncing(true); setSyncResult(null)
                          try {
                            const r = await api.syncToRemote({
                              remote: syncStatus.remotes[0],
                              remotePath: syncConfig.remotePath || '/slides-backup',
                            })
                            setSyncResult({ type: 'success', message: `Synced ${r.synced} presentations to ${r.destination}` })
                          } catch (err) {
                            setSyncResult({ type: 'error', message: err.message })
                          } finally { setSyncing(false) }
                        }}
                      >
                        Sync All
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: '#a0a0b0' }}>
                      Configure Proton Drive credentials. Your password is stored in the rclone config file on the server.
                    </p>
                    <div>
                      <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Proton Username</label>
                      <input
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                        value={syncConfig.username}
                        onChange={e => setSyncConfig(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="user@proton.me"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Proton Password</label>
                      <input
                        type="password"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                        value={syncConfig.password}
                        onChange={e => setSyncConfig(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Password"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Remote Name</label>
                      <input
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                        value={syncConfig.remoteName}
                        onChange={e => setSyncConfig(prev => ({ ...prev, remoteName: e.target.value }))}
                        placeholder="protondrive"
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={syncing || !syncConfig.username || !syncConfig.password}
                      onClick={async () => {
                        setSyncing(true); setSyncResult(null)
                        try {
                          await api.configureRclone(syncConfig)
                          const s = await api.getRcloneStatus()
                          setSyncStatus(s)
                          setSyncResult({ type: 'success', message: 'Connected to Proton Drive' })
                        } catch (err) {
                          setSyncResult({ type: 'error', message: err.message })
                        } finally { setSyncing(false) }
                      }}
                    >
                      {syncing ? 'Connecting...' : 'Connect'}
                    </button>
                  </>
                )}

                {syncResult && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 13,
                    background: syncResult.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: syncResult.type === 'success' ? '#22c55e' : '#ef4444',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {syncResult.type === 'success' ? <Check size={14} /> : <X size={14} />}
                    <span>{syncResult.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistoryModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '70vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Version History</h3>
              <button className="btn btn-ghost" onClick={() => setShowHistoryModal(false)} style={{ padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                placeholder="Snapshot name (optional)"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    api.saveSnapshot(presentationId, snapshotName || undefined).then(async () => {
                      setSnapshotName('')
                      setSnapshots(await api.getSnapshots(presentationId))
                    })
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await api.saveSnapshot(presentationId, snapshotName || undefined)
                  setSnapshotName('')
                  setSnapshots(await api.getSnapshots(presentationId))
                }}
              >
                Save
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {snapshots.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No snapshots yet</p>
              ) : (
                snapshots.map(snap => (
                  <div key={snap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{snap.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {new Date(snap.createdAt).toLocaleString()} &middot; {snap.slideCount} slide{snap.slideCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={async () => {
                        if (!confirm('Restore this snapshot? Current changes will be overwritten.')) return
                        const restored = await api.restoreSnapshot(presentationId, snap.id)
                        setPresentation({ ...restored, slides: (restored.slides || []).map(s => s) })
                        setShowHistoryModal(false)
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className="btn-icon"
                      style={{ color: 'var(--danger)' }}
                      title="Delete snapshot"
                      onClick={async () => {
                        await api.deleteSnapshot(presentationId, snap.id)
                        setSnapshots(await api.getSnapshots(presentationId))
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showGitHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGitHistory(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw', maxHeight: '70vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>
                <Github size={16} style={{ marginRight: 8, verticalAlign: -2 }} />
                Git History
              </h3>
              <button className="btn btn-ghost" onClick={() => setShowGitHistory(false)} style={{ padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {gitLoading ? (
                <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading commits...</p>
              ) : gitCommits.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No commits found. Push to GitHub first.</p>
              ) : (
                gitCommits.map((commit, i) => (
                  <div key={commit.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : '#555', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commit.message.split('\n')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {new Date(commit.date).toLocaleString()} &middot; {commit.author} &middot; <code style={{ fontSize: 10, color: '#666' }}>{commit.sha.slice(0, 7)}</code>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                      disabled={gitRestoring === commit.sha}
                      onClick={async () => {
                        if (!confirm(`Restore from commit ${commit.sha.slice(0, 7)}? Current changes will be overwritten.`)) return
                        setGitRestoring(commit.sha)
                        try {
                          const data = await api.getGitVersion(presentationId, commit.sha)
                          await api.updatePresentation(presentationId, data)
                          setPresentation({ ...data, slides: (data.slides || []).map(s => s) })
                          setShowGitHistory(false)
                        } catch (e) { alert('Restore failed: ' + e.message) }
                        setGitRestoring(null)
                      }}
                    >
                      {gitRestoring === commit.sha ? '...' : 'Restore'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="editor-body">
        <SlidePanel
          slides={presentation.slides}
          currentIndex={currentSlideIndex}
          onSelect={setCurrentSlideIndex}
          onAdd={(colNum) => { setPendingAddColumn(colNum ?? null); setShowTemplateModal(true) }}
          onAddColumn={addColumn}
          onDelete={deleteSlide}
          onDuplicate={duplicateSlide}
          onMove={moveSlide}
          onMoveInColumn={moveSlideInColumn}
          onMoveToColumn={moveSlideToColumn}
          slideW={slideW}
          slideH={slideH}
          referencesSlideIndex={hasReferencesSlide ? referencesSlideIndex : -1}
          referencesCount={referencedEntries.length}
        />

        <div className="editor-main">
          <Toolbar
            editor={editingElementId ? editor : null}
            editingElementId={editingElementId}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(v => !v)}
            gridSize={gridSize}
            onGridSizeChange={(v) => { setGridSize(v); setPresentation(prev => prev ? { ...prev, gridSize: v } : prev) }}
            onAddText={addTextElement}
            onAddTextPath={addTextPathElement}
            onAddImage={() => {
              const url = window.prompt('Image URL:')
              if (url) addImageElement(url)
            }}
            onAddImageUpload={async (file) => {
              const result = await api.uploadFile(file)
              if (result.url) addImageElement(result.url)
            }}

            onAddShape={addShapeElement}
            onAddNonobjective={addNonobjectiveElement}
            onAddModularGrid={addModularGrid}
            onAddHtml={addHtmlElement}
            onAddD3={addD3Element}
            onAddKineticText={() => setShowKineticModal(true)}
            onAddMathGrid={() => setShowMathGridModal(true)}
            onAddAnime={() => setShowAnimeModal(true)}
            onAddThree={() => setShowThreeModal(true)}
            onAddDiagram={() => setShowDiagramModal(true)}
            onAddP5={addP5Element}
            onAddCode={addCodeElement}
            onAddLatex={addLatexElement}
            onAddMarkdown={addMarkdownElement}
            onAddChart={addChartElement}
            onAddCallout={addCalloutElement}
            onAddIcon={addIconElement}
            onAddVideo={addVideoElement}
            onAddVideoUpload={async (file) => {
              const result = await api.uploadFileToPresentation(presentation.id, file)
              if (result.url) addVideoElement(result.url)
            }}
            onAddAudio={addAudioElement}
            onAddTable={addTableElement}
            onAddManim={addManimElement}
            pluginTypes={pluginsLoaded ? getInsertablePluginTypes() : []}
            onAddPluginElement={addPluginElement}
            selectedCount={selectedElementIds.length}
            onAlignElements={alignElements}
            smartGuidesEnabled={smartGuidesEnabled}
            onToggleSmartGuides={() => setSmartGuidesEnabled(v => !v)}
            slide={currentSlide}
            onUpdateSlide={updateCurrentSlide}
            onGroupElements={groupElements}
            onUngroupElements={ungroupElements}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers(v => !v)}
            guides={guides}
            onAddGuide={(guide) => {
              setGuides(prev => {
                const next = [...prev, guide]
                setPresentation(p => p ? { ...p, guides: next } : p)
                return next
              })
            }}
            onRemoveGuide={(idx) => {
              setGuides(prev => {
                const next = prev.filter((_, i) => i !== idx)
                setPresentation(p => p ? { ...p, guides: next } : p)
                return next
              })
            }}
            onUpdateGuide={(idx, pos) => {
              setGuides(prev => {
                const next = prev.map((g, i) => i === idx ? { ...g, position: pos } : g)
                setPresentation(p => p ? { ...p, guides: next } : p)
                return next
              })
            }}
            onImportPptx={handleImportPptx}
            drawTool={drawTool}
            onSetDrawTool={setDrawTool}
            onUndo={doUndo}
            onRedo={doRedo}
            canUndo={historyRef.current.length >= 2}
            canRedo={redoStackRef.current.length > 0}
          />
          <div className="canvas-area" style={{ display: 'flex', flexDirection: 'column' }}>
            {isViewingReferences ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ width: slideW * 0.75, height: slideH * 0.75, background: '#111122', borderRadius: 8, border: '1px solid var(--border)', overflow: 'auto', padding: '24px 32px', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                  <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Auto-generated</div>
                  <h2 style={{ fontSize: 22, margin: '0 0 16px', color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>References</h2>
                  <div style={{ columns: referencedEntries.length > 8 ? 2 : 1, columnGap: 24 }}>
                    {referencedEntries.map((entry, i) => {
                      const authors = parseAuthors(entry.author)
                      const authorStr = formatAuthorsFull(authors)
                      return (
                        <div key={entry.key} style={{ marginBottom: 8, lineHeight: 1.5, fontSize: 12, color: 'rgba(255,255,255,0.85)', breakInside: 'avoid' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 6 }}>[{i + 1}]</span>
                          {authorStr}{entry.year ? ` (${entry.year})` : ''}. {entry.title}.
                          {entry.journal || entry.booktitle ? <em> {entry.journal || entry.booktitle}</em> : null}
                          {entry.volume ? `, ${entry.volume}` : ''}{entry.pages ? `, ${entry.pages}` : ''}.
                          {entry.doi && <a href={`https://doi.org/${entry.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(99,102,241,0.8)', fontSize: '0.85em', marginLeft: 4 }}>DOI</a>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : <SlideCanvas
              editor={editor}
              slide={currentSlide}
              selectedElementIds={selectedElementIds}
              editingElementId={editingElementId}
              showGrid={showGrid}
              gridSize={gridSize}
              showFooter={presentation.showFooter || false}
              showPageNumbers={presentation.showPageNumbers || false}
              footerTimeMode={presentation.footerTimeMode || 'none'}
              timerDuration={presentation.timerDuration ?? 20}
              pageNumberFormat={presentation.pageNumberFormat || 'c/t'}
              pageNumber={(() => {
                if (!presentation.showPageNumbers) return null
                if (currentSlide?.showPageNumber === false) return null
                // Count only slides with showPageNumber !== false up to current
                let num = 0
                for (let i = 0; i <= currentSlideIndex; i++) {
                  if (presentation.slides[i]?.showPageNumber !== false) num++
                }
                return num
              })()}
              totalSlides={presentation.slides.filter(s => s.showPageNumber !== false).length}
              sectionName={currentSlide?.section || ''}
              footerFontSize={presentation.footerFontSize || 14}
              footerFontFamily={presentation.footerFontFamily || '-apple-system,sans-serif'}
              footerColor={presentation.footerColor || 'rgba(255,255,255,0.65)'}
              footerInactiveColor={presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'}
              footerMode={presentation.footerMode || 'basic'}
              sequenceSections={presentation.sequenceSections || []}
              activeSection={currentSlide?.activeSection ?? null}
              smartGuidesEnabled={smartGuidesEnabled}
              showRulers={showRulers}
              persistentGuides={guides}
              onAddGuide={(guide) => {
                setGuides(prev => {
                  const next = [...prev, guide]
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onRemoveGuide={(idx) => {
                setGuides(prev => {
                  const next = prev.filter((_, i) => i !== idx)
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onUpdateGuide={(idx, pos) => {
                setGuides(prev => {
                  const next = prev.map((g, i) => i === idx ? { ...g, position: pos } : g)
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onToggleSelectElement={toggleElementSelection}
              onStartEdit={startEditingElement}
              onStopEdit={stopEditingElement}
              onUpdateElement={updateElement}
              onUpdateElements={updateElements}
              onDeleteElement={deleteElement}
              onDeleteSelectedElements={deleteSelectedElements}
              onOpenHtmlEditor={openHtmlEditor}
              onOpenP5Editor={openP5Editor}
              onOpenCodeEditor={openCodeEditor}
              onOpenLatexEditor={openLatexEditor}
              onOpenManimEditor={openManimEditor}
              onAddImage={async (file, dropX, dropY) => {
                const result = await api.uploadFile(file)
                if (result.url) addImageElement(result.url, dropX, dropY)
              }}
              slideW={slideW}
              slideH={slideH}
              drawTool={drawTool}
              onAddDrawingStroke={addDrawingStroke}
              globalFont={presentation.globalFont || ''}
              onUpdateAxisLines={(axisLines) => updateCurrentSlide({ axisLines })}
            />}
          </div>
        </div>}

        <PropertiesPanel
          slide={currentSlide}
          selectedElement={selectedElement}
          onUpdateSlide={updateCurrentSlide}
          onUpdateElement={(updates) => selectedElementId && updateElement(selectedElementId, updates)}
          onDeleteElement={() => selectedElementId && deleteElement(selectedElementId)}
          onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
          onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
          onEditHtml={() => selectedElementId && openHtmlEditor(selectedElementId)}
          onEditP5={() => selectedElementId && openP5Editor(selectedElementId)}
          onEditCode={() => selectedElementId && openCodeEditor(selectedElementId)}
          onEditLatex={() => selectedElementId && openLatexEditor(selectedElementId)}
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation(prev => ({ ...prev, ...updates }))}
          selectedElementIds={selectedElementIds}
          onDeleteSelectedElements={deleteSelectedElements}
          isTemplate={isTemplate}
          activeMathNode={activeMathNode}
          onUpdateMathNode={updateMathNode}
          onCloseMathNode={() => { setActiveMathNode(null); mathNodeUpdateRef.current = null }}
          onPreviewSlide={() => previewSlideInWindow(presentation, currentSlideIndex)}
          currentSlideIndex={currentSlideIndex}
        />

      {/* HTML / D3 Code Editor Modal */}
      {htmlEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setHtmlEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '78vw', maxWidth: 960, height: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>HTML / D3 Embed</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>D3, plain HTML, or any JavaScript — renders in an iframe</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setHtmlEditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitHtmlEdit}>Apply</button>
              </div>
            </div>
            <textarea
              value={htmlEditorState.content}
              onChange={e => setHtmlEditorState(s => ({ ...s, content: e.target.value }))}
              style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', borderRadius: '0 0 12px 12px', lineHeight: 1.6, tabSize: 2 }}
              spellCheck={false}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const { selectionStart: s, selectionEnd: end, value } = e.target
                  const next = value.substring(0, s) + '  ' + value.substring(end)
                  e.target.value = next
                  setHtmlEditorState(st => ({ ...st, content: next }))
                  requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                }
              }}
            />
          </div>
        </div>
      )}

      {/* p5.js Sketch Editor Modal */}
      {p5EditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setP5EditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '90vw', maxWidth: 1200, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>p5.js Sketch</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Write <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>setup()</code> and <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>draw()</code> — canvas auto-sizes to element
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setP5EditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitP5Edit}>Apply</button>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <textarea
                value={p5EditorState.content}
                onChange={e => setP5EditorState(s => ({ ...s, content: e.target.value }))}
                style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.6, tabSize: 2, borderRight: '1px solid var(--border)' }}
                spellCheck={false}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const { selectionStart: s, selectionEnd: end, value } = e.target
                    const next = value.substring(0, s) + '  ' + value.substring(end)
                    e.target.value = next
                    setP5EditorState(st => ({ ...st, content: next }))
                    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                  }
                }}
              />
              <div style={{ flex: 1, background: '#0a0a14', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>Preview</div>
                <iframe
                  key={p5EditorState.content}
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#111;overflow:hidden;}canvas{display:block;}</style><script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"><\/script></head><body><script>${p5EditorState.content}<\/script></body></html>`}
                  style={{ flex: 1, border: 'none', display: 'block' }}
                  sandbox="allow-scripts"
                  title="p5.js preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Editor Modal */}
      {codeEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setCodeEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '78vw', maxWidth: 960, height: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Code Block</span>
              <select
                value={codeEditorState.language}
                onChange={e => setCodeEditorState(s => ({ ...s, language: e.target.value }))}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: '#e0e0e0', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
              >
                {[
                  { id: 'plaintext', label: 'Plain Text' },
                  { id: 'javascript', label: 'JavaScript' }, { id: 'typescript', label: 'TypeScript' },
                  { id: 'python', label: 'Python' }, { id: 'java', label: 'Java' },
                  { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' }, { id: 'csharp', label: 'C#' },
                  { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' }, { id: 'php', label: 'PHP' },
                  { id: 'ruby', label: 'Ruby' }, { id: 'swift', label: 'Swift' }, { id: 'kotlin', label: 'Kotlin' },
                  { id: 'r', label: 'R' }, { id: 'scala', label: 'Scala' },
                  { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }, { id: 'json', label: 'JSON' },
                  { id: 'yaml', label: 'YAML' }, { id: 'bash', label: 'Bash/Shell' }, { id: 'sql', label: 'SQL' },
                  { id: 'markdown', label: 'Markdown' }, { id: 'latex', label: 'LaTeX' },
                ].map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <select
                value={presentation.codeTheme || 'monokai'}
                onChange={e => setPresentation(prev => ({ ...prev, codeTheme: e.target.value }))}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: '#e0e0e0', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                title="Code highlight theme"
              >
                <optgroup label="Dark">
                  <option value="monokai">Monokai</option>
                  <option value="github-dark">GitHub Dark</option>
                  <option value="atom-one-dark">Atom One Dark</option>
                  <option value="tokyo-night-dark">Tokyo Night</option>
                  <option value="vs2015">VS Code Dark</option>
                  <option value="night-owl">Night Owl</option>
                  <option value="an-old-hope">An Old Hope</option>
                </optgroup>
                <optgroup label="Light">
                  <option value="atom-one-light">Atom One Light</option>
                  <option value="github">GitHub Light</option>
                  <option value="vs">Visual Studio</option>
                </optgroup>
              </select>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setCodeEditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitCodeEdit}>Apply</button>
              </div>
            </div>
            <textarea
              value={codeEditorState.content}
              onChange={e => setCodeEditorState(s => ({ ...s, content: e.target.value }))}
              style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', borderRadius: '0 0 12px 12px', lineHeight: 1.6, tabSize: 2 }}
              spellCheck={false}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const { selectionStart: s, selectionEnd: end, value } = e.target
                  const next = value.substring(0, s) + '  ' + value.substring(end)
                  e.target.value = next
                  setCodeEditorState(st => ({ ...st, content: next }))
                  requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                }
              }}
            />
          </div>
        </div>
      )}
      {/* LaTeX / TikZ Editor Modal */}
      {latexEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setLatexEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '78vw', maxWidth: 960, height: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>LaTeX / TikZ</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports KaTeX math, LaTeX tables (LaTeX.js), and TikZ diagrams (TikZJax)</span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setLatexEditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitLatexEdit}>Apply</button>
              </div>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
                <textarea
                  id="latex-editor-textarea"
                  value={latexEditorState.content}
                  onChange={e => setLatexEditorState(s => ({ ...s, content: e.target.value }))}
                  style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.6, tabSize: 2 }}
                  spellCheck={false}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const { selectionStart: s, selectionEnd: end, value } = e.target
                      const next = value.substring(0, s) + '  ' + value.substring(end)
                      e.target.value = next
                      setLatexEditorState(st => ({ ...st, content: next }))
                      requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                    }
                  }}
                />
                <EquationPalette onInsert={(latex) => {
                  const ta = document.getElementById('latex-editor-textarea')
                  if (!ta) return
                  const { selectionStart: s, selectionEnd: end, value } = ta
                  const next = value.substring(0, s) + latex + value.substring(end)
                  setLatexEditorState(st => ({ ...st, content: next }))
                  requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + latex.length })
                }} />
              </div>
              <div style={{ flex: 1, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 }}>
                <iframe
                  key={latexEditorState.content}
                  srcDoc={generateLatexIframeHtml(latexEditorState.content || '')}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                  sandbox="allow-scripts"
                  title="LaTeX Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manim Editor Modal */}
      {manimEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape' && !manimEditorState.rendering) setManimEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '90vw', maxWidth: 1200, height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Manim Animation</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scene:</span>
                <input
                  className="prop-input"
                  value={manimEditorState.sceneName}
                  onChange={e => setManimEditorState(s => ({ ...s, sceneName: e.target.value }))}
                  style={{ width: 140, fontSize: 12, padding: '3px 6px' }}
                  placeholder="SceneName"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quality:</span>
                <select
                  value={manimEditorState.quality}
                  onChange={e => setManimEditorState(s => ({ ...s, quality: e.target.value }))}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                >
                  <option value="l">Low (480p, fastest)</option>
                  <option value="m">Medium (720p)</option>
                  <option value="h">High (1080p, slow)</option>
                </select>
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '4px 14px', opacity: manimEditorState.rendering ? 0.6 : 1 }}
                onClick={renderManim}
                disabled={manimEditorState.rendering}
              >
                {manimEditorState.rendering ? '⏳ Rendering…' : '▶ Render'}
              </button>
              {manimEditorState.rendered && !manimEditorState.rendering && (
                <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Rendered</span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setManimEditorState(null)} disabled={manimEditorState.rendering}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitManimEdit} disabled={manimEditorState.rendering}>Apply</button>
              </div>
            </div>

            {/* Body: editor left, preview right */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Code editor */}
              <textarea
                value={manimEditorState.content}
                onChange={e => setManimEditorState(s => ({ ...s, content: e.target.value }))}
                style={{ flex: '0 0 58%', background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.6, tabSize: 4, borderRight: '1px solid var(--border)', borderRadius: '0 0 0 12px' }}
                spellCheck={false}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const { selectionStart: s, selectionEnd: end, value } = e.target
                    const next = value.substring(0, s) + '    ' + value.substring(end)
                    e.target.value = next
                    setManimEditorState(st => ({ ...st, content: next }))
                    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 4 })
                  }
                }}
              />

              {/* Preview panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0a0a14', borderRadius: '0 0 12px 0' }}>
                {manimEditorState.rendering && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32 }}>⏳</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Rendering…</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, textAlign: 'center' }}>
                      This can take 10–60 seconds depending on animation length and quality.
                    </div>
                  </div>
                )}
                {!manimEditorState.rendering && manimEditorState.error && (
                  <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
                    <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8, fontWeight: 600 }}>Render Error</div>
                    <pre style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>{manimEditorState.error}</pre>
                  </div>
                )}
                {!manimEditorState.rendering && !manimEditorState.error && manimEditorState.rendered && (
                  <video
                    key={manimEditorState.rendered}
                    src={manimEditorState.rendered}
                    controls
                    autoPlay
                    loop
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: '0 0 12px 0' }}
                  />
                )}
                {!manimEditorState.rendering && !manimEditorState.error && !manimEditorState.rendered && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>🎬</div>
                    <div style={{ fontSize: 13 }}>Click <strong style={{ color: 'var(--text-primary)' }}>▶ Render</strong> to generate the animation</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Low quality renders in ~10–30 seconds</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Find & Replace */}
      {showFindReplace && (
        <FindReplaceBar
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation(prev => ({ ...prev, ...updates }))}
          currentSlideIndex={currentSlideIndex}
          onNavigateToSlide={setCurrentSlideIndex}
          onClose={() => setShowFindReplace(false)}
        />
      )}

      {/* Animation Timeline */}
      {showTimeline && (
        <AnimationTimeline
          slide={currentSlide}
          onUpdateElement={(id, updates) => updateElement(id, updates)}
          onClose={() => setShowTimeline(false)}
          onPreview={() => presentInWindow(presentation)}
        />
      )}

      {/* Transition Preview */}
      {showTransitionPreview && (
        <TransitionPreview
          presentation={presentation}
          fromIndex={currentSlideIndex}
          onClose={() => setShowTransitionPreview(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showKineticModal && (
        <KineticTextModal
          onInsert={insertKineticText}
          onClose={() => setShowKineticModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showMathGridModal && (
        <MathGridModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 40, y: 40, width: slideW - 80, height: slideH - 80, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowMathGridModal(false)
          }}
          onClose={() => setShowMathGridModal(false)}
        />
      )}

      {showAnimeModal && (
        <AnimeModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 0, y: 0, width: slideW, height: slideH, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowAnimeModal(false)
          }}
          onClose={() => setShowAnimeModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showThreeModal && (
        <ThreeModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 0, y: 0, width: slideW, height: slideH, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowThreeModal(false)
          }}
          onClose={() => setShowThreeModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {/* Bibliography Modal */}
      {showBibliographyModal && (
        <BibliographyModal
          bibliography={presentation.bibliography || []}
          citationStyle={presentation.citationStyle || 'numbered'}
          onUpdate={updates => setPresentation(prev => ({ ...prev, ...updates }))}
          onInsertCitation={(entry, index) => {
            const cite = formatCitation(entry, presentation.citationStyle || 'numbered', index)
            if (editor && editingElementId) {
              editor.chain().focus().insertContent(`<sup style="color:#6366f1;font-weight:700;cursor:default">${cite}</sup>`).run()
            }
          }}
          onClose={() => setShowBibliographyModal(false)}
        />
      )}

      {/* Diagram Modal */}
      {showDiagramModal && (
        <DiagramModal
          slideW={slideW}
          slideH={slideH}
          onInsert={(svg) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 80, y: 80, width: 600, height: 380, zIndex: 2, content: svg }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowDiagramModal(false)
          }}
          onClose={() => setShowDiagramModal(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Share Presentation</h3>
              <button className="btn btn-ghost" onClick={() => setShowShareModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shareStatus.shared ? (
                <>
                  <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 6 }}>Sharing enabled</div>
                    <input
                      readOnly
                      value={`${window.location.origin}/share/${shareStatus.token}`}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      onClick={e => {
                        e.target.select()
                        navigator.clipboard.writeText(e.target.value).catch(() => {})
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 4 }}>Click to copy link</div>
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={async () => {
                      await api.disableShare(presentationId)
                      setShareStatus({ shared: false, token: null })
                    }}
                  >
                    Disable Sharing
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#a0a0b0' }}>
                    Generate a public link to view this presentation without the editor.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={async () => {
                      const result = await api.enableShare(presentationId)
                      setShareStatus(result)
                    }}
                  >
                    <Share2 size={14} />
                    Enable Sharing
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => { setShowTemplateModal(false); setPendingAddColumn(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2 style={{ marginBottom: 16 }}>Add Slide</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {Object.entries(SLIDE_TEMPLATES).filter(([, t]) => !t.category).map(([key, tmpl]) => (
                <button key={key}
                  onClick={() => { addSlide(key, pendingAddColumn); setPendingAddColumn(null); setShowTemplateModal(false) }}
                  style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                >
                  <div style={{ height: 55, background: '#1e1e2e', borderRadius: 4, marginBottom: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                    {key === 'blank' && <span style={{ fontSize: 20, opacity: 0.4 }}>□</span>}
                    {key === 'title' && <div style={{textAlign:'center'}}><div style={{fontSize:9,fontWeight:700,color:'white',marginBottom:3}}>─────────</div><div style={{fontSize:7,color:'#aaa'}}>─────</div></div>}
                    {key === 'two-column' && <div style={{display:'flex',gap:3,width:'80%',height:'60%'}}><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></div>}
                    {key === 'image-text' && <div style={{display:'flex',gap:3,width:'80%',height:'60%'}}><div style={{flex:1,background:'rgba(99,102,241,0.3)',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>🖼</div><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></div>}
                    {key === 'section-header' && <div style={{textAlign:'center'}}><div style={{fontSize:10,fontWeight:700,color:'#6366f1'}}>─────</div><div style={{width:30,height:2,background:'#6366f1',margin:'3px auto'}}/><div style={{fontSize:6,color:'#888'}}>section</div></div>}
                    {key === 'three-column' && <div style={{display:'flex',gap:2,width:'85%',height:'60%'}}><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></div>}
                    {key === 'comparison' && <div style={{display:'flex',gap:4,width:'80%',height:'60%'}}><div style={{flex:1,border:'1px solid #6366f1',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'#6366f1'}}>A</div><div style={{flex:1,border:'1px solid #ec4899',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'#ec4899'}}>B</div></div>}
                    {key === 'big-number' && <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#6366f1'}}>42</div><div style={{fontSize:6,color:'#888'}}>metric</div></div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#e0e0e0', fontWeight: 500 }}>{tmpl.label}</div>
                </button>
              ))}
            </div>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>Typographic Systems</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {Object.entries(SLIDE_TEMPLATES).filter(([, t]) => t.category === 'systems').map(([key, tmpl]) => {
                const icons = {
                  'system-axial':        <div style={{display:'flex',height:'60%',width:'80%',gap:0}}><div style={{width:'35%',borderRight:'2px solid #f472b6'}}/><div style={{flex:1,background:'rgba(255,255,255,0.06)'}}/></div>,
                  'system-bilateral':    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'60%',width:'80%'}}><div style={{width:'60%',height:2,background:'#6366f1',marginTop:'30%'}}/></div>,
                  'system-grid':         <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'80%',height:'60%'}}>{Array.from({length:6}).map((_,i)=><div key={i} style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:1}}/>)}</div>,
                  'system-modular':      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:2,width:'85%',height:'60%'}}>{Array.from({length:8}).map((_,i)=><div key={i} style={{background:i<4?'rgba(99,102,241,0.15)':'transparent',border:'1px solid rgba(99,102,241,0.2)',borderRadius:1}}/>)}</div>,
                  'system-transitional': <div style={{width:'80%',height:'60%',position:'relative'}}><div style={{position:'absolute',top:'10%',left:'5%',width:'55%',height:8,background:'rgba(255,255,255,0.12)',borderRadius:1}}/><div style={{position:'absolute',top:'35%',left:'15%',width:'45%',height:6,background:'rgba(255,255,255,0.08)',borderRadius:1}}/><div style={{position:'absolute',top:'55%',width:'70%',height:1,background:'rgba(255,255,255,0.15)'}}/><div style={{position:'absolute',top:'65%',left:'10%',width:'50%',height:8,background:'rgba(255,255,255,0.1)',borderRadius:1}}/></div>,
                  'system-radial':       <div style={{width:'80%',height:'60%',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:16,height:16,borderRadius:'50%',background:'#6366f1'}}/><div style={{position:'absolute',width:32,height:32,borderRadius:'50%',border:'1px solid rgba(99,102,241,0.3)'}}/><div style={{position:'absolute',width:48,height:48,borderRadius:'50%',border:'1px solid rgba(99,102,241,0.15)'}}/></div>,
                }
                return (
                  <button key={key}
                    onClick={() => { addSlide(key, pendingAddColumn); setPendingAddColumn(null); setShowTemplateModal(false) }}
                    style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#f472b6'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                  >
                    <div style={{ height: 55, background: '#1e1e2e', borderRadius: 4, marginBottom: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                      {icons[key] || <span style={{ fontSize: 9 }}>{tmpl.label}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#f472b6', fontWeight: 500 }}>{tmpl.label}</div>
                  </button>
                )
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowTemplateModal(false); setPendingAddColumn(null) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Park the TipTap editor DOM off-screen when not editing so ProseMirror's
          contenteditable node doesn't float at (0,0) inside the slide canvas. */}
      {!editingElementId && (
        <div style={{ position: 'fixed', left: -9999, top: -9999, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0 }}>
          <EditorContent editor={editor} />
        </div>
      )}
      </div>
    </div>
  )
}
