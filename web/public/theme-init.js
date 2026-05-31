// Applies the saved theme to <html> before first paint (no palette flash).
// Loaded as a render-blocking script at the top of <body>.
(function () {
  try {
    var t = localStorage.getItem("hv-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
    /* storage unavailable — fall back to the SSR default (dark) */
  }
})();
