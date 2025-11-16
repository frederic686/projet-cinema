/* =========================================================
   paiement.js – Hydratation, accordéon, masques CB
   Attendu dans l'URL : film, poster, salle, seance, langue, fin, seats, total
   ========================================================= */
(() => {
    // --- Helpers ---
    const $ = (s, ctx = document) => ctx.querySelector(s);
    const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
    const fmtEUR = n => Number(n || 0).toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    });
    
    // ====== Récup params pour la colonne gauche + total
    const qp = new URLSearchParams(location.search);
    const film = qp.get('film') || 'Titre du film';
    const posterParam = qp.get('poster') || '../assets/images/affiches/placeholder.jpg';
    const salle = qp.get('salle') || '—';
    const heure = qp.get('seance') || '--:--';
    const langue = qp.get('langue') || '—';
    const fin = qp.get('fin') || '—:—'; // Note: 'fin' est utilisé, pas 'end'
    const total = Number(qp.get('total')) || 0; // Total global (billets + snacks)
    // Compatibilité : accepte 'seats' (de salle.js) ou 'places' (ancien)
    const seats = qp.get('seats') || qp.get('places') || '';

    // Mise à jour de l'affichage du total (colonne de droite)
    document.getElementById('totalAmount').textContent = fmtEUR(total);

    // ---------------------------------------------------------
    // [COMMUN] Fonction d'hydratation de la colonne gauche
    // (Identique aux autres scripts)
    // ---------------------------------------------------------
    async function hydrateLeftColumn(params) {
        const poster = params.get('poster') || '';
        const film = params.get('film') || 'Film';
        const salle = params.get('salle') || '—';
        const seance = params.get('seance') || '';
        const langue = params.get('langue') || '—';
        const endQP = params.get('end') || params.get('fin') || ''; // Prend 'end' ou 'fin'
        const leftPane = document.querySelector('.left');
        const posterEl = document.querySelector('#filmPoster');
        // IDs spécifiques à la page paiement/ticket
        const titleEl = document.querySelector('#movieTitle') || document.querySelector('#filmTitle');
        const seanceTimeEl = document.querySelector('#seanceTime');
        const seanceEndEl = document.querySelector('#seanceEnd');
        const seanceLangEl = document.querySelector('#version') || document.querySelector('#seanceLang');
        const roomNoEl = document.querySelector('#roomBadge') || document.querySelector('#roomNo');

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
                // Fetch films.json si l'heure de fin n'est pas dans l'URL
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

    // Appel de la fonction pour la colonne de gauche
    hydrateLeftColumn(qp);

    // ====== Accordéon (Méthodes de paiement)
    const items = $$('#payMethods .ac-item');
    items.forEach(item => {
        const head = $('.ac-head', item); // La partie cliquable (en-tête)
        const body = $('.ac-body', item); // Le contenu (formulaire CB)
        
        // Fonction pour ouvrir CET item et fermer les autres
        const openOne = () => {
            items.forEach(i => {
                const h = $('.ac-head', i);
                const b = $('.ac-body', i);
                const on = (i === item); // Est-ce l'item sur lequel on a cliqué ?
                
                i.classList.toggle('open', on); // Ajoute/retire la classe 'open'
                h.setAttribute('aria-expanded', String(on)); // Accessibilité
                
                // Gère l'animation de la hauteur (CSS)
                b.style.maxHeight = on ? (b.scrollHeight + 'px') : '0px';
            });
        };
        
        // Si un item est 'open' au chargement, on calcule sa hauteur
        if (item.classList.contains('open')) body.style.maxHeight = body.scrollHeight + 'px';
        
        head.addEventListener('click', openOne); // Ouvre au clic
        head.addEventListener('keydown', e => { // Ouvre avec Espace ou Entrée
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                openOne();
            }
        });
    });

    // ====== Masques + détection marque carte
    const numberInput = $('#cc-number'); // Input numéro CB
    const expInput = $('#cc-exp'); // Input date expiration
    const cvcInput = $('#cc-cvc'); // Input CVC
    const brandRow = $('#brandRow'); // Conteneur pour le logo (Visa, MC)

    numberInput?.addEventListener('input', (e) => {
        // 1. Garde uniquement les chiffres (remplace \D) et limite à 16
        let v = e.target.value.replace(/\D/g, '').slice(0, 16);

        // 2. Formate par groupe de 4 (ex: "1234 5678")
        e.target.value = v.replace(/(.{4})/g, '$1 ').trim();

        // 3. Détection simple de la marque (basée sur les premiers chiffres)
        let brand = 'cb'; // Défaut
        if (/^4/.test(v)) brand = 'visa';
        else if (/^(5[1-5]|2[2-7])/.test(v)) brand = 'mc'; // Mastercard (BINs étendus)
        else if (/^3[47]/.test(v)) brand = 'amex'; // Amex

        // 4. Affiche le logo correspondant
        const logos = {
            cb: '../assets/images/LOGO/cb.png',
            visa: '../assets/images/LOGO/visa.webp',
            mc: '../assets/images/LOGO/mastercard.png',
            amex: '../assets/images/LOGO/amex.jpg'
        };
        brandRow.innerHTML = v ? `<img class="logo" src="${logos[brand]}" alt="${brand.toUpperCase()}">` : '';

        // 5. Feedback visuel (vert si 16 chiffres, sinon neutre)
        e.target.classList.remove('valid', 'invalid');
        if (v.length === 16) e.target.classList.add('valid');
    });

    expInput?.addEventListener('input', (e) => {
        // 1. Garde chiffres, limite à 4 (MMYY)
        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
        
        // 2. Ajoute le "/" automatiquement (ex: "12" -> "12", "122" -> "12/2")
        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
        e.target.value = v;
        
        // 3. Feedback visuel (vert/rouge si 5 chars ET date valide)
        e.target.classList.remove('valid', 'invalid');
        if (v.length === 5) {
            e.target.classList.add(validExpiry(v) ? 'valid' : 'invalid');
        }
    });

    cvcInput?.addEventListener('input', (e) => {
        // 1. Garde chiffres, limite à 4 (pour Amex)
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        
        // 2. Feedback (vert si 3+ chiffres)
        e.target.classList.remove('valid', 'invalid');
        if (e.target.value.length >= 3) e.target.classList.add('valid');
    });

    /**
     * Vérifie si une date d'expiration (MM/YY) est valide (pas expirée).
     * @param {string} mmYY - Date au format "MM/YY"
     * @returns {boolean}
     */
    function validExpiry(mmYY) {
        const [mm, yy] = mmYY.split('/').map(n => parseInt(n, 10));
        if (!mm || mm < 1 || mm > 12) return false; // Mois invalide
        
        const now = new Date();
        const y = 2000 + yy; // Année (ex: 25 -> 2025)
        const m = mm - 1; // Mois (JS : 0-11)
        
        // La date d'expiration est le dernier jour du mois MM/YY.
        // On vérifie si le *premier* jour du mois *suivant* (m + 1) est dans le futur.
        const exp = new Date(y, m + 1, 1); // ex: 12/25 -> 1er Jan 2026
        return exp > now; // Doit être > aujourd'hui
    }

    // ---------- Redirection vers le ticket ----------
    /**
     * Construit l'URL de la page "ticket.html" et y redirige l'utilisateur.
     * Transmet TOUTES les informations de la séance.
     */
    function goToTicket() {
        const params = new URLSearchParams({
            film,
            poster: posterParam,
            salle,
            seance: heure,
            langue,
            fin, // Transmet l'heure de fin
            seats, // Transmet les sièges
            total: total.toFixed(2) // Transmet le total payé
        });
        location.href = './ticket.html?' + params.toString();
    }

    // --- Démo : Clic sur les boutons de paiement ---
    
    // Clic sur Google Pay (simule paiement réussi)
    $('#btnGpay')?.addEventListener('click', () => goToTicket());

    // Clic sur le bouton principal "Payer X,XX €"
    $('#btnContinue').addEventListener('click', () => {
        // Vérifie quelle méthode de paiement est ouverte
        const active = document.querySelector('.ac-item.open')?.dataset.method;
        
        if (active === 'card') {
            // --- Validation du formulaire carte ---
            const raw = numberInput.value.replace(/\s+/g, ''); // Numéro sans espaces

            // 1. Exiger 16 chiffres (pas 15 pour Amex dans cette démo)
            if (raw.length !== 16) {
                numberInput.classList.remove('valid');
                numberInput.classList.add('invalid'); // Rouge
                numberInput.focus();
                return; // Bloque
            }
            // 2. Exiger date valide
            if (!validExpiry(expInput.value)) {
                expInput.classList.add('invalid');
                expInput.focus();
                return; // Bloque
            }
            // 3. Exiger CVC (3+ chiffres)
            if (cvcInput.value.length < 3) {
                cvcInput.classList.add('invalid');
                cvcInput.focus();
                return; // Bloque
            }

            // ✅ Paiement carte OK (démo) -> ticket
            goToTicket();
            
        } else if (active === 'gpay') {
            // ✅ Google Pay sélectionné (démo) -> ticket
            goToTicket();
        } else {
            // ✅ Autre méthode (ou pas d'accordéon) -> ticket (fallback)
            goToTicket();
        }
    });
})();