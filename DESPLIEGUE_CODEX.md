# DESPLIEGUE CODEX — Gestión Financiera TÁCTICA

## Objetivo
Servicio independiente para el módulo de Gestión Financiera de TÁCTICA. No fusionar con MONITOR; enlazar desde MONITOR o desde Render como servicio separado.

## Estructura
- `index.html`: interfaz completa con Flujo de Caja, Clientes, Socios, Control de Gestión y chat financiero.
- `server.js`: backend Express y endpoint `/api/chat`.
- `data.json`: agregados financieros de cartola para cálculos deterministas.
- `render.yaml`: Blueprint de Render.
- `README.md`: instrucciones operativas.

## Reglas funcionales vigentes
- La página inicia siempre en el mes actual del sistema.
- El selector de mes es común a todos los módulos y permite consultar meses reales y proyectados.
- Flujo de Caja distingue cartola real de proyección mensual.
- Socios muestra solo RCM, REP y CTC. RCM-REP se reparte 50/50; SIN RM queda fuera de Socios.
- Los saldos de socios son acumulados desde el último retiro/corte real registrado.
- Para RCM, Acciona + Hidro Maule se imputan mensualmente como anticipo contra retiros futuros.

## IA financiera
No revelar proveedor, endpoint ni modelo en la interfaz ni en documentación pública.

Variables privadas requeridas para IA libre:
- `AI_API_KEY`
- `AI_API_URL`
- `AI_MODEL`

El servidor calcula cifras mediante funciones deterministas y la IA solo redacta con resultados ya calculados. Si las variables no están configuradas, las consultas estructuradas siguen funcionando y las preguntas libres muestran un mensaje genérico.

## Render
Usar Blueprint o Web Service:
- Build command: `npm install`
- Start command: `npm start`
- Node: `20`
- Variables privadas: `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`

## Pruebas mínimas
1. Abrir `/` y confirmar que el mes por defecto sea el mes actual del sistema.
2. Entrar a Flujo, cambiar el mes y verificar que la tabla cambia entre real y proyectado.
3. Entrar a Socios, abrir RCM, cambiar el mes y verificar acumulado desde último retiro/corte.
4. Usar atrás/adelante del navegador en Socios y Clientes.
5. Probar `/api/chat` con consultas estructuradas de ingresos y retiros de socios.
