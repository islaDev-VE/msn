# MSN Messenger 7.5 (Retro Revival Edition) 🦋

> Recreación fiel y nostálgica de **Microsoft MSN Messenger 7.5** (era Windows XP, 2005) con tema Luna Blue, Web Audio API, zumbidos, guiños animados, tinta manuscrita y multijugador en tiempo real.

![MSN 7.5 Preview](https://img.shields.io/badge/MSN_Messenger-7.5_XP-0055ea?style=for-the-badge&logo=windows-xp&logoColor=white)
![Windows XP](https://img.shields.io/badge/Windows_XP-Luna_Blue-388e3c?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-En_Vivo-2ea44f?style=for-the-badge&logo=github)

🔗 **Pruébalo en vivo aquí:** [https://isladev-ve.github.io/msn/](https://isladev-ve.github.io/msn/)

---

## 🌟 Características Nostálgicas

- **🎨 Interfaz Fiel a Windows XP y MSN 7.5**:
  - Escritorio con fondo "Bliss", barra de tareas XP azul con botón "inicio" y menú clásico.
  - Ventanas arrastrables, minimizables y restaurables desde la barra de tareas.
  - Bandeja del sistema con reloj digital e icono de mariposa de MSN.
  - Pantalla de inicio de sesión con .NET Passport, avatares clásicos (mariposa, patito, balón, guitarra) y estados.
  - Lista de contactos con acordeón: `Conectados (X)` y `No conectados (Y)`.
  - Mensaje personal editable: `(8) escuchando: Evanescence - Bring Me To Life (8)`.

- **⚡ Zumbido (Nudge)**:
  - ¡Presiona el botón de Zumbido o escribe para sacudir la pantalla de tu amigo con el sonido auténtico de temblor y alerta!

- **✨ Guiños Animados (Winks)**:
  - Guiños a pantalla completa con animaciones y efectos de sonido:
    - 🤣 *Risa a carcajadas*
    - 🎈 *Globo de agua que salpica la pantalla*
    - 💋 *Beso gigante con labios*
    - 👊 *Golpe a la pantalla (toc, toc, toc)*

- **✍️ Tinta Manuscrita (Handwriting / Ink)**:
  - Dibuja a mano alzada firmas, notas o garabatos con diferentes colores y grosores de trazo, y envíalos directamente al historial de chat.

- **🔊 Sonidos Autónomos con Web Audio API**:
  - Sonido de inicio de sesión (*tuk-tu-tu-tu*).
  - Sonido de mensaje entrante (*ding!*).
  - Sonido del zumbido (*brrr-buzz*).
  - Sonidos de guiños.
  - Toaster notification al conectar un amigo.
  - Sonido de desconexión.
  - Cero dependencias de servidores MP3 externos caídos.

- **😊 Emoticonos Clásicos de MSN**:
  - Soporte completo para los atajos icónicos: `:)`, `:D`, `;-)`, `:P`, `(L)`, `(U)`, `(K)`, `(H)`, `(A)`, `(6)`, `(Y)`, `(N)`, `(8)`, `*-)`, etc.

- **👥 Multijugador Real entre Amigos**:
  - Salas privadas con enlace directo (`?room=XYZ`) y código PIN.
  - Notificaciones Toaster en la esquina inferior derecha cuando un amigo inicia sesión.
  - Indicador de "X está escribiendo un mensaje...".

---

## 🚀 Inicio Rápido

### Instalación de dependencias:
```bash
npm install
```

### Iniciar el servidor unificado (Frontend + Backend Socket.io):
```bash
npm run build
npm start
```
Abre tu navegador en: **`http://localhost:3000`**

### Modo Desarrollo:
```bash
npm run dev
```

---

## 💌 Cómo invitar a un amigo
1. Inicia sesión con tu apodo y avatar favorito.
2. Haz clic en el botón **"+ Invitar amigo"** en la barra superior de contactos.
3. Haz clic en **"Copiar enlace"** y compártelo con tu amigo (o pásale el código de la sala).
4. Cuando tu amigo abra el enlace en su navegador, entrará de inmediato a tu misma sala y verás aparecer la notificación emergente *"acaba de iniciar sesión"*.
