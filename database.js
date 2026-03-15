'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE — dibaca sekali saat startup, tulis ke disk hanya saat ada
// perubahan. Ini menghilangkan readFileSync berulang yang menyebabkan delay.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT = { products: [], redfinger: [], orders: [], cooldowns: {} };

let _cache = null;

function _load() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    _cache = Object.assign({}, DEFAULT, JSON.parse(raw));
  } catch {
    _cache = structuredClone(DEFAULT);
  }
}

function _save() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(_cache, null, 2), 'utf8');
}

function db() {
  if (!_cache) _load();
  return _cache;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBUX PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

function getAllRobuxProducts() {
  return db().products;
}

function getProductById(id) {
  return db().products.find(p => String(p.id) === String(id)) ?? null;
}

function addProduct(id, name, stock, price = 0, sold = 0) {
  const d = db();
  if (!id) {
    const nums = d.products.map(p => Number(p.id)).filter(n => !isNaN(n));
    id = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }
  const product = { id, name, stock, price, sold };
  d.products.push(product);
  _save();
  return product;
}

function updateProductStock(id, stock) {
  const p = getProductById(id);
  if (!p) return false;
  p.stock = stock;
  _save();
  return true;
}

function updateProductSold(id, sold) {
  const p = getProductById(id);
  if (!p) return false;
  p.sold = sold;
  _save();
  return true;
}

function deleteProduct(id) {
  const d = db();
  const idx = d.products.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return false;
  d.products.splice(idx, 1);
  _save();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// REDFINGER PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

function getAllRedfingerProducts() {
  return db().redfinger;
}

function getRedfingerById(id) {
  return db().redfinger.find(p => String(p.id) === String(id)) ?? null;
}

function addRedfingerProduct(id, name, stock, price = 0, sold = 0) {
  const d = db();
  const product = { id, name, stock, price, sold };
  d.redfinger.push(product);
  _save();
  return product;
}

function updateRedfingerStock(id, stock) {
  const p = getRedfingerById(id);
  if (!p) return false;
  p.stock = stock;
  _save();
  return true;
}

function updateRedfingerSold(id, sold) {
  const p = getRedfingerById(id);
  if (!p) return false;
  p.sold = sold;
  _save();
  return true;
}

function updateRedfingerPrice(id, price) {
  const p = getRedfingerById(id);
  if (!p) return false;
  p.price = price;
  _save();
  return true;
}

function deleteRedfingerProduct(id) {
  const d = db();
  const idx = d.redfinger.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return false;
  d.redfinger.splice(idx, 1);
  _save();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

function createOrder(userId, username, productId, quantity, totalPrice) {
  const d = db();
  const id = d.orders.length > 0 ? Math.max(...d.orders.map(o => o.id)) + 1 : 1;
  const order = {
    id, user_id: userId, username, product_id: productId,
    quantity, total_price: totalPrice, status: 'pending',
    created_at: new Date().toISOString(), completed_at: null,
  };
  d.orders.push(order);
  _save();
  return order;
}

function getOrderById(id) {
  return db().orders.find(o => o.id === id) ?? null;
}

function updateOrderStatus(orderId, status) {
  const order = getOrderById(orderId);
  if (!order) return false;
  order.status = status;
  if (status === 'completed') order.completed_at = new Date().toISOString();
  _save();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWNS
// ─────────────────────────────────────────────────────────────────────────────

function getReviewCooldown(userId) {
  return db().cooldowns[userId] ?? 0;
}

function setReviewCooldown(userId) {
  db().cooldowns[userId] = Date.now();
  _save();
}

module.exports = {
  getAllRobuxProducts, getProductById, addProduct,
  updateProductStock, updateProductSold, deleteProduct,
  getAllRedfingerProducts, getRedfingerById, addRedfingerProduct,
  updateRedfingerStock, updateRedfingerSold, updateRedfingerPrice, deleteRedfingerProduct,
  createOrder, getOrderById, updateOrderStatus,
  getReviewCooldown, setReviewCooldown,
};
