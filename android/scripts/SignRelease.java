import java.nio.file.*;
import java.util.*;

/** Firma local: java scripts/SignRelease.java APK_ENTRADA APKSIGNER_JAR APK_SALIDA */
class SignRelease {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("Indica APK, apksigner.jar y una ruta nueva de salida.");
        Path root = Path.of(System.getProperty("user.dir"));
        Path input = Path.of(args[0]).toAbsolutePath(), jar = Path.of(args[1]).toAbsolutePath(), output = Path.of(args[2]).toAbsolutePath();
        if (!Files.isRegularFile(input) || !Files.isRegularFile(jar)) throw new IllegalArgumentException("Falta el APK o apksigner.jar.");
        if (Files.exists(output)) throw new IllegalArgumentException("La salida ya existe; no se sobreescribirá.");
        Properties values = new Properties();
        try (var stream = Files.newInputStream(root.resolve("keystore.properties"))) { values.load(stream); }
        for (String key : List.of("storeFile", "storePassword", "keyAlias", "keyPassword")) {
            if (values.getProperty(key, "").isBlank()) throw new IllegalArgumentException("Falta configuración privada de firma.");
        }
        Path key = root.resolve(values.getProperty("storeFile")).normalize();
        if (!Files.isRegularFile(key)) throw new IllegalArgumentException("No se encontró el keystore configurado.");
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        ProcessBuilder signing = new ProcessBuilder(java, "-jar", jar.toString(), "sign", "--ks", key.toString(),
            "--ks-key-alias", values.getProperty("keyAlias"), "--ks-pass", "env:TV_APK_STORE_PASS",
            "--key-pass", "env:TV_APK_KEY_PASS", "--out", output.toString(), input.toString());
        signing.environment().put("TV_APK_STORE_PASS", values.getProperty("storePassword"));
        signing.environment().put("TV_APK_KEY_PASS", values.getProperty("keyPassword"));
        if (signing.inheritIO().start().waitFor() != 0) throw new IllegalStateException("Falló la firma; no distribuir la salida.");
        Process verification = new ProcessBuilder(java, "-jar", jar.toString(), "verify", "--verbose", "--print-certs", output.toString()).inheritIO().start();
        if (verification.waitFor() != 0) throw new IllegalStateException("Falló la verificación; no distribuir el APK.");
        System.out.println("APK firmado y verificado: " + output);
    }
}
