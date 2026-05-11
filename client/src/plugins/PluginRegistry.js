// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const PLUGIN_TYPE_PREFIX = 'plugin:'

class PluginRegistry {
  constructor() {
    this._plugins = new Map()
    this._elementTypes = new Map()
    this._toolbarItems = []
    this._propertyPanels = new Map()
    this._exportHooks = new Map()
    this._dataProcessors = new Map()
    this._commands = new Map()
    this._listeners = new Set()
  }

  register(manifest) {
    if (this._plugins.has(manifest.id)) return
    this._plugins.set(manifest.id, { manifest, instance: null, activated: false })

    const contributes = manifest.contributes || {}

    if (contributes.elementTypes) {
      for (const et of contributes.elementTypes) {
        const fullType = PLUGIN_TYPE_PREFIX + et.type
        this._elementTypes.set(fullType, { ...et, pluginId: manifest.id, fullType })
      }
    }

    if (contributes.toolbarItems) {
      for (const item of contributes.toolbarItems) {
        this._toolbarItems.push({ ...item, pluginId: manifest.id })
      }
    }

    if (contributes.propertyPanels) {
      for (const panel of contributes.propertyPanels) {
        const fullType = PLUGIN_TYPE_PREFIX + panel.elementType
        this._propertyPanels.set(fullType, { ...panel, pluginId: manifest.id })
      }
    }

    if (contributes.exportHooks) {
      for (const hook of contributes.exportHooks) {
        this._exportHooks.set(hook.id, { ...hook, pluginId: manifest.id })
      }
    }

    if (contributes.dataProcessors) {
      for (const proc of contributes.dataProcessors) {
        this._dataProcessors.set(proc.id, { ...proc, pluginId: manifest.id })
      }
    }

    this._notify()
  }

  unregister(pluginId) {
    const entry = this._plugins.get(pluginId)
    if (!entry) return
    const contributes = entry.manifest.contributes || {}

    if (contributes.elementTypes) {
      for (const et of contributes.elementTypes) {
        this._elementTypes.delete(PLUGIN_TYPE_PREFIX + et.type)
      }
    }
    if (contributes.toolbarItems) {
      this._toolbarItems = this._toolbarItems.filter(i => i.pluginId !== pluginId)
    }
    if (contributes.propertyPanels) {
      for (const panel of contributes.propertyPanels) {
        this._propertyPanels.delete(PLUGIN_TYPE_PREFIX + panel.elementType)
      }
    }
    if (contributes.exportHooks) {
      for (const hook of contributes.exportHooks) this._exportHooks.delete(hook.id)
    }
    if (contributes.dataProcessors) {
      for (const proc of contributes.dataProcessors) this._dataProcessors.delete(proc.id)
    }

    this._plugins.delete(pluginId)
    this._notify()
  }

  setInstance(pluginId, instance) {
    const entry = this._plugins.get(pluginId)
    if (entry) entry.instance = instance
  }

  markActivated(pluginId) {
    const entry = this._plugins.get(pluginId)
    if (entry) entry.activated = true
  }

  registerCommand(commandId, handler) {
    this._commands.set(commandId, handler)
    return () => this._commands.delete(commandId)
  }

  executeCommand(commandId) {
    const handler = this._commands.get(commandId)
    if (handler) return handler()
  }

  registerExportHandler(pluginId, elementType, handler) {
    const fullType = PLUGIN_TYPE_PREFIX + elementType
    this._exportHooks.set(fullType, { pluginId, handler })
    return () => this._exportHooks.delete(fullType)
  }

  registerDataProcessor(pluginId, config) {
    this._dataProcessors.set(config.id, { ...config, pluginId })
    return () => this._dataProcessors.delete(config.id)
  }

  // --- Queries ---

  getPlugin(pluginId) {
    return this._plugins.get(pluginId) || null
  }

  getPluginForElement(elementType) {
    const et = this._elementTypes.get(elementType)
    return et ? this._plugins.get(et.pluginId) || null : null
  }

  isPluginType(elementType) {
    return typeof elementType === 'string' && elementType.startsWith(PLUGIN_TYPE_PREFIX)
  }

  getElementType(fullType) {
    return this._elementTypes.get(fullType) || null
  }

  getAllElementTypes() {
    return Array.from(this._elementTypes.values())
  }

  getToolbarItems() {
    return [...this._toolbarItems]
  }

  getPropertyPanel(elementType) {
    return this._propertyPanels.get(elementType) || null
  }

  getExportHandler(elementType) {
    return this._exportHooks.get(elementType) || null
  }

  getDataProcessorsForFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase()
    return Array.from(this._dataProcessors.values()).filter(p => p.accepts.includes(ext))
  }

  getAllPlugins() {
    return Array.from(this._plugins.values()).map(e => e.manifest)
  }

  // --- Change notification ---

  subscribe(listener) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  _notify() {
    for (const fn of this._listeners) fn()
  }
}

const registry = new PluginRegistry()

export default registry
export { PLUGIN_TYPE_PREFIX }
