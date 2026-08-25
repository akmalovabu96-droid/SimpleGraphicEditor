# Canvas Foundry

Canvas Foundry is a lightweight browser-based drawing and pixel editor. It uses the native HTML5 Canvas API and runs entirely in the browser without a framework or backend. The interface is currently localized in Uzbek.

## Contents

- [What it does](#what-it-does)
- [Run locally](#run-locally)
- [How to use](#how-to-use)
- [Tools](#tools)
- [Menus and shortcuts](#menus-and-shortcuts)
- [Import and export](#import-and-export)
- [Naming and local saving](#naming-and-local-saving)
- [History model](#history-model)
- [Project structure](#project-structure)
- [Technical notes](#technical-notes)
- [Limitations](#limitations)

## What it does

The editor provides a focused workspace for creating simple illustrations, icons, pixel sketches, and quick image edits.

- Draw on an 800 x 600 pixel HTML5 Canvas.
- Use a freehand brush with a configurable size from 1 to 80 pixels.
- Draw lines, rectangles, and ellipses.
- Erase using transparent strokes.
- Fill a contiguous area with the selected color.
- Pick a visible color from the artwork with the Uzbek `Rang tanlovchi` tool.
- Choose colors with the native color picker or quick color swatches.
- Undo and redo drawing mutations.
- Import PNG, JPEG, or WebP images.
- Export artwork as PNG or JPEG.
- Save the current artwork and document name in browser local storage.
- Toggle the checkerboard canvas grid.
- Use the responsive interface on desktop and mobile screens.

## Run locally

### Requirements

- Node.js and npm for the supplied start script.
- A modern browser with Canvas API and local storage support.

### Start the editor

From the project root:

```powershell
npm start
```

The script runs `npx serve .` and prints a local URL, normally `http://localhost:3000`. Open that URL in a browser.

The project has no application dependencies and no build step. The first `npm start` may ask `npx` to download the small `serve` command-line server. For a dependency-free temporary preview, use Python instead:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

Opening `index.html` directly with `file:` also works for the editor itself, although a local HTTP server is preferable for browser testing.

## How to use

1. Select a tool in the left `Asboblar` panel.
2. Set the brush size with the size slider.
3. Choose a color from `Rang` or one of the quick swatches.
4. Draw on the central canvas. The `Jonli kuzatuv` preview updates as the artwork changes.
5. Rename the document by editing the title above the canvas.
6. Use `Fayl` to import, save locally, start a new canvas, or export.
7. Use `Orqaga qaytish` and `Qayta bajarish` when you need to navigate the edit history.

The canvas is scaled visually to fit the workspace, but its drawing coordinate space remains 800 x 600 pixels. Pointer coordinates are converted back to that fixed coordinate space before drawing.

## Tools

| Tool         | Uzbek label            | Shortcut | Behavior                                                                  |
| ------------ | ---------------------- | -------- | ------------------------------------------------------------------------- |
| Brush        | `Cho'tka`              | `B`      | Draws rounded strokes in the selected color.                              |
| Eraser       | `O'chirg'ich`          | `E`      | Removes pixels using the `destination-out` composite mode.                |
| Line         | `Chiziq`               | `L`      | Draws a straight line between the drag start and end points.              |
| Rectangle    | `To'g'ri to'rtburchak` | `R`      | Draws an outlined rectangle.                                              |
| Ellipse      | `Ellips`               | `O`      | Draws an outlined ellipse.                                                |
| Fill         | `To'ldirish`           | `F`      | Fills a contiguous region with the selected color.                        |
| Color picker | `Rang tanlovchi`       | `I`      | Reads a visible color from the canvas and applies it to the active color. |

Shape tools render a temporary shape while dragging, then commit one final mutation when the pointer is released. This keeps shape drawing predictable in the history stack.

## Menus and shortcuts

### `Fayl` (File)

- `Yangi xolst` (`Ctrl/Cmd + N`) creates a blank canvas and resets the history.
- `Rasmni import qilish` (`Ctrl/Cmd + O`) opens the system file picker for PNG, JPEG, and WebP files.
- `Mahalliy saqlash` (`Ctrl/Cmd + S`) saves the current name and artwork to local storage.
- `PNG sifatida eksport qilish` downloads a PNG.
- `JPEG sifatida eksport qilish` downloads a JPEG using the selected quality.

### `Tahrirlash` (Edit)

- `Orqaga qaytish` (`Ctrl/Cmd + Z`) undoes the latest drawing command.
- `Qayta bajarish` (`Ctrl/Cmd + Shift + Z`) re-applies the latest undone command.
- `Xolstni tozalash` clears the artwork and records the clear operation.

### `Ko'rinish` (View)

- `Canvas panjarasi` toggles the checkerboard background. It changes only the workspace appearance and does not alter exported pixels.

### `Yordam` (Help)

Displays a short list of drawing tool shortcuts.

## Import and export

### Import

Imported images are scaled proportionally to fit inside the 800 x 600 canvas and centered. Importing replaces the current visible artwork and is stored as one undoable command.

### Export

The right `Eksport` panel supports:

- PNG, which preserves transparency.
- JPEG, with quality from 10% to 100%.

The downloaded filename is generated from the document title. For example, `Mening rasmim 01` becomes `Mening-rasmim-01.png`. Unsupported filename characters are removed and spaces are converted to hyphens.

## Naming and local saving

The title above the canvas is an editable document name:

- Press `Enter` or click elsewhere to commit a name.
- Press `Escape` to cancel the current edit.
- An empty name falls back to `Sarlavhasiz xolst`.
- Drawing changes are automatically serialized to local storage through the history update path.
- `Ctrl/Cmd + S` explicitly saves the name and current PNG data.
- Reloading the page restores the last saved name and artwork in the same browser profile.

Saved data is local to the browser and device. It is not uploaded to a server and is not shared between different browsers or private browsing sessions.

## History model

Drawing mutations use the Command pattern in `app.js`:

- `DrawingCommand` stores an image snapshot before and after a mutation.
- `CommandHistory` owns the undo and redo stacks.
- Brush strokes, erasing, shapes, fill, import, and clear operations are undoable.
- Executing a new command clears the redo stack.
- Undo and redo also refresh the live preview.

Snapshots use `getImageData()` and `putImageData()`. The main context is created with `willReadFrequently: true` because history and color picking read pixels often.

## Project structure

```text
Canvas Foundry/
├── index.html
├── styles.css
├── app.js
├── package.json
├── README.md
├── .gitignore
└── .github/
	└── copilot-instructions.md
```

### `index.html`

Defines the application layout, Uzbek labels, menu bar, tool controls, drawing canvas, live preview canvas, import input, and export controls.

### `styles.css`

Contains the visual system, responsive layout, menu dropdowns, tool states, canvas checkerboard, editable document title, and custom brand mark.

### `app.js`

Contains all interactions: pointer drawing, shape previews, fill algorithm, color picking, Command-pattern history, live preview synchronization, import, export, document naming, keyboard shortcuts, and local persistence.

### `package.json`

Provides the `npm start` script. The application itself does not require a package installation or bundler.

## Technical notes

- The main canvas and preview canvas both use an 800 x 600 internal resolution.
- The preview is updated with `drawImage(canvas, 0, 0)` after drawing, history restoration, import, and clear actions.
- The color picker samples a small neighborhood and chooses the most opaque pixel. This makes selection more reliable around anti-aliased edges.
- Transparent sampled pixels are composited against white before being converted to HEX, so the selected color matches what the user visually sees on the light canvas background.
- The fill tool uses a stack-based contiguous-region flood fill and compares exact RGBA values.
- No external image assets or backend services are required.

## Limitations

- The canvas size is currently fixed at 800 x 600 pixels.
- Shapes are outline-only; filled shape modes are not currently exposed.
- The fill tool uses exact pixel matching, so anti-aliased boundaries can produce small edge differences.
- Local storage capacity limits how much artwork can be retained by the browser.
- There is no multi-layer system, selection tool, crop tool, text tool, or collaborative editing yet.

## Customization

To change the visual identity, edit the `.brand-mark` element in `index.html` and its rules in `styles.css`. The app behavior should remain in `app.js`, visual styling in `styles.css`, and drawing mutations should continue to pass through the Command-pattern history.
