// Register page logic
document.addEventListener("DOMContentLoaded", () => {
  refreshCartBadge();
  if (isLoggedIn()) {
    window.location.href = "account.html";
    return;
  }

  const form = document.getElementById("registerForm");
  const msg = document.getElementById("msg");

  function setMsg(t){ if(msg) msg.textContent = t || ""; }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Creating account...");
    try{
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const password = document.getElementById("password").value;
      const address = document.getElementById("address").value.trim();

      const res = await fetch(`${API_BASE}/customers/register`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ name, email, phone, password, address })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message || "Register failed");
        return;
      }

      clearCustomerAuth();
      setMsg("Account created! Please login.");
      const next = encodeURIComponent("account.html");
      window.location.href = `login.html?m=${encodeURIComponent("Account created successfully. Please login.")}&next=${next}`;
    }catch(err){
      setMsg("Server connection error. Start backend.");
    }
  });
});
