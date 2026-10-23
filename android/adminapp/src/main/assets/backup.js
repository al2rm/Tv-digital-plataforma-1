/* Called only by the administrator's explicit native menu action, on the trusted origin. */
(async () => {
  try {
    if (!window.TvAdminFiles?.postMessage) throw new Error('Actualiza Android System WebView para guardar copias.');
    const session = JSON.parse(localStorage.getItem('tv_digital_admin_session') || 'null');
    if (!session?.token) throw new Error('Inicia sesión como administrador antes de descargar la copia.');
    const response = await fetch('/api/admin/v2/backup', {
      headers: { Authorization: 'Bearer ' + session.token },
      credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(response.status === 403 ? 'Solo un administrador puede descargar copias.' : 'No se pudo obtener la copia. Comprueba tu sesión y el servidor.');
    const blob = await response.blob();
    if (blob.size > 4194304) throw new Error('La copia supera los 4 MB. Descárgala desde el navegador.');
    const reader = new FileReader();
    reader.onerror = () => alert('No se pudo preparar la copia.');
    reader.onload = () => window.TvAdminFiles.postMessage(JSON.stringify({
      name: 'tv-digital-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      mime: 'application/json', json: String(reader.result)
    }));
    reader.readAsText(blob, 'UTF-8');
  } catch (error) { alert(error.message || 'No se pudo preparar la copia.'); }
})();
