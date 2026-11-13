import { CELL_CM, MAX_CELLS, MAX_PROJECT_BYTES, buildingAt, clearProjectLayers, createProject, createSample, editBuildingCell, inBounds, plantAt, plantFits, surfaceBrushBounds, validateProject } from './model.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#garden-canvas');
const ctx = canvas.getContext('2d');
const brushCursor = $('#brush-cursor');
const scroll = $('#canvas-scroll');
const plantForm = $('#plant-form');
const settingsForm = $('#settings-form');
const state = {
  project: null, layer: 'surface', tool: 'select', material: 'sand', brushSize: 1, hoverCell: null, selectedId: null,
  buildingId: null, buildingMaterial: 'wall',
  visible: { surface: true, buildings: true, plants: true, water: false, electric: false },
  zoom: 1, image: null, drawing: false, lastCell: null, dirty: 0, saved: 0, saving: false, canSave: false
};
let saveTimer;
let toastTimer;
let settingsMode = 'edit';
let pendingSettings = null;

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4000);
}

function status(text, error = false) {
  $('#save-status').innerHTML = '<span class="status-dot"></span>';
  $('#save-status').append(document.createTextNode(` ${text}`));
  $('#save-status').classList.toggle('error', error);
  $('#retry-save').hidden = !(error && state.canSave);
}
$('#retry-save').addEventListener('click', saveProject);

function changed() {
  state.dirty++;
  status('Unsaved changes');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProject, 500);
  updateOverview();
}

