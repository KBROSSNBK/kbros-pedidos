let timer;
export function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(timer);
  timer = setTimeout(() => { el.style.display = "none"; }, 1800);
}
