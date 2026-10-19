# Día Uno — Expo en Omarchy

App de tareas inspirada en Google Tasks, construida con Expo SDK 57, React Native, TypeScript y Expo Router. El objetivo de distribución es un APK que se instala directamente en Android, sin tiendas y sin necesitar Expo Go ni la computadora para ejecutarse.

## Funciones

- Nueva tarea con nombre y descripción de menor tamaño.
- Fecha opcional, con o sin hora, mediante el selector del sistema.
- Guardado automático al tocar fuera del editor o al pulsar Listo; no se crean tareas sin nombre.
- Check para completar o volver a dejar pendiente; el nombre completado se muestra tachado.
- Edición tocando una tarea existente y botón rojo Eliminar junto a Listo.
- Animación del check y tachado progresivo al completar una tarea.
- Botones superiores Tareas (azul por defecto) y Hábitos (rojo claro por defecto); Hábitos permite crear rutinas cada una cantidad elegida de días con un contador numérico, marcar hoy o ayer, editar el nombre y consultar puntos del mes y de todos los años desde su creación, incluyendo registros anteriores si existen. La racha 🔥 cuenta completados separados por una cantidad de días menor o igual a la frecuencia; al superar ese plazo muestra 🧊 0. Los datos se guardan en Supabase al iniciar sesión, con copia local por cuenta; sin sesión se guardan solo en el dispositivo.
- La fecha/hora no programa notificaciones ni recordatorios todavía.
- Almacenamiento local persistente, sin cuenta ni servidor. Los datos de la vista web y Android son independientes.

## Activar las herramientas

```bash
source ~/Work/.expo-tools/env.sh
cd ~/Work/mejordia
```

Las herramientas están en `~/Work/.expo-tools`: Node 24 LTS, JDK 17, EAS CLI y SDK Android. No se cambiaron las versiones globales de Node o Java. El archivo `.mise.toml` contiene la configuración local equivalente y ya está autorizado: al entrar al proyecto desde una terminal de Omarchy, mise activa estas herramientas automáticamente.

## Vista previa

La vista web se abre con `npm run web`. La vista actual de la app está activa en http://localhost:8082 y en el emulador `Expo_API_36`, compartiendo Metro en ese puerto. Si cerrás estas sesiones, podés volver a iniciarlas con los comandos de abajo.

## Desarrollo rápido

```bash
npm start
```

Usá Expo Go **compatible con SDK 57** en un teléfono Android conectado a la misma red. Descarga oficial: https://expo.dev/go. Si la versión de Google Play es diferente, instalá el APK de Expo Go correspondiente al SDK.

Para usar el emulador, en otra terminal con el entorno activado:

```bash
npm run emulator
```

El emulador está ajustado a 720 × 1600, GPU Intel (`host`), KVM, 4 núcleos y 2 GB de RAM; el teclado físico está habilitado. El comando permite guardar y reutilizar Quick Boot al cerrar normalmente.

Y luego `npm run android`. Para instalar y ejecutar un cliente de desarrollo propio: `npm run android:build`. Después, `npx expo start --dev-client`.

## APK local sin cuenta de Expo

```bash
npm run build:apk:local
```

La primera compilación descarga Gradle, dependencias nativas, NDK y CMake; puede tardar bastante. El APK queda en:

`artifacts/dia-uno.apk` (también está en `android/app/build/outputs/apk/release/app-release.apk`)

Incluye el código JavaScript y los recursos. Se puede copiar al teléfono y abrir allí, autorizando la instalación de apps desde esa fuente, o instalar por USB con depuración USB habilitada:

```bash
adb devices
adb install -r artifacts/dia-uno.apk
```

El APK universal incluye ARM y x86 y requiere Android 7.0 (API 24) o posterior. El identificador de Android se conserva como `com.lobato.mejordia` para mantener la compatibilidad con instalaciones y el inicio de sesión.

La plantilla firma la compilación local con una clave de desarrollo. Antes de distribuir una app real, configurá una clave de firma propia y guardala: futuras actualizaciones de una app instalada deben conservar el identificador y la firma. No compartas claves privadas en Git.

## APK con EAS (alternativa en la nube)

```bash
eas login
eas build:configure
npm run build:apk
```

El perfil `preview` de `eas.json` produce un APK independiente, no un AAB. EAS necesita una cuenta de Expo y puede gestionar la clave de firma. No se necesita cuenta de Google Play ni publicar en una tienda. No se inició sesión ni se lanzó una compilación en la nube durante la preparación local.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run doctor
npm test
```

La app conserva soporte iOS. Linux no puede ejecutar el simulador de iOS ni compilar localmente con Xcode; esto no afecta al flujo de APK Android.

Documentación: https://docs.expo.dev/ y https://docs.expo.dev/build-reference/apk/.

El menú superior de apariencia permite elegir tema claro u oscuro y un color independiente para cada sección. Se guardan en el dispositivo con AsyncStorage (`tareas.appearance.v1`).

## Inicio de sesión con Google

Copia `.env.example` a `.env.local` y completa la URL y la clave publicable de Supabase. Expo usa `EXPO_PUBLIC_`, no `NEXT_PUBLIC_`. `.env.local` está excluido de Git. El secreto OAuth de Google se configura solo en Supabase.

Activa Google en Supabase con un cliente OAuth web de Google Cloud y autoriza allí la Callback URL de Supabase. En Supabase → Authentication → URL Configuration agrega `mejordia://auth/callback` y, para la vista web, la URL exacta `http://localhost:8083/auth/callback` (ajusta host y puerto al servidor que uses).

