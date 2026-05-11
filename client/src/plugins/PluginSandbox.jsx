// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useRef, useEffect, useCallback } from 'react'

export default function PluginSandbox({ sandboxUrl, pluginData, width, height, isSelected, onDataUpdate }) {
  const iframeRef = useRef(null)
  const dataRef = useRef(pluginData)
  dataRef.current = pluginData

  const postToSandbox = useCallback((type, payload) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'parallax-host', type, payload }, '*')
  }, [])

  useEffect(() => {
    postToSandbox('data-changed', pluginData || {})
  }, [pluginData, postToSandbox])

  useEffect(() => {
    postToSandbox('resize', { width, height })
  }, [width, height, postToSandbox])

  useEffect(() => {
    const handler = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      const msg = e.data
      if (!msg || msg.source !== 'parallax-sandbox') return

      switch (msg.type) {
        case 'update-data':
          onDataUpdate?.(msg.payload)
          break
        case 'ready':
          postToSandbox('init', {
            data: dataRef.current || {},
            width,
            height,
          })
          break
        case 'error':
          console.error(`[plugin-sandbox] ${msg.payload}`)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [width, height, postToSandbox, onDataUpdate])

  // inject the bridge script into the sandbox HTML
  const bridgeSrc = `
<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>
<script>
(function(){
  var _data = {};
  var _width = ${width};
  var _height = ${height};
  var _dataCallbacks = [];
  var _resizeCallbacks = [];
  var _snapshotCallback = null;

  window.parallax = Object.freeze({
    get data() { return JSON.parse(JSON.stringify(_data)); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      window.parent.postMessage({ source: 'parallax-sandbox', type: 'update-data', payload: patch }, '*');
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function(cb) { _resizeCallbacks.push(cb); },
    onCaptureSnapshot: function(cb) { _snapshotCallback = cb; },
    reportError: function(msg) {
      window.parent.postMessage({ source: 'parallax-sandbox', type: 'error', payload: msg }, '*');
    },
    fetch: function(url, opts) { return window.fetch(url, opts); }
  });

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || msg.source !== 'parallax-host') return;
    if (msg.type === 'init' || msg.type === 'data-changed') {
      _data = msg.payload.data || msg.payload;
      _dataCallbacks.forEach(function(cb) { cb(JSON.parse(JSON.stringify(_data))); });
    }
    if (msg.type === 'resize') {
      _width = msg.payload.width;
      _height = msg.payload.height;
      _resizeCallbacks.forEach(function(cb) { cb(_width, _height); });
    }
    if (msg.type === 'capture-snapshot' && _snapshotCallback) {
      Promise.resolve(_snapshotCallback(msg.payload || {})).then(function(result) {
        window.parent.postMessage({ source: 'parallax-sandbox', type: 'snapshot-result', payload: result }, '*');
      });
    }
  });

  window.parent.postMessage({ source: 'parallax-sandbox', type: 'ready' }, '*');
})();
<\/script>
</head><body></body></html>`

  const srcdoc = sandboxUrl
    ? undefined
    : bridgeSrc

  if (!sandboxUrl && !pluginData) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(99,102,241,0.06)', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif',
      }}>
        Plugin element
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={sandboxUrl || undefined}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{
        width: '100%', height: '100%', border: 'none', display: 'block', background: 'transparent',
        pointerEvents: isSelected ? 'auto' : 'none',
      }}
      title="Plugin sandbox"
    />
  )
}
