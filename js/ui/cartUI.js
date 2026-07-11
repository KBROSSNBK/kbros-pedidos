import { cartStore, addToCart, addRedemptionToCart, changeQty, removeFromCart, clearCart, cartTotal, cartCount, cartCanjePoints } from "../state/cart.js";
import { sessionStore, getRememberedContact, saveRememberedContact } from "../state/session.js";
import { getAdapter } from "../data/dataAdapter.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { placeholderIcon } from "./productCard.js";
import { goToView } from "./nav.js";
import { KBROS_LOCATION, WHATSAPP_NUMBER, DEFAULT_SETTINGS } from "../config.js";
import { calcularDescuentoRacha } from "../state/streak.js";

const CLP = new Intl.NumberFormat("es-CL");
let pointsConversion = 100;
export function setPointsConversion(v) { pointsConversion = v || 100; }

let checkoutSettings = { ...DEFAULT_SETTINGS };
export function setCheckoutSettings(settings) {
  checkoutSettings = { ...DEFAULT_SETTINGS, ...settings };
}

/** % de descuento por racha activo para el usuario actual (0 si no hay sesión o no tiene racha). */
function descuentoRachaActual() {
  const { authUser, userData, isAdmin } = sessionStore.getState();
  if (!authUser || isAdmin || !userData) return 0;
  return calcularDescuentoRacha(userData.racha || 0, checkoutSettings);
}

export function initCartBar() {
  const bar = document.getElementById("cartBar");
  const countEl = document.getElementById("cartBarCount");
  const totalEl = document.getElementById("cartBarTotal");

  cartStore.subscribe(({ items }) => {
    const count = cartCount(items);
    bar.classList.toggle("visible", count > 0);
    countEl.textContent = count + (count === 1 ? " producto" : " productos");
    totalEl.textContent = "$" + CLP.format(cartTotal(items));
  });

  document.getElementById("cartBarOpen").addEventListener("click", openCartSheet);
}

function renderCartLines(container) {
  const { items } = cartStore.getState();
  container.innerHTML = items
    .map(
      (i) => `
    <div class="order-line${i.esCanje ? " order-line-canje" : ""}" data-id="${i.id}">
      <div class="order-line-photo">${i.esCanje ? i.icon : i.imagen ? `<img src="${i.imagen}" alt="">` : placeholderIcon(i.categoria)}</div>
      <div class="order-line-main">
        <div class="order-line-name">${i.esCanje ? "🎁 " : ""}${i.nombre}</div>
        <div class="order-line-price">${i.esCanje ? `${CLP.format(i.pointCost * i.cantidad)} pts · no suma al total` : "$" + CLP.format(i.precio * i.cantidad)}</div>
      </div>
      <div class="qty-controls">
        <button type="button" data-action="dec" aria-label="Quitar uno">−</button>
        <span class="qty-value">${i.cantidad}</span>
        <button type="button" data-action="inc" aria-label="Agregar uno">+</button>
      </div>
      <button type="button" class="order-line-trash" data-action="trash" aria-label="Eliminar ${i.nombre}">🗑️</button>
    </div>`
    )
    .join("");
  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".order-line").dataset.id;
      if (btn.dataset.action === "trash") removeFromCart(id);
      else changeQty(id, btn.dataset.action === "inc" ? 1 : -1);
    });
  });
}

