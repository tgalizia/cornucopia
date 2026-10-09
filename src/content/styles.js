export const overlayCss = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }

.root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #e8eef6;
  font: 12px/1.35 ui-sans-serif, system-ui, sans-serif;
  user-select: none;
}

.toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  align-items: center;
  max-width: calc(100% - 16px);
  padding: 4px;
  background: #10151c;
  color: #e8eef6;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  pointer-events: auto;
}

.toolbar-title {
  padding: 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.toolbar button {
  appearance: none;
  border: 0;
  background: transparent;
  color: #e8eef6;
  font: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}

.toolbar button:hover,
.toolbar button.is-active {
  background: #3ee0a0;
  color: #10151c;
}

.toolbar button.exit { color: #8e9aab; }
.toolbar button.exit:hover { background: #3ee0a0; color: #10151c; }

.toolbar .grid-field {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 2px;
  padding: 3px 8px;
  border: 1px solid #3d4c60;
  border-radius: 6px;
  background: #1a212c;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
  color: #8e9aab;
  cursor: text;
}

.toolbar .grid-field:focus-within,
.toolbar .grid-field.is-active {
  border-color: #3ee0a0;
  color: #e8eef6;
}

.toolbar .grid-size {
  width: 6ch;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: end;
  user-select: text;
  cursor: text;
}

.toolbar .grid-size::placeholder { color: #3d4c60; }

.toolbar .grid-size:focus { outline: none; }

.toolbar .grid-unit { color: #8e9aab; }

.tip, .chip, .measure-label {
  position: absolute;
  z-index: 3;
  background: #10151c;
  color: #e8eef6;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.tip {
  width: max-content;
  min-width: 220px;
  max-width: min(340px, calc(100% - 24px));
  padding: 10px 12px;
  pointer-events: none;
}

.tip.is-pinned {
  pointer-events: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 0 1px #3ee0a0;
}

.tip-title {
  margin: 0;
  color: #3ee0a0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 600;
}

.tip dl {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 3px 8px;
  margin: 8px 0;
}

.tip dt { color: #8e9aab; }
.tip dd { margin: 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.tip-status { margin: 0 0 8px; color: #8e9aab; }

.tip button, .chip button {
  appearance: none;
  border: 0;
  background: #3ee0a0;
  color: #10151c;
  font: inherit;
  font-weight: 600;
  border-radius: 7px;
  padding: 4px 8px;
  cursor: pointer;
}

.hit-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: auto;
}

.outline {
  position: absolute;
  z-index: 1;
  outline: 2px solid #3ee0a0;
  background: rgba(62, 224, 160, 0.16);
  pointer-events: none;
}

.measure-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  pointer-events: none;
}

.measure-label span { color: #8e9aab; }
.measure-label strong { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 600; white-space: nowrap; }

.drag-hint {
  position: absolute;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  background: #3ee0a0;
  color: #10151c;
  font-weight: 600;
  pointer-events: none;
}

.grid-overlay {
  --grid-step: 8px;
  --grid-major: 64px;
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(62, 224, 160, 0.38) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(62, 224, 160, 0.38) 1px, transparent 1px),
    linear-gradient(to right, rgba(126, 184, 255, 0.55) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(126, 184, 255, 0.55) 1px, transparent 1px);
  background-size:
    var(--grid-step) var(--grid-step),
    var(--grid-step) var(--grid-step),
    var(--grid-major) var(--grid-major),
    var(--grid-major) var(--grid-major);
}

.chip {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 180px;
  padding: 8px 10px;
}

.chip i {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.chip div { display: flex; flex-direction: column; }
.chip strong { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.chip span { color: #8e9aab; }
.chip p { margin: 0; }
.chip.is-live, .chip.is-live * {
  pointer-events: none !important;
}
`
