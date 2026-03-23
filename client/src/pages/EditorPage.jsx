import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ChevronLeft, Play, Download, MessageSquare, Github, Settings, Check, X } from 'lucide-react'
import { api } from '../utils/api'
import { downloadHTML, presentInWindow, exportPDF } from '../utils/generateHTML'
import Toolbar from '../components/Toolbar'
import SlidePanel from '../components/SlidePanel'
import SlideCanvas from '../components/SlideCanvas'
import PropertiesPanel from '../components/PropertiesPanel'
import { MathNode } from '../extensions/MathExtension'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
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
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

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

export default function EditorPage({ presentationId, onGoHome }) {
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
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '', hasToken: false })
  const [githubToken, setGithubToken] = useState('')
  const [githubPushing, setGithubPushing] = useState(false)
  const [githubStatus, setGithubStatus] = useState(null) // { type: 'success'|'error', message }

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

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])

  // Load presentation on mount
  useEffect(() => {
    if (!presentationId) return
    api.getPresentation(presentationId).then(data => {
      // Migrate old slide format to new elements-based format
      const migrated = {
        ...data,
        slides: (data.slides || []).map(migrateSlide)
      }
      setPresentation(migrated)
      if (migrated.gridSize) setGridSize(migrated.gridSize)
      setLoading(false)
      isFirstLoad.current = true
    }).catch(err => {
      console.error('Failed to load presentation', err)
      setLoading(false)
    })
  }, [presentationId])

  // Load GitHub config on mount
  useEffect(() => {
    api.getGithubConfig().then(setGithubConfig).catch(() => {})
  }, [])

  const handleGithubSaveConfig = async () => {
    const data = { owner: githubConfig.owner, repo: githubConfig.repo }
    if (githubToken) data.token = githubToken
    const result = await api.saveGithubConfig(data)
    setGithubConfig(result)
    setGithubToken('')
  }

  const handleGithubPush = async () => {
    setGithubPushing(true)
    setGithubStatus(null)
    try {
      const result = await api.pushToGithub(presentationId)
      setGithubStatus({ type: 'success', message: 'Pushed to GitHub', url: result.url })
    } catch (err) {
      setGithubStatus({ type: 'error', message: err.message })
    } finally {
      setGithubPushing(false)
    }
  }

  const currentSlide = presentation?.slides[currentSlideIndex]

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
        await api.updatePresentation(presentation.id, presentation)
        setSaveStatus('saved')
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
      content: '<p>New text</p>'
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

  const DEFAULT_HTML = `<script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>
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

  const addHtmlElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: 80, y: 80, width: 500, height: 380, zIndex: 2,
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

  const addShapeElement = useCallback((shape) => {
    const defaults = { line: { width: 300, height: 40 }, circle: { width: 200, height: 200 } }
    const dim = defaults[shape] || { width: 200, height: 150 }
    const newEl = {
      id: crypto.randomUUID(),
      type: 'shape',
      shape,
      x: (960 - dim.width) / 2,
      y: (540 - dim.height) / 2,
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

  // Cut / copy / paste / duplicate keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingElementId) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      const element = selectedElementId
        ? presentation?.slides[currentSlideIndex]?.elements?.find(el => el.id === selectedElementId)
        : null
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
          x: Math.min((clipboard.x || 0) + 20, 960 - (clipboard.width || 100)),
          y: Math.min((clipboard.y || 0) + 20, 540 - (clipboard.height || 100))
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
          x: Math.min((element.x || 0) + 20, 960 - (element.width || 100)),
          y: Math.min((element.y || 0) + 20, 540 - (element.height || 100))
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
        const hist = historyRef.current
        if (hist.length < 2) return
        applyingUndoRef.current = true
        // Save current to redo stack before undoing
        redoStackRef.current = [...redoStackRef.current.slice(-19), hist[hist.length - 1]]
        const newHist = hist.slice(0, -1)
        historyRef.current = newHist
        const prevState = newHist[newHist.length - 1]
        setPresentation(prevState)
        setCurrentSlideIndex(ci => Math.min(ci, prevState.slides.length - 1))
        e.preventDefault()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        const stack = redoStackRef.current
        if (!stack.length) return
        applyingUndoRef.current = true
        const redoState = stack[stack.length - 1]
        redoStackRef.current = stack.slice(0, -1)
        if (presentation) historyRef.current = [...historyRef.current.slice(-49), JSON.parse(JSON.stringify(presentation))]
        setPresentation(redoState)
        setCurrentSlideIndex(ci => Math.min(ci, redoState.slides.length - 1))
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedElementId, editingElementId, clipboard, presentation, currentSlideIndex, deleteElement])

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

  const selectedElement = currentSlide?.elements?.find(el => el.id === selectedElementId) || null

  const toggleElementSelection = useCallback((id, multi = false) => {
    if (!id) { setSelectedElementIds([]); return }
    if (multi) {
      setSelectedElementIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      setSelectedElementIds([id])
    }
  }, [])

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

  const addSlide = (templateKey = null) => {
    const template = templateKey && SLIDE_TEMPLATES[templateKey] ? SLIDE_TEMPLATES[templateKey] : null
    const baseElements = template
      ? template.elements.map(el => ({ ...el, id: crypto.randomUUID() }))
      : [{ id: crypto.randomUUID(), type: 'text', x: 80, y: 160, width: 800, height: 220, zIndex: 1, content: '<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>' }]
    const newSlide = { id: crypto.randomUUID(), elements: baseElements, notes: '', background: { type: 'color', color: '#1e1e2e' } }
    setPresentation(prev => ({ ...prev, slides: [...prev.slides, newSlide] }))
    setCurrentSlideIndex(presentation.slides.length)
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
        <input
          className="title-input"
          value={presentation.title || ''}
          onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Untitled Presentation"
        />
        <div className="header-controls">
          {saveStatus === 'saving' && <span className="save-indicator">Saving...</span>}
          {saveStatus === 'saved' && <span className="save-indicator" style={{ color: 'var(--success)' }}>Saved</span>}

          <select
            className="select-sm"
            value={presentation.theme || 'black'}
            onChange={e => setPresentation(prev => ({ ...prev, theme: e.target.value }))}
            title="Theme"
          >
            {THEMES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          <select
            className="select-sm"
            value={presentation.transition || 'slide'}
            onChange={e => setPresentation(prev => ({ ...prev, transition: e.target.value }))}
            title="Transition"
          >
            {TRANSITIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          <select
            className="select-sm"
            value={presentation.codeTheme || 'monokai'}
            onChange={e => setPresentation(prev => ({ ...prev, codeTheme: e.target.value }))}
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

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={presentation.showPresentGrid || false}
              onChange={e => setPresentation(prev => ({ ...prev, showPresentGrid: e.target.checked }))}
              style={{ accentColor: 'var(--accent)' }} />
            Grid
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={presentation.showFooter || false}
              onChange={e => setPresentation(prev => ({ ...prev, showFooter: e.target.checked }))}
              style={{ accentColor: 'var(--accent)' }} />
            Footer
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={presentation.showPageNumbers || false}
              onChange={e => setPresentation(prev => ({ ...prev, showPageNumbers: e.target.checked }))}
              style={{ accentColor: 'var(--accent)' }} />
            Page #
          </label>

          {presentation.showPageNumbers && (
            <select
              className="select-sm"
              value={presentation.pageNumberFormat || 'c/t'}
              onChange={e => setPresentation(prev => ({ ...prev, pageNumberFormat: e.target.value }))}
              title="Page number format"
            >
              <option value="c">1</option>
              <option value="c/t">1 / 10</option>
            </select>
          )}


          <button
            className="btn btn-secondary"
            onClick={() => exportPDF(presentation)}
            title="Export PDF"
          >
            <Download size={14} />
            PDF
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => downloadHTML(presentation)}
            title="Export HTML"
          >
            <Download size={14} />
            HTML
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => presentInWindow(presentation)}
            title="Present then press S for speaker notes view"
          >
            <MessageSquare size={14} />
            Speaker
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowGithubModal(true)}
            title="Save to GitHub"
          >
            <Github size={14} />
            GitHub
          </button>

          <button
            className="btn btn-primary"
            onClick={() => presentInWindow(presentation)}
            title="Present"
          >
            <Play size={14} />
            Present
          </button>
        </div>
      </div>

      {/* GitHub Modal */}
      {showGithubModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGithubModal(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Save to GitHub</h3>
              <button className="btn btn-ghost" onClick={() => setShowGithubModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Repository Owner</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.owner}
                  onChange={e => setGithubConfig(prev => ({ ...prev, owner: e.target.value }))}
                  placeholder="username or org"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Repository Name</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.repo}
                  onChange={e => setGithubConfig(prev => ({ ...prev, repo: e.target.value }))}
                  placeholder="my-presentations"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Personal Access Token {githubConfig.hasToken && <span style={{ color: 'var(--success)' }}>(saved)</span>}
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder={githubConfig.hasToken ? '••••••••  (leave blank to keep)' : 'ghp_...'}
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

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

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
                  background: githubStatus.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: githubStatus.type === 'success' ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)',
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

      {/* Editor Body */}
      <div className="editor-body">
        <SlidePanel
          slides={presentation.slides}
          currentIndex={currentSlideIndex}
          onSelect={setCurrentSlideIndex}
          onAdd={() => setShowTemplateModal(true)}
          onDelete={deleteSlide}
          onDuplicate={duplicateSlide}
          onMove={moveSlide}
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
            onAddImage={() => {
              const url = window.prompt('Image URL:')
              if (url) addImageElement(url)
            }}
            onAddImageUpload={async (file) => {
              const result = await api.uploadFile(file)
              if (result.url) addImageElement(result.url)
            }}

            onAddShape={addShapeElement}
            onAddHtml={addHtmlElement}
            onAddCode={addCodeElement}
            selectedCount={selectedElementIds.length}
            onAlignElements={alignElements}
          />
          <div className="canvas-area" style={{ display: 'flex', flexDirection: 'column' }}>
            <SlideCanvas
              editor={editor}
              slide={currentSlide}
              selectedElementIds={selectedElementIds}
              editingElementId={editingElementId}
              showGrid={showGrid}
              gridSize={gridSize}
              showFooter={presentation.showFooter || false}
              showPageNumbers={presentation.showPageNumbers || false}
              pageNumberFormat={presentation.pageNumberFormat || 'c/t'}
              pageNumber={currentSlideIndex + 1}
              totalSlides={presentation.slides.length}
              sectionName={currentSlide?.section || ''}
              footerFontSize={presentation.footerFontSize || 14}
              footerFontFamily={presentation.footerFontFamily || '-apple-system,sans-serif'}
              footerColor={presentation.footerColor || 'rgba(255,255,255,0.65)'}
              onToggleSelectElement={toggleElementSelection}
              onStartEdit={startEditingElement}
              onStopEdit={stopEditingElement}
              onUpdateElement={updateElement}
              onUpdateElements={updateElements}
              onDeleteElement={deleteElement}
              onDeleteSelectedElements={deleteSelectedElements}
              onOpenHtmlEditor={openHtmlEditor}
              onOpenCodeEditor={openCodeEditor}
              onAddImage={async (file, dropX, dropY) => {
                const result = await api.uploadFile(file)
                if (result.url) addImageElement(result.url, dropX, dropY)
              }}
            />
          </div>
        </div>

        <PropertiesPanel
          slide={currentSlide}
          selectedElement={selectedElement}
          onUpdateSlide={updateCurrentSlide}
          onUpdateElement={(updates) => selectedElementId && updateElement(selectedElementId, updates)}
          onDeleteElement={() => selectedElementId && deleteElement(selectedElementId)}
          onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
          onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
          onEditHtml={() => selectedElementId && openHtmlEditor(selectedElementId)}
          onEditCode={() => selectedElementId && openCodeEditor(selectedElementId)}
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation(prev => ({ ...prev, ...updates }))}
          selectedElementIds={selectedElementIds}
          onDeleteSelectedElements={deleteSelectedElements}
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
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
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
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h2 style={{ marginBottom: 16 }}>Add Slide</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {Object.entries(SLIDE_TEMPLATES).map(([key, tmpl]) => (
                <button key={key}
                  onClick={() => { addSlide(key); setShowTemplateModal(false) }}
                  style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 8, padding: 12, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                >
                  <div style={{ height: 70, background: '#1e1e2e', borderRadius: 4, marginBottom: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {key === 'blank' && <span style={{ fontSize: 24, opacity: 0.4 }}>□</span>}
                    {key === 'title' && <div style={{textAlign:'center'}}><div style={{fontSize:10,fontWeight:700,color:'white',marginBottom:4}}>─────────</div><div style={{fontSize:8,color:'#aaa'}}>─────</div></div>}
                    {key === 'two-column' && <div style={{display:'flex',gap:4,width:'80%',height:'60%'}}><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></div>}
                    {key === 'image-text' && <div style={{display:'flex',gap:4,width:'80%',height:'60%'}}><div style={{flex:1,background:'rgba(99,102,241,0.3)',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🖼</div><div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:2}}/></div>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{tmpl.label}</div>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
