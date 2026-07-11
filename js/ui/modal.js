/**
 * `onClose` solo se dispara cuando el usuario DESCARTA el modal (X, click afuera, Esc),
 * nunca cuando el propio flujo llama a `close()` tras un éxito — así los checkout flows
 * (elegirModoEntrega -> pedirDatos -> ...) pueden resolver su promesa una sola vez sin
 * que el "cancelado" se dispare también.
 */
let openCount = 0;

export function openModal(innerHTML, { onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-sheet">${innerHTML}</div>`;
  document.body.appendChild(overlay);
  openCount += 1;
  document.body.classList.add("modal-open");

  const sheet = overlay.querySelector(".modal-sheet");
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close-x";
  closeBtn.type = "button";
  closeBtn.innerHTML = "✕";
  closeBtn.setAttribute("aria-label", "Cerrar");
  closeBtn.onclick = () => dismiss();
  sheet.appendChild(closeBtn);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  const escHandler = (e) => {
    if (e.key === "Escape") dismiss();
  };
  document.addEventListener("keydown", escHandler);

  function remove() {
    document.removeEventListener("keydown", escHandler);
    overlay.remove();
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.classList.remove("modal-open");
  }

  function close() {
    remove();
  }

  function dismiss() {
    remove();
    if (onClose) onClose();
  }

  return { overlay, sheet, close };
}
