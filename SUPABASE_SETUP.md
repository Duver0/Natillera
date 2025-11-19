# Instrucciones para configurar Supabase

## 1. Crear cuenta y proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta gratuita
2. Crea un nuevo proyecto (anota la contraseña de la base de datos)
3. Espera a que el proyecto se inicialice (~2 minutos)

## 2. Configurar la base de datos

1. En el dashboard de Supabase, ve a **SQL Editor**
2. Crea una nueva query
3. Copia y pega todo el contenido del archivo `supabase-schema.sql`
4. Ejecuta el script (botón "Run")

## 3. Obtener las credenciales

1. Ve a **Settings** → **API**
2. Copia los siguientes valores:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (es una clave larga)

## 4. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

## 5. Actualizar app.json

Agrega la configuración extra en `app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://tu-proyecto.supabase.co",
      "supabaseAnonKey": "tu-anon-key-aqui"
    }
  }
}
```

## 6. Probar la conexión

Ejecuta:
```bash
bunx expo start
```

## 7. Desplegar en Vercel (para Web)

1. Instala Vercel CLI: `npm i -g vercel`
2. En la raíz del proyecto: `vercel`
3. Sigue las instrucciones
4. Agrega las variables de entorno en Vercel Dashboard:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Notas importantes:

- ✅ Los datos ahora se sincronizan entre web y móvil
- ✅ Funciona offline en móvil (con SQLite) y online sincroniza
- ✅ La versión web tendrá persistencia real
- ⚠️ Límite gratuito: 500MB de base de datos, 2GB de ancho de banda
