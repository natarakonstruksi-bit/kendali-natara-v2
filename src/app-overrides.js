/**
 * KENDALI App V2.3 extension layer.
 * Semua pengembangan berikutnya ditempatkan di source ini / modul source lain,
 * bukan mengedit public/assets hasil build secara manual.
 */
const cfg = window.KENDALI_CONFIG || {};
document.documentElement.dataset.kendaliApp = cfg.appVersion || "APP";

window.KENDALI_APP = Object.freeze({
  config: cfg,
  health: () => fetch("/api/health", { credentials: "same-origin" }).then(r => r.json()),
  diagnostics: () => fetch("/api/diagnostics", { credentials: "same-origin" }).then(r => r.json())
});

window.dispatchEvent(new CustomEvent("kendali:app-ready", { detail: cfg }));
