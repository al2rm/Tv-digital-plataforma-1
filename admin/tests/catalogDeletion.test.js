import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteChannelSelection } from '../src/services/catalogDeletion.js';

test('elimina catálogos grandes en lotes secuenciales de hasta 500', async () => {
  const sizes = [];
  const progress = [];
  let active = 0;
  const result = await deleteChannelSelection(Array.from({ length: 1201 }, (_, i) => i + 1), async ids => {
    assert.equal(active++, 0);
    await Promise.resolve();
    sizes.push(ids.length);
    active--;
    return { data: { data: { deleted: ids, missing: 0 } } };
  }, state => progress.push(state.processed));
  assert.deepEqual(sizes, [500, 500, 201]);
  assert.deepEqual(progress, [500, 1000, 1201]);
  assert.deepEqual(result, { deleted: 1201, missing: 0 });
});

test('continúa si otro administrador ya eliminó un lote completo', async () => {
  let calls = 0;
  const result = await deleteChannelSelection(Array.from({ length: 501 }, (_, i) => i + 1), async ids => {
    if (++calls === 1) throw { response: { status: 404 } };
    return { data: { data: { deleted: ids, missing: 0 } } };
  });
  assert.deepEqual(result, { deleted: 1, missing: 500 });
});

test('detiene los lotes ante un error real y conserva el progreso', async () => {
  let calls = 0;
  const progress = [];
  await assert.rejects(deleteChannelSelection(Array.from({ length: 1001 }, (_, i) => i + 1), async ids => {
    if (++calls === 2) throw new Error('Sin conexión');
    return { data: { data: { deleted: ids, missing: 0 } } };
  }, state => progress.push(state.deleted)), /Sin conexión/);
  assert.equal(calls, 2);
  assert.deepEqual(progress, [500]);
});

test('elimina IDs duplicados y cuenta registros parcialmente ausentes', async () => {
  const result = await deleteChannelSelection([1, 1, 2], async ids => {
    assert.deepEqual(ids, [1, 2]);
    return { data: { data: { deleted: [1], missing: 1 } } };
  });
  assert.deepEqual(result, { deleted: 1, missing: 1 });
});
