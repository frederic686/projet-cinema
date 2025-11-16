// =========================================================
// SALLE (Page 3) – Script COMPLET (corrigé)
// =========================================================

// ---------- Helpers & Params ----------

// Helper pour sélectionner un seul élément DOM (type jQuery)
const $ = (s, ctx = document) => ctx.querySelector(s);
// Helper pour sélectionner plusieurs éléments DOM et les retourner en Array
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
// Récupère les paramètres de l'URL (ex: ?film=Titre)
const params = new URLSearchParams(location.search);

// --- Récupération des paramètres d'URL ---
// On récupère les infos passées par la page précédente (catalogue.html)
// || 'Film' est une valeur par défaut si le paramètre est manquant.
const filmTitre = params.get('film') || 'Film';
const room = params.get('salle') || '—';
const lang = params.get('langue') || '—';
const timeStr = params.get('seance') || '';
// Clé unique pour le localStorage, basée sur la séance
const seanceKey = `${filmTitre}|${room}|${timeStr}`;

// --- Paramètre de débogage ---
// Permet de forcer des sièges pris via l'URL (ex: ?taken=A1,B3)
const URL_TAKEN = (params.get('taken') || '')
  .split(',') // Sépare les sièges par la virgule
  .map(s => s.trim().toUpperCase()) // Nettoie (espaces, majuscules)
  .filter(Boolean); // Retire les chaînes vides

// ---------- État ----------
// Objet principal qui contient l'état de l'application pour cette page
const state = {
  rows: 16, // Nombre de rangées
  cols: 18, // Nombre de colonnes
  taken: new Set(), // Sièges bloqués (gris) - 'Set' pour éviter les doublons et rapidité
  selected: new Set(), // Sièges de l’utilisateur (verts)
  custom: new Map(), // Pour des icônes spécifiques (non utilisé dans ce script mais prévu)
  poster: '', // Nom du fichier de l'affiche
  format: '', // Format (IMAX, 4K)
  end: '', // Heure de fin
  selectedSeance: null // L'objet complet de la séance (chargé depuis films.json)
};

// ---------- Configuration des sièges ----------
// Définit les sièges qui sont toujours indisponibles ou spéciaux
const FIXED_OVERRIDES = {
  // Sièges "pris" en dur (ex: problèmes techniques, réservés staff)
  taken: ['G9', 'G10', 'A1'],
  // Espaces vides (couloirs, murs) qui ne sont pas des sièges
  gaps: ['A5', 'A6', 'A13', 'A14', 'P1', 'P18', 'E5'],
  // Icônes personnalisées (ex: sièges PMR)
  customIcon: {
    'A7': '../images/PICTOS/desactive.png', // Siège PMR (exemple)
    'A8': '../images/PICTOS/desactive.png',
    'A9': '../images/PICTOS/desactive.png',
    'A10': '../images/PICTOS/desactive.png',
    'A11': '../images/PICTOS/desactive.png',
    'A12': '../images/PICTOS/desactive.png',
  }
};
// Fusionne les sièges pris "en dur" avec ceux passés dans l'URL (pour le débogage)
// On utilise un Set pour gérer automatiquement les doublons
FIXED_OVERRIDES.taken = Array.from(new Set([...FIXED_OVERRIDES.taken, ...URL_TAKEN]));

// Ajoute dynamiquement les couloirs (colonnes 4 et 15) comme "gaps"
for (let r = 0; r < 16; r++) { // Pour chaque rangée (de 0 à 15)
  // String.fromCharCode(65 + r) convertit 0->'A', 1->'B', etc.
  FIXED_OVERRIDES.gaps.push(`${String.fromCharCode(65 + r)}4`); // Ajoute A4, B4, C4...
  FIXED_OVERRIDES.gaps.push(`${String.fromCharCode(65 + r)}15`); // Ajoute A15, B15, C15...
}

// ---------- Utilitaires ----------

/**
 * Génère un ID de siège (ex: "A1") à partir des index de rangée/colonne.
 * @param {number} r Index de rangée (0-15)
 * @param {number} c Index de colonne (0-17)
 * @returns {string} ID du siège (ex: "A1", "P18")
 */
const seatId = (r, c) => `${String.fromCharCode(65 + r)}${c + 1}`;

/**
 * Normalise une chaîne de caractères pour la comparaison.
 * Retire accents, passe en minuscules, retire espaces superflus.
 * @param {string} str Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 */
function normalize(str = '') {
  return str.toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Retire les accents
    .toLowerCase() // Minuscules
    .trim(); // Espaces début/fin
}

