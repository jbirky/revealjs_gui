import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'

export default function App() {
  const [page, setPage] = useState('home')
  const [presentationId, setPresentationId] = useState(null)
  const [isTemplate, setIsTemplate] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('editor-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
    localStorage.setItem('editor-theme', theme)
  }, [theme])

  const openEditor = (id, template = false) => { setPresentationId(id); setIsTemplate(template); setPage('editor') }
  const goHome = () => { setPage('home'); setPresentationId(null); setIsTemplate(false) }

  return page === 'home'
    ? <HomePage onOpen={openEditor} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
    : <EditorPage presentationId={presentationId} isTemplate={isTemplate} onGoHome={goHome} />
}
