# Guía para reportar fallas y novedades — Droguería App

> Esta guía es para el **equipo de la droguería** (cajeros, vendedores y administrador) y para la
> **máquina de producción**. Su objetivo es que cada problema se reporte de forma **precisa y completa**
> para que pueda arreglarse rápido, sin perder información ni ventas.

---

## 1. Regla de oro

**No intentes “arreglarlo” tú mismo.** Si algo falla:
- No borres datos.
- No cierres a la fuerza la app ni apagues el equipo sin avisar.
- No cambies contraseñas ni usuarios.
- **Anota lo que pasó y avisa.**

Un reporte claro vale más que 10 intentos de arreglo.

---

## 2. Antes de reportar, recoge esta información

Toma **1 minuto** y anota:

1. **Qué estabas haciendo** (ej.: “estaba registrando una venta en el punto de venta”).
2. **Qué esperabas que pasara** (ej.: “que se guardara la venta y descontara stock”).
3. **Qué pasó en realidad** (ej.: “apareció un mensaje rojo y no se guardó”).
4. **El mensaje de error exacto** (cópialo o tómale foto a la pantalla). No lo parafrasees.
5. **Hora aproximada** en que ocurrió (ej.: “10:45 a. m.”).
6. **Usuario con el que entraste** (Admin, vendedor1, vendedor2).
7. **Captura de pantalla** (tecla `Impr Pant` o `Win + Shift + S`).
8. **Si el problema se repite**, anota los pasos para repetirlo.

> 💡 Si la app se queda “pensando” o no carga, toma foto de la pantalla y anota la hora.

---

## 3. Plantilla de reporte (copiar y pegar)

Envía este bloque lleno por WhatsApp/correo al desarrollador:

```
REPORTE DE FALLA — Droguería App

1. Fecha y hora: __________
2. Usuario: Admin / vendedor1 / vendedor2
3. Módulo afectado: (Login, Productos, Punto de venta, Entradas, Traslados, Gastos, Reportes, Otro)
4. Qué estaba haciendo: __________________________
5. Qué esperaba: ________________________________
6. Qué pasó: ___________________________________
7. Mensaje de error (exacto): ____________________
8. ¿Se repite? Sí / No
9. Pasos para repetirlo: ________________________
10. Captura adjunta: Sí / No
```

**Ejemplo de buen reporte:**
> “10:45 a. m., vendedor1, Punto de venta. Estaba vendiendo 2 unidades de Acetaminofén. Esperaba que se guardara. Apareció ‘Stock insuficiente’ aunque había 10 en inventario. Se repite siempre con ese producto. Captura adjunta.”

**Ejemplo de mal reporte:**
> “No funciona la venta.” (no dice qué, ni cuándo, ni el error)

---

## 4. Clasificación de urgencia

Marca la urgencia al reportar:

| Nivel | Cuándo usarlo | Ejemplo |
|---|---|---|
| 🔴 **Crítico** | No se puede vender ni trabajar. Afecta a todos. | La app no abre, error 500, no entra nadie. |
| 🟠 **Alto** | Se puede trabajar con rodeo, pero hay riesgo de datos. | Stock no descuenta, venta duplicada, anulación fallida. |
| 🟡 **Medio** | Molestia o error visual, pero el trabajo sigue. | Un botón no responde, un reporte muestra mal un número. |
| 🟢 **Bajo** | Mejora o detalle cosmético. | Color, texto, orden de columnas. |

> Si es **Crítico**, además del reporte, llama por teléfono. No esperes respuesta por chat.

---

## 5. Casos especiales

### A. “La app no abre o se queda cargando”
- Verifica que el equipo tenga internet (solo para Supabase; la app local funciona sin internet).
- Anota si el problema es en el navegador (Chrome/Edge) o en el servidor.
- No reinstales nada. Reporta.

### B. “Perdí una venta / no se guardó”
- **No vuelvas a registrarla** hasta confirmar con el desarrollador.
- Anota la hora, el cliente, los productos y el monto.
- Revisa en **Historial de ventas** si quedó guardada (a veces sí se guardó aunque no mostró confirmación).

### C. “Stock no cuadra”
- No ajustes el stock manualmente.
- Anota el producto, el stock que muestra y el stock real.
- Reporta con captura del producto y del historial de entradas/ventas.

### D. “Olvidé mi contraseña”
- El administrador puede restablecerla desde **Usuarios** (solo admin).
- No uses la cuenta de otro vendedor.
- Si el admin olvidó su clave, contactar al desarrollador (no hay auto-recuperación por correo).

### E. “El sync / respaldo falló”
- El sync de datos **solo se corre en producción** (esta máquina). En desarrollo está bloqueado.
- Si la tarea programada falla, revisa `logs/supabase-sync.log` y reporta el error.

---

## 6. Qué NO reportar como falla

Estos son comportamientos esperados, no errores:

- “Después de reiniciar el backend, me pidió login de nuevo.” → Las sesiones duran 8 h y se pierden al reiniciar. Normal.
- “El vendedor no ve Entradas de Stock.” → Es por rol; solo admin entra ahí.
- “Los totales cambiaron después de editar un costo.” → Los reportes usan el costo actual (no histórico). Documentado.
- “La app se ve diferente en otro equipo.” → Puede ser caché del navegador; refrescar con `Ctrl + F5`.

---

## 7. Para la máquina de producción (auto-actualización)

Cuando el desarrollador avise que hay cambios nuevos:

1. **No** ejecutes `git pull` a mano si no sabes qué cambió.
2. Usa el botón/archivo **“Actualizar Droguería App”** del escritorio (si está disponible).
3. Si falla la actualización, **no** reinicies el backend a mano sin avisar.
4. Reporta el error completo que muestra el `.bat` (incluye la última línea).

El auto-deploy valida sintaxis, dependencias, migraciones y pruebas **antes** de reiniciar. Si algo falla, el backend anterior sigue corriendo y la venta no se interrumpe.

---

## 8. Contacto

- **Desarrollador:** __________ (WhatsApp / correo)
- **Administrador local:** __________
- **Horario de soporte:** __________

> Guarda esta guía impresa o en el escritorio del equipo de producción.

---

## 9. Checklist rápido antes de enviar el reporte

- [ ] Anoté la hora exacta.
- [ ] Copié el mensaje de error tal cual.
- [ ] Tomé captura de pantalla.
- [ ] Indiqué el usuario y el módulo.
- [ ] Clasifiqué la urgencia.
- [ ] No toqué datos ni contraseñas.

Si todos los casilleros están marcados, el reporte está listo para enviar. 🚀
'