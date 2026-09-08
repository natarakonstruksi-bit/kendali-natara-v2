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

window.addEventListener("error", (event) => {
  try {
    let box = document.getElementById("kendali-runtime-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "kendali-runtime-error";
      box.style.cssText = "position:fixed;z-index:999999;left:16px;right:16px;bottom:16px;padding:14px 16px;background:#fff1f0;border:1px solid #f2b8b5;border-radius:10px;color:#8a1c16;font:13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.14)";
      document.body.appendChild(box);
    }
    box.textContent = "KENDALI mendeteksi error tampilan: " + (event.message || "Unknown error");
  } catch {}
});
