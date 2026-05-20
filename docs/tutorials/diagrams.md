# Diagram Editor

The diagram editor lets you create flowcharts, system diagrams, and other schematic illustrations directly inside Parallax without needing an external tool.

## Opening the diagram editor

1. Click the **Embed** dropdown in the toolbar.
2. Select **Diagram**.

The diagram editor opens as a full-screen modal with a dark canvas and a tool panel on the left.

## Adding shapes

1. Click a shape tool in the left panel: **Rectangle**, **Rounded Rect**, **Circle**, or **Diamond**.
2. Click anywhere on the canvas to place the shape.
3. The tool switches back to **Select / Move** automatically after placing a shape.

## Adding text labels

- **Double-click** a shape to type a label directly on the canvas.
- Or select a shape and type in the **Label** field in the left panel.

Press Enter or click away to confirm.

## Connecting shapes with arrows

1. Click the **Arrow** tool in the left panel.
2. Click the **source** shape (it highlights white).
3. Click the **target** shape.

An arrow is drawn between the two shapes. Arrows automatically connect to the nearest edge of each shape and update when shapes are moved.

## Styling shapes

Before placing a shape, choose colors from the **Style** section:

- **Fill** — the shape's background color (click the hatched button for no fill)
- **Stroke** — the shape's border color

To restyle an existing shape, select it, then click **Apply colors** in the Selected section.

## Moving and editing shapes

- Click a shape to select it (white highlight)
- Drag to move it
- Double-click to edit its label
- Click **Delete** in the left panel to remove it

## Inserting the diagram

Click **Insert Diagram** in the top-right corner. The diagram is inserted as an SVG element on the current slide. You can resize and reposition it like any other element.

::: tip
The exported SVG has a transparent background, so it works on any slide background color. Shape colors are preserved exactly as you set them.
:::

## Example use cases

- Software architecture diagrams
- Process flowcharts
- Decision trees
- Network topology diagrams
- Concept maps