export function openCartSheet() {
  if (cartStore.getState().items.length === 0) {
    showToast("Tu carrito está vacío");
    return;
  }
  const { close, sheet } = openModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">🛒 TU PEDIDO</div>
    <div id="cartLines"></div>
    <button type="button" class="add-more-btn" id="btnAddMore">+ Agregar más productos</button>
    <div id="streakSummary"></div>
    <div id="pointsEarnSummary"></div>
    <div id="canjeSummary"></div>
    <div class="order-total-row"><span>Total</span> <span id="cartSheetTotal"></span></div>
    <button class="modal-btn outline" id="btnClearCart" type="button">Vaciar carrito</button>
    <button class="modal-btn" id="btnGoCheckout" type="button">CONTINUAR 🚀</button>
  `);
  const lines = sheet.querySelector("#cartLines");
  const totalEl = sheet.querySelector("#cartSheetTotal");
  const canjeSummaryEl = sheet.querySelector("#canjeSummary");
  const pointsEarnEl = sheet.querySelector("#pointsEarnSummary");
  const streakSummaryEl = sheet.querySelector("#streakSummary");

  // Recalcula el resumen tanto si cambia el carrito como si cambia la sesión (ej. el
  // cliente inicia o cierra sesión con el carrito ya abierto): antes solo escuchaba al
  // carrito, así que el resumen de puntos/racha quedaba pegado con la sesión vieja.
  function renderSummary() {
    const { items } = cartStore.getState();
    if (items.length === 0) { close(); return; }
    renderCartLines(lines);
    const total = cartTotal(items);
    const { authUser, isAdmin, userData } = sessionStore.getState();
    const descuentoPct = descuentoRachaActual();
    const descuentoMonto = Math.round((total * descuentoPct) / 100);
    const totalConDescuento = total - descuentoMonto;

    if (descuentoPct > 0) {
      totalEl.innerHTML = `<span style="text-decoration:line-through;color:var(--muted);font-size:0.85em;margin-right:6px;">$${CLP.format(total)}</span>$${CLP.format(totalConDescuento)}`;
      streakSummaryEl.innerHTML = `<p class="demo-note" style="text-align:left;padding:0 0.2rem;">🔥 Racha de <b style="color:var(--accent2);">${userData.racha} semana${userData.racha === 1 ? "" : "s"}</b>: <b style="color:var(--accent2);">${descuentoPct}% de descuento</b> aplicado (ahorras $${CLP.format(descuentoMonto)}).</p>`;
    } else {
      totalEl.textContent = "$" + CLP.format(total);
      streakSummaryEl.innerHTML = "";
    }

    if (isAdmin) {
      // No se oculta en silencio: se explica por qué no hay estimado, para que no
      // parezca un bug al probar la app con la cuenta admin.
      pointsEarnEl.innerHTML = `<p class="demo-note" style="text-align:left;padding:0 0.2rem;">👑 Tu cuenta es administrador: tiene K-Points ilimitados, así que no acumula puntos por compra.</p>`;
    } else if (authUser) {
      const puntosGanados = Math.floor(totalConDescuento / pointsConversion);
      pointsEarnEl.innerHTML = puntosGanados > 0
        ? `<p class="demo-note" style="text-align:left;padding:0 0.2rem;">⭐ Juntarás aprox. <b style="color:var(--accent2);">${CLP.format(puntosGanados)} K-Points</b> con esta compra (puede subir un poco más si eliges Delivery). Se acreditan cuando el administrador apruebe el pedido.</p>`
        : "";
    } else {
      pointsEarnEl.innerHTML = `<p class="demo-note" style="text-align:left;padding:0 0.2rem;">⭐ Inicia sesión antes de pedir para juntar K-Points con esta compra.</p>`;
    }

    const puntosCanje = cartCanjePoints(items);
    canjeSummaryEl.innerHTML = puntosCanje > 0
      ? `<p class="demo-note" style="text-align:left;padding:0 0.2rem;">🎁 Usarás <b style="color:var(--accent2);">${CLP.format(puntosCanje)} K-Points</b> en este pedido (no suman al total en $). Si el pedido se rechaza, se devuelven.</p>`
      : "";
  }

  const unsubCart = cartStore.subscribe(renderSummary);
  const unsubSession = sessionStore.subscribe(renderSummary);
  sheet.querySelector("#btnAddMore").addEventListener("click", () => {
    close();
    goToView("menu");
  });
  sheet.querySelector("#btnClearCart").addEventListener("click", () => {
    clearCart();
  });
  sheet.querySelector("#btnGoCheckout").addEventListener("click", () => {
    close();
    startCheckout();
  });
  // Des-suscripción al cerrar el modal por click afuera / X / Esc.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(sheet)) {
      unsubCart();
      unsubSession();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

function selectDeliveryMode() {
  return new Promise((resolve) => {
    const { close, sheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">¿CÓMO LO QUIERES?</div>
      <div class="modal-option" id="opt-delivery" tabindex="0">
        <span class="modal-opt-icon">🛵</span>
        <div><div class="modal-opt-title">Delivery</div><div class="modal-opt-sub">Te lo llevamos a domicilio</div></div>
        <div class="modal-check"></div>
      </div>
      <div class="modal-option" id="opt-retiro" tabindex="0">
        <span class="modal-opt-icon">🏃</span>
        <div><div class="modal-opt-title">Retiro en local</div><div class="modal-opt-sub">Pasa a buscar tu pedido</div></div>
        <div class="modal-check"></div>
      </div>
      <button class="modal-btn" id="btnConfirmModo" type="button">CONFIRMAR</button>
    `, { onClose: () => resolve(null) });
    let selected = null;
    ["delivery", "retiro"].forEach((opt) => {
      sheet.querySelector("#opt-" + opt).addEventListener("click", () => {
        selected = opt;
        sheet.querySelectorAll(".modal-option").forEach((el) => el.classList.remove("selected"));
        sheet.querySelector("#opt-" + opt).classList.add("selected");
      });
    });
    sheet.querySelector("#btnConfirmModo").addEventListener("click", () => {
      if (!selected) { showToast("Selecciona una opción"); return; }
      close();
      resolve(selected === "delivery" ? "DELIVERY" : "RETIRO");
    });
  });
}

