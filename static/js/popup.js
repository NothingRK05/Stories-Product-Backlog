export function showPopup(title, message) {
  const popup = document.getElementById("customPopup");
  document.getElementById("popupTitle").textContent = title;
  document.getElementById("popupMessage").textContent = message;

  popup.classList.remove("hidden");

  document.getElementById("popupCloseBtn").onclick = () => {
    popup.classList.add("hidden");
  };
}
