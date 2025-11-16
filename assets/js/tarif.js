/* =========================================================
JAVASCRIPT CORRIGÉ (tarifs.html)
========================================================= */
(() => { // IIFE
    // --- Helpers ---
    const $ = (s, ctx = document) => ctx.querySelector(s);
    const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
    const fmtEUR = n => (n || 0).toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    });

    // --- Récupération des paramètres (depuis salle.html) ---
    const qp = new URLSearchParams(location.search);
    const film = qp.get('film') || 'Film';
    const salle = qp.get('salle') || '—';
    const langue = qp.get('langue') || '—';
    const seance = qp.get('seance') || '';
    const endQP = qp.get('end') || ''; // Heure de fin
    const posterParam = qp.get('poster') || '';
    const format = qp.get('format') || '';
    const seatsStr = (qp.get('seats') || '').trim(); // "A1,B2,C3"
    // Convertit la chaîne en tableau (ex: ["A1", "B2", "C3"])
    const seats = seatsStr ? seatsStr.split(',').filter(Boolean) : [];
    const seatsCount = seats.length; // Nombre de sièges sélectionnés (ex: 3)

    // Clé pour le localStorage (doit être identique à salle.js)
    const LS_MAIN = 'pathe_reservation';
    const seanceKey = `${film}|${salle}|${seance}`;

    // ---------------------------------------------------------
    // [COMMUN] Fonction d'hydratation de la colonne gauche
    // (Identique aux autres scripts)
    // ---------------------------------------------------------
    async function hydrateLeftColumn(params) {
        const poster = params.get('poster') || '';
        const film = params.get('film') || 'Film';
        // ... (code identique aux autres fichiers, voir ci-dessus)
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

        // Heure de fin
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

    // Appel de la fonction
    hydrateLeftColumn(qp);

    // Bouton "Changer de film" (retour catalogue)
    $('#changeFilmBtn')?.addEventListener('click', () => {
        location.href = './catalogue.html';
    });

    // --- Barème des prix ---
    const PRICES = {
        MATIN: {
            label: 'Matin',
            price: 9.90
        },
        U14: {
            label: 'Moins de 14 ans',
            price: 6.50
        },
        // On pourrait ajouter d'autres tarifs ici (Etudiant, Senior...)
    };

    // --- État local ---
    const state = {
        qty: { // Quantités pour chaque tarif
            MATIN: 0,
            U14: 0
        },
        total: 0, // Total des billets
    };

    // --- Éléments DOM (côté droit) ---
    const seatsHintEl = $('#seatsHint'); // "Billets à sélectionner : 0/3"
    const linesEl = $('#basketLines'); // <ul> du panier
    const totalEl = $('#basketTotal'); // Total panier (milieu)
    const noteEl = $('#totalNote'); // Note sous le total (milieu)
    const btnCta = $('#btnContinue'); // Bouton "Continuer" (snacks)
    const footerTotalEl = $('#basketTotalFooter'); // Total panier (footer fixe)

    /**
     * Calcule le nombre total de billets sélectionnés (tous tarifs confondus).
     * @returns {number}
     */
    const totalTickets = () => Object.values(state.qty).reduce((a, b) => a + b, 0);

    /**
     * Met à jour le texte d'aide "Billets à sélectionner : X/Y".
     */
    function updateSeatHint() {
        const t = totalTickets(); // Nombre de billets pris
        if (seatsCount > 0) { // Si on a sélectionné des sièges (ex: 3)
            seatsHintEl.textContent = `Billets à sélectionner : ${t}/${seatsCount}`;
        } else { // Si on n'a pas sélectionné de siège (mode "placement libre")
            seatsHintEl.textContent = t > 0 ? `Billets sélectionnés : ${t}` : `Sélectionnez au moins un billet`;
        }
        // TODO: Gérer la couleur (rouge si t > seatsCount)
    }

    /**
     * Gère l'état (activé/désactivé) des boutons "+".
     * (Ici, on les active toujours, mais on pourrait les désactiver si t >= seatsCount)
     */
    function updateStepperAvailability() {
        // Pour l'instant, on peut toujours ajouter des billets
        $$('.tarif-item .plus').forEach(btn => btn.disabled = false);
        
        // Logique (non implémentée ici) si on voulait bloquer :
        // const t = totalTickets();
        // const maxReached = (seatsCount > 0 && t >= seatsCount);
        // $$('.tarif-item .plus').forEach(btn => btn.disabled = maxReached);
    }

    /**
     * Construit un tableau des lignes de billets pour le LS et l'URL.
     * @returns {Array<object>} ex: [{ code: "MATIN", label: "Matin", qty: 1, lineTotal: 9.90 }]
     */
    function buildTicketsLines() {
        const out = [];
        for (const [code, q] of Object.entries(state.qty)) {
            const p = PRICES[code];
            if (!p || !q) continue; // Ignore si q=0
            out.push({
                code,
                label: p.label,
                qty: q,
                lineTotal: +(q * p.price).toFixed(2) // Total pour cette ligne
            });
        }
        return out;
    }

    /**
     * Active ou désactive le bouton "Continuer" (vers snacks.html).
     * Construit l'URL cible du bouton.
     */
    function setCTAEnabled() {
        // 1. Prépare l'URL pour snacks.html
        const qs = new URLSearchParams({
            film,
            salle,
            langue,
            seance,
            end: endQP || '',
            poster: posterParam || '',
            format: format || '',
            seats: seats.join(','),
            total: String(state.total) // Transmet le total actuel
        });

        // Ajoute les détails des tarifs (ex: { "MATIN": 1 }) à l'URL
        const ticketsDetails = buildTicketsLines();
        if (ticketsDetails.length > 0) {
            // Transmet l'objet des quantités (plus simple)
            qs.set('tarifs', JSON.stringify(state.qty)); 
        }

        // 2. Vérifie les conditions d'activation
        const ticketsCount = totalTickets();
        // Condition :
        // - Soit on est en placement libre (seatsCount === 0) et on a > 0 billets
        // - Soit on a sélectionné des sièges (seatsCount > 0) ET le compte est bon (ticketsCount === seatsCount)
        const seatsMatch = (seatsCount === 0) || (ticketsCount === seatsCount);

        if (ticketsCount > 0 && seatsMatch) {
            // ✅ Activer le bouton
            btnCta.classList.toggle('is-disabled', false);
            btnCta.setAttribute('aria-disabled', "false");
            btnCta.href = `./snacks.html?${qs.toString()}`; // URL cible
        } else {
            // ❌ Désactiver le bouton
            btnCta.classList.toggle('is-disabled', true);
            btnCta.setAttribute('aria-disabled', "true");
            btnCta.href = '#'; // Lien mort
        }
    }

    /**
     * Sauvegarde l'état actuel (tarifs, total) dans le localStorage.
     */
    function persist() {
        try {
            const all = JSON.parse(localStorage.getItem(LS_MAIN) || '{}');
            // Met à jour la tranche de la séance actuelle
            all[seanceKey] = {
                ...(all[seanceKey] || {}), // Garde les infos de salle.js (selected...)
                film,
                salle,
                langue,
                seance,
                poster: posterParam,
                format,
                seats,
                tarifs: { ...state.qty }, // Les quantités { MATIN: 1 }
                total: state.total, // Le total calculé
                // (Duplication pour snacks.js au cas où)
                tickets: {
                    lines: buildTicketsLines(),
                    total: state.total,
                    count: totalTickets()
                }
            };
            localStorage.setItem(LS_MAIN, JSON.stringify(all));
        } catch {}
    }

    /**
     * Fonction principale de rendu : met à jour le panier, les totaux,
     * l'état du bouton, et persiste les données.
     * C'est la fonction appelée à chaque clic sur +/-.
     */
    function renderBasket() {
        // 1. Met à jour les lignes du panier (<ul>)
        linesEl.innerHTML = '';
        const entries = Object.entries(state.qty).filter(([, q]) => q > 0); // Lignes avec q > 0
        if (!entries.length) {
            linesEl.innerHTML = `<li class="muted">Aucun tarif sélectionné</li>`;
        } else {
            for (const [code, q] of entries) {
                const { label, price } = PRICES[code];
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="line-left"><strong>${q}×</strong> ${label}</div>
                    <div class="line-price">${fmtEUR(q * price)}</div>
                `;
                linesEl.appendChild(li);
            }
        }

        // 2. Calcule et met à jour le total
        let total = 0;
        for (const [code, q] of Object.entries(state.qty)) {
            total += q * (PRICES[code]?.price || 0);
        }
        state.total = Math.round(total * 100) / 100; // Total propre
        
        // 3. Affiche le total à deux endroits (panier + footer)
        if (totalEl) totalEl.textContent = fmtEUR(state.total);
        if (footerTotalEl) footerTotalEl.textContent = fmtEUR(state.total);

        // 4. Met à jour les aides visuelles
        updateSeatHint(); // "0/3"
        updateStepperAvailability(); // État des boutons +
        if (noteEl) { // Note sous le total
            noteEl.textContent = seatsCount > 0 ? `Billets : ${totalTickets()}/${seatsCount}` : '';
        }
        
        // 5. Met à jour l'état du bouton "Continuer"
        setCTAEnabled();
        
        // 6. Sauvegarde dans le localStorage
        persist();
    }

    // --- Initialisation des steppers (+/-) ---
    // Pour chaque "tarif-item" (Matin, U14...)
    $$('.tarif-item').forEach(item => {
        const code = item.dataset.code; // "MATIN" ou "U14"
        const qtyEl = item.querySelector('.qty');
        const btnMinus = item.querySelector('.minus');
        const btnPlus = item.querySelector('.plus');
        
        // Fonction de synchronisation (met à jour le 'state' et appelle 'renderBasket')
        const sync = () => {
            state.qty[code] = state.qty[code] || 0; // S'assure que le code existe
            qtyEl.textContent = state.qty[code]; // Met à jour le "0"
            renderBasket(); // Recalcule tout
        };
        
        // Clic sur "-"
        btnMinus.addEventListener('click', () => {
            if (state.qty[code] > 0) {
                state.qty[code] = state.qty[code] - 1;
                sync();
            }
        });
        
        // Clic sur "+"
        btnPlus.addEventListener('click', () => {
            state.qty[code] = (state.qty[code] || 0) + 1;
            sync();
        });
    });

    // --- Bouton "Modifier les sièges" ---
    // Permet de revenir à la page "salle.html" en conservant les infos
    $('#editSeatsBtn')?.addEventListener('click', () => {
        // Reconstruit l'URL de salle.html avec les mêmes paramètres
        const qs = new URLSearchParams({
            film,
            salle,
            langue,
            seance,
            end: endQP || '',
            poster: posterParam || '',
            format: format || '',
            seats: seats.join(',') // Transmet les sièges actuels
        });
        location.href = `./salle.html?${qs.toString()}`;
    });

    // --- Démarrage ---
    // Appel initial pour afficher l'état (tout à 0)
    renderBasket();
})();