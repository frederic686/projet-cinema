/* =========================================================
   Catalogue – Pathé (COMPLET) — Ordre par fonctionnement
   ========================================================= */

/* 1) Helpers & constantes */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const PATH_JSON = '../data/films.json'; // Chemin vers les données des films
const POSTER_DIR = '../assets/images/FILMS/'; // Dossier des affiches

/* 2) État & utilitaires */
// Objet contenant l'état de la page
const state = {
  films: [], // Liste complète des films (chargée du JSON)
  filters: { // Filtres actuellement actifs
    genre: 'Tous',
    fourk: false,
    langue: 'Tous',
    q: '' // Recherche textuelle
  }
};

/**
 * Convertit des minutes (ex: 90) en format "XhYY" (ex: "1h30").
 * @param {number} mins - Durée en minutes
 * @returns {string} - Durée formatée
 */
const minToH = (mins) => {
  const m = Math.max(0, Number(mins) || 0);
  const h = Math.floor(m / 60); // Heures
  const r = m % 60; // Minutes restantes
  return `${h}h${String(r).padStart(2, '0')}`; // "1h05"
};

/**
 * Vérifie si un film a au moins une séance en 4K.
 * @param {object} film - L'objet film
 * @returns {boolean}
 */
const has4K = (film) => (film['séances'] || film.seances || []).some(s => s['4k'] === true);

/**
 * Vérifie si un film a au moins une séance dans la langue demandée (VF/VOST).
 * @param {object} film - L'objet film
 * @param {string} lang - 'Tous', 'VF', ou 'VOST'
 * @returns {boolean}
 */
const hasLang = (film, lang) => {
  const seances = film['séances'] || film.seances || [];
  if (lang === 'Tous') return true;
  if (lang === 'VF') return seances.some(s => s.vf === true);
  if (lang === 'VOST') return seances.some(s => s.vost === true);
  return true;
};

/**
 * Normalise un titre de film pour le faire correspondre
 * aux clés de la Map TRAILERS.
 * @param {string} t - Titre du film
 * @returns {string} - Titre normalisé (ex: "le monde de wishy")
 */
function normalizeTitle(t) {
  return (t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9: ]/g, '') // caractères spéciaux
    .replace(/\s+/g, ' ') // espaces multiples
    .trim();
}

/* 3) Données statiques : bandes-annonces */
// Map (clé = titre normalisé, valeur = URL de la vidéo)
const TRAILERS = new Map([
  ['evanouis', 'https://www.youtube.com/embed/eDBLToWrnBU'],
  ['le monde de wishy', 'https://www.youtube.com/embed/wiWYHjlhTKc'],
]);

/* 4) Construction UI des menus + interactions filtres */

/**
 * Extrait la liste unique des genres de tous les films.
 * @param {Array<object>} films - Liste des films
 * @returns {Array<string>} - Liste des genres triée (ex: ["Tous", "Action", "Drame"])
 */
function uniqueGenres(films) {
  const set = new Set(); // Utilise un Set pour éviter les doublons
  films.forEach(f => (f.genre || []).forEach(g => set.add(g)));
  // Convertit le Set en Array, trie alphabétiquement, et ajoute "Tous" au début
  return ['Tous', ...[...set].sort((a, b) => a.localeCompare(b, 'fr'))];
}

/**
 * Construit le HTML des menus déroulants (Genres, Langues).
 */
function buildMenus() {
  const menuG = $('#menu-genres');
  if (menuG) {
    menuG.innerHTML =
      `<div class="title">Genres</div>` +
      uniqueGenres(state.films).map(g => `<button type="button" data-genre="${g}">${g}</button>`).join('');
  }

  const menuL = $('#menu-langues');
  if (menuL) {
    menuL.innerHTML =
      `<div class="title">Langues</div>
       <button type="button" data-lang="Tous">Tous</button>
       <button type="button" data-lang="VF">VF</button>
       <button type="button" data-lang="VOST">VOST</button>`;
  }
}

/**
 * Ferme tous les menus déroulants ouverts.
 */
function closeMenus() {
  $$('#menu-genres, #menu-langues').forEach(m => m.classList.add('hidden'));
}

/**
 * Initialise tous les écouteurs d'événements pour les filtres.
 */