async function saveProject() {
  if (!state.canSave || state.saving || state.saved === state.dirty) return;
  state.saving = true;
  const version = state.dirty;
  const body = JSON.stringify(state.project);
  status('Saving...');
  try {
    const response = await fetch('/api/project', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save your garden.');
    state.saved = version;
    status(state.saved === state.dirty ? 'All changes saved' : 'Unsaved changes');
  } catch (error) {
    status('Save failed', true);
    toast(`Save failed: ${error.message}. Your changes are still in this tab.`);
  } finally {
    state.saving = false;
    if (state.saved === version && state.dirty !== version) saveProject();
  }
}

function loadImage() {
  state.image = null;
  if (!state.project.image) { render(); return; }
  const image = new Image();
  const source = state.project.image;
  image.onload = () => {
    if (state.project.image !== source) return;
    state.image = image;
    render();
  };
  image.onerror = () => toast('The reference image could not be displayed. Try another image.');
  image.src = source;
}

function updateOverview() {
  const p = state.project;
  $('#project-name').textContent = p.name;
  $('#canvas-dimensions').textContent = `${(p.width / 10).toFixed(1)} m × ${(p.height / 10).toFixed(1)} m · 10 cm grid`;
  $('#size-bar-dimensions').textContent = `${(p.width / 10).toFixed(1)} m wide × ${(p.height / 10).toFixed(1)} m deep`;
  $('#overview-size').textContent = `${(p.width / 10).toFixed(1)} × ${(p.height / 10).toFixed(1)} m`;
  $('#overview-area').textContent = `${(p.width * p.height / 100).toFixed(1)} m²`;
  $('#overview-plants').textContent = p.plants.length;
  $('#reference-title').textContent = p.image ? 'Your reference image' : 'Start with a sketch';
  $('#image-controls').hidden = !p.image;
  $('#image-opacity').value = Math.round(p.imageOpacity * 100);
  $('#opacity-value').textContent = `${Math.round(p.imageOpacity * 100)}%`;
}

function fit() {
  const p = state.project;
  const availableWidth = Math.max(100, scroll.clientWidth - 80);
  const availableHeight = Math.max(100, scroll.clientHeight - 80);
  state.zoom = Math.min(1.5, availableWidth / (p.width * 12), availableHeight / (p.height * 12));
  render();
}

function render() {
  if (!state.project) return;
  const p = state.project;
  const cell = 12 * state.zoom;
  const width = p.width * cell;
  const height = p.height * cell;
  const ratio = Math.min(window.devicePixelRatio || 1, 8192 / width, 8192 / height, Math.sqrt(16000000 / (width * height)));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#fbfcf7';
  ctx.fillRect(0, 0, width, height);
  if (state.image) {
    ctx.globalAlpha = p.imageOpacity;
    ctx.drawImage(state.image, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  if (state.visible.surface) {
    const colors = { sand: '#e5d6b7', grass: '#bfd2ae', paving: '#cdcdc2' };
    ctx.globalAlpha = state.image ? 0.68 : 1;
    p.surface.forEach((material, index) => {
      if (!material) return;
      ctx.fillStyle = colors[material];
      ctx.fillRect((index % p.width) * cell, Math.floor(index / p.width) * cell, cell + 0.2, cell + 0.2);
    });
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = state.image ? 'rgba(57,78,59,.18)' : 'rgba(83,111,81,.16)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 0; x <= p.width; x++) { ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, height); }
  for (let y = 0; y <= p.height; y++) { ctx.moveTo(0, y * cell); ctx.lineTo(width, y * cell); }
  ctx.stroke();
  for (const layer of ['water', 'electric']) {
    if (!state.visible[layer]) continue;
    ctx.strokeStyle = layer === 'water' ? '#3d92ae' : '#dc9f40';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(2, cell * 0.28);
    ctx.lineCap = 'round';
    p[layer].forEach((enabled, index) => {
      if (!enabled) return;
      const x = index % p.width, y = Math.floor(index / p.width);
      const cx = (x + .5) * cell, cy = (y + .5) * cell;
      ctx.beginPath();
      if (x + 1 < p.width && p[layer][index + 1]) { ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy); }
      if (y + 1 < p.height && p[layer][index + p.width]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cell); }
      if (y + 1 < p.height && x + 1 < p.width && p[layer][index + p.width + 1] && !p[layer][index + 1] && !p[layer][index + p.width]) {
        ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy + cell);
      }
      if (y + 1 < p.height && x > 0 && p[layer][index + p.width - 1] && !p[layer][index - 1] && !p[layer][index + p.width]) {
        ctx.moveTo(cx, cy); ctx.lineTo(cx - cell, cy + cell);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, cell * .14), 0, Math.PI * 2); ctx.fill();
    });
  }
  if (state.visible.buildings) {
    const colors = { wall: '#746b63', door: '#c78d51', window: '#77a9b5' };
    for (const building of p.buildings) {
      for (const item of building.cells) {
        const x = (item.index % p.width) * cell, y = Math.floor(item.index / p.width) * cell;
        ctx.fillStyle = colors[item.type];
        ctx.fillRect(x, y, cell + .2, cell + .2);
        if (building.id === state.buildingId && state.layer === 'buildings' && cell >= 4) {
          ctx.strokeStyle = '#372f29';
          ctx.lineWidth = .5;
          ctx.strokeRect(x, y, cell, cell);
        }
      }
    }
  }
  if (state.visible.plants) {
    for (const plant of p.plants) {
      const x = (plant.x + plant.width / 2) * cell;
      const y = (plant.y + plant.height / 2) * cell;
      const rx = plant.width * cell / 2 - 1;
      const ry = plant.height * cell / 2 - 1;
      ctx.fillStyle = plant.type === 'tree' ? '#638b63' : plant.type === 'shrub' ? '#8eaa7a' : '#a9bd8f';
      ctx.strokeStyle = plant.id === state.selectedId ? '#294c3a' : '#6e956e';
      ctx.lineWidth = plant.id === state.selectedId ? 2 : 1;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + Math.min(ry * .45, 7)); ctx.lineTo(x, y - Math.min(ry * .45, 7));
      ctx.moveTo(x, y); ctx.lineTo(x - Math.min(rx * .35, 5), y - Math.min(ry * .25, 4));
      ctx.moveTo(x, y - Math.min(ry * .15, 2)); ctx.lineTo(x + Math.min(rx * .35, 5), y - Math.min(ry * .4, 6)); ctx.stroke();
    }
  }
  $('#zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
  updateBrushCursor();
}

