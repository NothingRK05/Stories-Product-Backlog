export function showPopup(title, message) {
    document.getElementById("popupTitle").textContent = title;
    document.getElementById("popupMessage").textContent = message;
    document.getElementById("customPopup").classList.remove("hidden");

    document.getElementById("popupCloseBtn").onclick = () => {
        document.getElementById("customPopup").classList.add("hidden");
  };
}