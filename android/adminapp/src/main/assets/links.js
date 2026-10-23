(() => {
  if (window.top !== window || !window.TvAdminLinks) return;
  const original = window.open;
  window.open = function (url) {
    try {
      const link = new URL(String(url), location.href);
      if (link.protocol === 'https:' && link.hostname === 'wa.me' && !link.username && !link.password
          && !link.port && !link.hash && /^\/[0-9]{7,15}$/.test(link.pathname)) {
        TvAdminLinks.postMessage(link.href);
        return null;
      }
    } catch (_) { /* Preserve normal browser behavior for other targets. */ }
    return original.apply(window, arguments);
  };
})();
