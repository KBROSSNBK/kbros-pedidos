import { createStore } from "./store.js";

const CART_KEY = "kbros_cart_v1";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function persist(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const cartStore = createStore({ items: loadCart() });

export function addToCart(product) {
  const items = [...cartStore.getState().items];
  const found = items.find((i) => i.id === product.id);
  if (found) found.cantidad += 1;
  else
    items.push({
      id: product.id,
      nombre: product.name,
      precio: product.price,
      cantidad: 1,
      categoria: product.category,
      imagen: product.image || null,
    });
  persist(items);
  cartStore.setState({ items });
}

/**
 * Agrega una recompensa canjeada como "extra" del pedido: no suma al total en CLP
 * (precio: 0), pero consume K-Points al confirmar el pedido (ver cartUI.js). Se
 * identifica con esCanje:true para que el resto de la UI la trate distinto.
 */
export function addRedemptionToCart(reward) {
  const items = [...cartStore.getState().items];
  const id = "redeem-" + reward.id;
  const found = items.find((i) => i.id === id);
  if (found) found.cantidad += 1;
  else
    items.push({
      id,
      nombre: reward.name,
      precio: 0,
      cantidad: 1,
      categoria: null,
      imagen: null,
      esCanje: true,
      rewardId: reward.id,
      pointCost: reward.cost,
      icon: reward.icon || "🎁",
    });
  persist(items);
  cartStore.setState({ items });
}

export function cartCanjePoints(items = cartStore.getState().items) {
  return items.filter((i) => i.esCanje).reduce((s, i) => s + i.pointCost * i.cantidad, 0);
}

export function removeFromCart(id) {
  const items = cartStore.getState().items.filter((i) => i.id !== id);
  persist(items);
  cartStore.setState({ items });
}

export function changeQty(id, delta) {
  let items = [...cartStore.getState().items];
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) items = items.filter((i) => i.id !== id);
  persist(items);
  cartStore.setState({ items });
}

export function clearCart() {
  persist([]);
  cartStore.setState({ items: [] });
}

export function cartTotal(items = cartStore.getState().items) {
  return items.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

export function cartCount(items = cartStore.getState().items) {
  return items.reduce((s, i) => s + i.cantidad, 0);
}