/**
 * Calcule l'ensemble initial des sièges "pris".
 * Prend en compte les overrides fixes et les icônes "desactive".
 */
function computeAvailability() {
  // Initialise les sièges pris avec la liste de FIXED_OVERRIDES
  state.taken = new Set(FIXED_OVERRIDES.taken);
  
  // Si un siège a une icône custom "desactive", il doit aussi être considéré comme "pris"
  Object.entries(FIXED_OVERRIDES.customIcon || {}).forEach(([id, path]) => {
    // /desactive/i.test(...) vérifie si le chemin de l'image contient "desactive" (insensible à la casse)
    if (/desactive/i.test(path || '')) state.taken.add(id);
  });
}

// ---------- Persistance (localStorage) ----------
// Sauvegarde et restaure la sélection de l'utilisateur pour qu'il
// puisse revenir sur la page sans perdre ses sièges.

const LS_KEY = 'pathe_reservation'; // Clé principale pour le localStorage

// Charge TOUTES les réservations (pour toutes les séances) depuis le LS
const loadAll = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {}; // En cas d'erreur de parsing JSON, retourne un objet vide
  }
};

/**
 * Sauvegarde l'état actuel (sièges sélectionnés, pris) pour CETTE séance
 * dans le localStorage.
 */
function persist() {
  const all = loadAll(); // Charge toutes les réservations existantes
  // Met à jour (ou ajoute) l'entrée pour la séance actuelle
  all[seanceKey] = {
    filmTitre,
    room,
    lang,
    timeStr,
    selected: [...state.selected], // Convertit le Set en Array pour le JSON
    taken: [...state.taken], // Idem
    custom: [...state.custom] // Idem (pour Map)
  };
  // Sauvegarde l'objet mis à jour dans le LS
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/**
 * Restaure l'état depuis le localStorage pour cette séance.
 */
function restore() {
  const data = loadAll()[seanceKey]; // Récupère les données de la séance actuelle
  if (!data) return; // Si rien n'est sauvegardé, on sort

  // Restaure la sélection de l'utilisateur
  state.selected = new Set(data.selected || []);
  
  // Fusionne les sièges "pris" calculés (FIXED_OVERRIDES)
  // avec ceux qui étaient "pris" lors de la dernière visite (ex: synchro JSON)
  const restoredTaken = new Set(data.taken || []);
  state.taken = new Set([...state.taken, ...restoredTaken]);
  
  // Restaure les icônes custom (non utilisé ici)
  state.custom = new Map(data.custom || []);
}

// ---------- Hydratation colonne gauche ----------
/**
 * Met à jour les informations de la colonne de gauche (affiche, titre, heure...)
 * et tente de fetch films.json pour trouver l'heure de fin si elle n'est pas
 * dans l'URL.
 * @param {URLSearchParams} qp - Les paramètres de l'URL
 */
async function hydrateLeftColumn(qp) {
  // Récupération des paramètres
  const poster = qp.get('poster') || '';
  const film = qp.get('film') || 'Film';
  const salle = qp.get('salle') || '—';
  const seance = qp.get('seance') || '';
  const langue = qp.get('langue') || '—';
  const endQP = qp.get('end') || ''; // Heure de fin (optionnelle)

  // Sélection des éléments DOM de la colonne gauche
  const leftPane = $('.left');
  const posterEl = $('#filmPoster');
  const titleEl = $('#filmTitle');
  const seanceTimeEl = $('#seanceTime');
  const seanceEndEl = $('#seanceEnd');
  const seanceLangEl = $('#seanceLang');
  const roomNoEl = $('#roomNo');

  // Extrait le nom du fichier de l'affiche (ex: 'affiche.jpg')
  const posterFile = (poster ? poster.split('/').pop() : '') || 'placeholder.jpg';
  
  // Met à jour l'affiche
  if (posterEl) {
    posterEl.src = `../assets/images/FILMS/${posterFile}`;
    posterEl.alt = `Affiche : ${film}`;
  }
  // Met à jour le fond flouté de la colonne gauche (via une variable CSS)
  if (leftPane) {
    leftPane.style.setProperty('--left-bg', `url("../images/FILMS/${posterFile}")`);
  }

  // Met à jour les textes
  if (titleEl) titleEl.textContent = film;
  if (roomNoEl) roomNoEl.textContent = salle;
  if (seanceTimeEl) seanceTimeEl.textContent = seance || '—:—';
  if (seanceLangEl) seanceLangEl.textContent = langue || '—';

  // --- Gestion de l'heure de fin ---
  if (seanceEndEl) {
    if (endQP) {
      // Si l'heure de fin est dans l'URL, on l'utilise
      seanceEndEl.textContent = `Fin prévue à ${endQP}`;
      state.end = endQP;
    } else {
      // Sinon, on la cherche dans films.json
      try {
        // 👇 Chemin corrigé pour le fetch
        const res = await fetch('../data/films.json');
        const list = await res.json();

        // Tente de trouver le film par son titre normalisé
        let f = list.find(x => normalize(x.titre) === normalize(film));
        // Fallback si le titre ne correspond pas exactement (ex: "Titre" vs "Titre (2025)")
        if (!f) f = list.find(x => normalize(x.titre).includes(normalize(film)));

        // Tente de trouver la séance exacte (heure + salle)
        let s = f?.séances?.find(x =>
          String(x.horaire).trim() === String(seance).trim() &&
          String(x.salle) === String(salle)
        );
        // Fallback si la séance exacte n'est pas trouvée (ex: erreur de param)
        if (!s && f?.séances?.length) {
          s = f.séances.find(x => String(x.salle) === String(salle)) || f.séances[0];
        }

        // Met à jour l'heure de fin et sauvegarde les infos de la séance dans l'état
        seanceEndEl.textContent = s?.fin ? `Fin prévue à ${s.fin}` : 'Fin prévue —:—';
        state.end = s?.fin || '';
        state.selectedSeance = s || null; // Très important pour syncLibresWithJSON
        state.poster = posterFile;
        state.format = s?.imax ? 'IMAX' : (s?.['4k'] ? '4K' : ''); // Sauvegarde format
      } catch (err) {
        console.warn('[salle] fetch films.json a échoué :', err);
        seanceEndEl.textContent = 'Fin prévue —:—';
      }
    }
  }
}

// Bouton "Changer de film" -> redirection vers le catalogue
$('#changeFilmBtn')?.addEventListener('click', () => {
  location.href = './catalogue.html';
});

// ---------- Colonne droite (Grille des sièges) ----------
const gridEl = $('#seatGrid'); // La grille
const freeCountEl = $('#freeCount'); // Texte "X places libres"
const mySeatsEl = $('#mySeats'); // Texte "Vos sièges : A1, A2"
const btnReserve = $('#btnReserve'); // Bouton "Réserver"

/**
 * Construit et affiche la grille complète des sièges
 * en fonction de l'état (state.rows, state.cols, state.taken, state.selected).
 */
function renderGrid() {
  // Définit le nombre de colonnes pour la CSS Grid
  gridEl.style.setProperty('--cols', state.cols);
  gridEl.innerHTML = ''; // Vide la grille avant de la reconstruire

  for (let r = 0; r < state.rows; r++) { // Pour chaque rangée
    for (let c = 0; c < state.cols; c++) { // Pour chaque colonne
      const id = seatId(r, c); // Génère l'ID (ex: "A1")
      const isGap = FIXED_OVERRIDES.gaps.includes(id); // Est-ce un couloir ?

      const cell = document.createElement('div');
      
      // Si c'est un "gap" (couloir), on crée une cellule vide
      if (isGap) {
        cell.className = 'seat gap';
        gridEl.appendChild(cell);
        continue; // Passe à la cellule suivante
      }

      // Vérifie l'état du siège
      const isCustom = Object.prototype.hasOwnProperty.call(FIXED_OVERRIDES.customIcon, id);
      const customPath = isCustom ? FIXED_OVERRIDES.customIcon[id] : '';
      const isTaken = state.taken.has(id) || (isCustom && /desactive/i.test(customPath));
      const isMe = state.selected.has(id); // Sélectionné par l'utilisateur

      // Applique la classe CSS appropriée
      let cls = isTaken ? 'taken' : (isMe ? 'me' : 'free');
      if (isCustom) {
        cls += ' custom'; // Classe pour les sièges spéciaux (PMR)
        // Applique l'image de l'icône via une variable CSS
        cell.style.setProperty('--seat-bg', `url("${customPath}")`);
      }

      cell.className = `seat ${cls}`; // Classe finale (ex: "seat free")

      // Crée le bouton cliquable (le siège)
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = id; // Stocke l'ID pour le retrouver au clic
      btn.tabIndex = isTaken ? -1 : 0; // Gère l'accessibilité clavier
      btn.setAttribute('aria-label', `Siège ${id}${isTaken ? ' indisponible' : ''}`);

      // On ne peut cliquer que sur les sièges non pris
      if (!isTaken) btn.addEventListener('click', toggleSeat);

      cell.appendChild(btn);
      gridEl.appendChild(cell);
    }
  }
}

/**
 * Gère le clic sur un siège (sélection / désélection).
 * @param {Event} e L'événement de clic
 */
function toggleSeat(e) {
  const id = e.currentTarget.dataset.id; // Récupère l'ID du siège cliqué
  
  // Bascule l'état de sélection
  if (state.selected.has(id)) {
    state.selected.delete(id); // Si déjà sélectionné, on le retire
  } else {
    state.selected.add(id); // Sinon, on l'ajoute
  }
  
  // Met à jour l'affichage
  renderGrid(); // Redessine la grille (pour changer la couleur)
  updateRecap(); // Met à jour le récapitulatif ("Vos sièges : ...")
  persist(); // Sauvegarde la nouvelle sélection dans le localStorage
}

/**
 * Met à jour le récapitulatif (places libres, sièges sélectionnés, état du bouton).
 */
function updateRecap() {
  // Calcule le nombre de places libres
  const total = state.rows * state.cols;
  const libres = total - state.taken.size - state.selected.size - FIXED_OVERRIDES.gaps.length;
  freeCountEl.textContent = `${libres} places libres`;

  // Trie les sièges sélectionnés par ordre (A1, A2, B1...)
  const arr = [...state.selected].sort((a, b) => {
    const [ra, ca] = [a.charCodeAt(0), parseInt(a.slice(1), 10)]; // 'B10' -> [66, 10]
    const [rb, cb] = [b.charCodeAt(0), parseInt(b.slice(1), 10)];
    return ra !== rb ? ra - rb : ca - cb; // Trie par rangée, puis par colonne
  });
  
  // Affiche la liste des sièges
  mySeatsEl.textContent = arr.length ? arr.join(', ') : '—';
  // Active ou désactive le bouton "Réserver"
  btnReserve.disabled = arr.length === 0;
}

/**
 * API pratique pour forcer des sièges en "pris" depuis la console (débogage).
 * @param  {...string} ids Liste des IDs de sièges (ex: "A1", "B2")
 */
function setTaken(...ids) {
  ids.flat().forEach(id => state.taken.add(String(id).toUpperCase()));
  persist();
  renderGrid();
  updateRecap();
}

// ---------- Capacité : agrandit si le JSON demande plus de "libres" ----------
/**
 * Augmente le nombre de colonnes (state.cols) si la capacité actuelle
 * est inférieure au nombre de sièges "libres" indiqué dans le JSON.
 * @param {number} targetLibres - Le nombre de sièges libres requis par le JSON.
 */
function ensureCapacityForLibres(targetLibres) {
  if (!Number.isFinite(targetLibres) || targetLibres <= 0) return;

  // Capacité actuelle (hors couloirs)
  const currentCapacity = state.rows * state.cols - FIXED_OVERRIDES.gaps.length;
  if (currentCapacity >= targetLibres) return; // Capacité suffisante

  // On augmente les colonnes
  const isGapColumn = (colIdx) => (colIdx === 4 || colIdx === 15);

  let cols = state.cols;
  let capacity = currentCapacity;

  // Boucle tant que la capacité n'est pas atteinte
  while (capacity < targetLibres) {
    cols += 1; // Ajoute une colonne
    // Si la nouvelle colonne n'est PAS un couloir (4 ou 15), on ajoute sa capacité
    if (!isGapColumn(cols)) {
      capacity += state.rows; // Ajoute une colonne pleine
    }
  }
  state.cols = cols; // Met à jour le nombre total de colonnes
}

// ---------- Synchroniser "libres" avec le JSON ----------
/**
 * Aligne le nombre de sièges "pris" pour correspondre au nombre de sièges "libres"
 * spécifié dans le fichier films.json pour cette séance.
 */
function syncLibresWithJSON() {
  const s = state.selectedSeance; // Récupère la séance chargée par hydrateLeftColumn
  const libresJSON = Number(s?.libres); // Le nombre de libres attendu

  if (!s) {
    console.warn('[salle] Aucune séance sélectionnée — vérifier film/salle/heure & JSON');
    return;
  }
  if (!Number.isFinite(libresJSON)) {
    console.warn('[salle] "libres" absent ou invalide dans le JSON pour cette séance');
    return;
  }

  // 1. S'assurer que la salle est assez grande
  ensureCapacityForLibres(libresJSON);

  // 2. Recalculer la capacité (elle a peut-être changé)
  const totalSeats = state.rows * state.cols - FIXED_OVERRIDES.gaps.length;
  // Le nombre de libres ne peut pas dépasser la capacité totale
  const targetLibres = Math.max(0, Math.min(libresJSON, totalSeats));
  // Nombre de sièges libres actuellement (visuellement)
  const currentLibres = totalSeats - state.taken.size - state.selected.size;

  if (currentLibres === targetLibres) return; // C'est déjà bon

  // Helpers pour les vérifications
  const isGap = id => FIXED_OVERRIDES.gaps.includes(id);
  const isCustomDisabled = id =>
    Object.prototype.hasOwnProperty.call(FIXED_OVERRIDES.customIcon, id) &&
    /desactive/i.test(FIXED_OVERRIDES.customIcon[id] || '');

  // Génère la liste de tous les IDs de sièges valides (ni "gap", ni "custom disabled")
  const allSeatIds = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const id = `${String.fromCharCode(65 + r)}${c + 1}`;
      if (!isGap(id)) allSeatIds.push(id);
    }
  }

  if (currentLibres > targetLibres) {
    // 👉 Il y a TROP de sièges libres : on doit marquer des sièges comme "pris"
    let needToTake = currentLibres - targetLibres;
    // On prend les sièges qui ne sont ni "pris" (taken) ni "sélectionnés" (selected)
    const candidates = allSeatIds.filter(id =>
      !state.taken.has(id) && !state.selected.has(id)
    );
    // On marque les candidats comme "pris" jusqu'à atteindre la cible
    for (const id of candidates) {
      state.taken.add(id);
      if (--needToTake <= 0) break;
    }
  } else {
    // 👉 Il n'y a PAS ASSEZ de sièges libres : on doit libérer des "pris"
    let needToFree = targetLibres - currentLibres;
    // On ne peut pas libérer les sièges "en dur" (FIXED_OVERRIDES.taken)
    const fixedTaken = new Set([
      ...FIXED_OVERRIDES.taken,
      ...Object.keys(FIXED_OVERRIDES.customIcon || {}).filter(isCustomDisabled)
    ]);
    // On prend les "pris" qui ne sont PAS dans la liste "fixedTaken"
    const removable = [...state.taken].filter(id => !fixedTaken.has(id));
    // On libère ces sièges
    for (const id of removable) {
      state.taken.delete(id);
      if (--needToFree <= 0) break;
    }
  }
}

