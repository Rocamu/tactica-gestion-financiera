# MONITOR TÁCTICA — Módulo Gestión Financiera

Módulo independiente de gestión financiera para TÁCTICA. Se despliega como servicio propio y puede enlazarse desde MONITOR sin fusionar código.

## Qué incluye
- `index.html` — front-end completo: Flujo de Caja, Clientes, Socios, Control de Gestión y chat financiero.
- `server.js` — backend Express. Sirve el front y expone `/api/chat`.
- `data.json` — agregados financieros para cálculos deterministas del servidor.
- `render.yaml` — Blueprint de Render.

## IA financiera
El proveedor, endpoint, modelo y llave se configuran solo por variables privadas de entorno. La interfaz no revela el motor usado.

Variables requeridas para IA libre:
- `AI_API_KEY`
- `AI_API_URL`
- `AI_MODEL`

Los módulos y las consultas estructuradas funcionan con motor financiero determinista aunque la IA libre no esté configurada. Las cifras se calculan localmente con funciones verificadas; no se inventan números.

## Correr local
```bash
cd monitor_tactica_finanzas
npm install
PORT=3017 npm start
```

## Desplegar en Render
1. Crear o sincronizar el Blueprint del repo.
2. Configurar `AI_API_KEY`, `AI_API_URL` y `AI_MODEL` en Environment si se quiere habilitar IA libre.
3. Mantener `NODE_VERSION=20`.

## Estado
- Navegación con historial del navegador por hash.
- Mes seleccionado común a los módulos, con default en el mes actual del sistema.
- Socios calcula acumulado desde último retiro/corte registrado.
- Flujo separa cartola real de proyección mensual.
