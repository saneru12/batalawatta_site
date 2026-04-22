// Home page logic: featured plants preview
document.addEventListener("DOMContentLoaded", () => {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
  loadFeaturedPlants();
});

async function loadFeaturedPlants(){
  const host = document.getElementById("featured");
  if(!host) return;

  host.innerHTML = "<div class='muted'>Loading...</div>";
  try{
    const res = await fetch(`${API_BASE}/plants`);
    const plants = await res.json();

    if(!Array.isArray(plants) || plants.length === 0){
      host.innerHTML = "<div class='muted'>No plants found.</div>";
      return;
    }

    const subset = plants.slice(0, 6); // show a subset (top 6)
    host.innerHTML = subset.map(p => `
      <a class="card card-link" href="product.html?id=${encodeURIComponent(p._id)}">
        <img src="${p.imageUrl || p.image || 'https://picsum.photos/seed/plant/600/400'}" alt="${escapeHtml(p.name || 'Plant')}">
        <div class="p">
          <b>${escapeHtml(p.name || 'Plant')}</b>
          <div class="muted">${escapeHtml(p.category || '')}${p.price != null ? ` • Rs.${p.price}` : ''}</div>
          <div class="muted">${p.available === false ? 'Out of stock' : 'Available'}</div>
        </div>
      </a>
    `).join("");
  }catch(e){
    host.innerHTML = "<div class='muted'>API connection error. Start backend.</div>";
  }
}


// tiny helper to avoid broken HTML from data
function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}
