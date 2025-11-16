// SNACKS (page 5)
// - Colonne gauche : hydratée depuis URL + films.json (fin) + fond
// - Détail des billets : lu depuis localStorage (clé séance) puis fallback URL
// - Catalogue snacks : depuis ../data/snack.json
// - Panier snacks : +/-, suppression ligne, vider
// - Total global = billets + snacks
// =========================================================
(() => { // IIFE pour isoler la portée
    // --- Helpers ---
    const $ = (s, ctx = document) => ctx.querySelector(s);
    const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
    // Formateur de devise (ex: 10.5 -> "10,50 €")
    const fmt = (n) => (n || 0).toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    });

    // --- Chemins ---
    const PATH_JSON = "../data/snack.json"; // Données des snacks
    const IMG_DIR = "../assets/images/SNACKS/";
    const PLUS_ICON = "../assets/images/PICTOS/plus.png";
    const MINUS_ICON = "../assets/images/PICTOS/moins.png";
    const TRASH_ICON = "../assets/images/PICTOS/poubelle.png";

    // --- DOM ---
    const shopSection = $('#catalog-container'); // Conteneur du catalogue de snacks
    const ticketLinesEl = $('#ticketLines'); // <ul> pour les lignes de billets
    const cartLinesEl = $('#cartLines'); // <ul> pour les lignes de snacks
    const basketTotalEl = $('#basketTotal'); // Total global (billets + snacks)
    const btnContinue = $('#btnContinue'); // Bouton "Continuer" (paiement)
    const btnClear = $('#btnClear'); // Bouton "Vider le panier" (snacks)

    // --- Params & clé séance ---
    const qp = new URLSearchParams(location.search);
    const film = qp.get('film') || 'Film';
    const salle = qp.get('salle') || '—';
    const seance = qp.get('seance') || '';
    const seatsStr = (qp.get('seats') || '').trim();
    const seats = seatsStr ? seatsStr.split(',').filter(Boolean) : [];
    
    // Clé pour le localStorage (doit être identique à celle de `salle.js` et `tarif.js`)
    const LS_MAIN = 'pathe_reservation';
    const seanceKey = `${film}|${salle}|${seance}`;

    // --- Barème identique à Tarifs ---
    // Nécessaire pour recalculer le total des billets si le LS est vide
    const PRICES = {
        MATIN: {
            label: 'Matin',
            price: 9.90
        },
        U14: {
            label: 'Moins de 14 ans',
            price: 6.50
        },
    };

    // --- État snacks ---
    let catalog = {}; // Objet qui contiendra les snacks (ex: { "Popcorn": [...], "Boissons": [...] })
    const cart = new Map(); // Panier de snacks (key = nom du snack, value = objet snack)

    // ---------------------------------------------------------
    // [COMMUN] Fonction d'hydratation de la colonne gauche
    // (Identique à celle de salle.js, tarif.js, etc.)
    // ---------------------------------------------------------
    async function hydrateLeftColumn(params) {
        const poster = params.get('poster') || '';
        const film = params.get('film') || 'Film';
        const salle = params.get('salle') || '—';
        const seance = params.get('seance') || '';
        const langue = params.get('langue') || '—';
        const endQP = params.get('end') || '';
        const leftPane = document.querySelector('.left');
        const posterEl = document.querySelector('#filmPoster');
        const titleEl = document.querySelector('#filmTitle');
        const seanceTimeEl = document.querySelector('#seanceTime');
        const seanceEndEl = document.querySelector('#seanceEnd');
        const seanceLangEl = document.querySelector('#seanceLang');
        const roomNoEl = document.querySelector('#roomNo');

        // Affiche et fond
        const posterFile = (poster ? poster.split('/').pop() : '') || 'placeholder.jpg';
        if (posterEl) {
            posterEl.src = `../assets/images/FILMS/${posterFile}`;
            posterEl.alt = `Affiche : ${film}`;
        }
        if (leftPane) {
            leftPane.style.setProperty('--left-bg', `url("../images/FILMS/${posterFile}")`);
        }

        // Textes
        if (titleEl) titleEl.textContent = film;
        if (roomNoEl) roomNoEl.textContent = `Salle ${salle}`;
        if (seanceTimeEl) seanceTimeEl.textContent = seance || '—:—';
        if (seanceLangEl) seanceLangEl.textContent = langue || '—';

        // Heure de fin (fetch films.json si besoin)
        if (seanceEndEl) {
            if (endQP) {
                seanceEndEl.textContent = `Fin prévue à ${endQP}`;
            } else {
                try {
                    const res = await fetch('../data/films.json');
                    const list = await res.json();
                    const f = list.find(x => x.titre === film);
                    const s = f?.séances?.find(x => String(x.salle) === String(salle) && x.horaire === seance);
                    seanceEndEl.textContent = s?.fin ? `Fin prévue à ${s.fin}` : 'Fin prévue —:—';
                } catch (error) {
                    console.error("Erreur lors de la récupération de la fin de séance", error);
                    seanceEndEl.textContent = 'Fin prévue —:—';
                }
            }
        }
    }

    // ---------- Billets : lecture localStorage puis fallback URL ----------
    /**
     * Charge les informations sur les billets (tarifs, promo, total)
     * depuis le localStorage (préféré) ou en fallback depuis les paramètres URL.
     * @returns {object} - Un objet contenant les détails des billets.
     */
    function loadTickets() {
        let tarifs = null, // ex: { MATIN: 1, U14: 1 }
            promo = null, // ex: "CINEPASS"
            total = NaN;

        // 1. Tente de lire depuis le localStorage
        try {
            const all = JSON.parse(localStorage.getItem(LS_MAIN) || '{}');
            const saved = all[seanceKey] || {};
            tarifs = saved.tarifs || null;
            promo = saved.promo || null;
            if (Number.isFinite(saved.total)) total = saved.total;
        } catch {}

        // 2. Fallback URL si le LS est vide
        if (!tarifs) {
            const tStr = qp.get('tarifs'); // Récupère ?tarifs={...}
            if (tStr) {
                try {
                    tarifs = JSON.parse(tStr); // Tente de parser le JSON de l'URL
                } catch {}
            }
        }
        if (!promo) promo = (qp.get('promo') || '').toUpperCase() || null;
        if (!Number.isFinite(total)) total = Number(qp.get('total')) || 0;

        // 3. Recalcule le total pour fiabilité (évite les incohérences)
        let subtotal = 0;
        const lines = []; // Lignes pour l'affichage (ex: "1x Matin")
        // Itère sur les tarifs chargés (LS ou URL)
        for (const [code, q] of Object.entries(tarifs || {})) {
            const p = PRICES[code]; // Trouve le prix correspondant
            if (!p || !q) continue;
            const lineTotal = +(q * p.price).toFixed(2);
            lines.push({
                code,
                label: p.label,
                qty: q,
                lineTotal
            });
            subtotal += lineTotal;
        }
        
        // Applique les promotions (logique dupliquée de tarif.js pour fiabilité)
        let recomputed = subtotal;
        if (promo === 'CINEPASS') recomputed = Math.max(0, subtotal * 0.9);
        if (promo === 'REDUC2' && subtotal >= 10) recomputed = Math.max(0, subtotal - 2);
        recomputed = +recomputed.toFixed(2);

        // Retourne l'objet propre
        return {
            tarifs: tarifs || {},
            promo: promo || null,
            seats,
            lines, // Lignes calculées pour l'affichage
            count: lines.reduce((a, l) => a + (l.qty || 0), 0), // Nombre total de billets
            total: recomputed || total || 0 // Total recalculé (préféré)
        };
    }

    /**
     * Affiche le récapitulatif des billets dans le panier (colonne de droite).
     * @param {object} data - Les données de `loadTickets()`
     */
    function renderTicketLines(data) {
        // Si l'élément HTML n'existe pas, on le crée (robustesse)
        if (!ticketLinesEl) {
            const right = document.querySelector('.right') || document.body;
            const card = document.createElement('div');
            card.className = 'card';
            // Crée un récapitulatif complet si la structure est manquante
            card.innerHTML = `
              <h3 class="h3">Vos billets</h3>
              <ul id="__ticketsUL" class="lines"></ul>
              <div class="meta" style="margin-top:6px;">Places : ${data.seats?.length ? data.seats.join(', ') : '—'}</div>
              <div class="total" style="margin-top:8px;border-top:1px solid #eee;padding-top:8px;">
                <div class="left"><span class="label">Total billets</span></div>
                <div class="right"><div class="amount">${fmt(data.total)}</div></div>
              </div>
            `;
            right.prepend(card); // Insère en haut de la colonne droite
            const ul = card.querySelector('#__ticketsUL');
            if (!data.lines.length) {
                ul.innerHTML = '<li class="muted">Aucun billet</li>';
            } else {
                data.lines.forEach(l => {
                    const li = document.createElement('li');
                    li.innerHTML = `<div class="line-left"><strong>${l.qty}×</strong> ${l.label}</div><div class="line-price">${fmt(l.lineTotal)}</div>`;
                    ul.appendChild(li);
                });
            }
            return;
        }

        // Cas normal : #ticketLines existe
        ticketLinesEl.innerHTML = '';
        if (!data.lines.length) {
            ticketLinesEl.innerHTML = '<li class="muted">Aucun billet</li>';
        } else {
            // Affiche chaque ligne de billet (ex: "1 x Matin ... 9,90 €")
            data.lines.forEach(l => {
                const li = document.createElement('li');
                li.className = 'cart-line is-sub'; // Classe "is-sub" pour style (ex: gris)
                li.innerHTML = `<span>${l.qty} × ${l.label}</span><span>${fmt(l.lineTotal)}</span>`;
                ticketLinesEl.appendChild(li);
            });
        }
    }

    // ---------- Catalogue snacks ----------
    /**
     * Construit le catalogue des snacks à partir des données JSON.
     */
    function renderCatalog() {
        // Itère sur les catégories (ex: "Popcorn", "Boissons")
        Object.keys(catalog).forEach((cat) => {
            const items = catalog[cat] || [];
            const section = document.createElement('section');
            section.className = 'category-section';

            const h3 = document.createElement('h3');
            h3.textContent = cat;
            section.appendChild(h3);

            const grid = document.createElement('div');
            grid.className = 'grid'; // Grille de produits

            // Itère sur les produits de la catégorie
            items.forEach((prod) => {
                const card = document.createElement('article');
                card.className = 'card';
                card.dataset.name = prod.nom; // Stocke le nom pour le retrouver au clic

                // Construit la carte produit
                card.innerHTML = `
                  <img src="${IMG_DIR}${prod.image}" alt="${prod.nom}" loading="lazy">
                  <h4 class="product-name">${prod.nom}</h4>
                  <p class="price">${fmt(prod.prix)}</p>

                  <div class="card-controls">
                    <button class="btn btn-remove" data-name="${prod.nom}" data-action="remove" aria-label="Diminuer ${prod.nom}" type="button">
                      <img src="${MINUS_ICON}" alt="" aria-hidden="true">
                    </button>
                    <span class="qty" data-name="${prod.nom}" aria-live="polite">0</span>
                    <button class="btn btn-add" data-name="${prod.nom}" data-action="add" aria-label="Augmenter ${prod.nom}" type="button">
                      <img src="${PLUS_ICON}" alt="" aria-hidden="true">
                    </button>
                  </div>
                `;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            shopSection?.appendChild(section); // Ajoute la section au DOM
        });

        // --- Délégation d'événements ---
        // Écoute les clics sur tout le catalogue (performant)
        shopSection?.addEventListener('click', handleProductInteraction);
        // Écoute les clics sur le bouton "Vider"
        btnClear?.addEventListener('click', clearCart);
        // Écoute les clics dans le panier (pour la poubelle)
        cartLinesEl?.addEventListener('click', handleCartLineClick);
    }

    // ---------- Interactions produits (+ / -) ----------
    /**
     * Gère les clics sur les boutons "+" et "-" des cartes produits.
     * @param {Event} event - L'événement de clic
     */
    function handleProductInteraction(event) {
        const btn = event.target.closest('.btn'); // Cible-t-on un bouton ?
        if (!btn) return;

        const productName = btn.dataset.name; // Récupère le nom du produit
        const product = findProductByName(productName); // Trouve l'objet produit complet
        if (!product) return;

        const action = btn.dataset.action; // 'add' or 'remove'
        if (action === 'add') addToCart(product);
        else if (action === 'remove') removeFromCart(product);
    }

    /**
     * Recherche un produit dans l'objet `catalog` par son nom.
     * @param {string} name - Nom du produit
     * @returns {object|null} - L'objet produit (avec prix, image...)
     */
    function findProductByName(name) {
        for (const category in catalog) { // Itère sur "Popcorn", "Boissons"...
            const product = (catalog[category] || []).find(p => p.nom === name);
            if (product) return product; // Trouvé !
        }
        return null;
    }

    // ---------- Panier snacks ----------
    /**
     * Ajoute un produit au panier (Map `cart`) ou incrémente sa quantité.
     * @param {object} prod - L'objet produit
     */
    function addToCart(prod) {
        // Récupère l'item du panier, ou crée un nouvel objet s'il n'existe pas
        const item = cart.get(prod.nom) || {
            ...prod,
            qty: 0
        };
        item.qty += 1; // Incrémente la quantité
        cart.set(prod.nom, item); // Met à jour la Map
        updateUI(prod.nom); // Met à jour l'affichage (ciblé)
    }

    /**
     * Retire un produit du panier ou décrémente sa quantité.
     * @param {object} prod - L'objet produit
     */
    function removeFromCart(prod) {
        const item = cart.get(prod.nom);
        if (item) {
            item.qty -= 1; // Décrémente
            if (item.qty <= 0) {
                cart.delete(prod.nom); // Si 0, supprime du panier
            }
            updateUI(prod.nom); // Met à jour l'affichage (ciblé)
        }
    }

    /**
     * Vide entièrement le panier de snacks.
     */
    function clearCart() {
        cart.clear(); // Vide la Map
        updateUI(); // Met à jour l'affichage (global)
    }

    /**
     * Gère le clic sur l'icône poubelle dans le récapitulatif du panier.
     * @param {Event} e - L'événement de clic
     */
    function handleCartLineClick(e) {
        const trashBtn = e.target.closest('.cart-trash'); // Cible-t-on une poubelle ?
        if (!trashBtn) return;
        const name = trashBtn.dataset.name; // Récupère le nom du produit à supprimer
        cart.delete(name); // Supprime de la Map
        updateUI(); // Met à jour l'affichage (global)
    }

    // ---------- UI : tickets + snacks + total ----------
    
    // Charge les données des billets une seule fois au démarrage
    let ticketsSnapshot = loadTickets();

    /**
     * Calcule le sous-total des snacks.
     * @returns {number} - Total des snacks
     */
    function calcSnackTotal() {
        let t = 0;
        cart.forEach(it => t += it.prix * it.qty); // Somme de (prix * quantité)
        return +t.toFixed(2);
    }

    /**
     * Sauvegarde le panier de SNACKS dans un localStorage séparé.
     */
    function saveCartLS() {
        try {
            // Utilise une clé différente ('pathe_cart_snacks')
            const all = JSON.parse(localStorage.getItem('pathe_cart_snacks') || '{}');
            const obj = {};
            // Convertit la Map en objet simple pour le JSON
            cart.forEach((v, k) => obj[k] = {
                prix: v.prix,
                qty: v.qty,
                image: v.image,
                points: v.points || 0
            });
            all[seanceKey] = obj; // Sauvegarde pour la séance actuelle
            localStorage.setItem('pathe_cart_snacks', JSON.stringify(all));
        } catch {}
    }

    /**
     * Restaure le panier de SNACKS depuis le localStorage.
     */
    function restoreCartLS() {
        try {
            const all = JSON.parse(localStorage.getItem('pathe_cart_snacks') || '{}');
            const obj = all[seanceKey] || {}; // Récupère le panier de cette séance
            // Convertit l'objet en Map
            Object.entries(obj).forEach(([name, v]) => {
                cart.set(name, {
                    nom: name,
                    prix: (v.prix || 0),
                    image: v.image || '',
                    points: v.points || 0,
                    qty: (v.qty || 0)
                });
            });
        } catch {}
    }

    /**
     * Fonction centrale de mise à jour de l'UI (panier snacks + total global).
     * @param {string|null} productName - Si fourni, ne met à jour que la carte de ce produit.
     */
    function updateUI(productName = null) {
        // 1. Met à jour la quantité sur la carte produit (ex: "0" -> "1")
        if (productName) {
            const qtyEl = $(`.qty[data-name="${productName}"]`);
            if (qtyEl) qtyEl.textContent = cart.get(productName)?.qty ?? 0;
        }

        // 2. Reconstruit la liste du panier SNACKS (colonne droite)
        if (cartLinesEl) {
            cartLinesEl.innerHTML = ''; // Vide la liste
            cart.forEach((item) => { // Remplit avec le contenu de la Map
                const line = document.createElement('li');
                line.className = 'cart-line';
                line.dataset.name = item.nom;
                line.innerHTML = `
                  <span>${item.qty} × ${item.nom}</span>
                  <span>${fmt(item.prix * item.qty)}</span>
                  <button class="cart-trash" data-name="${item.nom}" aria-label="Retirer ${item.nom}" type="button">
                    <img src="${TRASH_ICON}" alt="" aria-hidden="true">
                  </button>`;
                cartLinesEl.appendChild(line);
            });
        }

        // 3. Calcule et affiche le Total global
        const total = +((ticketsSnapshot.total || 0) + calcSnackTotal()).toFixed(2);
        basketTotalEl && (basketTotalEl.textContent = fmt(total));

        // 4. Gère l'état du bouton "Continuer"
        // (Désactivé si on n'a ni billets ni snacks)
        const isEmpty = cart.size === 0 && (!ticketsSnapshot || !ticketsSnapshot.count);
        btnContinue?.classList.toggle('is-disabled', isEmpty);
        btnContinue?.setAttribute('aria-disabled', String(isEmpty));

        // 5. Met à jour TOUTES les pastilles qty si on n'a pas ciblé un produit
        if (!productName) {
            $$('.qty').forEach(el => {
                const name = el.dataset.name;
                el.textContent = cart.get(name)?.qty ?? 0;
            });
        }

        // 6. Persiste le panier de snacks dans le LS
        saveCartLS();

        // 7. Prépare l'URL pour la page "paiement.html"
        // Récupère les infos de la séance depuis l'URL actuelle
        const qp = new URLSearchParams(location.search);
        const film = qp.get('film');
        const salle = qp.get('salle');
        // ... (tous les autres paramètres)

        if (btnContinue && !isEmpty) {
            // Construit l'URL de la page suivante
            const qs = new URLSearchParams({
                film: film || '',
                salle: salle || '',
                langue: qp.get('langue') || '',
                seance: qp.get('seance') || '',
                poster: qp.get('poster') || '',
                format: qp.get('format') || '',
                seats: qp.get('seats') || '',
                total: String(total) // Le PLUS important : le total global
            });
            // Ajoute les infos billets (tarifs, promo) pour la complétude
            if (ticketsSnapshot?.tarifs) qs.set('tarifs', JSON.stringify(ticketsSnapshot.tarifs));
            if (ticketsSnapshot?.promo) qs.set('promo', ticketsSnapshot.promo);
            
            btnContinue.href = `./paiement.html?${qs.toString()}`;
        } else if (btnContinue) {
            btnContinue.href = '#'; // Lien mort si panier vide
        }
    }
    
    // ---------- Boot ----------
    /**
     * Fonction d'initialisation de la page.
     */
    async function boot() {
        // 0) Met à jour la colonne de gauche (affiche, titre...)
        await hydrateLeftColumn(qp);

        // 1) Charge et affiche le récapitulatif des billets
        ticketsSnapshot = loadTickets();
        renderTicketLines(ticketsSnapshot);

        // 2) Charge le catalogue de snacks depuis snack.json
        try {
            const res = await fetch(PATH_JSON);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            catalog = await res.json();
        } catch (err) {
            shopSection && (shopSection.innerHTML = `<p class="empty">Impossible de charger les snacks.</p>`);
            console.error(err);
        }

        // 3) Construit l'affichage du catalogue
        renderCatalog();
        // 4) Restaure le panier de snacks (si l'utilisateur revient)
        restoreCartLS();

        // 5) Met à jour l'UI une première fois (totaux, etc.)
        updateUI();

        // 6) Bouton "Changer de film"
        $('#changeFilmBtn')?.addEventListener('click', () => {
            location.href = './catalogue.html';
        });
    }

    // Lance l'initialisation
    boot();
})();