# Encargo para Codex — Despliegue del módulo "Gestión Financiera" en Render

**Objetivo:** desplegar en Render el módulo de Gestión Financiera de Táctica como un **servicio web independiente**, junto a MONITOR TÁCTICA, y enlazarlo desde la landing de MONITOR. **No fusionar** con el código de MONITOR.

---

## Principio rector
Este módulo es autónomo: su propio repositorio, su propio servicio en Render, su propia URL. MONITOR solo lo **enlaza** desde su landing (no importa su código ni comparte build). No modificar la lógica de MONITOR salvo añadir ese enlace.

## Contenido del paquete (`monitor_tactica_finanzas.zip`)
- `index.html` — front-end completo (4 módulos + chatbot). Funciona sin backend para los módulos y el chatbot de consultas estructuradas.
- `server.js` — backend Express. Sirve el front y expone `POST /api/chat`.
- `data.json` — agregados de la cartola. **Vive solo en el servidor**; no se expone al navegador ni se envía a terceros.
- `package.json` — `start: node server.js`, Node >= 18.
- `render.yaml` — Blueprint listo (incluido abajo).

---

## Tareas

### 1. Repositorio
Crear un repositorio **nuevo e independiente** (p. ej. `tactica-gestion-financiera`) con el contenido del paquete. No mezclar con el repo de MONITOR. Incluir un `.gitignore` con `node_modules/` y cualquier `.env`. **No commitear secretos.**

### 2. Servicio en Render (vía Blueprint)
Usar el `render.yaml` incluido (deploy as Blueprint), o crear un **Web Service** manual con:
- Runtime: **Node 20**
- Build command: `npm install`
- Start command: `npm start`
- El server escucha en `process.env.PORT` (Render lo inyecta).

### 3. Variable de entorno (la API key)
- El módulo lee la llave de **`DEEPSEEK_API_KEY`**.
- Es una llave **nueva e independiente** de la de MONITOR. **No reutilizar la de MONITOR.**
- En el Blueprint está declarada con `sync: false`: Render la **pedirá al crear el servicio**; el valor lo pega el titular (Rodrigo) en el panel de Render, en **Environment**. 
- **No hardcodear, no imprimir en logs, no commitear** la llave. El repo nunca debe contenerla.

### 4. Integración con la landing de MONITOR
En la landing de MONITOR, en la caja/botón **"Gestión de Crisis"**, enlazar a la URL pública que entregue Render para este módulo:
```html
<a href="https://tactica-gestion-financiera.onrender.com">Gestión Financiera</a>
```
Único cambio admitido en MONITOR: este enlace. Sin fusión de código.

---

## Arquitectura (para contexto del agente)
- **Front** estático (`index.html`): 4 módulos (Flujo de Caja, Clientes, Socios, Control de Gestión) + chatbot. Calcula todo localmente en el navegador a partir de `data.json` embebido para los módulos; el chatbot tiene un motor local determinista para consultas estructuradas.
- **Backend** (`server.js`, Express): sirve el front y expone `POST /api/chat`.
- **Chatbot con DeepSeek (function calling):** `/api/chat` recibe `{question}`, llama a `deepseek-v4-pro` (endpoint OpenAI-compatible `https://api.deepseek.com/chat/completions`) pasando **solo la pregunta y el catálogo de funciones**. El modelo elige función y argumentos; el **servidor ejecuta la función localmente** sobre `data.json` (`ingresos_cliente`, `reparto_a_fecha`, `saldo_socio`) y devuelve el resultado; el modelo solo redacta. **Los datos financieros nunca se envían a DeepSeek.** Mantener este patrón.

## render.yaml
```yaml
services:
  - type: web
    name: tactica-gestion-financiera
    runtime: node
    plan: starter
    region: oregon
    buildCommand: npm install
    startCommand: npm start
    autoDeploy: true
    envVars:
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: NODE_VERSION
        value: "20"
```

---

## Criterios de aceptación
1. El servicio levanta en Render y responde en su URL pública (la landing del módulo carga con el logo de Táctica y los 4 módulos navegables).
2. `GET /` sirve `index.html`; los indicadores (UF, dólar) cargan desde mindicador.cl.
3. Con `DEEPSEEK_API_KEY` configurada, `POST /api/chat` responde correctamente a: *"¿cuánto ingresó Virgin en los últimos 6 meses?"* y *"reparto a julio de 2026, ¿cuánto retira cada socio?"* (las cifras deben coincidir con el motor local del front).
4. Sin la variable, el servicio igual sirve el front (los módulos y el chatbot estructurado funcionan); `/api/chat` devuelve un error controlado.
5. El repo **no contiene** la llave. La caja "Gestión de Crisis" de MONITOR abre el módulo.

## Notas / pendientes
- **Facturación**: hoy se muestra como *dato de ejemplo, en rojo*, en el módulo Clientes. Reemplazar por datos reales cuando existan.
- **Logo**: ya incrustado (wordmark blanco oficial, inline base64).
- **Actualización de datos**: `data.json` se regenera desde el Excel de cartola cuando haya nuevos meses.
