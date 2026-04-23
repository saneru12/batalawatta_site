// Gallery (static for now) - you can replace URLs with your own photos
// Tip: Put your images in: frontend/assets/img/gallery/ and update the src fields.

const CATEGORIES = ["All", "Plants", "Harvest", "Nursery", "Customers"];

const GALLERY_ITEMS = [
  // Plants
  { id: "p1", title: "Rose Plant", category: "Plants", tags: ["rose", "flower"], src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTUJMMa2GtG4Mpt8smi1T7zp9bGInlxGeL3Zg&s" },
  { id: "p2", title: "Indoor Green Plant", category: "Plants", tags: ["indoor", "green"], src: "https://picsum.photos/seed/indoor-plant/1200/800" },
  { id: "p3", title: "Succulents", category: "Plants", tags: ["succulent"], src: "https://picsum.photos/seed/succulents/1200/800" },

  // Harvest
  { id: "h1", title: "Fresh Harvest Basket", category: "Harvest", tags: ["harvest", "fresh"], src: "https://picsum.photos/seed/harvest-basket/1200/800" },
  { id: "h2", title: "Fruit Harvest", category: "Harvest", tags: ["fruits", "harvest"], src: "https://picsum.photos/seed/fruit-harvest/1200/800" },

  // Nursery
  { id: "n1", title: "Nursery Area", category: "Nursery", tags: ["nursery"], src: "https://picsum.photos/seed/nursery-area/1200/800" },
  { id: "n2", title: "Potting Setup", category: "Nursery", tags: ["pots", "soil"], src: "https://picsum.photos/seed/potting/1200/800" },

  // Customers
  { id: "c1", title: "Customer Garden", category: "Customers", tags: ["customer", "garden"], src: "https://picsum.photos/seed/customer-garden/1200/800" },
  { id: "c2", title: "Balcony Plants", category: "Customers", tags: ["balcony", "indoor"], src: "https://picsum.photos/seed/balcony-plants/1200/800" },
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
