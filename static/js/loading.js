const overlay = document.getElementById("loadingOverlay");

export function showLoading() {
  overlay?.classList.remove("hidden");
}

export function hideLoading() {
  overlay?.classList.add("hidden");
}