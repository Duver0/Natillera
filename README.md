# Natillera App (Expo + SQLite + Bun)

Aplicación móvil para gestionar una natillera / fondo rotatorio:

- Manejo de usuarios de la app (login/registro).
- Cada usuario puede crear y administrar **sus propios clientes**.
- Para cada cliente se podrán manejar ahorros, créditos, cuotas e intereses (modelo de datos ya creado en SQLite).
- Pensada para funcionar **offline** con SQLite y luego poder sincronizar con un backend sencillo.

## Tecnologías

- **React Native + Expo** (app móvil).
- **SQLite (expo-sqlite)** como base de datos local.
- **React Navigation** para la navegación entre pantallas.
- **Bun** como gestor de paquetes y ejecución de scripts.

## Requisitos

- Node.js (para Expo CLI y entorno React Native).
- [Bun](https://bun.sh/) instalado globalmente.
  - En Linux/macOS:
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```

## Instalación de dependencias

Desde la carpeta del proyecto (raíz del repo):

```bash
cd /home/duver/Natillera
bun install
```

Esto leerá `package.json` y generará el archivo de bloqueo de Bun (`bun.lock`).

## Ejecutar la app con Bun

Los scripts definidos en `package.json` se ejecutan así:

- Iniciar el servidor de desarrollo de Expo:
  ```bash
  bun run start
  ```

- Abrir en Android:
  ```bash
  bun run android
  ```

- Abrir en iOS (macOS con Xcode):
  ```bash
  bun run ios
  ```

- Abrir en web:
  ```bash
  bun run web
  ```

Internamente los scripts llaman a `expo`, que se resuelve desde las dependencias instaladas con Bun.

## Estructura principal del proyecto

- `App.js`: punto de entrada de la app, inicializa la base de datos y monta la navegación + contexto de autenticación.
- `app.json`: configuración principal de Expo.
- `babel.config.js`: configuración de Babel para Expo.
- `src/`
  - `navigation/AppNavigator.js`: navegación (stack + tabs: Dashboard, Clientes, Reportes).
  - `db/database.js`: conexión SQLite y creación de tablas.
  - `db/userRepository.js`: acceso a datos de usuarios de la app.
  - `db/clientRepository.js`: acceso a datos de clientes.
  - `context/AuthContext.js`: contexto de autenticación (login, registro, logout).
  - `screens/LoginScreen.js`: pantalla de login/registro.
  - `screens/ClientsScreen.js`: listado y creación de clientes por usuario.
  - `screens/DashboardScreen.js`: resumen (pendiente de completar).
  - `screens/YearlyReportScreen.js`: vista de reportes anuales (pendiente de completar).

## Notas

- El archivo `bun.lock` **debe versionarse** en Git para tener instalaciones reproducibles.
- Si prefieres usar `bunx` en lugar de `npx` para comandos puntuales (por ejemplo, crear nuevos proyectos Expo), puedes usar:
  ```bash
  bunx create-expo-app nombre-app
  ```

# Updated at Tue 18 Nov 2025 06:38:40 PM -05
