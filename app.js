const canvas = document.querySelector("#drawingCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const previewCanvas = document.querySelector("#previewCanvas");
const previewContext = previewCanvas.getContext("2d");
const stage = document.querySelector("#canvasStage");
const emptyState = document.querySelector("#emptyState");
const colorInput = document.querySelector("#colorInput");
const swatch = document.querySelector("#swatch");
const hexOutput = document.querySelector("#hexOutput");
const sizeInput = document.querySelector("#sizeInput");
const sizeOutput = document.querySelector("#sizeOutput");
const qualityInput = document.querySelector("#qualityInput");
const qualityOutput = document.querySelector("#qualityOutput");
const historyStatus = document.querySelector("#historyStatus");
const toast = document.querySelector("#toast");
const importInput = document.querySelector("#importInput");
const canvasName = document.querySelector("#canvasName");
const STORAGE_KEY = "canvas-foundry-document";

let activeTool = "brush";
let activeColor = colorInput.value;
let brushSize = Number(sizeInput.value);
let exportFormat = "png";
let isDrawing = false;
let lastPoint = null;
let toastTimer;
let gridVisible = true;
let documentName =
  localStorage.getItem(`${STORAGE_KEY}-name`) || canvasName.value;

class DrawingCommand {
  constructor(before, after) {
    this.before = before;
    this.after = after;
  }
  execute() {
    restoreSnapshot(this.after);
  }
  undo() {
    restoreSnapshot(this.before);
  }
}

class CommandHistory {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    updateHistoryUi();
  }
  undo() {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    updateHistoryUi();
  }
  redo() {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
    updateHistoryUi();
  }
}

const history = new CommandHistory();

canvasName.value = documentName;

function snapshot() {
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function updatePreview() {
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.drawImage(canvas, 0, 0);
}

function saveLocally(showMessage = true) {
  localStorage.setItem(`${STORAGE_KEY}-name`, documentName);
  localStorage.setItem(`${STORAGE_KEY}-image`, canvas.toDataURL("image/png"));
  if (showMessage) showToast("Mahalliy saqlandi");
}

function slugifyName(name) {
  return (
    name
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "canvas-foundry"
  );
}

function loadSavedArtwork() {
  const savedImage = localStorage.getItem(`${STORAGE_KEY}-image`);
  if (!savedImage) return;
  const image = new Image();
  image.onload = () => {
    context.drawImage(image, 0, 0);
    updatePreview();
    emptyState.classList.add("hidden");
  };
  image.src = savedImage;
}

function restoreSnapshot(imageData) {
  context.putImageData(imageData, 0, 0);
  updatePreview();
  emptyState.classList.add("hidden");
}

function updateHistoryUi() {
  const count = history.undoStack.length;
  historyStatus.textContent = `${count} o'zgarish${count === 1 ? "" : "lar"}`;
  document.querySelector("#undoButton").disabled = count === 0;
  document.querySelector("#redoButton").disabled =
    history.redoStack.length === 0;
  saveLocally(false);
}

function setColor(color) {
  activeColor = color;
  colorInput.value = color;
  swatch.style.backgroundColor = color;
  hexOutput.textContent = color.toUpperCase();
  document
    .querySelectorAll(".swatch")
    .forEach((item) =>
      item.classList.toggle(
        "selected",
        item.dataset.color.toUpperCase() === color.toUpperCase(),
      ),
    );
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * canvas.width) / bounds.width,
    y: ((event.clientY - bounds.top) * canvas.height) / bounds.height,
  };
}

function drawSegment(from, to) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = brushSize;
  context.strokeStyle = activeColor;
  context.globalCompositeOperation =
    activeTool === "eraser" ? "destination-out" : "source-over";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function drawShape(from, to) {
  const width = to.x - from.x;
  const height = to.y - from.y;
  context.save();
  context.lineWidth = brushSize;
  context.strokeStyle = activeColor;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "source-over";
  context.beginPath();
  if (activeTool === "line") {
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  } else if (activeTool === "rectangle") {
    context.rect(from.x, from.y, width, height);
  } else {
    context.ellipse(
      from.x + width / 2,
      from.y + height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      Math.PI * 2,
    );
  }
  context.stroke();
  context.restore();
}

