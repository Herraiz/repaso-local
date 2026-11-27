# Repaso

Aplicación local para practicar preguntas tipo test de oposiciones y otros exámenes. Abre `index.html` en el navegador. Mantén los archivos juntos y, si descargaste un ZIP, extrae primero toda la carpeta. Puedes usarla sin conexión y sin instalar un servidor.

## GitHub Pages y Safari

Para publicar en GitHub Pages, selecciona **Settings → Pages → Deploy from a branch** y guarda **main** con la carpeta **/ (root)**. El archivo `.nojekyll` permite servir la aplicación estática directamente. El código usa rutas relativas y también funciona en un sitio de proyecto bajo `/<repositorio>/`. [Configurar la fuente de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

En el iPad, abre la dirección HTTPS de Pages en Safari. El lector de PDF usa la variante compatible de la misma versión de PDF.js, con Safari 18 o posterior como referencia. [Compatibilidad de PDF.js](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported)

Para trasladar los bancos y el historial desde una copia local de Repaso, guarda la copia JSON en la aplicación anterior y usa **Historial → Recuperar copia** en la web. Las dos direcciones tienen su propio almacenamiento. En las siguientes actualizaciones de la web, usa la misma dirección HTTPS y abre Safari con el mismo perfil. La aplicación conserva la clave y el formato de `localStorage`. Safari puede eliminar datos de sitios según su política de almacenamiento. [Política de almacenamiento de WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)

## Empezar a estudiar

1. Abre **Bancos** e importa tu PDF o Excel. Revisa el recuento y los avisos que aparezcan antes de guardar.
2. En **Estudiar**, selecciona el banco y el modo. Pulsa **¿Qué hace cada modo?** para ver cómo se eligen las preguntas. Puedes filtrar por tema en Aleatoria, Por número, Fallos y Repaso de hoy si el banco tiene temas.
3. Elige la penalización por fallo y empieza el test. Pulsa una vez una opción para marcarla y otra vez la misma opción para avanzar. Puedes saltar preguntas y usar **Guardar y salir** para continuar después.
4. Usa **Terminar y corregir** para corregir el test entero. Con **Terminar examen aquí** se corrige hasta la pregunta actual o la última que quedó respondida, la que esté más adelante. Por ejemplo, si respondiste la 18 y vuelves a la 12, se corrigen las primeras 18. Las preguntas omitidas dentro de ese tramo cuentan como en blanco. Las posteriores quedan fuera de la nota.

La nota sobre 10 se calcula como `10 × (aciertos − fallos × penalización) ÷ preguntas incluidas en la corrección`. Las preguntas en blanco suman cero. La configuración inicial es sin penalización. Una penalización seleccionada puede dar una nota negativa. Ajusta el valor a las bases de tu examen.

Activa **Mezclar el orden de las preguntas** para cambiar el orden en **Completo**, **Por número** y **Repaso de hoy**. En este último, la app sigue eligiendo primero las preguntas más atrasadas de la tanda. Los modos **Aleatoria** y **Fallos** siempre mezclan las preguntas. El navegador recuerda el estado de la casilla.

## Repaso de hoy

El contador del modo muestra las preguntas del banco cuyo repaso ya toca. Cada tanda incluye hasta 10 y empieza por las más atrasadas. Cuando terminas las pendientes, puedes consultar la fecha del próximo repaso.

- Cada fallo o pregunta en blanco dentro de la corrección se programa para el día siguiente.
- Un acierto desde la fecha pendiente programa el siguiente repaso a 3, 7, 14 y, a partir de ahí, 30 días. Repetir la pregunta antes de la nueva fecha mantiene el intervalo.
- Un fallo posterior reinicia el ciclo y vuelve a programar la pregunta para el día siguiente.

El calendario se calcula a partir de los tests corregidos de cada banco, incluidos los guardados antes de añadir esta función. Las copias JSON permiten recuperarlo junto con el historial.

## Importar un PDF

El importador está verificado con el **Listado de preguntas definitivo del Grupo Auxiliar Administrativo de la Función Administrativa del Servicio Canario de la Salud**. Lee sus 300 preguntas, incluidas las que empiezan en una página y terminan en la siguiente. La columna **Página PDF** cuenta desde la primera página del archivo, incluida la portada.

Para otros PDF, el formato compatible es texto seleccionable, preguntas numeradas (`1.` o `1)`), opciones con letra (`A)`, `B)`, etc.) y una línea de clave por pregunta, por ejemplo `Respuesta correcta: C`. El lector trabaja mejor con el contenido en una sola columna. Los escaneos sin texto y los documentos con la clave en una tabla aparte requieren preparar el Excel. Antes de estudiar, compara el recuento y una muestra con tu fuente. Las preguntas incompletas o sin una clave reconocible aparecen en los avisos cuando el lector detecta su numeración.

## Importar o generar un Excel

Desde **Bancos** puedes **Descargar plantilla Excel** o convertir un banco importado en un archivo `.xlsx` con **Descargar Excel**. Edita ese archivo para corregir una pregunta, añadir temas o preparar otro examen. Guarda e importa la versión editada como un nuevo banco.

| Columna | Contenido |
| --- | --- |
| ID | Identificador único. Cuando está en blanco, se usa la posición en la lista. Para conservar ceros iniciales, escribe los ID como texto. |
| Tema | Opcional. Permite filtrar las preguntas en una sesión. |
| Pregunta | Enunciado de la pregunta. |
| A, B, C, D, E, F, G, H | Entre dos y ocho opciones consecutivas. Las sobrantes pueden quedar vacías. |
| Correcta | Una letra de las opciones disponibles. |
| Página PDF | Opcional. Número de la página de origen. |

Mantén las cabeceras y una pregunta por fila. Puedes quitar las columnas de opciones que no uses, empezando por la última. La app importa la primera hoja que contiene cabeceras compatibles. El formato admitido es `.xlsx`.

## Historial y copias

Los bancos, las respuestas y los resultados se guardan en el almacenamiento local del navegador. En **Historial** tienes dos formas de pasar los datos.

- **Guardar o compartir copia** guarda los bancos, los resultados y el test en curso en un JSON. Si el navegador admite compartir archivos, abre el menú del dispositivo. En los demás casos, descarga el archivo. **Recuperar copia** sustituye los datos actuales por los del archivo elegido, previa confirmación.
- **Exportar historial JSON** descarga los tests terminados, con sus respuestas y correcciones. **Importar historial JSON** añade los tests que faltan. También acepta la sección de historial de una copia completa.

Para llevar Repaso a una tablet, copia `Repaso.html` y tu copia JSON. Abre el HTML en un navegador que ejecute páginas locales y pulsa **Recuperar copia** en **Historial**. `Repaso.html` reúne la aplicación en un archivo. Puedes seguir usando `index.html` con la carpeta completa.

Para actualizar Repaso, guarda una copia JSON antes de sustituir el HTML. Abre la versión nueva desde la misma carpeta y con el mismo nombre, navegador y perfil. La conservación de los datos de un archivo local depende del navegador. Si el historial aparece vacío, recupéralo con la copia. [Almacenamiento de archivos locales en MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#description)

En **Resultados**, **Exportar Excel** guarda una fila por test. **Borrar historial** elimina los resultados y sus correcciones y reinicia el calendario de repaso tras confirmar.

## Código y dependencias

- `index.html` y `styles.css` contienen la interfaz.
- `app.js` gestiona las sesiones y el almacenamiento local.
- `core.js` valida las preguntas, interpreta el texto de los PDF y calcula las notas.
- `files.js` lee PDF y Excel y genera las descargas.
- `data/banco-inicial.js` define el banco que aparece la primera vez que se abre la aplicación.
- `vendor/` incluye la variante legacy de PDF.js 5.6.205 (Apache 2.0) y JSZip 3.10.1 (MIT o GPLv3), junto a sus licencias. PDF.js se carga en el navegador mediante URL de objeto para permitir la apertura directa desde el disco.
- `node scripts/build-portable.cjs` genera `Repaso.html` desde el código del repositorio. La compilación necesita Node.js. Para usar el HTML en el navegador solo hace falta el archivo generado.

Para verificar un cambio, abre `index.html` y prueba los modos de estudio. En un examen completo, responde una pregunta más adelante y vuelve atrás antes de pulsar **Terminar examen aquí**. Comprueba que la corrección incluya hasta la última respondida. Importa un historial dos veces para verificar que los tests aparecen una sola vez y restaura una copia completa en un perfil limpio.