// ---------- Réservation ----------
// Gère le clic sur le bouton "Réserver"
btnReserve?.addEventListener('click', () => {
  persist(); // Sauvegarde la sélection finale
  
  // Récupère les infos nécessaires pour la page suivante (tarif.html)
  const poster = state.poster || 'placeholder.jpg';
  const format = state.format || '';
  const end = state.end || '';
  const seanceHM =
    state.selectedSeance?.horaire || // Heure depuis le JSON (préféré)
    (/^\d{2}:\d{2}$/.test(params.get('seance') || '') ? params.get('seance') : ''); // Fallback URL

  // Liste des sièges (ex: "A1,A2,B3")
  const selectedSeats = [...state.selected].join(',');

  // Construit l'URL pour la page "tarif.html"
  location.href =
    `tarif.html?film=${encodeURIComponent(filmTitre)}` +
    `&salle=${room}` +
    `&langue=${encodeURIComponent(lang)}` +
    (seanceHM ? `&seance=${encodeURIComponent(seanceHM)}` : '') +
    `&poster=${encodeURIComponent(`../assets/images/FILMS/${poster}`)}` +
    `&format=${encodeURIComponent(format)}` +
    `&seats=${encodeURIComponent(selectedSeats)}` + // Transmet les sièges
    (end ? `&end=${encodeURIComponent(end)}` : '');
});

// ---------- BOOT ----------
// Fonction auto-exécutée au chargement de la page
(async function() {
  // 1. Met à jour la colonne de gauche (et charge state.selectedSeance depuis films.json)
  await hydrateLeftColumn(params);
  // 2. Applique les sièges "pris" en dur (G9, G10, etc.)
  computeAvailability();
  // 3. Restaure la sélection de l'utilisateur s'il revient sur la page
  restore();
  // 4. Aligne le nombre de "libres" sur le JSON (ajuste state.taken)
  syncLibresWithJSON();
  // 5. Dessine la grille des sièges
  renderGrid();
  // 6. Met à jour le récapitulatif (compteurs, bouton)
  updateRecap();
})();