function floodFill(point) {
  const image = snapshot();
  const start = (Math.floor(point.y) * canvas.width + Math.floor(point.x)) * 4;
  const target = [
    image.data[start],
    image.data[start + 1],
    image.data[start + 2],
    image.data[start + 3],
  ];
  const replacement = [...hexToRgb(activeColor), 255];
  if (target.every((value, index) => value === replacement[index]))
    return false;
  const pixels = image.data;
  const matches = (index) =>
    pixels[index] === target[0] &&
    pixels[index + 1] === target[1] &&
    pixels[index + 2] === target[2] &&
    pixels[index + 3] === target[3];
  const stack = [[Math.floor(point.x), Math.floor(point.y)]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    const index = (y * canvas.width + x) * 4;
    if (!matches(index)) continue;
    pixels[index] = replacement[0];
    pixels[index + 1] = replacement[1];
    pixels[index + 2] = replacement[2];
    pixels[index + 3] = replacement[3];
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  context.putImageData(image, 0, 0);
  updatePreview();
  return true;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function pickColor(point) {
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
  const radius = 2;
  const area = context.getImageData(
    Math.max(0, x - radius),
    Math.max(0, y - radius),
    Math.min(canvas.width - x + radius, radius * 2 + 1),
    Math.min(canvas.height - y + radius, radius * 2 + 1),
  );
  let selected = null;
  for (let index = 0; index < area.data.length; index += 4) {
    if (!selected || area.data[index + 3] > selected[3])
      selected = area.data.slice(index, index + 4);
  }
  if (!selected || selected[3] === 0) {
    setColor("#FFFFFF");
    showToast("Oq rang tanlandi");
    return;
  }
  const alpha = selected[3] / 255;
  const rgb = Array.from(selected.slice(0, 3), (value) =>
    Math.round(value * alpha + 255 * (1 - alpha)),
  );
  const hex = rgb.map((value) => value.toString(16).padStart(2, "0")).join("");
  setColor(`#${hex}`);
  showToast("Rang tanlandi");
}

function beginDrawing(event) {
  const point = pointFromEvent(event);
  if (activeTool === "picker") {
    pickColor(point);
    return;
  }
  if (activeTool === "fill") {
    beforeDrawing = snapshot();
    if (floodFill(point))
      history.execute(new DrawingCommand(beforeDrawing, snapshot()));
    return;
  }
  isDrawing = true;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
  if (["line", "rectangle", "ellipse"].includes(activeTool)) return;
  drawSegment(lastPoint, { x: lastPoint.x + 0.01, y: lastPoint.y + 0.01 });
  updatePreview();
  emptyState.classList.add("hidden");
}

function continueDrawing(event) {
  if (!isDrawing) return;
  const point = pointFromEvent(event);
  if (["line", "rectangle", "ellipse"].includes(activeTool)) {
    restoreSnapshot(beforeDrawing);
    drawShape(lastPoint, point);
  } else drawSegment(lastPoint, point);
  updatePreview();
  if (!["line", "rectangle", "ellipse"].includes(activeTool)) lastPoint = point;
}

function finishDrawing(event) {
  if (!isDrawing) return;
  isDrawing = false;
  if (event && canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  const point = pointFromEvent(event);
  if (["line", "rectangle", "ellipse"].includes(activeTool)) {
    restoreSnapshot(beforeDrawing);
    drawShape(lastPoint, point);
  }
  const after = snapshot();
  history.execute(new DrawingCommand(beforeDrawing, after));
  lastPoint = null;
}

let beforeDrawing;
canvas.addEventListener("pointerdown", (event) => {
  beforeDrawing = snapshot();
  beginDrawing(event);
});
canvas.addEventListener("pointermove", continueDrawing);
canvas.addEventListener("pointerup", finishDrawing);
canvas.addEventListener("pointercancel", finishDrawing);

document.querySelectorAll(".tool-button").forEach((button) =>
  button.addEventListener("click", () => {
    activeTool = button.dataset.tool;
    document
      .querySelectorAll(".tool-button")
      .forEach((item) => item.classList.toggle("active", item === button));
    canvas.style.cursor =
      activeTool === "picker"
        ? "copy"
        : activeTool === "fill"
          ? "cell"
          : "crosshair";
  }),
);

colorInput.addEventListener("input", (event) => setColor(event.target.value));
document
  .querySelectorAll(".swatch")
  .forEach((button) =>
    button.addEventListener("click", () => setColor(button.dataset.color)),
  );

sizeInput.addEventListener("input", (event) => {
  brushSize = Number(event.target.value);
  sizeOutput.textContent = `${brushSize} px`;
});

qualityInput.addEventListener("input", (event) => {
  qualityOutput.textContent = `${event.target.value}%`;
});

document.querySelectorAll(".format-button").forEach((button) =>
  button.addEventListener("click", () => {
    exportFormat = button.dataset.format;
    document
      .querySelectorAll(".format-button")
      .forEach((item) => item.classList.toggle("active", item === button));
  }),
);

document
  .querySelector("#undoButton")
  .addEventListener("click", () => history.undo());
document
  .querySelector("#redoButton")
  .addEventListener("click", () => history.redo());
document.querySelector("#clearButton").addEventListener("click", () => {
  const before = snapshot();
  context.clearRect(0, 0, canvas.width, canvas.height);
  updatePreview();
  emptyState.classList.add("hidden");
  history.execute(new DrawingCommand(before, snapshot()));
  showToast("Xolst tozalandi");
});

function exportArtwork() {
  const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
  const quality = Number(qualityInput.value) / 100;
  const link = document.createElement("a");
  link.download = `${slugifyName(documentName)}.${exportFormat}`;
  link.href = canvas.toDataURL(mime, quality);
  link.click();
  showToast(`${exportFormat.toUpperCase()} downloaded`);
}

document
  .querySelector("#exportButton")
  .addEventListener("click", exportArtwork);
document
  .querySelector("#downloadButton")
  .addEventListener("click", exportArtwork);

function clearCanvas() {
  const before = snapshot();
  context.clearRect(0, 0, canvas.width, canvas.height);
  updatePreview();
  emptyState.classList.add("hidden");
  history.execute(new DrawingCommand(before, snapshot()));
  showToast("Xolst tozalandi");
}

function newCanvas() {
  clearCanvas();
  history.undoStack = [];
  history.redoStack = [];
  documentName = "Sarlavhasiz xolst";
  canvasName.value = documentName;
  localStorage.removeItem(`${STORAGE_KEY}-image`);
  updateHistoryUi();
  showToast("Yangi xolst yaratildi");
}

function importImage(file) {
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    const before = snapshot();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(
      canvas.width / image.width,
      canvas.height / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    );
    updatePreview();
    emptyState.classList.add("hidden");
    history.execute(new DrawingCommand(before, snapshot()));
    showToast("Rasm import qilindi");
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(file);
}

document.querySelectorAll(".menu-trigger").forEach((trigger) =>
  trigger.addEventListener("click", () => {
    const item = trigger.parentElement;
    const open = item.classList.toggle("open");
    document.querySelectorAll(".menu-item").forEach((other) => {
      if (other !== item) other.classList.remove("open");
    });
    trigger.setAttribute("aria-expanded", open);
  }),
);

document.querySelectorAll("[data-menu-action]").forEach((button) =>
  button.addEventListener("click", () => {
    const action = button.dataset.menuAction;
    if (action === "new") newCanvas();
    if (action === "import") importInput.click();
    if (action === "save") saveLocally();
    if (action === "undo") history.undo();
    if (action === "redo") history.redo();
    if (action === "clear") clearCanvas();
    if (action === "export-png") {
      exportFormat = "png";
      exportArtwork();
    }
    if (action === "export-jpeg") {
      exportFormat = "jpeg";
      exportArtwork();
    }
    if (action === "grid") {
      gridVisible = !gridVisible;
      stage.classList.toggle("grid-hidden", !gridVisible);
      document.querySelector("#gridCheck").textContent = gridVisible ? "✓" : "";
    }
    document
      .querySelectorAll(".menu-item")
      .forEach((item) => item.classList.remove("open"));
  }),
);

canvasName.addEventListener("input", () => {
  documentName = canvasName.value;
});
canvasName.addEventListener("blur", () => {
  documentName = canvasName.value.trim() || "Sarlavhasiz xolst";
  canvasName.value = documentName;
  saveLocally(false);
});
canvasName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    canvasName.blur();
  }
  if (event.key === "Escape") {
    canvasName.value = documentName;
    canvasName.blur();
  }
});

importInput.addEventListener("change", (event) => {
  importImage(event.target.files[0]);
  event.target.value = "";
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-item"))
    document
      .querySelectorAll(".menu-item")
      .forEach((item) => item.classList.remove("open"));
});

document.addEventListener("keydown", (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? history.redo() : history.undo();
  }
  if (modifier && event.key.toLowerCase() === "n") {
    event.preventDefault();
    newCanvas();
  }
  if (modifier && event.key.toLowerCase() === "o") {
    event.preventDefault();
    importInput.click();
  }
  if (modifier && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveLocally();
  }
  if (!modifier) {
    const shortcuts = {
      b: "brush",
      e: "eraser",
      l: "line",
      r: "rectangle",
      o: "ellipse",
      f: "fill",
      i: "picker",
    };
    if (shortcuts[event.key.toLowerCase()])
      document
        .querySelector(`[data-tool="${shortcuts[event.key.toLowerCase()]}"]`)
        .click();
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}
setColor(activeColor);
updatePreview();
updateHistoryUi();
loadSavedArtwork();
