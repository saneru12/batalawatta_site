const list = document.getElementById("list");
const msg = document.getElementById("msg");

async function loadPlants() {
  const search = document.getElementById("search").value.trim();
  const category = document.getElementById("category").value;

  const url = new URL(`${API_BASE}/plants`);
  if (search) url.searchParams.set("search", search);
  if (category) url.searchParams.set("category", category);

  msg.textContent = "Loading...";
  const res = await fetch(url);
  const plants = await res.json();

  if (!Array.isArray(plants) || plants.length === 0) {
    list.innerHTML = "";
    msg.textContent = "No plants found.";
    return;
  }

  msg.textContent = `${plants.length} item(s) found`;
  list.innerHTML = plants.map(p => `
    <a class="card card-link" href="product.html?id=${p._id}">
      <img src="${p.imageUrl || 'https://picsum.photos/seed/plant/600/400'}" alt="${p.name}">
      <div class="p">
        <b>${p.name}</b>
        <div class="muted">${p.category} • Rs.${p.price}</div>
        <div class="muted">${p.description || ""}</div>
        <div class="muted">${p.available ? "Available" : "Out of stock"}</div>
      </div>
    </a>
  `).join("");
}

document.getElementById("btnLoad").addEventListener("click", loadPlants);
loadPlants().catch(() => (msg.textContent = "API connection error. Start backend."));
