/**
 * Habilita "arrastrar con el mouse" en los carruseles horizontales (Promociones,
 * Más vendidos). Por defecto un div con overflow-x:auto solo se puede desplazar con
 * scroll/touch; en desktop, sin esto, el usuario no tiene forma de arrastrarlo con clic.
 *
 * SOLO para mouse: en touch, el navegador ya sabe distinguir un swipe de un tap nativamente
 * (el scroll horizontal táctil funciona solo, sin JS). Si este mismo código interceptaba
 * también los toques, cualquier micro-movimiento normal del dedo al tocar (mucho más de
 * 6px, algo normal en una pantalla táctil) se interpretaba como "arrastre" y cancelaba el
 * click del botón "+" — el cliente tocaba "+" y no pasaba nada. Dejar touch fuera de esto
 * evita esa clase entera de bug.
 *
 * Distingue arrastre de click (mouse): la clase "dragging" (que desactiva pointer-events en
 * los hijos vía CSS) solo se agrega DESPUÉS de superar el umbral de movimiento, nunca en el
 * pointerdown. Agregarla de entrada rompía el botón "+" bajo el cursor: el navegador cancela
 * el click si el elemento pierde pointer-events entre el pointerdown y el click.
 */
const UMBRAL_PX = 6;

export function enableDragScroll(el) {
  if (!el || el.dataset.dragScrollBound) return;
  el.dataset.dragScrollBound = "1";

  let startX = 0;
  let startScroll = 0;
  let tracking = false;
  let moved = false;

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return; // deja el scroll nativo
    if (e.button !== undefined && e.button !== 0) return; // solo click principal
    tracking = true;
    moved = false;
    startX = e.clientX;
    startScroll = el.scrollLeft;
  });

  el.addEventListener("pointermove", (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > UMBRAL_PX) {
      moved = true;
      el.classList.add("dragging"); // recién ahora se desactivan los hijos: ya es un arrastre real
    }
    if (moved) {
      el.scrollLeft = startScroll - dx;
      e.preventDefault();
    }
  });

  function endDrag() {
    if (!tracking) return;
    tracking = false;
    el.classList.remove("dragging");
    if (moved) {
      // Bloquea el click sintético que el navegador dispara justo después del arrastre.
      const blockClick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        el.removeEventListener("click", blockClick, true);
      };
      el.addEventListener("click", blockClick, true);
    }
  }

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointerleave", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

export function enableDragScrollAll(selector = ".hscroll") {
  document.querySelectorAll(selector).forEach(enableDragScroll);
}
