# Repaso

Aplicación local para practicar preguntas tipo test de oposiciones y otros exámenes. Abre `index.html` en el navegador. Mantén los archivos juntos y, si descargaste un ZIP, extrae primero toda la carpeta. Puedes usarla sin conexión y sin instalar un servidor.

## Empezar a estudiar

1. Abre **Bancos** e importa tu PDF o Excel. Revisa el recuento y los avisos que aparezcan antes de guardar.
2. En **Estudiar**, selecciona el banco. Elige **Completo** para recorrer todas las preguntas en el orden del banco, **Aleatoria** para sacar una tanda sin repeticiones, o **Por número** para escribir una lista o rangos como `1-15, 23, 40-45`. **Fallos** recupera las preguntas que fallaste o dejaste en blanco la última vez que las hiciste. Cuando hay temas disponibles, puedes filtrar en los modos Aleatoria, Por número y Fallos.
3. Elige la penalización por fallo y empieza el test. Pulsa una vez una opción para marcarla y otra vez la misma opción para avanzar. Puedes saltar preguntas y usar **Guardar y salir** para continuar después.
4. Usa **Terminar y corregir** para corregir el test entero. Con **Terminar examen aquí** se corrige hasta la pregunta actual o la última que quedó respondida, la que esté más adelante. Por ejemplo, si respondiste la 18 y vuelves a la 12, se corrigen las primeras 18. Las preguntas omitidas dentro de ese tramo cuentan como en blanco. Las posteriores quedan fuera de la nota.

La nota sobre 10 se calcula como `10 × (aciertos − fallos × penalización) ÷ preguntas incluidas en la corrección`. Las preguntas en blanco suman cero. La configuración inicial es sin penalización. Una penalización seleccionada puede dar una nota negativa. Ajusta el valor a las bases de tu examen.

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

Los bancos, las respuestas y los resultados se guardan en el almacenamiento local del navegador. Usa el mismo navegador, perfil y ruta del HTML para seguir estudiando. En **Historial** tienes dos formas de pasar los datos:

- **Exportar copia JSON** guarda los bancos, los resultados y el test en curso. **Importar copia JSON** sustituye los datos actuales por los del archivo elegido, previa confirmación.
- **Exportar historial JSON** descarga los tests terminados, con sus respuestas y correcciones. **Importar historial JSON** añade los tests que faltan. También acepta la sección de historial de una copia completa.

Para llevar Repaso a una tablet, copia `Repaso.html` y tu copia JSON. Abre el HTML en un navegador que ejecute páginas locales e importa la copia desde **Historial**. `Repaso.html` reúne la aplicación en un archivo. Puedes seguir usando `index.html` con la carpeta completa.

Si vas a mover el HTML, usar otro dispositivo o borrar los datos del navegador, guarda primero la copia JSON. En un perfil privado o si el navegador bloquea su almacenamiento, exporta la copia antes de cerrar. **Exportar Excel** guarda una fila de resultados por test.

## Código y dependencias

- `index.html` y `styles.css` contienen la interfaz.
- `app.js` gestiona las sesiones y el almacenamiento local.
- `core.js` valida las preguntas, interpreta el texto de los PDF y calcula las notas.
- `files.js` lee PDF y Excel y genera las descargas.
- `data/banco-inicial.js` define el banco que aparece la primera vez que se abre la aplicación.
- `vendor/` incluye PDF.js 5.6.205 (Apache 2.0) y JSZip 3.10.1 (MIT o GPLv3), junto a sus licencias. PDF.js se carga en el navegador mediante URL de objeto para permitir la apertura directa desde el disco.
- `node scripts/build-portable.cjs` genera `Repaso.html` desde el código del repositorio. La compilación necesita Node.js. Para usar el HTML en el navegador solo hace falta el archivo generado.

Para verificar un cambio, abre `index.html` y prueba los modos de estudio. En un examen completo, responde una pregunta más adelante y vuelve atrás antes de pulsar **Terminar examen aquí**. Comprueba que la corrección incluya hasta la última respondida. Importa un historial dos veces para verificar que los tests aparecen una sola vez y restaura una copia completa en un perfil limpio.
