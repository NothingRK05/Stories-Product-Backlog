import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showPopup } from "./popup.js";

document.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("resetEmail").value.trim();

    if (!email) {
        showPopup("Missing Email", "Please enter your email address.");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showPopup("Email Sent", "If an account exists for that email, a reset link has been sent. Check your inbox.");
    } catch (err) {
        showPopup("Error", err.message);
    }
});