function updateBrushCursor() {
  const cell = state.hoverCell;
  const show = state.project && cell && inBounds(state.project, cell.x, cell.y) &&
    state.layer === 'surface' && (state.tool === 'paint' || state.tool === 'erase');
  brushCursor.hidden = !show;
  if (!show) return;
  const bounds = surfaceBrushBounds(state.project, cell.x, cell.y, state.brushSize);
  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = $('#canvas-wrap').getBoundingClientRect();
  const cellWidth = canvasRect.width / state.project.width;
  const cellHeight = canvasRect.height / state.project.height;
  brushCursor.style.left = `${canvasRect.left - wrapRect.left + bounds.left * cellWidth}px`;
  brushCursor.style.top = `${canvasRect.top - wrapRect.top + bounds.top * cellHeight}px`;
  brushCursor.style.width = `${(bounds.right - bounds.left) * cellWidth}px`;
  brushCursor.style.height = `${(bounds.bottom - bounds.top) * cellHeight}px`;
}

function updateControls() {
  document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === state.tool));
  document.querySelectorAll('[data-layer-row]').forEach(row => row.classList.toggle('active', row.dataset.layerRow === state.layer));
  document.querySelectorAll('[data-visibility]').forEach(button => {
    const visible = state.visible[button.dataset.visibility];
    button.classList.toggle('is-hidden', !visible);
    const label = button.dataset.visibility === 'surface' ? 'ground cover' : button.dataset.visibility === 'buildings' ? 'buildings' : button.dataset.visibility === 'plants' ? 'plants and trees' : button.dataset.visibility === 'water' ? 'water pipes' : 'electricity';
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`);
    button.title = `${visible ? 'Hide' : 'Show'} ${label}`;
  });
  document.querySelectorAll('[data-material]').forEach(button => button.classList.toggle('active', button.dataset.material === state.material));
  $('#materials-section').hidden = state.layer !== 'surface';
  $('#buildings-section').hidden = state.layer !== 'buildings';
  document.querySelectorAll('[data-building-material]').forEach(button => button.classList.toggle('active', button.dataset.buildingMaterial === state.buildingMaterial));
  updateBuildingControls();
  let hint = 'Select a plant to see its details.';
  if (state.layer === 'buildings' && state.tool === 'select') hint = 'Click a building wall to select that building.';
  if (state.tool === 'paint') hint = state.layer === 'plants' ? 'Click a soil area to add a plant.' : state.layer === 'buildings' ? 'Select or add a building, then draw walls or openings. Zoom in for details.' : `Click and drag to draw ${state.layer === 'surface' ? state.material : state.layer === 'water' ? 'water pipes' : 'electric cables'}.`;
  if (state.tool === 'erase') hint = state.layer === 'plants' ? 'Click a plant to remove it.' : 'Click and drag to erase from the selected layer.';
  $('#editor-hint').textContent = hint;
  canvas.style.cursor = state.tool === 'select' ? 'pointer' : 'crosshair';
  render();
}

function updateBuildingControls() {
  const select = $('#building-select');
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Select a building';
  select.append(empty);
  for (const building of state.project.buildings) {
    const option = document.createElement('option');
    option.value = building.id;
    option.textContent = building.name;
    select.append(option);
  }
  const building = state.project.buildings.find(item => item.id === state.buildingId);
  select.value = building?.id || '';
  $('#building-form').hidden = !building;
  $('#building-status').textContent = building
    ? building.cells.length ? `${building.cells.length} building squares drawn. You can start another wall anywhere.` : 'No walls yet. Draw the first wall anywhere on the plan.'
    : 'Add or select a building to begin.';
  if (building && document.activeElement !== $('#building-form').elements.name) $('#building-form').elements.name.value = building.name;
}

function showPlant(id) {
  state.selectedId = id;
  const plant = state.project.plants.find(item => item.id === id);
  $('#garden-inspector').hidden = !!plant;
  $('#plant-inspector').hidden = !plant;
  $('#inspector-title').textContent = plant ? 'Plant details' : 'Your garden';
  $('#inspector-subtitle').textContent = plant ? 'Everything you need to help it thrive.' : 'A closer look at your plan.';
  $('#plant-error').textContent = '';
  if (plant) {
    for (const key of ['name', 'type', 'purchased', 'retailer', 'prune', 'notes']) plantForm.elements[key].value = plant[key];
    plantForm.elements.width.value = plant.width * CELL_CM;
    plantForm.elements.height.value = plant.height * CELL_CM;
    plantForm.elements.x.value = plant.x + 1;
    plantForm.elements.y.value = plant.y + 1;
  }
  render();
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.floor((event.clientX - rect.left) / rect.width * state.project.width), y: Math.floor((event.clientY - rect.top) / rect.height * state.project.height) };
}

function paintCell(x, y) {
  const p = state.project;
  if (!inBounds(p, x, y)) return false;
  const index = y * p.width + x;
  if (state.layer === 'buildings') {
    const building = p.buildings.find(item => item.id === state.buildingId);
    if (!building) {
      if (!state.warnedBuilding) { toast('Add or select a building first.'); state.warnedBuilding = true; }
      return false;
    }
    const type = state.tool === 'erase' ? 'erase' : state.buildingMaterial;
    const before = building.cells.find(cell => cell.index === index);
    if ((type === 'erase' && !before) || (before && before.type === type)) return false;
    const error = editBuildingCell(p, building, x, y, type);
    if (error) {
      if (!state.warnedBuilding) { toast(error); state.warnedBuilding = true; }
      return false;
    }
    return true;
  }
  if (state.layer === 'surface') {
    const value = state.tool === 'erase' ? '' : state.material;
    if (p.surface[index] === value) return false;
    if (value !== 'sand' && plantAt(p, x, y)) {
      if (!state.warnedPlant) { toast('Remove or move the plant before changing the soil beneath it.'); state.warnedPlant = true; }
      return false;
    }
    p.surface[index] = value;
    return true;
  }
  if (state.layer === 'water' || state.layer === 'electric') {
    const value = state.tool !== 'erase';
    if (p[state.layer][index] === value) return false;
    p[state.layer][index] = value;
    return true;
  }
  return false;
}

function paintLine(from, to) {
  let { x, y } = from;
  const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx - dy, modified = false;
  while (true) {
    if (state.layer === 'surface') {
      const bounds = surfaceBrushBounds(state.project, x, y, state.brushSize);
      for (let brushY = bounds.top; brushY < bounds.bottom; brushY++) {
        for (let brushX = bounds.left; brushX < bounds.right; brushX++) {
          modified = paintCell(brushX, brushY) || modified;
        }
      }
    } else {
      modified = paintCell(x, y) || modified;
    }
    if (x === to.x && y === to.y) break;
    const twice = error * 2;
    if (twice > -dy) { error -= dy; x += sx; if (state.layer === 'buildings' && twice < dx) modified = paintCell(x, y) || modified; }
    if (twice < dx) { error += dx; y += sy; }
  }
  if (modified) { changed(); if (state.layer === 'buildings') updateBuildingControls(); render(); }
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const cell = point(event);
  if (!inBounds(state.project, cell.x, cell.y)) return;
  state.hoverCell = cell;
  updateBrushCursor();
  event.preventDefault();
  if (state.tool === 'select') {
    if (state.layer === 'buildings') {
      state.buildingId = state.visible.buildings ? buildingAt(state.project, cell.x, cell.y)?.id || null : null;
      updateControls();
    } else showPlant(state.visible.plants ? plantAt(state.project, cell.x, cell.y)?.id : null);
    return;
  }
  if (state.layer === 'buildings' && !state.visible.buildings) {
    state.visible.buildings = true;
    updateControls();
  }
  if (state.layer === 'plants') {
    const existing = plantAt(state.project, cell.x, cell.y);
    if (state.tool === 'erase') {
      if (existing && confirm(`Remove ${existing.name}?`)) {
        state.project.plants = state.project.plants.filter(plant => plant.id !== existing.id);
        showPlant(null); changed();
      }
    } else {
      const plant = { id: newId(), name: 'New plant', type: 'plant', x: cell.x, y: cell.y, width: 3, height: 3, purchased: '', retailer: '', prune: '', notes: '' };
      if (!plantFits(state.project, plant)) { plant.width = 1; plant.height = 1; }
      if (!plantFits(state.project, plant)) { toast('Choose an unoccupied soil / sand square for your plant.'); return; }
      state.project.plants.push(plant);
      changed(); showPlant(plant.id);
      toast('Plant added. Edit its details on the right.');
    }
    return;
  }
  state.drawing = true;
  state.warnedPlant = false;
  state.warnedBuilding = false;
  state.lastCell = cell;
  canvas.setPointerCapture(event.pointerId);
  paintLine(cell, cell);
});
canvas.addEventListener('pointermove', event => {
  const cell = point(event);
  state.hoverCell = inBounds(state.project, cell.x, cell.y) ? cell : null;
  updateBrushCursor();
  if (inBounds(state.project, cell.x, cell.y)) $('#coordinates').textContent = `Column ${cell.x + 1}, row ${cell.y + 1} · 10 cm per square`;
  if (state.drawing && inBounds(state.project, cell.x, cell.y)) { paintLine(state.lastCell, cell); state.lastCell = cell; }
});
function stopDrawing() { state.drawing = false; state.lastCell = null; }
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);
canvas.addEventListener('lostpointercapture', stopDrawing);
canvas.addEventListener('pointerleave', () => {
  state.hoverCell = null;
  updateBrushCursor();
  $('#coordinates').textContent = '10 cm per square';
});

$('#brush-size').addEventListener('change', event => {
  state.brushSize = Number(event.target.value);
  updateBrushCursor();
});
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => { state.tool = button.dataset.tool; updateControls(); }));
document.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => {
  state.layer = button.dataset.layer;
  state.visible[state.layer] = true;
  state.tool = 'paint';
  updateControls();
}));
document.querySelectorAll('[data-visibility]').forEach(button => button.addEventListener('click', () => {
  const layer = button.dataset.visibility;
  state.visible[layer] = !state.visible[layer];
  if (layer === 'plants' && !state.visible.plants) showPlant(null);
  updateControls();
}));
document.querySelectorAll('[data-material]').forEach(button => button.addEventListener('click', () => {
  state.material = button.dataset.material;
  state.layer = 'surface'; state.visible.surface = true; state.tool = 'paint';
  updateControls();
}));
document.querySelectorAll('[data-building-material]').forEach(button => button.addEventListener('click', () => {
  state.buildingMaterial = button.dataset.buildingMaterial;
  state.layer = 'buildings'; state.visible.buildings = true; state.tool = 'paint';
  updateControls();
}));
$('#add-building').addEventListener('click', () => {
  const building = { id: newId(), name: `Building ${state.project.buildings.length + 1}`, cells: [] };
  state.project.buildings.push(building);
  state.buildingId = building.id; state.buildingMaterial = 'wall'; state.tool = 'paint';
  changed(); updateControls();
  toast('Draw the first wall anywhere on the plan.');
});
$('#building-select').addEventListener('change', event => { state.buildingId = event.target.value || null; updateControls(); });
$('#building-form').addEventListener('submit', event => {
  event.preventDefault();
  const building = state.project.buildings.find(item => item.id === state.buildingId);
  const name = event.currentTarget.elements.name.value.trim();
  if (!building || !name) { toast('Enter a building name.'); return; }
  building.name = name;
  changed(); updateControls(); toast('Building name saved.');
});
$('#delete-building').addEventListener('click', () => {
  const building = state.project.buildings.find(item => item.id === state.buildingId);
  if (!building || !confirm(`Remove ${building.name} and all its walls, doors and windows?`)) return;
  state.project.buildings = state.project.buildings.filter(item => item.id !== building.id);
  state.buildingId = null;
  changed(); updateControls();
});
$('#zoom-in').addEventListener('click', () => { state.zoom = Math.min(3, state.zoom * 1.25); render(); });
$('#zoom-out').addEventListener('click', () => { state.zoom = Math.max(.01, state.zoom / 1.25); render(); });
$('#fit-button').addEventListener('click', fit);

plantForm.addEventListener('submit', event => {
  event.preventDefault();
  const current = state.project.plants.find(plant => plant.id === state.selectedId);
  if (!current) return;
  const form = plantForm.elements;
  const plant = {
    ...current, name: form.name.value.trim(), type: form.type.value,
    width: Number(form.width.value) / CELL_CM, height: Number(form.height.value) / CELL_CM,
    x: Number(form.x.value) - 1, y: Number(form.y.value) - 1,
    purchased: form.purchased.value, retailer: form.retailer.value, prune: form.prune.value, notes: form.notes.value
  };
  if (!plant.name || !plantFits(state.project, plant, plant.id)) {
    $('#plant-error').textContent = 'Enter a name and a valid size and position on unoccupied soil / sand.';
    return;
  }
  Object.assign(current, plant);
  $('#plant-error').textContent = '';
  changed(); render(); toast('Plant details saved.');
});
$('#delete-plant').addEventListener('click', () => {
  const plant = state.project.plants.find(item => item.id === state.selectedId);
  if (plant && confirm(`Remove ${plant.name}?`)) {
    state.project.plants = state.project.plants.filter(item => item.id !== plant.id);
    showPlant(null); changed();
  }
});

function updateSizePreview() {
  const width = Number(settingsForm.elements.width.value);
  const height = Number(settingsForm.elements.height.value);
  const valid = settingsForm.elements.width.value && settingsForm.elements.height.value &&
    Number.isInteger(width / CELL_CM) && Number.isInteger(height / CELL_CM) &&
    width >= CELL_CM && height >= CELL_CM && width <= MAX_CELLS * CELL_CM && height <= MAX_CELLS * CELL_CM;
  $('#size-preview').textContent = valid
    ? `${(width / 100).toFixed(1)} m × ${(height / 100).toFixed(1)} m · ${width / CELL_CM} × ${height / CELL_CM} squares`
    : 'Enter valid dimensions to see the grid size.';
}

function openSettings(mode) {
  settingsMode = mode;
  pendingSettings = null;
  $('#settings-confirmation').hidden = true;
  settingsForm.elements.name.value = mode === 'new' ? 'My garden' : state.project.name;
  settingsForm.elements.width.value = state.project.width * CELL_CM;
  settingsForm.elements.height.value = state.project.height * CELL_CM;
  $('#settings-title').textContent = mode === 'new' ? 'New project' : 'Project settings';
  $('#settings-submit').textContent = mode === 'new' ? 'Create new project' : 'Save settings';
  $('#settings-warning').textContent = mode === 'new'
    ? 'A new project replaces the current garden. Export a backup first if you want to keep it.'
    : 'Changing the size clears the entire layout, including buildings, and reference image after confirmation.';
  $('#backup-section').hidden = mode === 'new';
  $('#settings-error').textContent = '';
  updateSizePreview();
  $('#settings-dialog').showModal();
}
$('#settings-button').addEventListener('click', () => openSettings('edit'));
$('#size-button').addEventListener('click', () => openSettings('edit'));
$('#new-project-button').addEventListener('click', () => openSettings('new'));
settingsForm.elements.width.addEventListener('input', updateSizePreview);
settingsForm.elements.height.addEventListener('input', updateSizePreview);
settingsForm.addEventListener('input', () => {
  pendingSettings = null;
  $('#settings-confirmation').hidden = true;
  $('#settings-error').textContent = '';
});
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#cancel-settings').addEventListener('click', () => $('#settings-dialog').close());
function saveSettings({ name, width, height }, replace) {
  if (replace) {
    state.project = createProject(width, height, name);
    state.buildingId = null;
    state.image = null;
    showPlant(null);
    updateControls();
    fit();
  } else {
    state.project.name = name;
  }
  pendingSettings = null;
  $('#settings-confirmation').hidden = true;
  changed();
  $('#settings-dialog').close();
  render();
  toast(replace ? 'New garden created.' : 'Project settings saved.');
}
settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = settingsForm.elements.name.value.trim();
  const width = Number(settingsForm.elements.width.value) / CELL_CM;
  const height = Number(settingsForm.elements.height.value) / CELL_CM;
  if (!name || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CELLS || height > MAX_CELLS) {
    $('#settings-error').textContent = `Enter a project name and dimensions from 10 to ${MAX_CELLS * CELL_CM} cm in multiples of 10. For 19 × 31 m, enter 1900 × 3100 cm.`;
    return;
  }
  if (settingsMode === 'new' || width !== state.project.width || height !== state.project.height) {
    pendingSettings = { name, width, height };
    $('#settings-confirmation').hidden = false;
    $('#settings-confirm').focus();
    return;
  }
  saveSettings({ name, width, height }, false);
});
$('#settings-keep').addEventListener('click', () => {
  pendingSettings = null;
  $('#settings-confirmation').hidden = true;
  $('#settings-submit').focus();
});
$('#settings-confirm').addEventListener('click', () => {
  if (pendingSettings) saveSettings(pendingSettings, true);
});

const clearForm = $('#clear-form');
$('#clear-workspace-button').addEventListener('click', () => {
  clearForm.reset();
  $('#clear-error').textContent = '';
  $('#clear-dialog').showModal();
});
$('#close-clear').addEventListener('click', () => $('#clear-dialog').close());
$('#cancel-clear').addEventListener('click', () => $('#clear-dialog').close());
clearForm.addEventListener('submit', event => {
  event.preventDefault();
  const layers = [...clearForm.querySelectorAll('input[name="layer"]:checked')].map(input => input.value);
  if (!layers.length) {
    $('#clear-error').textContent = 'Select at least one item to clear.';
    return;
  }
  const names = { surface: 'ground cover', buildings: 'buildings', plants: 'plants and trees', water: 'water pipes', electric: 'electricity', image: 'reference image' };
  const selected = layers.map(layer => names[layer]);
  if (layers.includes('surface') && !layers.includes('plants')) selected.push('plants and trees (required when clearing ground cover)');
  if (!confirm(`Clear ${selected.join(', ')}? This cannot be undone. Export a backup first if needed.`)) return;
  clearProjectLayers(state.project, layers);
  if (layers.includes('buildings')) { state.buildingId = null; updateControls(); }
  if (layers.includes('surface') || layers.includes('plants')) showPlant(null);
  if (layers.includes('image')) state.image = null;
  changed(); render();
  $('#clear-dialog').close();
  toast('Selected items cleared.');
});

$('#image-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    toast('Choose a PNG, JPEG, or WebP image under 10 MB.'); return;
  }
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the image.'));
      reader.readAsDataURL(file);
    });
    await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.src = data;
    });
    state.project.image = data;
    loadImage(); changed(); updateOverview();
  } catch (error) { toast(error.message); }
});
$('#image-opacity').addEventListener('input', event => {
  state.project.imageOpacity = Number(event.target.value) / 100;
  updateOverview(); changed(); render();
});
$('#remove-image').addEventListener('click', () => { state.project.image = null; state.image = null; changed(); updateOverview(); render(); });
$('#backup-button').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'garden-studio-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#backup-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > MAX_PROJECT_BYTES) { toast('Backup is too large. The limit is 25 MB.'); return; }
  try {
    const project = JSON.parse(await file.text());
    const error = validateProject(project);
    if (error) throw new Error(error);
    if (!confirm('Importing this backup will replace your current garden. Continue?')) return;
    state.project = project; state.project.buildings ??= []; state.buildingId = null;
    showPlant(null); loadImage(); changed(); updateOverview(); updateControls(); fit();
    $('#settings-dialog').close();
    toast('Backup imported.');
  } catch (error) { toast(`Could not import backup: ${error.message}`); }
});

window.addEventListener('beforeunload', event => {
  if (state.canSave && state.dirty !== state.saved) {
    event.preventDefault();
    event.returnValue = '';
  }
});

async function init() {
  try {
    const response = await fetch('/api/project');
    const project = await response.json();
    if (!response.ok) throw new Error(project.error || 'Could not load your garden.');
    if (project && validateProject(project)) throw new Error('Stored project data is invalid.');
    state.project = project || createSample();
    state.project.buildings ??= [];
    state.canSave = true;
    if (!project) changed(); else status('All changes saved');
    updateOverview(); loadImage(); updateControls(); fit();
  } catch (error) {
    status('Load failed', true);
    toast(`Could not load your garden: ${error.message}. Reload after fixing the problem.`);
    document.querySelectorAll('button, input').forEach(element => { element.disabled = true; });
  }
}
init();
