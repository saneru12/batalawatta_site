// Customer auth helpers (JWT stored in localStorage)
const AUTH_TOKEN_KEY = "bpn_customerToken";
const AUTH_CUSTOMER_KEY = "bpn_customer";

function getCustomerToken(){
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}
function getCustomer(){
  try { return JSON.parse(localStorage.getItem(AUTH_CUSTOMER_KEY) || "null"); } catch { return null; }
}
function setCustomerAuth(token, customer){
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (customer) localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(customer));
  renderAuthLinks();
}
function clearCustomerAuth(){
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_CUSTOMER_KEY);
  renderAuthLinks();
}
function isLoggedIn(){
  return !!getCustomerToken();
}
function authHeaders(extra){
  const h = Object.assign({}, extra || {});
  const t = getCustomerToken();
  if (t) h["Authorization"] = "Bearer " + t;
  return h;
}

function renderAuthLinks(){
  const wrap = document.getElementById("authLinks");
  if(!wrap) return;
  const cust = getCustomer();
  if (isLoggedIn()){
    wrap.innerHTML = `
      <a href="account.html" class="auth-link">Hi, ${cust?.name ? escapeHtml(cust.name) : "Customer"}</a>
      <a href="#" class="auth-link" id="logoutLink">Logout</a>
    `;
    const btn = document.getElementById("logoutLink");
    if(btn){
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        clearCustomerAuth();
        // keep cart sessionId (guest cart) so they can still checkout later
        window.location.href = "index.html";
      });
    }
  } else {
    wrap.innerHTML = `
      <a href="login.html" class="auth-link">Login</a>
      <a href="register.html" class="auth-link">Register</a>
    `;
  }
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[m]);
}

// Run on every page load
document.addEventListener("DOMContentLoaded", renderAuthLinks);


// Redirect to login with return URL (for protected actions/pages)
function requireLogin(nextUrl){
  try{
    const next = encodeURIComponent(nextUrl || (window.location.pathname.split("/").pop() + window.location.search));
    window.location.href = `login.html?next=${next}`;
  }catch{
    window.location.href = "login.html";
  }
}

// Utility: protect a full page (redirect if not logged in)
function protectPage(){
  if (!isLoggedIn()){
    requireLogin(window.location.pathname.split("/").pop() + window.location.search);
    return false;
  }
  return true;
}
