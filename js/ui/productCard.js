import { addToCart } from "../state/cart.js";
import { showToast } from "./toast.js";

const CLP = new Intl.NumberFormat("es-CL");

export function placeholderIcon(category) {
  const map = {
    promos: "⭐", completos: "🌭", as: "🌭", hamburguesas: "🍔", mechadas: "🍔",
    churrascos: "🍔", fajitas: "🌯", papas: "🍟", ensaladas: "🥗",
    dorilokos: "🤪", empanadas: "🥟", bebestibles: "🥤",
  };
  return map[category] || "🍽️";
}

/** Crea el nodo DOM de una card de producto (imagen, descripción, precio, botón agregar). */
export function renderProductCard(product) {
  const el = document.createElement("article");
  el.className = "product-card card-scroll-item";

  const photo = product.image
    ? `<img src="${product.image}" alt="${product.name}" loading="lazy">`
    : `<span aria-hidden="true">${placeholderIcon(product.category)}</span>`;

  const badge = product.promo
    ? `<span class="badge">Promo</span>`
    : product.bestSeller
      ? `<span class="badge badge-best">🔥 Más vendido</span>`
      : "";

  el.innerHTML = `
    <div class="product-photo">${photo}${badge}</div>
    <div class="product-body">
      <div class="product-name">${product.name}</div>
      ${product.description ? `<div class="product-desc">${product.description}</div>` : ""}
      <div class="product-footer">
        <span class="product-price">$${CLP.format(product.price)}</span>
        <button type="button" class="btn-add" aria-label="Agregar ${product.name} al carrito">+</button>
      </div>
    </div>`;

  const btn = el.querySelector(".btn-add");
  btn.addEventListener("click", () => {
    addToCart(product);
    btn.classList.remove("flash");
    void btn.offsetWidth;
    btn.classList.add("flash");
    if (navigator.vibrate) navigator.vibrate(12); // micro-feedback táctil, como en apps nativas
    showToast("➕ " + product.name.split(" - ")[0]);
  });

  return el;
}