En Configuración → Cuenta pulsa Continuar con Google. La sesión persiste y puedes cerrarla desde ese menú; también puedes seguir sin cuenta. El flujo usa PKCE y abre el navegador del sistema. Para Android/iOS se requiere una compilación de desarrollo o una app instalada con el esquema `mejordia`; Expo Go no permite probar este retorno. No se compilan APKs al configurar el login.

## Guardado de tareas y hábitos en Supabase

1. En Supabase → SQL Editor → New query, ejecuta el contenido de `supabase/migrations/202610100001_tasks_habits.sql`. Es una transacción y puede ejecutarse de nuevo sin borrar datos. La clave publicable de la app no tiene permisos para crear tablas.
2. Ejecuta `supabase/migrations/202610100003_optional_task_lists.sql` para listas opcionales. Funciona aunque no hayas ejecutado la actualización 002. Conserva las listas personalizadas y deja sin lista las tareas de la antigua “Mis tareas”.
3. Abre la app con tu cuenta de Google. En Configuración → Cuenta debe aparecer «Tareas y hábitos guardados en tu cuenta». Si la app ya estaba abierta, recarga.
4. En Supabase → Table Editor encontrarás `tareas`, `habitos` y `listas`. Todas tienen `usuario_id` ligado a Authentication → Users; RLS impide que una cuenta acceda a los datos de otra.

`tareas`: `nombre`, `descripcion`, `fecha` (date, opcional), `hora` (time, opcional), `favorita`, `realizada`, `lista_id`. `listas`: `nombre`, identificador y fecha de creación. `habitos`: `nombre`, `descripcion`, `dias` (entero positivo), `dias_completados` (array de fechas). Ambas incluyen identificador y fecha de creación para conservar el orden y el historial.

El botón + junto a las listas crea una lista con nombre. El editor permite asignar o mover tareas entre listas; “Todo” aparece primero y reúne todas las tareas. No hay listas creadas automáticamente; el editor ofrece “Sin lista”. En “Todo”, las tareas asignadas muestran un pequeño indicador de su lista. Las listas vacías también se guardan y sincronizan.

Las fechas y horas de tareas son valores de calendario local, sin convertir el día a UTC. La hora puede estar vacía y requiere una fecha. Los días completados son fechas `YYYY-MM-DD`, sin duplicados. La frecuencia y descripción del hábito se pueden editar en su modal.

Cada cambio se muestra inmediatamente y se escribe primero en AsyncStorage. Con sesión se envía a Supabase; sin conexión queda en una cola que sobrevive al reinicio y se reintenta al editar, cada 30 segundos mientras la app está activa o al volver a la app. Cada dispositivo tiene su copia local por usuario, no una lista compartida entre cuentas. Al cerrar sesión los datos de la cuenta desaparecen de la vista, pero su copia y sus cambios pendientes se conservan para el siguiente acceso con esa misma cuenta. Sin sesión se utiliza una lista local independiente.

Al iniciar sesión se trasladan los datos anónimos de ese dispositivo a la cuenta, manteniendo los identificadores para evitar duplicados. Un recibo persistente vincula el traslado a su destinatario antes de moverlo; los datos originales y una copia de respaldo quedan guardados localmente. Tras el traslado, el modo sin cuenta comienza vacío. Los hábitos antiguos reciben descripción vacía. La importación no reemplaza registros que ya existan en la nube ni revive tareas eliminadas.

La función `mejordia_sync` aplica lotes y devuelve las listas completas sin el límite de paginación del Table Editor. `cambios_aplicados` registra recibos para que los reintentos no repitan cambios. Las tareas eliminadas mantienen una marca de borrado para que un dispositivo atrasado no las vuelva a crear. Ante ediciones del mismo campo desde varios dispositivos, gana la última procesada por el servidor; cambiar una estrella o completar una tarea no sobrescribe su texto, y marcar un día de hábito no reemplaza los demás días. Los cambios externos se reciben al sincronizar o en la siguiente comprobación de 30 segundos.

`supabase/tests/tasks_habits.sql` valida RLS, acceso anónimo, campos, historial, reintentos, borrado e importación dentro de una transacción que se revierte al terminar. Ejecútalo únicamente en una base de desarrollo. Las pruebas locales del modelo y la cola se ejecutan con `npm test`.

El tema y los colores siguen siendo preferencias locales del dispositivo. No se utilizan claves secretas ni service-role en la app y no hace falta compilar un APK para verificar el guardado en la vista web.

Para renombrar y eliminar listas desde una pulsación larga, ejecuta también `supabase/migrations/202610100004_manage_task_lists.sql` Este archivo también crea la tabla de listas si falta; no requiere ejecutar las migraciones 002 o 003 por separado. Eliminar una lista conserva sus tareas sin lista. Los nombres nuevos admiten hasta 16 caracteres.
