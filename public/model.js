export const CELL_CM = 10;
export const MAX_CELLS = 500;
export const MAX_PROJECT_BYTES = 25 * 1024 * 1024;
export const MATERIALS = ['sand', 'grass', 'paving'];
export const UTILITIES = ['water', 'electric'];

export function createProject(width = 80, height = 60, name = 'My garden') {
  return {
    version: 1, name, width, height, image: null, imageOpacity: 0.55,
    surface: Array(width * height).fill(''),
    water: Array(width * height).fill(false),
    electric: Array(width * height).fill(false),
    plants: [], buildings: []
  };
}

export function clearProjectLayers(project, layers) {
  if (layers.includes('surface')) {
    project.surface.fill('');
    project.plants = [];
  } else if (layers.includes('plants')) {
    project.plants = [];
  }
  for (const layer of UTILITIES) {
    if (layers.includes(layer)) project[layer].fill(false);
  }
  if (layers.includes('buildings')) project.buildings = [];
  if (layers.includes('image')) project.image = null;
}

export function createSample() {
  const project = createProject(60, 40, 'The garden plan');
  for (let y = 0; y < project.height; y++) {
    for (let x = 0; x < project.width; x++) {
      let material = 'grass';
      if (x < 7 || y > 34) material = 'paving';
      if ((x >= 9 && x < 20 && y >= 5 && y < 31) ||
          (x >= 38 && x < 57 && y >= 4 && y < 19) ||
          (x >= 24 && x < 54 && y >= 24 && y < 33)) material = 'sand';
      project.surface[y * project.width + x] = material;
    }
  }
  project.plants = [
    { id: 'sample-olive', name: 'Olive tree', type: 'tree', x: 43, y: 7, width: 7, height: 7, purchased: '', retailer: '', prune: 'Early spring', notes: 'A little Mediterranean character.' },
    { id: 'sample-lavender', name: 'Lavender', type: 'shrub', x: 12, y: 9, width: 5, height: 5, purchased: '', retailer: '', prune: 'After flowering', notes: 'Loves a sunny spot.' },
    { id: 'sample-hydrangea', name: 'Hydrangea', type: 'shrub', x: 13, y: 22, width: 5, height: 5, purchased: '', retailer: '', prune: 'Spring', notes: '' },
    { id: 'sample-grass', name: 'Ornamental grass', type: 'plant', x: 29, y: 26, width: 4, height: 4, purchased: '', retailer: '', prune: '', notes: '' },
    { id: 'sample-rosemary', name: 'Rosemary', type: 'shrub', x: 43, y: 26, width: 4, height: 4, purchased: '', retailer: '', prune: '', notes: '' }
  ];
  return project;
}

export function inBounds(project, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < project.width && y < project.height;
}

export function plantFits(project, plant, ignoreId = null) {
  if (!Number.isInteger(plant.x) || !Number.isInteger(plant.y) ||
      !Number.isInteger(plant.width) || !Number.isInteger(plant.height) ||
      plant.width < 1 || plant.height < 1 ||
      !inBounds(project, plant.x, plant.y) ||
      !inBounds(project, plant.x + plant.width - 1, plant.y + plant.height - 1)) return false;
  const buildingCells = new Set((project.buildings || []).flatMap(building => building.cells.map(cell => cell.index)));
  for (let y = plant.y; y < plant.y + plant.height; y++) {
    for (let x = plant.x; x < plant.x + plant.width; x++) {
      if (project.surface[y * project.width + x] !== 'sand') return false;
      if (buildingCells.has(y * project.width + x)) return false;
    }
  }
  return !project.plants.some(other => other.id !== ignoreId &&
    plant.x < other.x + other.width && plant.x + plant.width > other.x &&
    plant.y < other.y + other.height && plant.y + plant.height > other.y);
}

export function buildingAt(project, x, y) {
  const index = y * project.width + x;
  return (project.buildings || []).find(building => building.cells.some(cell => cell.index === index));
}

export function editBuildingCell(project, building, x, y, type) {
  if (!inBounds(project, x, y)) return 'Outside the garden.';
  const index = y * project.width + x;
  const existing = building.cells.find(cell => cell.index === index);
  if (type === 'erase') {
    if (!existing) return null;
    building.cells = building.cells.filter(cell => cell.index !== index);
    return null;
  }
  if (!['wall', 'door', 'window'].includes(type)) return 'Unknown building material.';
  if (type !== 'wall' && !existing) return 'Draw doors and windows over this building’s walls.';
  if (!existing) {
    if (buildingAt(project, x, y)) return 'Another building already occupies that square.';
    if (plantAt(project, x, y)) return 'Move or remove the plant before drawing a wall there.';
    building.cells.push({ index, type });
  } else {
    existing.type = type;
  }
  return null;
}

export function plantAt(project, x, y) {
  return project.plants.find(plant => x >= plant.x && x < plant.x + plant.width &&
    y >= plant.y && y < plant.y + plant.height);
}

export function validateProject(project) {
  if (!project || project.version !== 1 || typeof project.name !== 'string' || project.name.length > 200 ||
      !Number.isInteger(project.width) || !Number.isInteger(project.height) ||
      project.width < 1 || project.height < 1 || project.width > MAX_CELLS || project.height > MAX_CELLS ||
      !Number.isFinite(project.imageOpacity) || project.imageOpacity < 0 || project.imageOpacity > 1 ||
      !(project.image === null || (typeof project.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(project.image)))) {
    return 'Invalid project settings.';
  }
  const size = project.width * project.height;
  if (!Array.isArray(project.surface) || project.surface.length !== size ||
      !project.surface.every(cell => cell === '' || MATERIALS.includes(cell)) ||
      !UTILITIES.every(key => Array.isArray(project[key]) && project[key].length === size && project[key].every(cell => typeof cell === 'boolean')) ||
      !Array.isArray(project.plants) || project.plants.length > size) return 'Invalid grid data.';
  if (project.buildings !== undefined) {
    if (!Array.isArray(project.buildings) || project.buildings.length > size) return 'Invalid building data.';
    const ids = new Set(), occupied = new Set();
    for (const building of project.buildings) {
      if (!building || typeof building.id !== 'string' || !building.id || ids.has(building.id) ||
          typeof building.name !== 'string' || !building.name.trim() || building.name.length > 200 ||
          !Array.isArray(building.cells) || building.cells.length > size) return 'Invalid building data.';
      ids.add(building.id);
      for (const cell of building.cells) {
        if (!cell || !Number.isInteger(cell.index) || cell.index < 0 || cell.index >= size ||
            !['wall', 'door', 'window'].includes(cell.type) || occupied.has(cell.index)) return 'Invalid building cells.';
        occupied.add(cell.index);
      }
    }
  }
  const ids = new Set();
  for (const plant of project.plants) {
    if (!plant || typeof plant.id !== 'string' || !plant.id || ids.has(plant.id) ||
        !['name', 'type', 'purchased', 'retailer', 'prune', 'notes'].every(key => typeof plant[key] === 'string' && plant[key].length <= 5000) ||
        !['plant', 'shrub', 'tree'].includes(plant.type) || !plantFits(project, plant, plant.id)) return 'Invalid plant data or placement.';
    ids.add(plant.id);
  }
  return null;
}
