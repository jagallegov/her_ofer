# Tablero de oferta de cupos y docentes ocasionales, Sede Medellín

Reproduce el análisis de las diapositivas 14 a 35 de la presentación del RII de Medellín. Cinco secciones, con un máximo de cinco visualizaciones cada una, más cinco indicadores.

1. **Oferta de cupos:** cupos por semestre (obligatorias y otras), cupos por estudiante matriculado, variación de los cupos en obligatorias por UAB y detalle por UAB.
2. **Docentes ocasionales:** docentes y valor por tipología, participación en grupos y cupos, valor por cupo dictado y peso por UAB.
3. **Grupos y ocupación:** cupos e inscritos por grupo, ocupación y grupos con menos de 10 inscritos según el tipo de docente, y detalle por UAB.
4. **Oferta de 2026-2S:** cambio de la oferta entre el 19 de agosto y el 12 de septiembre, estado de los grupos, cupos añadidos y libres, y ocupación por UAB.
5. **Cancelación y pérdida:** cancelación por semestre y por UAB, valor por estudiante y tasa de pérdida según el tipo de docente.

Los filtros son en cascada y cambian según la sección. Las tarjetas con la marca (Sede Medellín) no responden a los filtros porque la matrícula solo existe para la Sede.

## Definiciones
- Docente ocasional: docente principal del grupo con vinculación DOCA en el semestre, sin ad honorem. Los análisis de grupos usan grupos de 5 cupos o más y excluyen 2026-2S.
- Valor: pago total con prestaciones más aportes patronales, en pesos corrientes.
- Comparaciones por UAB: promedio por semestre de 2022-2S y 2023-1S frente a 2025-2S y 2026-1S (cancelación: 2025-1S y 2025-2S).
- UAB de una asignatura: la última registrada en el catálogo de cupos.

## Datos
`python3 etl_oferta.py carpeta_con_tablas datos` con las tablas intermedias indicadas en el encabezado del script. No se exporta cédula, nombre ni correo. La matrícula por semestre está incorporada en el script.
Servir con `python3 -m http.server 8000` y abrir http://localhost:8000.
