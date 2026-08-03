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

export function initCatalog({ products, categories }) {
  const tabsEl = document.getElementById("categoryTabs");
  const gridEl = document.getElementById("catalogGrid");
  const searchInput = document.getElementById("searchInput");
  const searchBox = document.getElementById("searchBox");
  const searchClear = document.getElementById("searchClear");

  let activeCategory = categories[0]?.id || null;

  tabsEl.innerHTML = "";
  categories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip" + (cat.id === activeCategory ? " active" : "");
    chip.textContent = `${cat.icon} ${cat.label}`;
    chip.dataset.cat = cat.id;
    chip.addEventListener("click", () => {
      activeCategory = cat.id;
      searchInput.value = "";
      searchBox.classList.remove("has-value");
      paint();
    });
    tabsEl.appendChild(chip);
  });

  function paint() {
    const q = normalize(searchInput.value);
    let list;
    let showTabs = true;
    if (q.length > 0) {
      showTabs = false;
      list = products.filter(
        (p) => normalize(p.name).includes(q) || normalize(p.description).includes(q)
      );
    } else {
      // El orden dentro de la categoría lo define el admin (ver panel admin -> Productos,
      // botones ▲▼); los productos sin orden asignado todavía usan su posición actual
      // como respaldo (índice), para no dejar el comparador con NaN si a ninguno le
      // asignaron orden aún.
      list = products
        .filter((p) => p.category === activeCategory)
        .map((p, i) => ({ ...p, order: p.order ?? i }))
        .sort((a, b) => a.order - b.order);
    }

    tabsEl.style.display = showTabs ? "flex" : "none";
    tabsEl.querySelectorAll(".category-chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.cat === activeCategory);
    });

    gridEl.innerHTML = "";
    if (list.length === 0) {
      gridEl.innerHTML = `<div class="empty-state">😕 No encontramos productos para "${searchInput.value}"</div>`;
      return;
    }
    list.forEach((p) => gridEl.appendChild(renderProductCard(p)));
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
      activeCategory = id;
      searchInput.value = "";
      searchBox.classList.remove("has-value");
      paint();
    },
  };
}
