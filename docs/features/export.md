# Export & Sharing

Parallax supports multiple export formats so you can share your presentation in any context — live on the web, offline at a conference, or embedded in a document.

## HTML export (standalone)

The default HTML export produces a **self-contained `.html` file** that loads reveal.js and other assets from a CDN.

- Open your presentation in the editor.
- Click **File → Export → HTML**.
- Save the `.html` file to your computer.
- Open the file in any browser to present.

::: tip
Standalone HTML is the smallest file format because assets are fetched from a CDN at runtime. Use it when you expect an internet connection.
:::

## Offline HTML

Offline HTML inlines all external CSS, JavaScript, and font assets so the file works **without any internet connection**.

- Click **File → Export → Offline HTML**.
- The export process downloads all CDN assets and inlines them — this may take a few seconds.
- The resulting file is self-contained and can be copied to a USB drive or shared by email.

::: tip
Use offline HTML when presenting at a conference venue where Wi-Fi may be unreliable, or when distributing slides to students.
:::

## PDF

Export a **print-ready PDF** using the browser's print dialog with reveal.js print styles applied.

- Click **File → Export → PDF**.
- The editor opens a print-optimized view in a new tab with all fragments expanded.
- Use **Ctrl+P** (or Cmd+P) and choose "Save as PDF" in the print dialog.
- Set margins to "None" for best results.

::: warning
PDF export relies on the browser's print engine. Complex layouts, custom fonts, or TikZ diagrams may render slightly differently than on-screen. Check the print preview before finalizing.
:::

## PPTX (PowerPoint)

Export a **PowerPoint-compatible `.pptx` file** for editing in Microsoft Office, Google Slides, or LibreOffice Impress.

- Click **File → Export → PPTX**.
- Text, images, and basic shapes are exported as editable PowerPoint elements.
- Complex elements (LaTeX blocks, charts) are rasterized as images in the PPTX.

## Shareable links

Generate a **shareable URL** that others can open to view (or edit) your presentation directly in their browser — no installation required.

- Click **Share → Get Link**.
- Choose **View only** or **Editable**.
- Copy and share the URL.

::: tip
Shareable links require your Parallax instance to be accessible from the internet (or your local network). If running locally behind a firewall, share the exported HTML file instead.
:::

## GitHub push

Push your presentation file directly to a **GitHub repository**.

1. Click **File → Publish to GitHub**.
2. Authenticate with GitHub (OAuth or personal access token).
3. Choose the repository and branch.
4. Enter a commit message.
5. Click **Push**.

The presentation is saved as a `.json` file in the repository. You can also push the exported HTML to enable GitHub Pages hosting of your slides.
