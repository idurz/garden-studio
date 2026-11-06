import test from 'node:test';
import assert from 'node:assert/strict';
import { clearProjectLayers, createProject, createSample, plantAt, plantFits, validateProject } from '../public/model.js';

function plant(overrides = {}) {
  return { id: 'one', name: 'Fern', type: 'plant', x: 0, y: 0, width: 2, height: 2, purchased: '', retailer: '', prune: '', notes: '', ...overrides };
}

test('sample and blank projects have valid 10 cm grid data', () => {
  assert.equal(validateProject(createSample()), null);
  const project = createProject(3, 4);
  assert.equal(project.surface.length, 12);
  assert.equal(validateProject(project), null);
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
