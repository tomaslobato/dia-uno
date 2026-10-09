# mejordia — Expo en Omarchy

App de tareas inspirada en Google Tasks, construida con Expo SDK 57, React Native, TypeScript y Expo Router. El objetivo de distribución es un APK que se instala directamente en Android, sin tiendas y sin necesitar Expo Go ni la computadora para ejecutarse.

## Funciones

- Nueva tarea con nombre y descripción de menor tamaño.
- Fecha opcional, con o sin hora, mediante el selector del sistema.
- Guardado automático al tocar fuera del editor o al pulsar Listo; no se crean tareas sin nombre.
- Check para completar o volver a dejar pendiente; el nombre completado se muestra tachado.
- Edición tocando una tarea existente y botón rojo Eliminar junto a Listo.
- Animación del check y tachado progresivo al completar una tarea.
- Botones superiores Tareas (azul por defecto) y Hábitos (rojo claro por defecto); Hábitos permite crear rutinas cada una cantidad elegida de días con un contador numérico, marcar hoy o ayer, editar el nombre y consultar puntos del mes y del año actual más los dos anteriores. La racha 🔥 cuenta completados separados por una cantidad de días menor o igual a la frecuencia; al superar ese plazo muestra 🧊 0. Los datos se guardan localmente con AsyncStorage (`tareas.habits.v1`).
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

`artifacts/mejordia.apk` (también está en `android/app/build/outputs/apk/release/app-release.apk`)

Incluye el código JavaScript y los recursos. Se puede copiar al teléfono y abrir allí, autorizando la instalación de apps desde esa fuente, o instalar por USB con depuración USB habilitada:

```bash
adb devices
adb install -r artifacts/mejordia.apk
```

El APK universal incluye ARM y x86 y requiere Android 7.0 (API 24) o posterior. El identificador provisional es `com.lobato.mejordia`.

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
