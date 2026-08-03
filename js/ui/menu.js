import { renderProductCard } from "./productCard.js";

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");
function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
}

export function renderHomeSections({ promos, bestSellers }) {
  const promoScroll = document.getElementById("promoScroll");
  const bestScroll = document.getElementById("bestScroll");
  promoScroll.innerHTML = "";
  promos.forEach((p) => promoScroll.appendChild(renderProductCard(p)));
  bestScroll.innerHTML = "";
  bestSellers.forEach((p) => bestScroll.appendChild(renderProductCard(p)));
}

/** Ordena los productos de una categoría según el orden que fijó el admin (panel admin ->
 * Productos, botones ▲▼); los que no tienen orden asignado todavía usan su posición actual
 * como respaldo (índice), para no dejar el comparador con NaN si a ninguno le asignaron aún. */
function sortByOrder(list) {
  return list.map((p, i) => ({ ...p, order: p.order ?? i })).sort((a, b) => a.order - b.order);
}

export function initCatalog({ products, categories }) {
  const tabsEl = document.getElementById("categoryTabs");
  const gridEl = document.getElementById("catalogGrid");
  const searchInput = document.getElementById("searchInput");
  const searchBox = document.getElementById("searchBox");
  const searchClear = document.getElementById("searchClear");

  // Solo categorías con al menos un producto: si no, quedaba un chip que al tocarlo no
  // llevaba a ningún lado (porque esa categoría nunca pinta su bloque en el catálogo).
  const categoriesWithProducts = categories.filter((cat) => products.some((p) => p.category === cat.id));

  let activeCategory = categoriesWithProducts[0]?.id || null;
  let spyObserver = null;

  function setActiveChip(catId) {
    activeCategory = catId;
    tabsEl.querySelectorAll(".category-chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.cat === catId);
    });
  }

  tabsEl.innerHTML = "";
  categoriesWithProducts.forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip" + (cat.id === activeCategory ? " active" : "");
    chip.textContent = `${cat.icon} ${cat.label}`;
    chip.dataset.cat = cat.id;
    chip.addEventListener("click", () => {
      searchInput.value = "";
      searchBox.classList.remove("has-value");
      setActiveChip(cat.id);
      document.getElementById("catBlock-" + cat.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    tabsEl.appendChild(chip);
  });

  function paintSearchResults(q) {
    tabsEl.style.display = "none";
    const list = products.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.description).includes(q)
    );
    gridEl.innerHTML = "";
    if (list.length === 0) {
      gridEl.innerHTML = `<div class="empty-state">😕 No encontramos productos para "${searchInput.value}"</div>`;
      return;
    }
    const grid = document.createElement("div");
    grid.className = "catalog-grid";
    list.forEach((p) => grid.appendChild(renderProductCard(p)));
    gridEl.appendChild(grid);
  }

  /** Todas las categorías apiladas una tras otra (no solo la elegida): así, quien solo
   * hace scroll también recorre el menú completo sin tener que tocar los chips. Los
   * chips igual sirven para saltar directo, y se van resaltando solos según la sección
   * que esté más visible (estilo Rappi/Uber Eats). */
  function paintFullCatalog() {
    tabsEl.style.display = "flex";
    gridEl.innerHTML = "";
    if (categoriesWithProducts.length === 0) {
      gridEl.innerHTML = `<div class="empty-state">Todavía no hay productos.</div>`;
      return;
    }
    categoriesWithProducts.forEach((cat) => {
      const block = document.createElement("div");
      block.className = "catalog-category-block";
      block.id = "catBlock-" + cat.id;
      const title = document.createElement("h3");
      title.className = "catalog-category-title";
      title.textContent = `${cat.icon || ""} ${cat.label}`;
      const grid = document.createElement("div");
      grid.className = "catalog-grid";
      sortByOrder(products.filter((p) => p.category === cat.id)).forEach((p) => grid.appendChild(renderProductCard(p)));
      block.appendChild(title);
      block.appendChild(grid);
      gridEl.appendChild(block);
    });

    if (spyObserver) spyObserver.disconnect();
    spyObserver = new IntersectionObserver(
      (entries) => {
        const visibles = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visibles[0]) setActiveChip(visibles[0].target.id.replace("catBlock-", ""));
      },
      { rootMargin: "-130px 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75] }
    );
    categoriesWithProducts.forEach((cat) => {
      const el = document.getElementById("catBlock-" + cat.id);
      if (el) spyObserver.observe(el);
    });
  }

  function paint() {
    const q = normalize(searchInput.value);
    if (spyObserver) { spyObserver.disconnect(); spyObserver = null; }
    if (q.length > 0) paintSearchResults(q);
    else paintFullCatalog();
  }

  searchInput.addEventListener("input", () => {
    searchBox.classList.toggle("has-value", searchInput.value.length > 0);
    paint();
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchBox.classList.remove("has-value");
    searchInput.focus();
    paint();
  });

  paint();

  return {
    focusSearch: () => searchInput.focus(),
    goToCategory: (id) => {
      searchInput.value = "";
      searchBox.classList.remove("has-value");
      paint();
      setActiveChip(id);
      document.getElementById("catBlock-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };
}
