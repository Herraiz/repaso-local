(function () {
  "use strict";

  const spreadsheetMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const sheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const documentRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRel = "http://schemas.openxmlformats.org/package/2006/relationships";
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const parser = new DOMParser();
  const byTag = (node, name) => [...node.getElementsByTagNameNS("*", name)];
  const xml = text => xmlHeader + text;
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
  const escapeXml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/[&<>"']/g, character => entities[character]);

  function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = path;
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se ha encontrado el lector de PDF. Abre index.html desde la carpeta completa."));
      document.head.append(script);
    });
  }

  let pdfLibrary;
  async function getPdfLibrary() {
    if (!pdfLibrary) {
      pdfLibrary = (async () => {
        if (!globalThis.RepasoPDF) await loadScript("vendor/pdf.bundle.js");
        const { main, worker } = globalThis.RepasoPDF;
        const mainUrl = URL.createObjectURL(new Blob([main], { type: "text/javascript" }));
        try {
          const pdf = await import(mainUrl);
          pdf.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
          delete globalThis.RepasoPDF;
          return pdf;
        } finally {
          URL.revokeObjectURL(mainUrl);
        }
      })().catch(error => {
        pdfLibrary = null;
        throw error;
      });
    }
    return pdfLibrary;
  }

  function textLines(items) {
    const rows = [];
    for (const item of items) {
      if (!item.str?.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let row = rows.find(candidate => Math.abs(candidate.y - y) < 2.4);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x, width: item.width, text: item.str });
    }
    return rows.sort((a, b) => b.y - a.y).map(row => {
      let line = "";
      let end = -Infinity;
      for (const part of row.parts.sort((a, b) => a.x - b.x)) {
        if (line && part.x - end > 0.85 && !/\s$/.test(line)) line += " ";
        line += part.text;
        end = part.x + part.width;
      }
      return line;
    });
  }

  async function readPdf(file, progress) {
    const pdf = await getPdfLibrary();
    const task = pdf.getDocument({
      data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false,
      useSystemFonts: true, useWasm: false, stopAtErrors: true
    });
    try {
      const document = await task.promise;
      const pages = [];
      for (let page = 1; page <= document.numPages; page += 1) {
        progress(page, document.numPages);
        const content = await (await document.getPage(page)).getTextContent();
        pages.push({ page, lines: textLines(content.items) });
      }
      return Repaso.pdfQuestions(pages);
    } finally {
      await task.destroy();
    }
  }

  function columnName(index) {
    let name = "";
    for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
      name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
    }
    return name;
  }

  function columnIndex(reference, fallback) {
    const prefix = /^[A-Z]+/.exec(reference || "");
    if (!prefix) return fallback;
    return [...prefix[0]].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  }

  async function readExcel(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    async function readXml(path, optional = false) {
      const entry = zip.file(path);
      if (!entry && optional) return null;
      if (!entry) throw new Error("El archivo no tiene la estructura de un Excel .xlsx.");
      const text = await entry.async("string");
      if (text.length > 20_000_000 || /<!DOCTYPE/i.test(text)) throw new Error("Una hoja supera el tamaño o estructura admitidos.");
      const document = parser.parseFromString(text, "application/xml");
      if (byTag(document, "parsererror").length) throw new Error("El Excel contiene una hoja dañada.");
      return document;
    }
    const [book, relations, shared] = await Promise.all([
      readXml("xl/workbook.xml"), readXml("xl/_rels/workbook.xml.rels"), readXml("xl/sharedStrings.xml", true)
    ]);
    const relationById = new Map(byTag(relations, "Relationship")
      .filter(relation => relation.getAttribute("TargetMode") !== "External")
      .map(relation => [relation.getAttribute("Id"), relation.getAttribute("Target")]));
    const textValue = parent => byTag(parent, "t").map(text => text.textContent).join("");
    const sharedStrings = shared ? byTag(shared, "si").map(textValue) : [];

    for (const sheet of byTag(book, "sheet")) {
      const target = relationById.get(sheet.getAttributeNS(documentRel, "id"));
      if (!target) continue;
      const path = target.startsWith("/") ? target.slice(1) : "xl/" + target;
      if (path.includes("..")) continue;
      const rows = byTag(await readXml(path), "row").map(row => {
        const values = [];
        for (const cell of byTag(row, "c")) {
          const index = columnIndex(cell.getAttribute("r"), values.length);
          if (index > 16383) throw new Error("El Excel contiene una referencia de columna no válida.");
          const kind = cell.getAttribute("t");
          const raw = byTag(cell, "v")[0]?.textContent ?? "";
          values[index] = kind === "s" ? sharedStrings[Number(raw)] ?? "" :
            kind === "inlineStr" ? textValue(cell) : raw;
        }
        return values;
      });
      const questions = Repaso.rowsToQuestions(rows);
      if (questions) return { questions, warnings: [] };
    }
    throw new Error("No se encontró una hoja con Pregunta, A, B y Correcta. Usa la plantilla Excel.");
  }

  async function writeExcel(rows, sheetName, filename, widths) {
    const zip = new JSZip();
    const last = columnName(rows[0].length - 1) + rows.length;
    const types = "http://schemas.openxmlformats.org/package/2006/content-types";
    zip.file("[Content_Types].xml", xml(
      '<Types xmlns="' + types + '"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="' + spreadsheetMime + '.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
    ));
    zip.file("_rels/.rels", xml('<Relationships xmlns="' + packageRel + '"><Relationship Id="rId1" Type="' +
      documentRel + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'));
    zip.file("xl/_rels/workbook.xml.rels", xml('<Relationships xmlns="' + packageRel + '"><Relationship Id="rId1" Type="' +
      documentRel + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' +
      documentRel + '/styles" Target="styles.xml"/></Relationships>'));
    zip.file("xl/workbook.xml", xml('<workbook xmlns="' + sheetNs + '" xmlns:r="' + documentRel +
      '"><sheets><sheet name="' + escapeXml(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'));
    zip.file("xl/styles.xml", xml('<styleSheet xmlns="' + sheetNs + '">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF29263A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'));
    const columns = widths.map((width, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) +
      '" width="' + width + '" customWidth="1"/>').join("");
    const data = rows.map((row, i) => {
      const cells = row.map((value, j) => {
        if (value === "" || value === null || value === undefined) return "";
        const address = columnName(j) + (i + 1);
        const style = i === 0 ? 1 : 2;
        if (typeof value === "number" && Number.isFinite(value)) {
          return '<c r="' + address + '" s="' + style + '"><v>' + value + '</v></c>';
        }
        return '<c r="' + address + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
          escapeXml(value) + '</t></is></c>';
      }).join("");
      return '<row r="' + (i + 1) + '">' + cells + '</row>';
    }).join("");
    zip.file("xl/worksheets/sheet1.xml", xml('<worksheet xmlns="' + sheetNs + '"><dimension ref="A1:' + last +
      '"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
      columns + '</cols><sheetData>' + data + '</sheetData><autoFilter ref="A1:' + last + '"/></worksheet>'));
    const blob = await zip.generateAsync({ type: "blob", mimeType: spreadsheetMime, compression: "DEFLATE" });
    save(blob, filename);
  }

  function exportBank(questions, filename) {
    return writeExcel(Repaso.questionRows(questions), "Preguntas", filename,
      [10, 22, 68, 40, 40, 40, 40, 27, 27, 27, 27, 13, 15]);
  }

  globalThis.RepasoFiles = { readPdf, readExcel, save, writeExcel, exportBank };
})();
