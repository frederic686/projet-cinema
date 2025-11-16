(() => { // IIFE
  // --- Utilitaires ---
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const fmtEUR = (n) =>
    Number(n || 0).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR"
    });

  // --- Params URL (récupération des infos depuis paiement.html) ---
  const qp = new URLSearchParams(location.search);
  const film = qp.get("film") || "Film";
  const salle = qp.get("salle") || "—";
  const seance = qp.get("seance") || "—:—";
  const langue = qp.get("langue") || "—";
  const seats = (qp.get("seats") || "").trim(); // Liste des sièges (ex: "A1,B2")
  const total = qp.get("total") || "0.00"; // Total payé

  // ---------------------------------------------------------
  // [COMMUN] Hydratation de la colonne gauche
  // (Identique aux autres scripts)
  // ---------------------------------------------------------
  async function hydrateLeftColumn(params) {
    const posterQP = params.get("poster") || "";
    const filmQP = params.get("film") || "Film";
    const salleQP = params.get("salle") || "—";
    const seanceQP = params.get("seance") || "—:—";
    const langueQP = params.get("langue") || "—";
    const finQP = params.get("fin") || params.get("end") || ""; // Accepte 'fin' ou 'end'

    const leftPane = document.querySelector(".left");
    const posterEl = document.querySelector("#filmPoster");
    const titleEl = document.querySelector("#filmTitle");
    const seanceTimeEl = document.querySelector("#seanceTime");
    const seanceEndEl = document.querySelector("#seanceEnd");
    const seanceLangEl = document.querySelector("#seanceLang");
    const roomNoEl = document.querySelector("#roomNo");

    // Affiche + fond
    const posterFile = posterQP ? posterQP.split("/").pop() : "";
    if (posterEl) {
      posterEl.src = `../assets/images/FILMS/${posterFile || "placeholder.jpg"}`;
      posterEl.alt = `Affiche : ${filmQP}`;
    }
    if (leftPane) {
      const bgPath = posterFile ? `../images/FILMS/${posterFile}` : "";
      // Le CSS utilise --left-bg pour le pseudo-élément ::before
      leftPane.style.setProperty("--left-bg", bgPath ? `url("${bgPath}")` : "none");
    }

    // Textes
    if (titleEl) titleEl.textContent = filmQP;
    if (roomNoEl) roomNoEl.textContent = `Salle ${salleQP}`;
    if (seanceTimeEl) seanceTimeEl.textContent = seanceQP;
    if (seanceLangEl) seanceLangEl.textContent = langueQP;

    // Heure de fin
    if (seanceEndEl) {
      if (finQP) {
        seanceEndEl.textContent = `Fin prévue à ${finQP}`;
      } else {
        // Fetch films.json si l'heure de fin n'est pas dans l'URL
        try {
          const res = await fetch("../data/films.json");
          const list = await res.json();
          const f = list.find((x) => x.titre === filmQP);
          const s = f?.séances?.find(
            (x) => String(x.salle) === String(salleQP) && x.horaire === seanceQP
          );
          seanceEndEl.textContent = s?.fin ? `Fin prévue à ${s.fin}` : "Fin prévue —:—";
        } catch (err) {
          console.error("Erreur lors de la récupération de la fin de séance", err);
          seanceEndEl.textContent = "Fin prévue —:—";
        }
      }
    }
  }

  // Appel de la fonction pour la colonne de gauche
  hydrateLeftColumn(qp);

  // ---------------------------------------------------------
  // Ticket (colonne droite)
  // Hydrate les éléments du ticket avec les paramètres de l'URL
  // ---------------------------------------------------------
  if ($("#movie-title")) $("#movie-title").textContent = film;
  if ($("#session-time")) $("#session-time").textContent = seance;
  if ($("#session-version")) $("#session-version").textContent = langue;
  if ($("#room-number")) $("#room-number").textContent = salle;

  // Sièges : Formate "A1,B2" -> "A1, B2" pour un meilleur affichage
  const seatsPretty =
    seats && seats.includes(",")
      ? seats.split(",").map((s) => s.trim()).join(", ")
      : seats || "—";
  if ($("#seat-numbers")) $("#seat-numbers").textContent = seatsPretty;

  // Total (formaté en EUR)
  if ($("#total-price")) $("#total-price").textContent = fmtEUR(parseFloat(total));


  // ---------------------------------------------------------
  // [NOUVEAU] Génération du QR Code Dynamique
  // ---------------------------------------------------------
  try {
    // 1. Préparer les données à inclure dans le QR Code
    const ticketData = {
      film: film,
      salle: salle,
      seance: seance,
      langue: langue,
      sieges: seats,
      totalPaye: fmtEUR(parseFloat(total))
    };

    // 2. Convertir cet objet en une chaîne de texte (format JSON)
    const qrDataString = JSON.stringify(ticketData);

    // 3. Trouver l'élément image
    const qrImgElement = $("#qr-code");

    // 4. Vérifier que la bibliothèque 'QRious' est bien chargée
    if (qrImgElement && typeof QRious !== 'undefined') {
      
      // 5. Générer le QR code
      const qr = new QRious({
        element: qrImgElement, // Cible directement votre <img>
        value: qrDataString,   // Les données (la chaîne JSON)
        size: 120,             // Taille en pixels (correspond à votre CSS)
        level: 'H'             // Niveau de correction d'erreur
      });

      // 6. (Optionnel) Mettre à jour le texte 'alt' pour l'accessibilité
      qrImgElement.alt = "QR Code pour votre billet : " + film;

    } else if (typeof QRious === 'undefined') {
      console.warn("La bibliothèque QRious n'est pas chargée. Le QR code ne peut être généré.");
    }

  } catch (err) {
    console.error("Erreur lors de la génération du QR Code :", err);
  }


  // ---------------------------------------------------------
  // Reset storage sur liens Accueil
  // Si l'utilisateur clique pour retourner à l'accueil, on vide le localStorage
  // pour commencer une nouvelle réservation propre.
  // ---------------------------------------------------------
  const homeLinkBreadcrumb = $("#homeLinkBreadcrumb"); // Lien fil d'Ariane
  const homeLinkHeader = $("#homeLinkHeader"); // Logo/Lien header
  
  // Fonction qui vide TOUT le localStorage
  const clearAll = () => localStorage.clear();

  if (homeLinkBreadcrumb) homeLinkBreadcrumb.addEventListener("click", clearAll);
  if (homeLinkHeader) homeLinkHeader.addEventListener("click", clearAll);

})();