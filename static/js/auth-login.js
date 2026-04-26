document.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = "/product-backlog";
    } catch (err) {
        alert(err.message);
    }
});
