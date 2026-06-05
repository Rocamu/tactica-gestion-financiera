# MONITOR TÁCTICA — Módulo "Gestión Financiera"

Módulo **independiente** (sin fusionar con el código de MONITOR). Se integra como una página/ruta a la que MONITOR enlaza desde su landing.

## Qué incluye
- `index.html` — front-end completo (cuatro módulos + chatbot). Funciona **solo**, sin backend, para pruebas: abre el archivo en el navegador.
- `server.js` — backend mínimo (Express). Sirve el front-end y expone `/api/chat`, que conecta el chatbot a **DeepSeek v4-pro** con *function calling*.
- `data.json` — agregados de la cartola para el motor servidor. El archivo no se sirve por ruta pública; el front estático contiene los agregados mínimos embebidos para que los módulos funcionen sin backend.
- `package.json`

## Arquitectura del chatbot (seguridad)
La llave de DeepSeek se lee de la variable de entorno **`DEEPSEEK_API_KEY`**. Nunca se escribe en el código ni se envía al navegador. A DeepSeek viaja solo la **pregunta** del usuario y el **catálogo de funciones**; las cifras las calcula el servidor localmente con funciones deterministas (`ingresos_cliente`, `reparto_a_fecha`, `saldo_socio`) y solo el resultado se usa para redactar la respuesta. Tus datos financieros no salen del servidor.

## Correr en local (M1)
```bash
cd monitor_tactica_finanzas
npm install
export DEEPSEEK_API_KEY="tu_llave"      # configúrala tú; no la pongas en el código
npm start                               # http://localhost:3000
```
Sin la llave, el front-end y los tres módulos funcionan igual; el chatbot resuelve consultas con el motor local y reserva DeepSeek para preguntas en lenguaje libre.

## Desplegar en Render (junto a MONITOR, sin fusionar)
1. Sube esta carpeta como un **nuevo servicio** (Web Service) en el mismo proyecto Render de MONITOR, o como subcarpeta con su propio `start`.
2. Build command: `npm install` · Start command: `npm start`.
3. En **Environment** agrega `DEEPSEEK_API_KEY` con una llave nueva e independiente de MONITOR. Render la inyecta; no queda en el repo.
4. Render entrega una URL (ej. `https://tactica-finanzas.onrender.com`).

## Integrar con la landing de MONITOR
En la caja **"Gestión de Crisis"** (o la que definas) de la landing de MONITOR, enlaza a la URL del módulo:
```html
<a href="https://tactica-finanzas.onrender.com" target="_self">Gestión Financiera</a>
```
Como el módulo es independiente, no toca el código de MONITOR: solo se enlaza.

## Estado
- **Logo**: incrustado el wordmark blanco oficial de tacticalegal.cl (inline base64; no depende de la red).
- **Facturación emitida**: se muestra como **dato de ejemplo, en rojo**, en el módulo Clientes. Cuando tengas la facturación real, se reemplaza ese cálculo de ejemplo por los datos efectivos.
- **Llave DeepSeek**: usa una llave nueva e independiente vía `DEEPSEEK_API_KEY`.

## Pendientes
- Sustituir la facturación de ejemplo por la real cuando esté disponible.
- **Actualización de datos**: para refrescar la cartola, se regenera `data.json` desde el Excel.
