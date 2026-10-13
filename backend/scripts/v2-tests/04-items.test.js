'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { axiosError } = require('./mock');

test('items: usa sales-invoices y NO llama a sales-orders', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  const m = h.use();
  m.setHandler(h.orderRouter());
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].prefijo, 'M');
  assert.equal(res.items[0].es_montura, true);
  assert.ok(!m.calls.some((c) => c.url.includes('/sales-orders/')),
    'no debe consultar sales-orders si la factura tiene líneas');
});

test('items: fallback a sales-orders cuando la factura viene vacía', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  const m = h.use();
  m.setHandler(h.orderRouter({
    invoice: async () => ({ lines: [] }),
    salesOrder: async () => ({ lines: [h.line({ productId: 200 })] }),
    product: async () => ({ reference: 'C55', description: 'Cristal' }),
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items.length, 1);
  assert.ok(m.calls.some((c) => c.url.includes('/sales-orders/666')), 'debe usar sales-orders como fallback');
});

test('items: fallback a sales-orders cuando la factura da error', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  h.use().setHandler(h.orderRouter({
    invoice: async () => { throw axiosError(404, null, { detail: 'not found' }); },
    salesOrder: async () => ({ lines: [h.line({ productId: 200 })] }),
    product: async () => ({ reference: 'M200', description: 'Montura' }),
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items.length, 1);
});

test('items: factura y pedido vacíos → items=[] sin romper', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  h.use().setHandler(h.orderRouter({
    invoice: async () => ({ lines: [] }),
    salesOrder: async () => ({ lines: [] }),
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.deepEqual(res.items, []);
});

test('items: producto 404 → descripción por defecto, sin romper', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  h.use().setHandler(h.orderRouter({
    invoice: async () => ({ lines: [h.line({ productId: 999 })] }),
    product: async () => { throw axiosError(404, null, { detail: 'product not found' }); },
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].descripcion, 'Descripción no disponible');
  assert.equal(res.items[0].codigo_articulo, null);
  assert.equal(res.items[0].es_montura, false);
});

test('items: clasificación de cristal por prefijo/descripción', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  h.use().setHandler(h.orderRouter({
    invoice: async () => ({ lines: [h.line({ productId: 100 })] }),
    product: async () => ({ reference: 'C55', description: 'Cristal Progresivo' }),
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items[0].es_cristal, true);
  assert.equal(res.items[0].prefijo, 'H', 'progresivo → prefijo H');
  assert.equal(res.items[0].codigo_completo, 'HC55');
});

test('items: productCache evita repetir getProduct (mismo producto)', async () => {
  const { fetchAndMapOrder } = h.freshFetch();
  const m = h.use();
  m.setHandler(h.orderRouter({
    invoice: async () => ({ lines: [h.line({ productId: 100 }), h.line({ productId: 100 })] }),
    product: async () => ({ reference: 'M100', description: 'Montura' }),
  }));
  const res = await fetchAndMapOrder('114200001925');
  assert.equal(res.items.length, 2);
  const productCalls = m.calls.filter((c) => c.url.includes('/products/'));
  assert.equal(productCalls.length, 1, 'debe cachear el producto');
});
