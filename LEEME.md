# Herramientas de apoyo para la programación académica

Contenedor que reúne tres tableros de la Sede Medellín, en este orden: Registro de intención de inscripción - RII, Oferta de asignaturas y Resultados académicos.
La selección del tablero está en la parte superior, en un recuadro propio; la fuente de cada tablero aparece al pie del propio tablero.

- Cada tablero conserva su carpeta, sus datos y su código (`rii/`, `oferta/`, `resultados/`). Las librerías están una sola vez en `vendor/`.
- Dentro del contenedor se oculta el encabezado y el pie propios de cada tablero.
- Cada tablero se carga al seleccionarlo y conserva sus filtros al cambiar entre ellos.
- Los nombres y rutas de los tableros se editan en la lista `TABLEROS` de `index.html`.
- Los gráficos de los tres tableros evitan el cruce de etiquetas: giran, recortan o retiran las etiquetas que no caben (función `evitarCruces` en cada `js/dashboard.jsx`).
- En RII y Oferta, la función `armonizar` evita combinar verde y ocre en una misma gráfica.
- Las tarjetas de indicadores no llevan subtítulo y los títulos no usan paréntesis.
- El tablero del RII incluye la sección Asignaturas declaradas; sus datos salen de `rii/prep_sel.py` y `rii/etl_rii.py`.
- El tablero de Oferta incluye la sección Evolución de resultados académicos (inscritos iniciales, cancelaciones después de la apertura del acta y matrícula final, de 2022-1S a 2026-1S, por asignatura); sus datos salen de `oferta/etl_oferta.py` (tabla `evolucion`). La matrícula final es la diferencia entre inscritos iniciales y cancelaciones.
- Enlace directo a un tablero: `index.html#rii`, `index.html#oferta` o `index.html#resultados`.

Servir con `python3 -m http.server 8000` y abrir http://localhost:8000.
