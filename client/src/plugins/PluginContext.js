// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import registry from './PluginRegistry'
import datasetManager from '../datasets/DatasetManager'

export function createPluginContext(manifest, { getElement, updateElement, getPresentation, showToast }) {
  const disposables = []
  const dispose = (fn) => { disposables.push(fn); return fn }

  const context = Object.freeze({
    manifest: Object.freeze({ ...manifest }),

    element: {
      getData() {
        const el = getElement()
        return el ? JSON.parse(JSON.stringify(el.pluginData || {})) : {}
      },
      updateData(patch) {
        const el = getElement()
        if (!el) return
        updateElement(el.id, { pluginData: { ...el.pluginData, ...patch } })
      },
      getLayout() {
        const el = getElement()
        if (!el) return { x: 0, y: 0, width: 0, height: 0, zIndex: 1, rotation: 0 }
        return { x: el.x, y: el.y, width: el.width, height: el.height, zIndex: el.zIndex || 1, rotation: el.rotation || 0 }
      },
      updateLayout(patch) {
        const el = getElement()
        if (!el) return
        const allowed = {}
        if (patch.x != null) allowed.x = patch.x
        if (patch.y != null) allowed.y = patch.y
        if (patch.width != null) allowed.width = patch.width
        if (patch.height != null) allowed.height = patch.height
        updateElement(el.id, allowed)
      },
      onDataChanged(callback) {
        let prev = JSON.stringify(getElement()?.pluginData || {})
        const check = () => {
          const cur = JSON.stringify(getElement()?.pluginData || {})
          if (cur !== prev) { prev = cur; callback(JSON.parse(cur)) }
        }
        const id = setInterval(check, 200)
        const unsub = () => clearInterval(id)
        dispose(unsub)
        return unsub
      },
    },

    presentation: {
      get id() { return getPresentation()?.id || '' },
      get title() { return getPresentation()?.title || '' },
      get slideWidth() { return getPresentation()?.slideWidth || 960 },
      get slideHeight() { return getPresentation()?.slideHeight || 540 },
      get slideCount() { return (getPresentation()?.slides || []).length },
      getCurrentSlideIndex() { return 0 },
      getPluginElements() {
        const pres = getPresentation()
        if (!pres) return []
        const results = []
        ;(pres.slides || []).forEach((slide, si) => {
          ;(slide.elements || []).forEach(el => {
            if (el.type && el.type.startsWith('plugin:')) {
              results.push({ slideIndex: si, elementId: el.id, data: JSON.parse(JSON.stringify(el.pluginData || {})) })
            }
          })
        })
        return results
      },
    },

    ui: {
      registerCommand(commandId, handler) {
        const unsub = registry.registerCommand(commandId, handler)
        dispose(unsub)
        return unsub
      },
      showToast(message, type = 'info') {
        showToast?.(message, type)
      },
    },

    exports: {
      registerExportHook(config) {
        const elTypes = (manifest.contributes?.elementTypes || []).map(et => et.type)
        for (const et of elTypes) {
          const unsub = registry.registerExportHandler(manifest.id, et, config.handler)
          dispose(unsub)
        }
      },
    },

    data: {
      registerProcessor(config) {
        const unsub = registry.registerDataProcessor(manifest.id, config)
        dispose(unsub)
        return unsub
      },
    },

    datasets: {
      list() {
        return datasetManager.list()
      },
      schema(name) {
        return datasetManager.schema(name)
      },
      async load(name) {
        return datasetManager.load(name)
      },
      async query(name, opts) {
        return datasetManager.query(name, opts)
      },
      onChange(name, callback) {
        const unsub = datasetManager.onChange(name, callback)
        dispose(unsub)
        return unsub
      },
    },

    log: {
      info: (...args) => console.log(`[plugin:${manifest.id}]`, ...args),
      warn: (...args) => console.warn(`[plugin:${manifest.id}]`, ...args),
      error: (...args) => console.error(`[plugin:${manifest.id}]`, ...args),
    },
  })

  return {
    context,
    dispose() { disposables.forEach(fn => fn()) },
  }
}
