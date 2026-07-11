/**
 * Catálogo de productos KBROS.
 * Estructura pensada para migrar 1:1 a Firebase Realtime Database bajo el nodo "products/{id}",
 * donde cada producto es exactamente este mismo objeto. Mientras no exista esa migración,
 * este archivo es la fuente de verdad que consumen los adapters (ver dataAdapter.js).
 */

const CATEGORIES = [
  { id: "promos", label: "Promociones KBROS", icon: "⭐" },
  { id: "completos", label: "Completos", icon: "🌭" },
  { id: "as", label: "As", icon: "🌭" },
  { id: "hamburguesas", label: "Hamburguesas", icon: "🍔" },
  { id: "mechadas", label: "Mechadas", icon: "🍔" },
  { id: "churrascos", label: "Churrascos", icon: "🍔" },
  { id: "fajitas", label: "Fajitas", icon: "🌯" },
  { id: "papas", label: "Papas fritas", icon: "🍟" },
  { id: "ensaladas", label: "Ensaladas", icon: "🥗" },
  { id: "dorilokos", label: "Dorilokos", icon: "🤪" },
  { id: "empanadas", label: "Empanadas", icon: "🥟" },
  { id: "bebestibles", label: "Bebestibles", icon: "🥤" },
];

// image: null => se usa un placeholder ilustrado con el icono de la categoría (ver ProductCard).
// Cuando existan fotos reales, basta con completar este campo con la URL — el resto del sistema
// no necesita cambios (ver "Recomendaciones" en el informe entregado junto a este prototipo).
const PRODUCTS = [
  // ---------------- PROMOCIONES (impulsan ticket promedio, van primero) ----------------
  p("promo-1", "promos", "X2 Completos o Italianos chicos + Papas chicas", 6000, {
    description: "Dos completos o italianos a elección + papas fritas chicas para compartir.",
    promo: true, bestSeller: true,
  }),
  p("promo-2", "promos", "X2 Churrascos Luco o Italianos + Papas chicas", 9900, {
    description: "Dos churrascos jugosos a elección + papas chicas.",
    promo: true,
  }),
  p("promo-piola", "promos", "X2 Fajitas Piola + Papas Piola", 13000, {
    description: "Dos fajitas piola bien cargadas + papas piola para acompañar.",
    promo: true,
  }),
  p("promo-kbros", "promos", "X2 Fajitas KBROS + Papas Pulentas", 14000, {
    description: "La combinación insignia: dos fajitas KBROS + papas pulentas.",
    promo: true, bestSeller: true,
  }),
  p("promo-insana", "promos", "X2 Mechaitos con papas + 2 bebidas 350ml", 15000, {
    description: "Dos mechaitos completos con papas incluidas + dos bebidas heladas.",
    promo: true,
  }),
  p("promo-bkn", "promos", "X6 As Italianos grandes + 10 Empanadas", 30000, {
    description: "Ideal para compartir en grupo: 6 As italianos grandes + 10 empanadas de queso.",
    promo: true,
  }),

  // ---------------- COMPLETOS ----------------
  ...sizedPair("completo-hotdog", "completos", "Hot Dog", 1500, 2100, "Vienesa clásica, pan hallulla y tus salsas favoritas."),
  ...sizedPair("completo-italiano", "completos", "Italiano", 2300, 3500, "Vienesa, tomate, palta y mayo. El clásico chileno.", { bestSellerGrande: true }),
  ...sizedPair("completo-completo", "completos", "Completo", 2100, 2900, "Vienesa, chucrut, tomate, palta y mayo."),
  ...sizedPair("completo-tocomple", "completos", "Tocomple", 2800, 3900, "Vienesa, tocino crocante, queso derretido y salsas."),
  ...sizedPair("completo-dinamico", "completos", "Dinámico", 2800, 3700, "Vienesa, papas hilo, chucrut, tomate y mayo."),
  ...sizedPair("completo-chamo", "completos", "Chamo", 2300, 3500, "Vienesa, repollo morado, tomate y salsas de la casa."),

  // ---------------- AS ----------------
  ...sizedPair("as-clasico", "as", "As", 2500, 3000, "Pan especial As, vienesa y salsas KBROS."),
  ...sizedPair("as-italiano", "as", "As Italiano", 3300, 4500, "Pan As, vienesa, tomate, palta y mayo.", { bestSellerGrande: true }),
  ...sizedPair("as-completo", "as", "As Completo", 3100, 3700, "Pan As, vienesa, chucrut, tomate, palta y mayo."),
  ...sizedPair("as-tocomple", "as", "As Tocomple", 3800, 4900, "Pan As, vienesa, tocino y queso derretido."),
  ...sizedPair("as-dinamico", "as", "As Dinámico", 3800, 4800, "Pan As, vienesa, papas hilo, chucrut y salsas."),
  ...sizedPair("as-queso", "as", "As Queso", 3300, 4500, "Pan As, vienesa y queso derretido bien generoso."),

  // ---------------- HAMBURGUESAS ----------------
  p("burger-clasica", "hamburguesas", "Hamburguesa Clásica", 4500, { description: "Carne 100% vacuno, lechuga, tomate y salsas KBROS." }),
  p("burger-italiana", "hamburguesas", "Hamburguesa Italiana", 4500, { description: "Carne, tomate, palta y mayo casera.", bestSeller: true }),
  p("burger-americana", "hamburguesas", "Hamburguesa Americana", 4500, { description: "Carne, queso cheddar, tocino y salsa BBQ." }),
  p("burger-cheddar-bacon", "hamburguesas", "Cheddar Bacon", 5500, { description: "Doble carne, cheddar derretido y tocino crocante." }),
  p("burger-con-papas", "hamburguesas", "Con papas", 1000, { description: "Suma papas fritas a tu hamburguesa." }),
  p("burger-papas-cheddar", "hamburguesas", "Papas + salsa cheddar", 1500, { description: "Papas fritas bañadas en salsa cheddar." }),
  p("burger-extra-cheddar", "hamburguesas", "Hamburguesa + cheddar", 1000, { description: "Agrega una capa extra de queso cheddar." }),

  // ---------------- MECHADAS ----------------
  p("mechada-luco", "mechadas", "Mecha-Luco", 5000, { description: "Carne mechada, queso derretido y palta." }),
  p("mechada-italiano", "mechadas", "Mechada Italiano", 5000, { description: "Carne mechada, tomate, palta y mayo.", bestSeller: true }),
  p("mechada-chacarero", "mechadas", "Mechada Chacarero", 5000, { description: "Carne mechada, poroto verde, tomate y ají verde." }),
  p("mechada-mechaito", "mechadas", "Mechaíto", 5500, { description: "Nuestra versión más cargada de carne mechada." }),
  p("mechada-con-papas", "mechadas", "Con papas", 1000, { description: "Suma papas fritas a tu mechada." }),
  p("mechada-papas-cheddar", "mechadas", "Papas + salsa cheddar", 1500, { description: "Papas fritas bañadas en salsa cheddar." }),

  // ---------------- CHURRASCOS ----------------
  p("churrasco-luco", "churrascos", "Churras-Luco", 4500, { description: "Churrasco, queso derretido y palta." }),
  p("churrasco-italiano", "churrascos", "Churrasco Italiano", 4500, { description: "Churrasco, tomate, palta y mayo." }),
  p("churrasco-chacarero", "churrascos", "Churrasco Chacarero", 4500, { description: "Churrasco, poroto verde, tomate y ají verde." }),
  p("churrasco-churrasquito", "churrascos", "Churrasquito", 5000, { description: "Nuestra versión más cargada de churrasco." }),
  p("churrasco-con-papas", "churrascos", "Con papas", 1000, { description: "Suma papas fritas a tu churrasco." }),
  p("churrasco-papas-cheddar", "churrascos", "Papas + salsa cheddar", 1500, { description: "Papas fritas bañadas en salsa cheddar." }),

  // ---------------- FAJITAS ----------------
  p("fajita-piola", "fajitas", "Fajita Piola", 5000, { description: "Fajita bien cargada, receta de la casa." }),
  p("fajita-kbros", "fajitas", "Fajita KBROS", 5500, { description: "Nuestra fajita insignia, la favorita de los clientes.", bestSeller: true }),
  p("fajita-a-tu-pinta", "fajitas", "Fajita a tu pinta", 6000, { description: "Arma tu fajita con los ingredientes que quieras." }),

  // ---------------- PAPAS FRITAS ----------------
  p("papas-altoke-chica", "papas", "Papas Altoke chica", 2500, { description: "Papas fritas crocantes, porción individual." }),
  p("papas-altoke-grande", "papas", "Papas Altoke grande", 5000, { description: "Papas fritas crocantes para compartir." }),
  p("papas-salchipapas-chica", "papas", "Salchipapas chicas", 3500, { description: "Papas fritas con trozos de vienesa." }),
  p("papas-salchipapas-grande", "papas", "Salchipapas grandes", 5500, { description: "Papas fritas con trozos de vienesa, porción grande." }),
  p("papas-piola", "papas", "Papas Piola", 5500, { description: "Papas con todos los agregados de la casa." }),
  p("papas-pulentas", "papas", "Papas Pulentas", 6000, { description: "Papas con carne mechada, queso y salsas.", bestSeller: true }),
  p("papas-gringas", "papas", "Papas Gringas", 6500, { description: "Papas con tocino, queso cheddar y salsas." }),
  p("papas-chidas", "papas", "Papas Chidas", 6500, { description: "Papas con toque picante estilo mexicano." }),
  p("papas-supremas", "papas", "Papas Supremas", 6500, { description: "La versión más completa de nuestras papas." }),

  // ---------------- OTROS ----------------
  p("ensalada", "ensaladas", "Ensalada", 5000, { description: "Fresca y liviana, ideal para acompañar o comer sola." }),
  p("doriloko", "dorilokos", "⭐ Doriloko ⭐", 4500, { description: "Doritos cargados con carne, queso y salsas KBROS.", bestSeller: true }),
  p("empanadas-queso", "empanadas", "Empanadas de queso x5", 2000, { description: "Cinco empanadas fritas rellenas de queso." }),
  p("bebida-lata", "bebestibles", "Bebida lata 350ml", 1300, { description: "Bien helada, a elección." }),
  p("jugo", "bebestibles", "Jugo", 1500, { description: "Jugo natural bien frío." }),
  p("agua", "bebestibles", "Agua", 1000, { description: "Agua mineral con o sin gas." }),
];

function p(id, category, name, price, opts = {}) {
  return {
    id,
    category,
    name,
    price,
    description: opts.description || "",
    image: opts.image || null,
    bestSeller: !!opts.bestSeller,
    promo: !!opts.promo,
  };
}

function sizedPair(idBase, category, name, priceChica, priceGrande, description, opts = {}) {
  return [
    p(idBase + "-chico", category, name + " - Chico", priceChica, { description }),
    p(idBase + "-grande", category, name + " - Grande", priceGrande, {
      description,
      bestSeller: !!opts.bestSellerGrande,
    }),
  ];
}

export function getCategories() {
  return CATEGORIES;
}

export function getAllProducts() {
  return PRODUCTS;
}

export function getPromoProducts() {
  return PRODUCTS.filter((x) => x.promo);
}

export function getBestSellers() {
  return PRODUCTS.filter((x) => x.bestSeller);
}
