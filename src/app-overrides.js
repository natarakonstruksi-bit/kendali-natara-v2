/**
 * KENDALI App extension point.
 *
 * Mulai versi App terpadu, perubahan kecil/non-destruktif dapat diletakkan
 * di file ini tanpa menyentuh bundle legacy hasil build lama.
 * Perubahan besar akan dipindahkan bertahap menjadi modul source terpisah.
 */
const cfg = window.KENDALI_CONFIG || {};
document.documentElement.dataset.kendaliApp = cfg.appVersion || "APP";
window.dispatchEvent(new CustomEvent("kendali:app-ready", { detail: cfg }));
