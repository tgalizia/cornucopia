# Cornucopia

Cornucopia is a small developer extension for Chrome and other Chromium browsers. Click the toolbar icon and a menu opens at the top-right of the page. Pick a tool and inspect the page in front of you. Click the icon again, or click outside the menu, to close it.

On pages Chrome will not modify (`chrome://`, the Chrome Web Store, and any page that is not `http` or `https`), the same menu opens in a small window.

It runs entirely on your machine. There is no account, no analytics, and no network request.

## Tools

Page tools draw an overlay and a toolbar at the top center, with Exit. They are mutually exclusive. Choosing one turns the previous one off and closes the menu. Choosing it again, pressing Escape, or clicking Exit leaves the tool. Viewport and Clear site data stay in the menu.

- **Typography.** Hover text to read its font, size, weight, style, line-height, letter-spacing, color, alignment, and transform. The card follows the pointer. Click the page to pin it (a green edge marks the pin) so Copy CSS can be clicked. Click the page again and the card follows the pointer. Copy CSS copies a `font` shorthand and the color. Google Docs paints text on a canvas, so Cornucopia asks the editor to expose each text run before the document loads. That hover reading needs Chromium 111 or newer. Reload a Doc once after installing or updating. Until that canvas data is there, hovering the page shows the font at the text cursor. Escape exits while the Doc has keyboard focus.
- **Color.** Move over a pixel to read it; the readout follows the pointer. Click to save it as hex, `rgb()`, and the nearest CSS color name. The toolbar Copy button copies the hex under the pointer. Saved colors show in the menu as a session palette of up to 20. The two newest colors also show a WCAG contrast ratio. Click a swatch to copy its hex. Clear palette drops them. The palette lives in `chrome.storage.session`, so it lasts until you quit the browser (reloading the extension clears it too).
- **Measure.** Element mode outlines the box under the pointer and shows the tag (and id, when it has one), width, height, padding, border, and margin. Rectangle mode lets you drag a free box. The rectangle stays until the next drag or Escape.
- **Grid.** A baseline grid, 8px by default, with a stronger line every 8 steps. While it is on, the toolbar switches it to 4, 12, or 16px. The field beside those takes another size: type it and press Enter. Sizes below 1px become 1, and sizes above 128px become 128. The field stays empty while a preset is selected. Arrow keys nudge the size. The last size stays until the page reloads.
- **Viewport.** Presets resize the window so the page viewport is 375, 390, 768, 1024, 1280, or 1440 pixels wide, keeping the current height. The menu shows the current size and takes a custom width and height. Each side is an integer from 200 to 7680. Clicking the active preset, or Restore, returns the window to its size from before the first resize in this browser session, including a maximized window. On macOS, Viewport stays off while the window is fullscreen, because Chrome cannot put it back.
- **Clear site data.** The first time, Chrome asks for permission to delete browsing data. After that, it deletes cookies for the current site's domain, plus the HTTP cache and Cache Storage for that origin, then reloads the tab. It does not clear other sites, history, or passwords. Chrome clears cookies for the whole registrable domain; cache removal stays on the origin.

The tools inspect the top frame of the page.

## Privacy

Cornucopia does not collect personal data. The full statement is [PRIVACY.md](PRIVACY.md).

- Nothing is uploaded.
- The color palette and the window size to restore are stored only in session storage and are dropped when the browser quits.
- A clear-site confirmation is kept in local storage for up to two minutes, then removed.
- Page styles and pixels are read locally to draw the overlay.
- On Google Docs, a page script asks the editor to keep text positions in the document so Typography can read them. That stays in the tab.
- Clearing site data is limited to the site you confirmed.

## Install

Cornucopia needs Chromium 102 or newer. That includes current Chrome, Edge, Brave, Opera, Arc, and Vivaldi. Firefox is not supported.

```bash
npm install
npm test
npm run build
```

Then load the unpacked extension:

1. Open the extensions page (`chrome://extensions`, or the matching page in your browser).
2. Turn on Developer mode.
3. Choose **Load unpacked** and select the `dist` folder.

`npm run dev` rebuilds while you edit. Click the reload icon on the extension card after a change.

The fixture page in `fixture/index.html` is a convenient surface for the page tools. Serve it over http (the extension does not inject `file://` URLs):

```bash
npx --yes serve fixture
```

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab`, `scripting` | Inject the overlay into the tab you just opened Cornucopia on |
| `https://docs.google.com/*` | Let Typography read fonts in Google Docs. The script runs when a document loads |
| `storage` | Keep the session palette, the window size to restore, and a short-lived clear-site confirmation |
| `windows` | Resize and restore the browser window |
| `browsingData` and site access | Optional. Requested only from **Clear site data**, and only so cookies and cache can be deleted for that site |

## Add a tool

A tool is a folder plus one entry in [`src/tools/registry.js`](src/tools/registry.js).

Page tools export a `mount` function. `ctx.root` is inside a shadow root, so the page's CSS does not affect it. `ctx.signal` aborts when the tool exits. `ctx.isOwnEvent(event)` is true while the pointer is over the overlay.

```js
export function mountNotes(ctx) {
  const note = document.createElement('p')
  note.textContent = 'Hello'
  ctx.root.append(note)
  window.addEventListener('pointermove', () => {}, { signal: ctx.signal })
}

// registry.js
{ id: 'notes', label: 'Notes', kind: 'page', hint: '…', pageHint: 'Esc exits.', mount: mountNotes }
```

Popup tools (`kind: 'popup'`) leave `mount` off, render their controls in [`src/popup/popup.js`](src/popup/popup.js) and [`src/popup/app.js`](src/popup/app.js), and handle their messages in [`src/background/index.js`](src/background/index.js). Rebuild with `npm run build`.

Ideas that fit the same shape, and are not built yet: spacing between two elements, image dimensions on hover, and a design-mode toggle.

## Chrome Web Store

`npm run package` writes `release/cornucopia-<version>.zip`. The zip has `manifest.json` at the root, production scripts, and no source maps. Upload that file in the [developer dashboard](https://chrome.google.com/webstore/devconsole).

The dashboard also needs the listing copy in [`store/LISTING.md`](store/LISTING.md), one screenshot, and this privacy policy: [PRIVACY.md](PRIVACY.md). Publishing needs a Chrome Web Store developer account. The extension does not phone home either way.

## License

[MIT](LICENSE)
