import { Node } from '@tiptap/core'
import katex from 'katex'

export const MathNode = Node.create({
  name: 'mathNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex:    { default: '' },
      display:  { default: false },
      fontSize: { default: null },
      color:    { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-math-latex]', getAttrs: el => ({
      latex:    el.getAttribute('data-math-latex'),
      display:  el.getAttribute('data-math-display') === 'true',
      fontSize: el.getAttribute('data-math-fontsize') || null,
      color:    el.getAttribute('data-math-color') || null,
    })}]
  },

  renderHTML({ node }) {
    return ['span', {
      'data-math-latex':    node.attrs.latex,
      'data-math-display':  String(node.attrs.display),
      'data-math-fontsize': node.attrs.fontSize || '',
      'data-math-color':    node.attrs.color || '',
      class: `math-node ${node.attrs.display ? 'math-display' : 'math-inline'}`
    }]
  },

  addNodeView() {
    return ({ node, updateAttributes }) => {
      const dom = document.createElement('span')
      dom.classList.add('math-node', node.attrs.display ? 'math-display' : 'math-inline')

      const applyStyle = (fontSize, color) => {
        dom.style.fontSize = fontSize || ''
        dom.style.color    = color    || ''
      }

      const render = (latex, display, fontSize, color) => {
        try {
          dom.innerHTML = ''
          applyStyle(fontSize, color)
          katex.render(latex, dom, { throwOnError: false, displayMode: display })
          dom.setAttribute('data-math-latex',    latex)
          dom.setAttribute('data-math-display',  String(display))
          dom.setAttribute('data-math-fontsize', fontSize || '')
          dom.setAttribute('data-math-color',    color    || '')
        } catch(e) {
          dom.textContent = `$${latex}$`
        }
      }
      render(node.attrs.latex, node.attrs.display, node.attrs.fontSize, node.attrs.color)

      dom.style.cursor = 'pointer'
      dom.title = 'Click to edit LaTeX in the properties panel'

      // Fire a custom event instead of opening a prompt — EditorPage picks this up
      // and surfaces the editor in the properties panel.
      dom.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        dom.dispatchEvent(new CustomEvent('math-node-edit', {
          bubbles: true,
          detail: {
            latex:    node.attrs.latex,
            display:  node.attrs.display,
            fontSize: node.attrs.fontSize || '',
            color:    node.attrs.color || '',
            update:   (attrs) => updateAttributes(attrs),
          }
        }))
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mathNode') return false
          render(updatedNode.attrs.latex, updatedNode.attrs.display, updatedNode.attrs.fontSize, updatedNode.attrs.color)
          return true
        }
      }
    }
  },

  addCommands() {
    return {
      insertMath: (latex, display = false) => ({ commands, editor }) => {
        const style = editor.getAttributes('textStyle')
        return commands.insertContent({
          type: this.name,
          attrs: {
            latex,
            display,
            fontSize: style.fontSize || null,
            color:    style.color    || null,
          }
        })
      }
    }
  }
})
