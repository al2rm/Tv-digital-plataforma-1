package com.tvdigital.admin;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AdminActivity extends ComponentActivity {
    private static final int BACKGROUND = Color.rgb(11, 21, 34);
    private static final int ACCENT = Color.rgb(87, 216, 197);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private PanelPolicy policy;
    private WebView web;
    private FrameLayout content;
    private LinearLayout errorPanel;
    private TextView errorText;
    private ProgressBar progress;
    private TextView serverLabel;
    private PendingBackupStore backupStore;
    private final BackupRequestGate backupGate = new BackupRequestGate(android.os.SystemClock::elapsedRealtime);
    private boolean failed;
    private AlertDialog externalPrompt;
    private final Runnable timeout = () -> showError("El servidor está tardando en responder. Si estaba suspendido, espera un momento y pulsa Reintentar.");
    private final ActivityResultLauncher<String> saveBackup = registerForActivityResult(
            new ActivityResultContracts.CreateDocument("application/json"), uri -> {
                if (uri == null) {
                    backupStore.clear();
                    toast("Guardado cancelado.");
                    return;
                }
                files.execute(() -> {
                    try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                        BackupPayload backup = backupStore.read();
                        if (backup == null) throw new java.io.IOException("No se encontró la copia pendiente");
                        if (out == null) throw new java.io.IOException();
                        out.write(backup.bytes);
                        handler.post(() -> toast("Copia guardada. Consérvala en un lugar privado."));
                    } catch (Exception ignored) {
                        handler.post(() -> toast("No se pudo recuperar o guardar la copia. Genera otra desde Menú."));
                    } finally { backupStore.clear(); }
                });
            });

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        backupStore = new PendingBackupStore(getNoBackupFilesDir());
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        String saved = getPreferences(MODE_PRIVATE).getString("server", BuildConfig.PANEL_URL);
        try { policy = new PanelPolicy(saved); }
        catch (IllegalArgumentException ignored) { policy = new PanelPolicy(BuildConfig.PANEL_URL); }
        buildLayout();
        createWebView();
        String route = state == null ? null : state.getString("route");
        web.loadUrl(policy.owns(route) ? route : policy.home);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else new AlertDialog.Builder(AdminActivity.this).setTitle("Salir del panel")
                        .setMessage("Tu sesión se conservará. Para cerrarla usa Salir dentro del panel o Borrar sesión en Menú.")
                        .setNegativeButton("Cancelar", null).setPositiveButton("Salir", (d, w) -> finish()).show();
            }
        });
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private Button button(String text, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(12);
        button.setTextColor(ACCENT);
        button.setAllCaps(false);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setPadding(dp(8), 0, dp(8), 0);
        button.setBackgroundColor(BACKGROUND);
        button.setOnClickListener(listener);
        return button;
    }

    private void buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BACKGROUND);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.setPadding(dp(16), dp(6), dp(8), dp(6));
        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("TV Digital · Administración");
        title.setTextSize(16);
        title.setTextColor(Color.WHITE);
        brand.addView(title);
        serverLabel = new TextView(this);
        serverLabel.setTextSize(10);
        serverLabel.setSingleLine(true);
        serverLabel.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        serverLabel.setTextColor(ACCENT);
        brand.addView(serverLabel);
        heading.addView(brand, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        heading.addView(button("Menú", this::showMenu), new LinearLayout.LayoutParams(dp(64), dp(48)));
        root.addView(heading);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(24), dp(28), dp(24));
        errorPanel.setBackgroundColor(BACKGROUND);
        errorText = new TextView(this);
        errorText.setTextSize(18);
        errorText.setTextColor(Color.WHITE);
        errorText.setGravity(Gravity.CENTER);
        errorPanel.addView(errorText);
        errorPanel.addView(button("Reintentar", v -> web.loadUrl(policy.home)), new LinearLayout.LayoutParams(-1, dp(56)));
        errorPanel.addView(button("Configurar servidor", v -> configureServer()), new LinearLayout.LayoutParams(-1, dp(56)));
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        errorPanel.setVisibility(View.GONE);
        LinearLayout navigation = new LinearLayout(this);
        String[] titles = {"Inicio", "Clientes", "Catálogo", "Pagos"};
        String[] paths = {"/", "/usuarios", "/catalogo", "/pagos"};
        for (int i = 0; i < titles.length; i++) {
            String path = paths[i];
            navigation.addView(button(titles[i], v -> navigate(path)), new LinearLayout.LayoutParams(0, dp(48), 1));
        }
        root.addView(navigation);
        setContentView(root);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        backupGate.cancel();
        if (web != null) {
            content.removeView(web);
            web.stopLoading();
            web.destroy();
        }
        web = new WebView(this);
        content.addView(web, 0, new FrameLayout.LayoutParams(-1, -1));
        serverLabel.setText(policy.origin);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setUserAgentString(settings.getUserAgentString() + " TVDigitalAdmin/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "TvAdminFiles", Collections.singleton(policy.origin),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (!isMainFrame || view != web || !policy.owns(sourceOrigin.toString()) || !policy.owns(view.getUrl())) return;
                        if (!backupGate.consume()) return;
                        if (backupStore.hasPending()) { toast("Termina de guardar la copia anterior."); return; }
                        try {
                            BackupPayload backup = new BackupPayload(message.getData());
                            backupStore.save(message.getData());
                            saveBackup.launch(backup.name);
                        } catch (Exception error) {
                            backupStore.clear();
                            toast("No se pudo preparar la copia. Revisa el formato o usa el navegador.");
                        }
                    });
            WebViewCompat.addWebMessageListener(web, "TvAdminLinks", Collections.singleton(policy.origin),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (BuildConfig.DEBUG) android.util.Log.d("TvAdminPopup", "link: main=" + isMainFrame + ", source=" + policy.owns(sourceOrigin.toString()) + ", current=" + policy.owns(view.getUrl()) + ", failed=" + failed);
                        if (!isMainFrame || view != web || failed || !policy.owns(sourceOrigin.toString()) || !policy.owns(view.getUrl())) return;
                        String url = message.getData();
                        if (url != null && url.length() <= 32768 && PanelPolicy.isAssistedWhatsApp(url)) confirmWhatsApp(url);
                    });
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                try {
                    WebViewCompat.addDocumentStartJavaScript(web, readAsset("links.js"), Collections.singleton(policy.origin));
                } catch (java.io.IOException ignored) { toast("No se pudo preparar la apertura de enlaces."); }
            }
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return !policy.owns(request.getUrl().toString());
                String url = request.getUrl().toString();
                if (policy.owns(url)) return false;
                if (request.hasGesture()) openExternal(url);
                else toast("Enlace externo bloqueado. Ábrelo desde una acción del panel.");
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                backupGate.cancel();
                if (!policy.owns(url)) { view.stopLoading(); showError("La página intentó salir del servidor configurado."); return; }
                failed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
                handler.removeCallbacks(timeout);
                handler.postDelayed(timeout, 65000);
            }
            @Override public void onPageFinished(WebView view, String url) {
                handler.removeCallbacks(timeout);
                progress.setVisibility(View.GONE);
                if (!failed && policy.owns(url)) errorPanel.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError("No se pudo conectar con el panel. Revisa Internet y la dirección del servidor.");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showError("El servidor respondió con error " + response.getStatusCode() + ". Reintenta o revisa su configuración.");
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler sslHandler, SslError error) {
                sslHandler.cancel();
                showError("El certificado HTTPS del servidor no es válido. Corrígelo para acceder al panel.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                if (BuildConfig.DEBUG) android.util.Log.d("TvAdminPopup", "requested: trusted=" + policy.owns(view.getUrl()) + ", gesture=" + isUserGesture + ", failed=" + failed);
                if (view != web || !policy.owns(view.getUrl()) || failed) return false;
                WebView popup = new WebView(AdminActivity.this);
                popup.getSettings().setAllowFileAccess(false);
                popup.getSettings().setAllowContentAccess(false);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (BuildConfig.DEBUG) android.util.Log.d("TvAdminPopup", "navigation: whatsapp=" + PanelPolicy.isAssistedWhatsApp(url) + ", blank=" + "about:blank".equals(url));
                        if (isUserGesture) {
                            if (policy.owns(url)) web.loadUrl(url); else openExternal(url);
                        } else if (PanelPolicy.isAssistedWhatsApp(url)) {
                            confirmWhatsApp(url);
                        } else toast("Ventana automática bloqueada.");
                        child.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });
        web.setDownloadListener((url, userAgent, disposition, mime, size) -> {
            if (url.startsWith("blob:")) {
                new AlertDialog.Builder(this).setTitle("Guardar copia de seguridad")
                        .setMessage("Usa Menú → Copia de seguridad para elegir dónde guardar el archivo en Android.")
                        .setPositiveButton("Entendido", null).show();
            } else toast("Descarga no admitida. Usa Copia de seguridad en Menú.");
        });
    }

    private void navigate(String path) {
        if (backupStore.hasPending()) { toast("Termina de guardar la copia antes de cambiar de sección."); return; }
        web.loadUrl(policy.origin + path);
    }

    private void showError(String text) {
        failed = true;
        handler.removeCallbacks(timeout);
        progress.setVisibility(View.GONE);
        errorText.setText(text);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        String[] actions = {"Recargar", "Configurar servidor", "Suscripciones", "Conexión y Xtream", "Actividad y papelera", "Copia de seguridad", "Borrar sesión", "Acerca de"};
        for (int i = 0; i < actions.length; i++) menu.getMenu().add(0, i, i, actions[i]);
        if (backupStore.hasPending()) menu.getMenu().add(0, 8, 8, "Descartar copia pendiente");
        menu.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 0: web.reload(); break;
                case 1: configureServer(); break;
                case 2: navigate("/suscripciones"); break;
                case 3: navigate("/conexion"); break;
                case 4: navigate("/actividad"); break;
                case 5: requestBackup(); break;
                case 6: new AlertDialog.Builder(this).setTitle("Borrar sesión de este dispositivo")
                        .setMessage("Se eliminarán los datos de acceso guardados en esta APK. Los clientes y suscripciones del servidor se conservarán.")
                        .setNegativeButton("Cancelar", null).setPositiveButton("Borrar sesión", (d, w) -> resetSession(policy)).show(); break;
                case 8: backupStore.clear(); toast("Copia pendiente descartada."); break;
                default: new AlertDialog.Builder(this).setTitle("TV Digital Administración " + BuildConfig.VERSION_NAME)
                        .setMessage("Panel de gestión para Android 7 o superior. Usa tu cuenta de administrador, vendedor o soporte. Las opciones disponibles dependen del rol y del servidor. Requiere conexión a Internet.")
                        .setPositiveButton("Cerrar", null).show();
            }
            return true;
        });
        menu.show();
    }

    private void configureServer() {
        if (backupStore.hasPending()) { toast("Termina o descarta la copia pendiente desde Menú antes de cambiar de servidor."); return; }
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(policy.home);
        input.setSelectAllOnFocus(true);
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(24), dp(8), dp(24), 0);
        TextView description = new TextView(this);
        description.setText("Dirección HTTPS principal de tu panel (sin /api). Al cambiarla se cerrará la sesión en esta APK.");
        form.addView(description);
        form.addView(input);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Servidor del panel").setView(form)
                .setNegativeButton("Cancelar", null).setPositiveButton("Guardar", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                PanelPolicy next = new PanelPolicy(input.getText().toString());
                dialog.dismiss();
                if (!next.home.equals(policy.home)) resetSession(next);
                else web.loadUrl(policy.home);
            } catch (IllegalArgumentException error) { input.setError(error.getMessage()); }
        }));
        dialog.show();
    }

    private void resetSession(PanelPolicy next) {
        if (backupStore.hasPending()) { toast("Termina o descarta la copia pendiente desde Menú antes de borrar la sesión."); return; }
        web.stopLoading();
        web.clearCache(true);
        web.clearHistory();
        policy = next;
        getPreferences(MODE_PRIVATE).edit().putString("server", policy.home).apply();
        createWebView(); // Destroy the old document before removing its stored session.
        WebStorage.getInstance().deleteAllData();
        CookieManager.getInstance().removeAllCookies(done -> {
            if (isFinishing() || isDestroyed()) return;
            CookieManager.getInstance().flush();
            web.loadUrl(policy.home);
        });
    }

    private void requestBackup() {
        if (!policy.owns(web.getUrl()) || failed) { toast("Conecta con el panel e inicia sesión primero."); return; }
        if (backupStore.hasPending()) { toast("Termina o descarta la copia pendiente desde Menú."); return; }
        if (!backupGate.begin()) { toast("La copia se está preparando. Espera un momento."); return; }
        try {
            web.evaluateJavascript(readAsset("backup.js"), null);
        } catch (Exception ignored) { backupGate.cancel(); toast("No se pudo iniciar la copia de seguridad."); }
    }

    private String readAsset(String name) throws java.io.IOException {
        try (InputStream source = getAssets().open(name)) {
            java.io.ByteArrayOutputStream script = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[2048];
            int count;
            while ((count = source.read(buffer)) != -1) script.write(buffer, 0, count);
            return script.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void confirmWhatsApp(String url) {
        if (externalPrompt != null && externalPrompt.isShowing()) return;
        externalPrompt = new AlertDialog.Builder(this).setTitle("Abrir WhatsApp")
                .setMessage("Se abrirá el mensaje preparado. Podrás revisarlo antes de enviarlo.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Abrir", (d, w) -> openExternal(url)).create();
        externalPrompt.setOnDismissListener(ignored -> externalPrompt = null);
        externalPrompt.show();
    }

    private void openExternal(String url) {
        if (!PanelPolicy.canOpenExternally(url)) { toast("Este tipo de enlace no está permitido en el panel."); return; }
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { toast("No hay una aplicación disponible para abrir el enlace."); }
    }

    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    @Override protected void onSaveInstanceState(Bundle state) {
        String url = web.getUrl();
        if (policy.owns(url)) state.putString("route", url);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        backupGate.cancel();
        if (externalPrompt != null) externalPrompt.dismiss();
        handler.removeCallbacksAndMessages(null);
        files.shutdown();
        if (web != null) { content.removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
