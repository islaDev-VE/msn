# Zumbido 05 — Mensajería Retro (Production & Mobile PWA)

Aplicación web progresiva (**PWA**) de mensajería instantánea en tiempo real inspirada en la estética clásica de los años 2000, lista para trabajar en **local** y desplegar en **producción** con base de datos SQLite nativa (`node:sqlite` en modo WAL), usuarios reales, fotos de perfil optimizadas y soporte 100% responsive para escritorio y móviles.

---

## Características Principales

- **Usuarios Reales y Persistencia (`SQLite WAL`)**:
  - Registro e inicio de sesión con contraseñas cifradas (`bcryptjs`) y sesiones JWT persistentes.
  - Lista de amigos real por correo electrónico con solicitudes entrantes/salientes, grupos personalizados (*Amigos*, *Familia*, *Trabajo*, etc.), bloqueo/desbloqueo, eliminación y última conexión (`last_seen`).
  - Historial de conversaciones persistente y paginado (*"Cargar mensajes anteriores"*), con soporte para mensajes sin conexión y conteo de no leídos.
- **Fotos de Perfil Reales y Colores Plus**:
  - Sube fotos reales desde tu PC o cámara/galería móvil con recorte cuadrado y compresión automática en el cliente (`256×256` WebP/JPEG).
  - Galería de avatares retro originales y editor de apodos con **Colores Plus** (`[c=#hex]Texto[/c]`, `[b]`, `[i]`, `[u]`) + selector de canciones clásicas del 2005 `(8)`.
- **Experiencia Nostálgica 2005**:
  - **Escritorio Clásico 05** con ventanas arrastrables mediante `PointerEvents`, límites de viewport, gestión de foco `z-index` y **parpadeo naranja** en la barra de tareas cuando llegan mensajes nuevos.
  - **Zumbidos** con sacudida de pantalla, sonido procedural, **cooldown anti-spam de 5s** y **vibración real en móviles** (`navigator.vibrate`).
  - **Envío de imágenes** en el chat (con compresión a 800px, barra de progreso retro y visor ampliado) y **Clips de Voz** (`🎙️` o atajo `F2`).
  - **Tinta manuscrita táctil** (mouse o dedo), **Guiños animados** y **Emoticonos clásicos**.
  - **Motor de audio Web Audio API** 100% procedural sin archivos externos.
- **PWA Instalable y 100% Responsive**:
  - `manifest.json`, Service Worker (`sw.js`) e iconos PNG reales (`192×192`, `512×512`, `180×180`).
  - En móviles (`< 768px`) se transforma en una app táctil de pantalla completa (`100dvh` + `visualViewport`) con navegación inferior y botón `← Atrás`.
  - Notificaciones del navegador (`Notification API`), botón **Instalar App** y banner automático de reconexión.

---

## Ejecución en Local

Requisitos: **Node.js 24+** (incluye `node:sqlite` nativo).

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Configurar variables de entorno
cp .env.example .env

# 3. Compilar frontend y arrancar el servidor unificado
npm run build
npm start
```

Abre **`http://localhost:3000`** en tu navegador. La base de datos SQLite se creará automáticamente en `data/zumbido05.db`.

### Desarrollo con recarga en vivo (Vite + Backend)
En una terminal inicia el backend:
```bash
npm run server
```
En otra terminal inicia Vite (con proxy automático a `/api` y `/socket.io`):
```bash
npm run dev
```

---

## Despliegue en Producción con Docker

```bash
# Definir secreto JWT seguro y levantar con volumen persistente ./data
JWT_SECRET="cambia-esta-clave-larga-y-aleatoria" docker compose up -d --build
```

El servicio quedará disponible en el puerto `3000` (configurable vía `PORT`) con comprobación de salud en `GET /api/health` y persistencia garantizada en `./data/zumbido05.db`.

---

## Pruebas Automatizadas

```bash
npm run test:integration
```

---

## Aviso de Independencia
**Zumbido 05** es un proyecto de software independiente inspirado en la estética clásica de la mensajería de los años 2000. Todos sus gráficos, logotipos, sonidos procedurales y código fuente son originales. No está afiliado, asociado, patrocinado ni respaldado por Microsoft Corporation ni por ninguna otra marca comercial.
