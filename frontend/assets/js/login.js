// Login page logic
document.addEventListener("DOMContentLoaded", () => {
  refreshCartBadge();
  if (isLoggedIn()) {
    // already logged in
    window.location.href = "account.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const nextUrl = params.get("next") || "account.html";
  const m = params.get("m");

  const form = document.getElementById("loginForm");
  const msg = document.getElementById("msg");

  function setMsg(t){ if(msg) msg.textContent = t || ""; }
  if (m) setMsg(m);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Logging in...");
    try{
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const res = await fetch(`${API_BASE}/customers/login`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message || "Login failed");
        return;
      }

      setCustomerAuth(data.token, data.customer);
      setMsg("Login success! Redirecting...");
      window.location.href = nextUrl;
    }catch(err){
      setMsg("Server connection error. Start backend.");
    }
  });
});
