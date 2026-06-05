# Reporte de Despliegue — Gestión Financiera TÁCTICA

## Estado
- Repositorio GitHub creado y conectado a Render.
- Servicio Render desplegado como módulo independiente.
- Navegación con historial del navegador habilitada.
- Selector de mes común agregado para los módulos.
- IA financiera preparada con variables privadas genéricas.

## Variables privadas requeridas
- `AI_API_KEY`
- `AI_API_URL`
- `AI_MODEL`

## Pruebas realizadas
- Sintaxis de `index.html` y `server.js`.
- Navegación en Socios y Clientes con atrás/adelante.
- Flujo de Caja con separación entre real y proyectado.
- Socios con acumulado desde último retiro/corte.
- Endpoint `/api/chat` para consultas estructuradas.

## Pendiente operativo
Configurar las variables privadas de IA en Render para habilitar preguntas libres. Las consultas estructuradas siguen funcionando con el motor financiero determinista.
