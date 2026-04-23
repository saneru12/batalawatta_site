// Gallery (static for now) - you can replace URLs with your own photos
// Tip: Put your images in: frontend/assets/img/gallery/ and update the src fields.

const CATEGORIES = ["All", "Plants", "Harvest", "Nursery", "Customers"];

const GALLERY_ITEMS = [
  // Plants
  { id: "p1", title: "Rose Plant", category: "Plants", tags: ["rose", "flower"], src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTUJMMa2GtG4Mpt8smi1T7zp9bGInlxGeL3Zg&s" },
  { id: "p2", title: "Indoor Green Plant", category: "Plants", tags: ["indoor", "green"], src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRxcgX621kXNjGDiXnDseBpOW3QnNsVmy3jfQ&s" },
  { id: "p3", title: "Succulents", category: "Plants", tags: ["succulent"], src: "https://www.gardenia.net/wp-content/uploads/2023/05/succulents.webp" },

  // Harvest
  { id: "h1", title: "Fresh Harvest Basket", category: "Harvest", tags: ["harvest", "fresh"], src: "https://static.vecteezy.com/system/resources/previews/072/212/629/large_2x/fresh-harvest-basket-vibrant-fruits-and-vegetables-on-marble-countertop-photo.jpg" },
  { id: "h2", title: "Fruit Harvest", category: "Harvest", tags: ["fruits", "harvest"], src: "https://www.trees.com/wp-content/uploads/2020/11/Fruit-Harvest-Guide.jpg" },

  // Nursery
  { id: "n1", title: "Nursery Area", category: "Nursery", tags: ["nursery"], src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6zN84XCOY7weFHlPHWpICwUk9Fca3qYMEeQ&s" },
  { id: "n2", title: "Potting Setup", category: "Nursery", tags: ["pots", "soil"], src: "https://cdn.shopify.com/s/files/1/0862/7827/5406/files/indoor-gardening-supplies-potting-setup.jpg?v=1738599988" },

  // Customers
  { id: "c1", title: "Customer Garden", category: "Customers", tags: ["customer", "garden"], src: "https://www.gardencentermag.com/remote/aHR0cHM6Ly9naWVjZG4uYmxvYi5jb3JlLndpbmRvd3MubmV0L2ZpbGV1cGxvYWRzL3B1YmxpY2F0aW9ucy8xMy9pc3N1ZXMvMTAzNDcwL2FydGljbGVzL2ltYWdlcy9nYXJkZW5fZGVzaWduX3RpcHMuanBn.MbF5DHPy2bY.jpg?format=webp" },
  { id: "c2", title: "Balcony Plants", category: "Customers", tags: ["balcony", "indoor"], src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyh0l-R_zndtLf7dwDojQ12bR4AdfJlupdig&s" },
];

let activeCategory = "All";
let searchText = "";

const chipsEl = document.getElementById("galleryChips");
const gridEl = document.getElementById("galleryGrid");
const searchEl = document.getElementById("gallerySearch");

// Lightbox
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxMeta = document.getElementById("lightboxMeta");
const lightboxClose = document.getElementById("lightboxClose");

function renderChips(){
  chipsEl.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const b = document.createElement("button");
    b.className = "chip" + (cat === activeCategory ? " active" : "");
    b.type = "button";
    b.textContent = cat;
    b.addEventListener("click", () => {
      activeCategory = cat;
      renderChips();
      renderGrid();
    });
    chipsEl.appendChild(b);
  });
}

function filteredItems(){
  return GALLERY_ITEMS.filter(it => {
    const byCat = activeCategory === "All" ? true : it.category === activeCategory;
    const s = searchText.trim().toLowerCase();
    const bySearch = !s
      ? true
      : (it.title.toLowerCase().includes(s) || (it.tags || []).join(" ").toLowerCase().includes(s));
    return byCat && bySearch;
  });
}

function openLightbox(item){
  lightboxImg.src = item.src;
  lightboxTitle.textContent = item.title;
  lightboxMeta.textContent = item.category + (item.tags?.length ? " • " + item.tags.join(", ") : "");
  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox(){
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
}

function renderGrid(){
  const items = filteredItems();
  gridEl.innerHTML = "";
  if(!items.length){
    const empty = document.createElement("div");
    empty.className = "gallery-empty card";
    empty.innerHTML = '<div class="p"><b>No photos found</b><div class="muted">Try a different category or search term.</div></div>';
    gridEl.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "gallery-card card clickable";
    card.innerHTML = `
      <img src="${item.src}" alt="${item.title}">
      <div class="p">
        <b>${item.title}</b>
        <div class="muted">${item.category}</div>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(item));
    gridEl.appendChild(card);
  });
}

searchEl.addEventListener("input", (e) => {
  searchText = e.target.value;
  renderGrid();
});

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if(e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeLightbox();
});

// Init
renderChips();
renderGrid();
