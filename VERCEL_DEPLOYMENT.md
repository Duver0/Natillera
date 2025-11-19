# Natillera - Despliegue Web

## 🚀 La aplicación está desplegada en Vercel

### Pasos para desplegar:

1. **Instalar Vercel CLI** (si no lo tienes):
```bash
npm install -g vercel
```

2. **Desplegar desde la terminal**:
```bash
vercel
```

3. **En la primera vez te preguntará**:
   - Set up and deploy? → **Yes**
   - Which scope? → Selecciona tu cuenta
   - Link to existing project? → **No**
   - What's your project's name? → `natillera` (o el que prefieras)
   - In which directory is your code located? → `./` (presiona Enter)
   - Want to override settings? → **No**

4. **Configurar variables de entorno en Vercel**:
   
   Ve a tu dashboard de Vercel (https://vercel.com/dashboard) y:
   - Selecciona tu proyecto "natillera"
   - Ve a **Settings** → **Environment Variables**
   - Agrega estas variables:
     ```
     EXPO_PUBLIC_SUPABASE_URL = https://arvyilhrnjogzxzffvli.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnlpbGhybmpvZ3p4emZmdmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MTk4NDUsImV4cCI6MjA3OTA5NTg0NX0.YgaMjWU8lSi-g9r_HQAShMfMmY6cafIlpnBhuKgwoEI
     ```

5. **Re-desplegar con las variables**:
```bash
vercel --prod
```

## 🌐 ¿Cómo queda online?

Una vez desplegado, obtendrás una URL como:
- **Producción**: `https://natillera.vercel.app` o `https://natillera-duver0.vercel.app`

### Características del deployment:

✅ **Totalmente gratis** - Vercel tiene un plan gratuito generoso
✅ **HTTPS automático** - Certificado SSL incluido
✅ **Deploy automático** - Cada push a main actualiza la web
✅ **CDN global** - La app carga rápido en todo el mundo
✅ **Base de datos Supabase** - Todos los datos se guardan en la nube
✅ **Sesiones persistentes** - Los usuarios quedan logueados

### Acceso a la aplicación:

1. **Usuario administrador**:
   - Email: `admin`
   - Contraseña: `1193527117Rosa**`

2. **Desde cualquier dispositivo**:
   - Abre el navegador
   - Ve a tu URL de Vercel
   - Inicia sesión
   - ¡Listo! Puedes gestionar préstamos y ahorros

### Funcionalidades web:

- ✅ Crear, editar y eliminar clientes
- ✅ Crear préstamos con fecha personalizada
- ✅ Registrar pagos (capital, interés o cuota completa)
- ✅ Gestionar cuentas de ahorro
- ✅ Agregar depósitos y retiros con fechas
- ✅ Liquidar ahorros con interés
- ✅ Ver reportes y estadísticas
- ✅ Gestión de usuarios (solo admin)
- ✅ Sesión persistente (no se pierde al recargar)

### Actualizar la aplicación:

Cuando hagas cambios en el código:
```bash
git add .
git commit -m "descripción del cambio"
git push origin main
```

Vercel detectará el push y actualizará automáticamente la web en 1-2 minutos.

## 🔒 Seguridad

- Las credenciales de Supabase están en variables de entorno (no en el código)
- La comunicación es por HTTPS
- Las sesiones se guardan en localStorage (solo en el navegador del usuario)
- Las contraseñas se guardan tal cual (en producción deberías usar bcrypt)

## 📱 Acceso móvil

La misma URL funciona en:
- Computadoras de escritorio
- Tablets
- Teléfonos móviles
- Cualquier navegador moderno

## 🆘 Soporte

Si algo no funciona:
1. Verifica que las variables de entorno estén configuradas en Vercel
2. Revisa los logs en el dashboard de Vercel
3. Verifica que la base de datos Supabase esté activa
4. Revisa las políticas RLS en Supabase (deben permitir acceso público para desarrollo)