function initFilterInteractions() {
  const btnGenres = $('#btnGenres');
  const btn4k = $('#btn4K');
  const btnLangues = $('#btnLangues');
  const inputQ = $('#searchInput');

  // Clic sur le bouton "Genres"
  if (btnGenres) {
    btnGenres.addEventListener('click', () => {
      const m = $('#menu-genres');
      const r = btnGenres.getBoundingClientRect(); // Position du bouton
      // Positionne le menu sous le bouton
      m.style.top = `${r.bottom + window.scrollY + 6}px`;
      m.style.left = `${r.left + window.scrollX}px`;
      closeMenus(); // Ferme les autres menus
      m.classList.remove('hidden'); // Ouvre celui-ci
      btnGenres.setAttribute('aria-expanded', 'true');
    });
  }

  // Clic sur le bouton "Langues" (logique similaire)
  if (btnLangues) {
    btnLangues.addEventListener('click', () => {
      const m = $('#menu-langues');
      const r = btnLangues.getBoundingClientRect();
      m.style.top = `${r.bottom + window.scrollY + 6}px`;
      m.style.left = `${r.left + window.scrollX}px`;
      closeMenus();
      m.classList.remove('hidden');
      btnLangues.setAttribute('aria-expanded', 'true');
    });
  }

  // Ferme les menus si on clique n'importe où ailleurs sur la page
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-genres,#menu-langues,#btnGenres,#btnLangues')) {
      closeMenus();
      btnGenres?.setAttribute('aria-expanded', 'false');
      btnLangues?.setAttribute('aria-expanded', 'false');
    }
  });

  // Clic DANS le menu "Genres" (délégation d'événement)
  $('#menu-genres')?.addEventListener('click', (e) => {
    const g = e.target?.dataset?.genre; // Récupère la valeur (ex: "Action")
    if (!g) return;
    state.filters.genre = g; // Met à jour l'état
    if ($('#btnGenres span')) {
      $('#btnGenres span').textContent = (g === 'Tous' ? 'Genres' : g); // Met à jour le texte du bouton
    }
    closeMenus();
    render(); // Relance le rendu avec le nouveau filtre
  });

  // Clic DANS le menu "Langues" (similaire)
  $('#menu-langues')?.addEventListener('click', (e) => {
    const l = e.target?.dataset?.lang;
    if (!l) return;
    state.filters.langue = l;
    if ($('#btnLangues span')) {
      $('#btnLangues span').textContent = (l === 'Tous' ? 'Langues' : l);
    }
    closeMenus();
    render();
  });

  // Clic sur le bouton "4K"
  if (btn4k) {
    btn4k.addEventListener('click', () => {
      state.filters.fourk = !state.filters.fourk; // Inverse l'état
      btn4k.setAttribute('aria-pressed', String(state.filters.fourk)); // Accessibilité
      btn4k.style.fontWeight = state.filters.fourk ? '800' : '500'; // Feedback visuel
      render();
    });
  }

  // Saisie dans le champ de recherche
  inputQ?.addEventListener('input', (e) => {
    state.filters.q = e.target.value || ''; // Met à jour l'état
    render(); // Relance le rendu à chaque frappe
  });
}

/* 5) Modale vidéo (ouverture/fermeture) */
const videoModal = $('#videoModal');
const videoFrame = $('#videoFrame');
const closeModal = $('#closeModal');

/**
 * Ouvre la modale et lance la vidéo.
 * @param {string} url - URL de la vidéo (embed)
 */
function openVideoTrailer(url) {
  if (!url) return;
  const sep = url.includes('?') ? '&' : '?';
  videoFrame.src = url + sep + 'autoplay=1&rel=0'; // Ajoute autoplay
  videoModal.classList.add('open');
  videoModal.setAttribute('aria-hidden', 'false');
}

/**
 * Ferme la modale et arrête la vidéo.
 */
function closeVideo() {
  videoModal?.classList.remove('open');
  videoModal?.setAttribute('aria-hidden', 'true');
  if (videoFrame) videoFrame.src = ''; // Arrête la vidéo en vidant la source
}

// Écouteurs pour fermer la modale
closeModal?.addEventListener('click', closeVideo);
videoModal?.addEventListener('click', (e) => {
  // Ferme si on clique sur le fond (overlay), mais pas sur la vidéo elle-même
  if (e.target === videoModal) closeVideo();
});
document.addEventListener('keydown', (e) => {
  // Ferme avec la touche "Échap"
  if (e.key === 'Escape' && videoModal?.classList.contains('open')) {
    closeVideo();
  }
});