function askContactInfo() {
  const remembered = getRememberedContact();
  return new Promise((resolve) => {
    const { close, sheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">TUS DATOS</div>
      <label class="modal-input-label">NOMBRE</label>
      <input class="modal-input" id="nombreInput" type="text" placeholder="¿Cómo te llamas?" value="${remembered?.nombre || ""}">
      <label class="modal-input-label">TELÉFONO (9 dígitos, sin +56)</label>
      <input class="modal-input" id="telefonoInput" type="tel" placeholder="9 1234 5678" maxlength="9" value="${remembered?.telefono || ""}">
      ${remembered ? `<p class="demo-note">Recordamos tus datos de tu último pedido para que sea más rápido. ¿No eres tú? Solo edítalos.</p>` : ""}
      <button class="modal-btn" id="btnConfirmDatos" type="button">LISTO ✓</button>
    `, { onClose: () => resolve(null) });

    // Safari/iPhone: la pestaña de WhatsApp se debe abrir en el instante del clic del
    // usuario o el navegador la bloquea; por eso se abre en blanco aquí y se completa
    // más adelante con la URL real (ver enviarPedido en checkout.js).
    sheet.querySelector("#btnConfirmDatos").addEventListener("click", () => {
      const nombre = sheet.querySelector("#nombreInput").value.trim();
      const telefono = sheet.querySelector("#telefonoInput").value.trim();
      if (!nombre) return showToast("Ingresa tu nombre");
      if (!/^\d{9}$/.test(telefono)) return showToast("Número inválido: 9 dígitos sin +56");
      const ventanaWhatsApp = window.open("", "_blank");
      saveRememberedContact(nombre, telefono);
      close();
      resolve({ nombre, telefono, ventanaWhatsApp });
    });
  });
}

function pickLocationOnMap() {
  return new Promise((resolve, reject) => {
    const { close, sheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">📍 TU UBICACIÓN</div>
      <p class="demo-note">Toca el mapa para marcar dónde quieres tu pedido</p>
      <div id="mapa" style="height:280px;border-radius:14px;overflow:hidden;border:1px solid var(--border2);margin-top:0.6rem;"></div>
      <button class="modal-btn" id="btnConfirmarUbicacion" type="button">CONFIRMAR UBICACIÓN</button>
    `, { onClose: () => reject(new Error("cancelado_por_usuario")) });

    const mapa = L.map(sheet.querySelector("#mapa")).setView([KBROS_LOCATION.lat, KBROS_LOCATION.lng], 16);
    L.marker([KBROS_LOCATION.lat, KBROS_LOCATION.lng]).addTo(mapa).bindPopup("✌KBROS😎").openPopup();
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapa);
    let marker = null, coords = null;
    mapa.on("click", (e) => {
      if (marker) marker.remove();
      marker = L.marker(e.latlng).addTo(mapa);
      coords = e.latlng;
    });
    mapa.locate({ setView: true, maxZoom: 17 });
    mapa.on("locationfound", (e) => L.circle(e.latlng, { radius: 50, color: "#ff6b2b" }).addTo(mapa));
    sheet.querySelector("#btnConfirmarUbicacion").addEventListener("click", () => {
      if (!coords) return showToast("Toca el mapa para marcar tu ubicación");
      close();
      resolve({ lat: coords.lat, lng: coords.lng });
    });
  });
}

