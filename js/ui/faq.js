import { openModal } from "./modal.js";

export function initFaq() {
  const btn = document.getElementById("helpFab");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const { sheet, close } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">❔ PREGUNTAS FRECUENTES</div>
      <div style="max-height:60vh;overflow-y:auto;padding-right:2px;">
        <div class="faq-item">
          <h3>🛒 ¿Cómo hago un pedido?</h3>
          <p>Elige tus productos desde el Menú tocando el "+" en cada card. Cuando estés listo, toca "Ver pedido", confirma si es Delivery o Retiro en local, y completa tus datos. Te llevamos directo a WhatsApp para confirmar.</p>
        </div>
        <div class="faq-item">
          <h3>⭐ ¿Cómo gano K-Points?</h3>
          <p>Inicia sesión con Google y haz tu pedido normalmente. Cada compra suma K-Points una vez que el administrador aprueba el pedido.</p>
        </div>
        <div class="faq-item">
          <h3>🎁 ¿Cómo canjeo una recompensa?</h3>
          <p>En la pestaña K-Points → Recompensas, agrega la recompensa a tu pedido. No suma al total a pagar, pero se descuentan los puntos correspondientes al confirmar el pedido. Si el pedido es rechazado, esos puntos se devuelven automáticamente.</p>
        </div>
        <div class="faq-item">
          <h3>🎯 ¿Qué son las misiones?</h3>
          <p>Metas del mes (ej. juntar cierta cantidad de compras o puntos). Al completarlas puedes reclamar un premio extra desde K-Points → Misiones.</p>
        </div>
        <div class="faq-item">
          <h3>🏅 ¿Cómo funcionan los rangos?</h3>
          <p>A medida que acumulas K-Points subes de rango (Papita Nueva → Completero → Parrillero → KBROS Legend). Es tu progreso personal, no una competencia con otros clientes.</p>
        </div>
        <div class="faq-item">
          <h3>🎂 ¿Puedo cambiar mi fecha de cumpleaños?</h3>
          <p>Se ingresa una sola vez para evitar abusos del bono de cumpleaños. Si te equivocaste, pide al staff que la corrija desde el mostrador.</p>
        </div>
      </div>
      <button class="modal-btn" id="btnCerrarFaq" type="button">ENTENDIDO</button>
    `);
    sheet.querySelector("#btnCerrarFaq").addEventListener("click", () => close());
  });
}
