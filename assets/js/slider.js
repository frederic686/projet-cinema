/* =========================
   Slider 100% JavaScript
   - précharge et filtre les images cassées
   - boucle infinie toutes les 4s
   - navigation clavier
   - transition pages (fade out)
========================= */

// Dossier de base des images du slider
const BASE = "assets/images/affiches/";
// Liste des noms de fichiers des images
const IMAGES = [
  "nobody-accueil.jpg",
  "nobody-2.jpg",
  "TNG.png",
  "evanouis.webp",
  "karate-kid-legends.webp",
  "karate-kid-legends-2.jpg",
  "le-monde-de-wishy.jpg",
  "le-monde-de-wishy-2.jpg",
  "nobody-2_header-mobile.jpg"
];

// L'élément conteneur du slider dans le HTML
const slidesEl = document.getElementById("slides");

/**
 * Précharge une image.
 * Retourne une Promesse qui résout si l'image charge, ou rejette si elle est cassée.
 * @param {string} src - Nom du fichier de l'image (ex: "nobody-accueil.jpg")
 * @returns {Promise<string>}
 */
function preload(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); // Crée une image en mémoire
    img.onload = () => resolve(src); // Succès
    img.onerror = () => reject(src); // Échec (image cassée, 404)
    img.src = BASE + encodeURIComponent(src); // Lance le chargement
  });
}

/**
 * Fonction principale (IIFE) qui initialise le slider.
 */
(async function initSlider() {
  if (!slidesEl) return; // Ne fait rien si l'élément #slides n'existe pas

  // 1. Tente de précharger TOUTES les images en parallèle
  // Promise.allSettled attend que toutes les promesses soient finies (succès ou échec)
  const results = await Promise.allSettled(IMAGES.map(preload));
  
  // 2. Garde uniquement les images qui ont chargé avec succès
  const validImages = results
    .filter(r => r.status === "fulfilled") // Garde les succès
    .map(r => r.value); // Récupère le nom du fichier

  if (validImages.length === 0) {
    console.error("[slider] Aucune image valide trouvée");
    // Le slider restera vide, mais le site ne plantera pas
    return;
  }

  // 3. Crée les éléments <div> pour chaque image valide
  const slides = validImages.map(file => {
    const s = document.createElement("div");
    s.className = "slide";
    s.style.backgroundImage = `url("${BASE + encodeURIComponent(file)}")`;
    slidesEl.appendChild(s);
    return s;
  });

  // 4. Logique du slider
  let idx = 0; // Index de la slide active
  let timer = null; // Référence vers le setInterval
  const INTERVAL = 4000; // 4 secondes

  /**
   * Affiche la slide à l'index 'i'.
   * Gère le retour au début (boucle).
   * @param {number} i - Index de la slide à afficher
   */
  function goTo(i) {
    // (i + slides.length) % slides.length : astuce pour gérer les index négatifs
    // ex: (0 - 1 + 5) % 5 = 4 (on passe de la slide 0 à la slide 4)
    idx = (i + slides.length) % slides.length;
    
    // Ajoute/retire la classe "is-active"
    slides.forEach((s, k) => s.classList.toggle("is-active", k === idx));
  }

  function next() {
    goTo(idx + 1);
  } // Passe à la slide suivante
  
  function start() {
    stop(); // Arrête l'ancien timer (sécurité)
    if (slides.length > 1) timer = setInterval(next, INTERVAL); // Lance le nouveau
  }
  
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // 5. Démarrage
  goTo(0); // Affiche la première slide
  start(); // Lance le défilement automatique

  // 6. Navigation clavier (flèches)
  document.addEventListener("keydown", (e) => {
    if (slides.length <= 1) return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") goTo(idx - 1);
  });
})();

/* Transition pages (fondu au clic) */
// Sélectionne tous les liens <a>, .btn-reserver, et <button data-href>
document.querySelectorAll('a, .btn-reserver, button[data-href]').forEach(el => {
  el.addEventListener('click', (e) => {
    const href = el.getAttribute('href') || el.dataset.href || "";
    
    // Ignore les liens internes (#) ou les liens vides
    if (!href || href.startsWith('#')) return;
    
    e.preventDefault(); // Empêche la navigation immédiate
    document.body.classList.add('fade-out'); // Ajoute la classe pour l'animation CSS
    
    // Attend la fin de l'animation (500ms) avant de changer de page
    setTimeout(() => {
      window.location = href;
    }, 500);
  });
});