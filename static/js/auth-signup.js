document.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        await userCred.user.updateProfile({ displayName: name });

        window.location.href = "/product-backlog";
    } catch (err) {
        alert(err.message);
    }
});
