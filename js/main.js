import { USE_MOCK, BRAND, DEFAULT_SETTINGS } from "./config.js";
import { getAdapter } from "./data/dataAdapter.js";
import { getAllProducts, getCategories as getLocalCategories } from "./data/menuData.js";
import { initNav, goToView } from "./ui/nav.js";
import { renderHomeSections, initCatalog } from "./ui/menu.js";
import { initCartBar, openCartSheet, setPointsConversion, setCheckoutSettings } from "./ui/cartUI.js";
import { initProfileView } from "./ui/profile.js";
import { initKpointsView } from "./ui/kpoints.js";
import { initSession, sessionStore } from "./state/session.js";
import { cartStore, cartCount } from "./state/cart.js";
import { enableDragScrollAll } from "./ui/dragScroll.js";
import { registerServiceWorker, initInstallBanner } from "./ui/pwaInstall.js";
import { initFaq } from "./ui/faq.js";
import { initAdminBell } from "./ui/adminBell.js";
import { showToast } from "./ui/toast.js";

function applySettingsToUI(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  document.getElementById("heroTitle").firstChild.textContent = s.heroTitle + " ";
  document.getElementById("heroSlogan").textContent = s.heroSlogan;
  document.getElementById("heroSubtitle").textContent = s.heroSubtitle;
  setPointsConversion(s.pointsPerClp);
  setCheckoutSettings(s);
}

async function bootstrap() {
  registerServiceWorker();
  initInstallBanner();

  if (USE_MOCK) {
    const banner = document.getElementById("demoBanner");
    if (banner) banner.hidden = false;
  }

  const adapter = await getAdapter();

  // Ajustes generales (texto del hero, delivery, WhatsApp, K-Points): salen del adapter
  // para que el panel admin los pueda editar sin tocar código.
  try {
    applySettingsToUI(await adapter.getSettings());
  } catch {
    applySettingsToUI(DEFAULT_SETTINGS);
  }
  window.addEventListener("kbros:settings-updated", (e) => applySettingsToUI(e.detail));

  // Productos: se piden al adapter (Firebase o mock) para que el catálogo ya esté
  // "listo" para administrarse en línea; si el nodo no existe aún, cae al catálogo local.
  let products;
  try {
    products = await adapter.getProducts();
  } catch {
    products = getAllProducts();
  }
  // Categorías: mismo patrón que productos, editables desde el panel admin.
  let categories;
  try {
    categories = await adapter.getCategories();
  } catch {
    categories = getLocalCategories();
  }

  let bestSellers;
  try {
    bestSellers = await adapter.getBestSellers(8);
  } catch {
    bestSellers = products.filter((p) => p.bestSeller);
  }

  renderHomeSections({
    promos: products.filter((p) => p.promo),
    bestSellers,
  });
  const catalog = initCatalog({ products, categories });
  enableDragScrollAll(".hscroll, .category-tabs");

  initNav();
  initCartBar();
  initProfileView();
  initKpointsView();
  initFaq();
  initAdminBell();
  window.addEventListener("kbros:birthday-bonus", (e) => {
    showToast(`🎉🎂 ¡Feliz cumpleaños! Te regalamos ${e.detail.amount} K-Points`);
  });
  await initSession();

  // Social proof: likes + usuarios activos
  const likeBtn = document.getElementById("likeChip");
  const likeCount = document.getElementById("likeCount");
  const viewersCount = document.getElementById("viewersCount");
  adapter.onLikes((n) => { likeCount.textContent = n; });
  adapter.onActiveUsers((n) => { viewersCount.textContent = n; });
  likeBtn.addEventListener("click", () => adapter.incrementLike());

  // K-Points en la topbar (visible solo si hay sesión)
  const topbarPoints = document.getElementById("topbarPoints");
  sessionStore.subscribe(({ authUser, userData, isAdmin }) => {
    if (!authUser) { topbarPoints.hidden = true; return; }
    topbarPoints.hidden = false;
    topbarPoints.textContent = "⭐ " + (isAdmin ? "∞" : (userData?.puntos || 0).toLocaleString("es-CL"));
  });

  // Carrito persistente en la topbar (accesible desde cualquier vista, estilo PedidosYa)
  document.getElementById("topbarCartBtn").addEventListener("click", openCartSheet);
  const topbarCartDot = document.getElementById("topbarCartDot");
  cartStore.subscribe(({ items }) => {
    const n = cartCount(items);
    topbarCartDot.hidden = n === 0;
    topbarCartDot.textContent = n;
  });

  // Hero CTAs
  document.getElementById("ctaVerMenu").addEventListener("click", () => {
    goToView("menu");
  });
  document.getElementById("ctaPedirAhora").addEventListener("click", () => {
    goToView("menu");
    requestAnimationFrame(() => catalog.focusSearch());
  });

  // Botón "ver todo" de Más vendidos en Inicio -> Menú
  document.getElementById("seeAllBest")?.addEventListener("click", () => goToView("menu"));
  document.getElementById("seeAllPromo")?.addEventListener("click", () => goToView("menu"));

  // Badge de cantidad en el ícono "Menú" de la nav inferior (feedback rápido de carrito)
  const menuNavDot = document.getElementById("menuNavDot");
  cartStore.subscribe(({ items }) => {
    const n = cartCount(items);
    menuNavDot.hidden = n === 0;
    menuNavDot.textContent = n;
  });

  document.title = `${BRAND.name} — Pide en menos de 30 segundos`;
}

// Pantalla de carga: se muestra al menos MIN_SPLASH_MS (para que la animación de marca
// se note) y espera a que bootstrap() termine si toma más que eso, así nunca se oculta
// mientras la página sigue armándose.
const MIN_SPLASH_MS = 3200;
const splashStart = Date.now();
bootstrap().finally(() => {
  const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashStart));
  setTimeout(() => {
    document.getElementById("splashScreen")?.classList.add("hide");
  }, remaining);
});