/* 6) Rendu d’un film (brique) */
/**
 * Construit l'élément DOM <article> complet pour un seul film.
 * @param {object} f - L'objet film
 * @returns {HTMLElement} - L'élément <article>
 */
function renderFilm(f) {
  const wrap = document.createElement('article');
  wrap.className = 'film';
  wrap.dataset.title = f.titre; // Stocke le titre pour le retrouver au clic (BA)

  // Affiche
  const img = document.createElement('img');
  img.className = 'poster';
  img.alt = f.titre;
  img.src = POSTER_DIR + (f.image || 'placeholder.jpg');
  wrap.appendChild(img);

  // Contenu (texte, séances)
  const content = document.createElement('div');
  content.className = 'film-content';

  // Badges (Nouveau, Frisson)
  const badges = document.createElement('div');
  badges.className = 'badges';
  if (f.nouveau === true) {
    const b = document.createElement('span');
    b.className = 'badge badge--new';
    b.textContent = 'Nouveau';
    b.setAttribute('aria-label', 'Nouveauté');
    badges.appendChild(b);
  }
  if (f.mention_frisson) {
    const b = document.createElement('span');
    b.className = 'badge-frisson';
    b.textContent = 'Frisson';
    badges.appendChild(b);
  }
  if (badges.children.length) {
    content.appendChild(badges);
  }

  // Titre
  const h3 = document.createElement('h3');
  h3.className = 'film-title';
  h3.textContent = f.titre;
  content.appendChild(h3);

  // Meta (genres, durée, chips âge/violence)
  const meta = document.createElement('div');
  meta.className = 'meta';

  const g = document.createElement('span');
  g.textContent = (f.genre || []).join(' · '); // "Action · Drame"
  meta.appendChild(g);

  const dot = document.createElement('span');
  dot.className = 'dot';
  meta.appendChild(dot);

  const d = document.createElement('span');
  d.textContent = `(${minToH(f['durée_minutes'])})`; // "(1h30)"
  meta.appendChild(d);

  if (typeof f['âge_minimum'] === 'number') {
    const chipAge = document.createElement('span');
    chipAge.className = 'chip chip--age';
    chipAge.textContent = `${f['âge_minimum']}+`;
    chipAge.title = `Âge minimum ${f['âge_minimum']} ans`;
    meta.appendChild(chipAge);
  }
  if (f['avertissement_violence'] === true) {
    const chipViolence = document.createElement('span');
    chipViolence.className = 'chip chip--violence';
    chipViolence.title = 'Avertissement : violence';
    meta.appendChild(chipViolence);
  }
  content.appendChild(meta);

  // Séances (boutons)
  const times = document.createElement('div');
  times.className = 'showtimes';

  const seances = f['séances'] || f.seances || [];
  seances.forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'showtime';
    btn.type = 'button';
    btn.setAttribute(
      'aria-label',
      `Séance ${s.horaire} ${s.vf ? 'VF' : (s.vost ? 'VOST' : '')} ${s.imax ? 'IMAX' : ''} ${s['4k'] ? '4K' : ''}`
    );

    // Flags (IMAX/4K) en haut du bouton
    const flags = [];
    if (s.imax) flags.push('IMAX');
    if (s['4k']) flags.push('4K');
    if (flags.length) {
      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = flags.join(' • ');
      btn.appendChild(flag);
    }

    // Contenu gauche (Heure + Langue)
    const left = document.createElement('div');
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = s.horaire;
    left.appendChild(time);

    const lang = document.createElement('span');
    lang.className = 'lang';
    lang.textContent = s.vf ? 'VF' : (s.vost ? 'VOST' : '');
    left.appendChild(lang);
    btn.appendChild(left);

    // Contenu droit (Icônes)
    const right = document.createElement('div');
    right.className = 'icons';
    if (s.handicap) {
      const ic = document.createElement('i');
      ic.className = 'icon-wheel'; // Utilise une classe CSS pour l'icône
      ic.title = 'Accessible PMR';
      right.appendChild(ic);
    }
    btn.appendChild(right);

    // --- Clic sur une séance ---
    btn.addEventListener('click', () => {
      // Prépare les données à envoyer à la page "salle.html"
      const sessionData = {
        film: f.titre,
        seance: s.horaire,
        salle: s.salle,
        fin: s.fin,
        // (VF/VOST n'est pas utilisé dans salle.js, mais on le garde)
        vf: !!s.vf,
        vost: !!s.vost,
        langue: s.vf ? 'VF' : (s.vost ? 'VOST' : '—'), // Ajout pour salle.js
        imax: !!s.imax,
        fourk: !!s['4k'],
        poster: f.image
      };

      // Construit l'URL avec les paramètres
      const qs = new URLSearchParams(sessionData).toString();
      window.location.href = `salle.html?${qs}`;
    });

    times.appendChild(btn);
  });

  content.appendChild(times);
  wrap.appendChild(content);
  return wrap; // Retourne l'élément <article> construit
}

