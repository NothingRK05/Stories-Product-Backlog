const overlay = document.getElementById("loadingOverlay");

export function showLoading() {
  if (!overlay) return;
  overlay.classList.remove("hidden");
}

export function hideLoading() {
  if (!overlay) return;
  overlay.classList.add("hidden");
}
