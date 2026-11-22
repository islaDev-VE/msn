# Zumbido 05 — Mensajería Retro (Python FastAPI + Mobile PWA)

Aplicación web progresiva (**PWA**) de mensajería instantánea en tiempo real inspirada en la estética clásica de los años 2000, construida con backend en **Python (`FastAPI` + `python-socketio` + `SQLAlchemy`)** y frontend **React + Vite**, lista para trabajar en **local** y desplegar en **producción**.

---

## Arquitectura

- **Backend**: Python 3.11+ con **FastAPI**, **Uvicorn** (un solo proceso ASGI), **python-socketio** para tiempo real con autenticación JWT (`PyJWT` + `bcrypt`), y **SQLAlchemy 2.0**.
- **Base de datos**: **SQLite en modo WAL** por defecto en local (`data/zumbido05.db`, cero configuración), preparada para cambiar a **PostgreSQL** o **MySQL** en producción ajustando únicamente `DATABASE_URL` en `.env`.
- **Frontend PWA**: React + Vite, 100% responsive (Escritorio Clásico 05 con ventanas arrastrables en PC y app táctil a pantalla completa en móviles), `manifest.json`, Service Worker e iconos PNG reales (`192×192`, `512×512`, `180×180`).

---

## Características Principales

- **Usuarios Reales y Persistencia**: Registro e inicio de sesión seguros, solicitudes de amistad por correo, grupos personalizados (*Amigos*, *Familia*, *Trabajo*, etc.), bloqueo/desbloqueo, eliminación, última conexión (`last_seen`) e historial paginado (*"Cargar mensajes anteriores"*).
- **Fotos de Perfil Reales y Colores Plus**: Subida desde PC o cámara/galería móvil con recorte cuadrado y compresión automática a `256×256`, avatares retro originales, apodos con **Colores Plus** (`[c=#hex]Texto[/c]`, `[b]`, `[i]`, `[u]`) y selector rápido de canciones del 2005 `(8)`.
- **Experiencia Nostálgica 2005**:
  - Ventanas arrastrables con `PointerEvents`, límites al viewport y **parpadeo naranja** en la barra de tareas cuando llegan mensajes nuevos.
  - **Zumbidos** con sacudida de pantalla, sonido procedural, **cooldown de 5s** y **vibración real en móviles** (`navigator.vibrate`).
  - **Envío de imágenes** en el chat (comprimidas a 800px con barra de transferencia retro y visor ampliado) y **Clips de Voz** (`🎙️` o tecla `F2`).
  - **Tinta manuscrita táctil**, **Guiños animados**, **Emoticonos clásicos** y motor de audio Web Audio API 100% procedural.

---

## Ejecución en Local (Python)

Requisitos: **Python 3.11+** y **Node.js 20+** (solo para compilar el frontend Vite).

```bash
# 1. Crear entorno virtual e instalar dependencias de Python
python3 -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Compilar el frontend PWA
npm install
npm run build

# 3. (Opcional) Configurar .env
cp .env.example .env

# 4. Arrancar el servidor unificado Python (API + Socket.io + PWA)
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Abre **`http://localhost:8000`** en tu navegador. La base de datos SQLite se creará automáticamente en `data/zumbido05.db`.

### Modo desarrollo con recarga en vivo
Terminal 1 (Backend Python con recarga automática):
```bash
uvicorn backend.main:app --reload --port 8000
```
Terminal 2 (Frontend Vite con proxy automático a `/api` y `/socket.io`):
```bash
npm run dev
```

---

## Cambio a PostgreSQL o MySQL en Producción

Solo define `DATABASE_URL` en tu archivo `.env` (o variables de entorno del servidor):

- **PostgreSQL** (`pip install "psycopg[binary]"`):
  ```env
  DATABASE_URL=postgresql+psycopg://usuario:clave@host:5432/zumbido05
  ```
- **MySQL / MariaDB** (`pip install pymysql`):
  ```env
  DATABASE_URL=mysql+pymysql://usuario:clave@host:3306/zumbido05
  ```

---

## Despliegue en Producción con Docker

```bash
JWT_SECRET="cambia-esta-clave-larga-y-aleatoria" docker compose up -d --build
```

El servicio quedará activo en `http://localhost:8000` (configurable con `PORT`) con comprobación de salud en `GET /api/health` y persistencia en `./data`.

---

## Pruebas E2E Automatizadas

```bash
npm run build
npm run test:e2e
```

---

## Aviso de Independencia
**Zumbido 05** es un proyecto de software independiente inspirado en la estética clásica de la mensajería de los años 2000. Todos sus gráficos, logotipos, sonidos procedurales y código fuente son originales. No está afiliado, asociado, patrocinado ni respaldado por Microsoft Corporation ni por ninguna otra marca comercial.
