// Startpunt: controleer of de bibliotheken geladen zijn en start dan de app.

function fatal(message) {
  const main = document.getElementById('main');
  if (main) {
    main.innerHTML = `<div class="empty"><p>${message}</p><button type="button" class="btn btn--ink" onclick="location.reload()">Opnieuw laden</button></div>`;
  }
}

if (!window.L || !window.supabase) {
  fatal('De app kon niet volledig laden. Controleer je verbinding en probeer opnieuw.');
} else {
  import('./app.js')
    .then((m) => m.start())
    .catch((err) => {
      console.error(err);
      fatal('Er ging iets mis bij het starten van de app.');
    });
}