async function calcularDistanciaKm(lat, lng) {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${KBROS_LOCATION.lng},${KBROS_LOCATION.lat}?overview=false`
    );
    const data = await r.json();
    return data.routes[0].distance / 1000;
  } catch {
    return 3; // fallback razonable si el ruteo externo falla
  }
}

export async function startCheckout() {
  const { items: itemsAntes } = cartStore.getState();
  const puntosCanjeReq = cartCanjePoints(itemsAntes);
  if (puntosCanjeReq > 0) {
    const { authUser, userData, isAdmin } = sessionStore.getState();
    if (!authUser) {
      showToast("Inicia sesión para usar tus canjes, o quítalos del carrito");
      return;
    }
    if (!isAdmin && (userData?.puntos || 0) < puntosCanjeReq) {
      showToast("No tienes suficientes K-Points para los canjes en tu carrito");
      return;
    }
  }

  const modo = await selectDeliveryMode();
  if (!modo) return;

  let costoDelivery = 0, ubicacion = "";
  if (modo === "DELIVERY") {
    try {
      const coords = await pickLocationOnMap();
      ubicacion = `${coords.lat},${coords.lng}`;
      const km = Math.round(await calcularDistanciaKm(coords.lat, coords.lng));
      const { deliveryBaseFee, deliveryPerKmFee, deliveryFreeKm } = checkoutSettings;
      costoDelivery = km <= deliveryFreeKm ? deliveryBaseFee : deliveryBaseFee + (km - deliveryFreeKm) * deliveryPerKmFee;
    } catch {
      showToast("No se pudo obtener tu ubicación");
      return;
    }
  }

  const datos = await askContactInfo();
  if (!datos) return;

  const { items } = cartStore.getState();
  const productItems = items.filter((i) => !i.esCanje);
  const canjeItems = items.filter((i) => i.esCanje);
  const subtotal = cartTotal(productItems);
  const descuentoPct = descuentoRachaActual();
  const descuentoMonto = Math.round((subtotal * descuentoPct) / 100);
  const totalFinal = subtotal - descuentoMonto + costoDelivery;

  let mensaje = `Soy ${datos.nombre}\nQuiero - ${modo}`;
  if (modo === "DELIVERY") mensaje += `\nUbicación: https://www.google.com/maps?q=${ubicacion}`;
  mensaje += `\nContacto: +56${datos.telefono}\n\nDetalle del pedido:\n`;
  productItems.forEach((i) => { mensaje += `• ${i.nombre} x${i.cantidad} = $${i.precio * i.cantidad}\n`; });
  if (canjeItems.length) {
    mensaje += `\n🎁 Extras canjeados con K-Points (no suman al total):\n`;
    canjeItems.forEach((i) => { mensaje += `• ${i.nombre} x${i.cantidad} (${i.pointCost * i.cantidad} pts)\n`; });
  }
  mensaje += `\nSubTotal: $${subtotal}`;
  if (descuentoPct > 0) mensaje += `\n🔥 Descuento por racha (${descuentoPct}%): -$${descuentoMonto}`;
  if (modo === "DELIVERY") mensaje += `\nDelivery: $${costoDelivery}`;
  mensaje += `\n\nTOTAL: $${totalFinal}`;

  const { authUser, userData } = sessionStore.getState();
  let puntosRegistrados = true;
  try {
    const adapter = await getAdapter();
    if (authUser && userData) {
      const puntos = Math.floor(totalFinal / pointsConversion);
      await adapter.submitOrder({
        uid: authUser.uid, codigo: userData.codigo, nombre: datos.nombre,
        modo, monto: totalFinal, puntos,
        items: productItems.map((i) => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, categoria: i.categoria, imagen: i.imagen })),
        canjes: canjeItems.length
          ? canjeItems.map((i) => ({ rewardId: i.rewardId, name: i.nombre, cost: i.pointCost, qty: i.cantidad, icon: i.icon }))
          : null,
      });
      window.dispatchEvent(new CustomEvent("kbros:pending-changed"));
    }
    if (productItems.length) {
      await adapter.recordProductSales(productItems.map((i) => ({ id: i.id, cantidad: i.cantidad })));
    }
  } catch (e) {
    console.error("No se pudo registrar el pedido para K-POINTS:", e);
    puntosRegistrados = false; // el pedido igual se envía por WhatsApp, no se pierde la venta
  }

  const url = `https://wa.me/${checkoutSettings.whatsappNumber || WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
  if (datos.ventanaWhatsApp && !datos.ventanaWhatsApp.closed) {
    datos.ventanaWhatsApp.location.href = url;
  } else {
    const w = window.open(url, "_blank");
    if (!w) window.location.href = url;
  }
  clearCart();
  showToast(puntosRegistrados ? "✅ ¡Pedido enviado!" : "⚠️ Tu pedido se envió, pero no pudimos registrar los K-Points. Avísale al local.");
}

/**
 * "Volver a pedir": reconstruye el carrito a partir de una compra pasada del historial.
 * Si esa compra incluía canjes, se vuelven a descontar los K-Points correspondientes al
 * confirmar el nuevo pedido — por eso primero se valida que el cliente tenga saldo
 * suficiente HOY; si no alcanza, se bloquea todo el reencargo con un error, no solo el canje.
 */
export function reorderPastOrder(order) {
  const items = order.items || [];
  const canjes = order.canjes || [];
  if (items.length === 0 && canjes.length === 0) {
    showToast("Este pedido no tiene detalle guardado para volver a pedirlo");
    return false;
  }
  if (canjes.length) {
    const { userData, isAdmin } = sessionStore.getState();
    const totalCanje = canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
    if (!isAdmin && (userData?.puntos || 0) < totalCanje) {
      showToast("❌ No tienes suficientes K-Points para volver a pedir esto");
      return false;
    }
  }
  items.forEach((i) => {
    for (let n = 0; n < (i.cantidad || 1); n++) {
      addToCart({ id: i.id, name: i.nombre, price: i.precio, category: i.categoria, image: i.imagen });
    }
  });
  canjes.forEach((c) => {
    for (let n = 0; n < (c.qty || 1); n++) {
      addRedemptionToCart({ id: c.rewardId, name: c.name, cost: c.cost, icon: c.icon || "🎁" });
    }
  });
  showToast("🛒 Pedido agregado al carrito");
  return true;
}
