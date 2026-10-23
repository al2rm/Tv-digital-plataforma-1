package com.tvdigital.admin;

import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.EditText;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import org.hamcrest.Matcher;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.junit.Assert.*;

/** Offline native smoke checks: no customer account or running backend required. */
@RunWith(AndroidJUnit4.class)
public class AdminSmokeTest {
    @Test public void launcherAndWebViewUseAdministrativeSecuritySettings() {
        try (ActivityScenario<AdminActivity> scenario = ActivityScenario.launch(AdminActivity.class)) {
            onView(withText("TV Digital · Administración")).check(matches(isDisplayed()));
            onView(withText("Clientes")).check(matches(isDisplayed()));
            onView(withText("Catálogo")).check(matches(isDisplayed()));
            scenario.onActivity(activity -> {
                WebView web = findWebView(activity.getWindow().getDecorView());
                assertNotNull(web);
                assertFalse(web.getSettings().getAllowFileAccess());
                assertFalse(web.getSettings().getAllowContentAccess());
                assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, web.getSettings().getMixedContentMode());
                assertTrue((activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0);
            });
        }
    }

    @Test public void invalidHttpServerStaysInSettingsWithoutChangingTheSavedServer() {
        try (ActivityScenario<AdminActivity> scenario = ActivityScenario.launch(AdminActivity.class)) {
            onView(withText("Menú")).perform(click());
            onView(withText("Configurar servidor")).perform(click());
            onView(isAssignableFrom(EditText.class)).perform(replaceText("http://panel.example/"), closeSoftKeyboard());
            onView(withText("Guardar")).perform(click());
            onView(isAssignableFrom(EditText.class)).check(matches(hasErrorText("Usa la dirección HTTPS principal del panel, sin /api ni datos de acceso.")));
            onView(withText("Cancelar")).perform(click());
            scenario.onActivity(activity -> assertEquals(BuildConfig.PANEL_URL,
                    activity.getPreferences(0).getString("server", BuildConfig.PANEL_URL)));
        }
    }

    @Test public void assistedWhatsAppOpensWithoutWebViewUserActivation() throws Exception {
        try (ActivityScenario<AdminActivity> scenario = ActivityScenario.launch(AdminActivity.class)) {
            scenario.onActivity(activity -> findWebView(activity.getWindow().getDecorView()).loadDataWithBaseURL(
                    BuildConfig.PANEL_URL,
                    "<html><head><title>native-test-ready</title></head><body>Prueba local</body></html>",
                    "text/html", "UTF-8", null));
            awaitFixture(scenario);
            assertEquals("\"object\"", evaluate(scenario, "typeof window.TvAdminLinks"));
            assertEquals("true", evaluate(scenario, "window.open.toString().includes('TvAdminLinks')"));
            assertEquals("null", evaluate(scenario, "window.open('https://wa.me/595981234567?text=Prueba','_blank','noopener,noreferrer')"));
            onView(isRoot()).perform(waitForWebView());
            onView(withText("Abrir WhatsApp")).check(matches(isDisplayed()));
            onView(withText("Cancelar")).perform(click());
        }
    }

    @Test public void originAloneCannotStartAnUnrequestedExport() throws Exception {
        try (ActivityScenario<AdminActivity> scenario = ActivityScenario.launch(AdminActivity.class)) {
            scenario.onActivity(activity -> findWebView(activity.getWindow().getDecorView()).loadDataWithBaseURL(
                    BuildConfig.PANEL_URL,
                    "<html><head><title>native-test-ready</title></head><body>Prueba local</body></html>",
                    "text/html", "UTF-8", null));
            awaitFixture(scenario);
            assertEquals("\"object\"", evaluate(scenario, "typeof window.TvAdminFiles"));
            scenario.onActivity(activity -> findWebView(activity.getWindow().getDecorView()).evaluateJavascript(
                    "TvAdminFiles.postMessage(JSON.stringify({name:'tv-digital-backup-2026-10-23.json',mime:'application/json',json:'{}'}))", null));
            onView(isRoot()).perform(waitForWebView());
            onView(withText("TV Digital · Administración")).check(matches(isDisplayed()));
            scenario.onActivity(activity -> assertFalse(new PendingBackupStore(activity.getNoBackupFilesDir()).hasPending()));
        }
    }

    private static void awaitFixture(ActivityScenario<AdminActivity> scenario) throws Exception {
        long limit = System.nanoTime() + TimeUnit.SECONDS.toNanos(12);
        String title = null;
        do {
            title = evaluate(scenario, "document.title");
            if ("\"native-test-ready\"".equals(title)) return;
            Thread.sleep(100);
        } while (System.nanoTime() < limit);
        fail("La página local no terminó de cargar: " + title);
    }

    private static String evaluate(ActivityScenario<AdminActivity> scenario, String script) throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        scenario.onActivity(activity -> findWebView(activity.getWindow().getDecorView()).evaluateJavascript(script, result -> {
            value.set(result);
            ready.countDown();
        }));
        assertTrue("WebView no respondió al script de prueba", ready.await(3, TimeUnit.SECONDS));
        return value.get();
    }

    private static ViewAction waitForWebView() {
        return new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isRoot(); }
            @Override public String getDescription() { return "Esperar el script local de WebView"; }
            @Override public void perform(UiController controller, View view) { controller.loopMainThreadForAtLeast(2000); }
        };
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView child = findWebView(group.getChildAt(i));
                if (child != null) return child;
            }
        }
        return null;
    }
}