/* 7) Rendu de la liste (orchestrateur) */
/**
 * Filtre les films selon l'état (state.filters) et les affiche dans la liste.
 */
function render() {
  const list = $('#filmsList');
  if (!list) return;
  list.innerHTML = ''; // Vide la liste

  // Filtre la liste complète des films
  const filtered = state.films.filter(f => {
    // Filtre recherche textuelle
    const q = (state.filters.q || '').trim().toLowerCase();
    const genresText = (f.genre || []).join(' ').toLowerCase();
    const qok = !q || f.titre.toLowerCase().includes(q) || genresText.includes(q);

    // Filtre genre
    const gok = (state.filters.genre === 'Tous') || (f.genre || []).includes(state.filters.genre);
    // Filtre 4K
    const k4 = state.filters.fourk ? has4K(f) : true;
    // Filtre langue
    const lok = hasLang(f, state.filters.langue);

    return qok && gok && k4 && lok; // Le film doit passer tous les filtres
  });

  // Ajoute chaque film filtré au DOM
  filtered.forEach(f => list.appendChild(renderFilm(f)));
}

/* 8) Délégation : clic affiche (ouvre BA) */
// Utilise la délégation d'événement sur la liste pour gérer les clics
$('#filmsList')?.addEventListener('click', (e) => {
  const poster = e.target.closest('.poster'); // Cible-t-on une affiche ?
  if (!poster) return;

  const article = poster.closest('.film');
  const title = article?.dataset?.title || ''; // Récupère le titre stocké
  const key = normalizeTitle(title); // Normalise le titre

  // Cherche l'URL de la bande-annonce
  let url = TRAILERS.get(key);
  if (!url) {
    // Fallback : si "evanouis" est dans TRAILERS, et le film est "Les Évanouis (2025)"
    // on tente une correspondance partielle
    for (const [k, v] of TRAILERS.entries()) {
      if (key.includes(k)) {
        url = v;
        break;
      }
    }
  }

  if (url) openVideoTrailer(url); // Ouvre la modale
});

/* 9) Init (DOMContentLoaded → fetch → build → init → render) */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Va chercher les données des films
  fetch(PATH_JSON)
    .then(r => r.json())
    .then(data => {
      // 2. Stocke les films dans l'état
      state.films = Array.isArray(data) ? data : [];
      // 3. Construit les menus déroulants
      buildMenus();
      // 4. Initialise les interactions des filtres
      initFilterInteractions();
      // 5. Affiche les films
      render();
    })
    .catch(err => {
      console.error('Erreur chargement films.json', err);
      const list = $('#filmsList');
      if (list) list.innerHTML = `<p style="opacity:.8">Impossible de charger les films.</p>`;
    });
});

/* Fonction flèche haut (Scroll to top) */
(function() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;

  // Respecte les préférences de réduction des animations
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Affiche/cache le bouton selon la position de scroll
  function toggleBtn() {
    if (window.scrollY > 300) { // Visible si on a scrollé de 300px
      btn.classList.add('is-visible');
    } else {
      btn.classList.remove('is-visible');
    }
  }

  // Action au clic : remonter en haut
  btn.addEventListener('click', () => {
    const behavior = prefersReduced ? 'auto' : 'smooth'; // 'smooth' si animations OK
    window.scrollTo({
      top: 0,
      left: 0,
      behavior
    });
  });

  // Initialisation + écoute de l'événement scroll
  toggleBtn(); // Vérifie l'état au chargement
  window.addEventListener('scroll', toggleBtn, {
    passive: true
  }); // Optimisation
})();