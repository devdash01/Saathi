# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```


## Mobile App (Android APK via Capacitor)

Saathi can be compiled into a downloadable Android APK:

1. **Build web assets & sync to Android project**:
   ```bash
   npm run cap:sync
   ```

2. **Open in Android Studio**:
   ```bash
   npm run cap:open
   ```
   In Android Studio, click **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate the downloadable `.apk`.

3. **Or build headless from terminal**:
   ```powershell
   cd android
   .\gradlew assembleDebug
   ```
   The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

