package com.tvdigital.admin;

import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.EditText;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
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
