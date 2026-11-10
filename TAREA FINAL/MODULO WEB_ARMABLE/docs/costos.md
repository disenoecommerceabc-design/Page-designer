# Costos y límites del producto

No conviene fijar precios comerciales a partir del nombre de un modelo ni equiparar los créditos internos con los del proveedor. Las tarifas y las condiciones deben confirmarse en la cuenta Kie que usará el negocio.

Para un cliente, calcula:

```text
costo_texto = (tokens_entrada × tarifa_entrada + tokens_salida × tarifa_salida) / 1.000.000
costo_imagenes = cantidad_imagenes × tarifa_real_por_imagen_y_resolucion
costo_total_cliente = costo_texto + costo_imagenes + infraestructura + soporte + comisiones
margen_bruto = (precio_neto - costo_total_cliente) / precio_neto
precio_neto_minimo = costo_total_cliente / (1 - margen_objetivo)
```

Ejemplo puramente ilustrativo: si el costo total medido por cliente fuese 4 unidades monetarias y buscas un margen del 60 %, el precio neto mínimo sería 10 unidades monetarias. Este ejemplo no describe tarifas de Kie ni contempla impuestos.

La configuración inicial de la app usa 30 créditos internos por cuenta y día y 60 globales. A 5 créditos por imagen, un cliente no puede solicitar más de 6 imágenes al día si no realiza otras operaciones. El global permite hasta 12 imágenes entre todas las cuentas. Aun así, los cupos diarios no son una suscripción mensual ni un saldo pagado: todavía no existe facturación al cliente ni reposición comprada de créditos.

Antes de vender el servicio:

1. Ejecuta una muestra de solicitudes autorizadas con la clave real y contrasta `input_tokens`, `output_tokens`, `credits_consumed` y la factura de Kie.
2. Mide el peor costo razonable, incluyendo tokens de razonamiento, fallos que el proveedor facture, reintentos manuales y almacenamiento.
3. Confirma la compatibilidad de `max_output_tokens` en `/codex/v1/responses`. No bases un límite monetario únicamente en ese parámetro sin comprobarlo.
4. Ajusta los costos internos de texto, imagen y diseñador para representar el uso relativo real. Baja el cupo global si necesitas limitar exposición mientras obtienes mediciones.
5. Añade límites mensuales y por plan en la base de datos cuando integres el sistema de pagos. El cupo diario actual se comparte por cuenta, no por proyecto.
6. Fija alertas y el techo de gasto del proveedor cuando la cuenta lo permita. Un fallo de conexión puede dejar una operación facturada sin resultado confirmado.

Los fallos conservan la reserva interna de manera conservadora. La conciliación o devolución de esos cupos debe basarse en el estado de Kie; no hay una función administrativa de reembolso en esta versión.
