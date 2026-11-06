import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingAt, clearProjectLayers, createProject, createSample, editBuildingCell, plantAt, plantFits, validateProject } from '../public/model.js';

function plant(overrides = {}) {
  return { id: 'one', name: 'Fern', type: 'plant', x: 0, y: 0, width: 2, height: 2, purchased: '', retailer: '', prune: '', notes: '', ...overrides };
}

test('sample and blank projects have valid 10 cm grid data', () => {
  assert.equal(validateProject(createSample()), null);
  const project = createProject(3, 4);
  assert.equal(project.surface.length, 12);
  assert.equal(validateProject(project), null);
});

test('supports 19 × 31 m gardens and validates the 50 m limit', () => {
  const project = createProject(190, 310, 'Large plot');
  assert.equal(project.surface.length, 58900);
  assert.equal(validateProject(project), null);
  assert.equal(validateProject(createProject(500, 500)), null);
  assert.match(validateProject(createProject(501, 1)), /settings/i);
  assert.match(validateProject(createProject(1, 501)), /settings/i);
});

test('plants must fit entirely on soil, inside the garden and not overlap', () => {
  const project = createProject(4, 4);
  project.surface.fill('sand');
  const fern = plant();
  assert.equal(plantFits(project, fern), true);
  project.plants.push(fern);
  assert.equal(plantAt(project, 1, 1), fern);
  assert.equal(plantAt(project, 2, 1), undefined);
  assert.equal(plantFits(project, fern, fern.id), true);
  assert.equal(plantFits(project, plant({ id: 'two', x: 1 })), false);
  assert.equal(plantFits(project, plant({ id: 'two', x: 3 })), false);
  assert.equal(plantFits(project, plant({ id: 'two', x: 2, width: 1.5 })), false);
  project.surface[2] = 'grass';
  assert.equal(plantFits(project, plant({ id: 'two', x: 2 })), false);
  assert.equal(validateProject(project), null);
  project.surface[0] = 'paving';
  assert.match(validateProject(project), /plant/i);
});

test('validation rejects malformed grids, images, duplicate IDs and overlapping plants', () => {
  const project = createProject(3, 3);
  project.surface.fill('sand');
  project.plants.push(plant());
  project.plants.push(plant({ x: 1, y: 1 }));
  assert.ok(validateProject(project));
  project.plants.pop();
  project.image = 'data:image/svg+xml;base64,abcd';
  assert.ok(validateProject(project));
  project.image = null;
  project.water.pop();
  assert.ok(validateProject(project));
});

test('clearing selected layers preserves other garden data', () => {
  const project = createSample();
  project.water[0] = true;
  project.electric[1] = true;
  project.image = 'data:image/png;base64,abcd';
  const surface = [...project.surface];
  clearProjectLayers(project, ['water', 'image']);
  assert.deepEqual(project.surface, surface);
  assert.equal(project.plants.length, 5);
  assert.equal(project.water[0], false);
  assert.equal(project.electric[1], true);
  assert.equal(project.image, null);
  assert.equal(validateProject(project), null);
  clearProjectLayers(project, ['surface']);
  assert.ok(project.surface.every(cell => cell === ''));
  assert.equal(project.plants.length, 0);
  assert.equal(project.electric[1], true);
  assert.equal(validateProject(project), null);
});

test('clearing only plants keeps their soil and utilities', () => {
  const project = createSample();
  project.water[0] = true;
  const surface = [...project.surface];
  clearProjectLayers(project, ['plants']);
  assert.deepEqual(project.surface, surface);
  assert.equal(project.plants.length, 0);
  assert.equal(project.water[0], true);
  assert.equal(validateProject(project), null);
});

test('buildings support independent wall segments, doors and windows without overlapping plants', () => {
  const project = createProject(6, 6);
  project.surface.fill('sand');
  const building = { id: 'house', name: 'House', cells: [] };
  project.buildings.push(building);
  assert.equal(editBuildingCell(project, building, 1, 1, 'wall'), null);
  assert.equal(editBuildingCell(project, building, 4, 4, 'wall'), null);
  assert.equal(editBuildingCell(project, building, 2, 1, 'wall'), null);
  assert.equal(editBuildingCell(project, building, 3, 1, 'wall'), null);
  assert.equal(editBuildingCell(project, building, 2, 1, 'door'), null);
  assert.equal(editBuildingCell(project, building, 3, 1, 'window'), null);
  assert.match(editBuildingCell(project, building, 1, 2, 'door'), /walls/);
  assert.equal(editBuildingCell(project, building, 2, 1, 'erase'), null);
  assert.equal(editBuildingCell(project, building, 2, 1, 'door'), 'Draw doors and windows over this building’s walls.');
  assert.equal(editBuildingCell(project, building, 2, 1, 'wall'), null);
  assert.equal(editBuildingCell(project, building, 2, 1, 'door'), null);
  assert.equal(buildingAt(project, 2, 1), building);
  assert.equal(plantFits(project, plant({ x: 1, y: 1 })), false);
  assert.equal(validateProject(project), null);
  assert.equal(editBuildingCell(project, building, 3, 1, 'erase'), null);
  const other = { id: 'shed', name: 'Shed', cells: [] };
  project.buildings.push(other);
  assert.match(editBuildingCell(project, other, 1, 1, 'wall'), /Another building/);
  project.plants.push(plant({ x: 4, y: 2 }));
  assert.match(editBuildingCell(project, other, 4, 2, 'wall'), /plant/);
  assert.equal(validateProject(project), null);
});

test('validates building data and reads legacy projects without buildings', () => {
  const project = createProject(4, 4);
  delete project.buildings;
  assert.equal(validateProject(project), null);
  project.buildings = [{ id: 'b', name: 'House', cells: [{ index: 0, type: 'wall' }, { index: 2, type: 'window' }] }];
  assert.equal(validateProject(project), null);
  project.buildings[0].cells[1].index = 1;
  assert.equal(validateProject(project), null);
  project.buildings.push({ id: 'c', name: 'Shed', cells: [{ index: 1, type: 'door' }] });
  assert.match(validateProject(project), /cells/);
  clearProjectLayers(project, ['buildings']);
  assert.equal(validateProject(project), null);
});
