(function (root) {
  "use strict";

  const letters = "ABCDEFGH";
  const headers = ["ID", "Tema", "Pregunta", ...letters, "Correcta", "Página PDF"];
  const clean = value => String(value ?? "").replace(/[\s\u00a0]+/g, " ").trim();
  const normalized = value => clean(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  function question(input) {
    const result = {
      id: clean(input.id), topic: clean(input.topic), text: clean(input.text),
      options: Array.isArray(input.options) ? input.options.map(clean) : [],
      answer: clean(input.answer).toUpperCase(),
      page: input.page === null || input.page === "" || input.page === undefined ? null : Number(input.page)
    };
    if (!result.id || !result.text || result.options.length < 2 || result.options.length > letters.length ||
        result.options.some(option => !option) || result.answer.length !== 1 ||
        !letters.slice(0, result.options.length).includes(result.answer) ||
        (result.page !== null && (!Number.isInteger(result.page) || result.page < 1))) {
      throw new Error("Comprueba el enunciado, las opciones consecutivas, la letra correcta y la página.");
    }
    return result;
  }

  function bankQuestions(candidates) {
    if (!Array.isArray(candidates) || !candidates.length) throw new Error("El banco está vacío.");
    const ids = new Set();
    return candidates.map(candidate => {
      const item = question(candidate);
      if (ids.has(item.id)) throw new Error(`ID repetido: ${item.id}.`);
      ids.add(item.id);
      return item;
    });
  }

  function pdfQuestions(pages) {
    const candidates = [];
    let current = null;
    let field = "text";
    const warnings = [];
    const repeatedHeader = /^(listado de preguntas definitivo|convocatoria\s*:|categoría\s*:|n[º°o]\s*de preguntas de reserva\s*:)/i;
    const footer = /^(página\s+\d+\s+de\s+\d+\b|en la dirección https?:|este documento ha sido firmado electrónicamente|el presente documento ha sido descargado)/i;
    const numbered = /^(\d{1,6})[.)]\s*(.*)$/;
    const option = /^([A-H])[).]\s*(.*)$/i;
    const inlineKey = /^(?:respuesta\s+(?:correcta|válida)|solución)\s*:\s*([A-H])\s*[.)]?\s*$/i;

    for (const { page, lines } of pages) {
      for (const rawLine of lines) {
        const line = clean(rawLine);
        if (footer.test(line)) break;
        if (!line || repeatedHeader.test(line)) continue;
        const number = numbered.exec(line);
        const choice = option.exec(line);
        const key = inlineKey.exec(line);
        if (key && current) {
          current.answer = key[1];
          candidates.push(current);
          current = null;
        } else if (number && (!current || field !== "text" || Number(number[1]) === Number(current.id) + 1)) {
          if (current) candidates.push(current);
          current = { id: number[1], text: number[2], options: [], answer: "", page };
          field = "text";
        } else if (current && choice) {
          if (choice[1].toUpperCase() === letters[current.options.length]) {
            current.options.push(choice[2]);
            field = "option";
          } else {
            current.invalidOptions = true;
          }
        } else if (current && field === "text") {
          current.text += " " + line;
        } else if (current && !/^respuesta\s+(correcta|válida)\s*:/i.test(line)) {
          current.options[current.options.length - 1] += " " + line;
        }
      }
    }
    if (current) candidates.push(current);

    const occurrences = new Map();
    for (const item of candidates) occurrences.set(item.id, (occurrences.get(item.id) || 0) + 1);
    const questions = [];
    for (const item of candidates) {
      if (occurrences.get(item.id) > 1) {
        warnings.push(`Pregunta ${item.id} (página ${item.page}): identificador repetido.`);
        continue;
      }
      try {
        if (item.invalidOptions) throw new Error("Opciones fuera de orden.");
        questions.push(question(item));
      } catch {
        warnings.push(`Pregunta ${item.id} (página ${item.page}): opciones incompletas o clave sin reconocer.`);
      }
    }
    const numbers = [...occurrences.keys()].map(Number).sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i += 1) {
      if (numbers[i] > numbers[i - 1] + 1) {
        warnings.push(`Hay un salto en la numeración entre ${numbers[i - 1]} y ${numbers[i]}.`);
      }
    }
    return { questions, warnings };
  }

  function rowsToQuestions(rows) {
    const columns = aliases => header.findIndex(key => aliases.includes(key));
    const headerIndex = rows.findIndex(row => row.some(value => ["pregunta", "enunciado"].includes(normalized(value))));
    if (headerIndex < 0) return null;
    const header = rows[headerIndex].map(normalized);
    const text = columns(["pregunta", "enunciado"]);
    const answer = columns(["correcta", "respuesta correcta", "respuesta"]);
    const id = columns(["id", "numero", "nº", "n°"]);
    const topic = columns(["tema", "bloque", "categoria"]);
    const page = columns(["pagina pdf", "pagina"]);
    const choices = [...letters].map(letter => columns([letter.toLowerCase(), `opcion ${letter.toLowerCase()}`]));
    if (answer < 0 || choices[0] < 0 || choices[1] < 0) return null;
    const entries = rows.slice(headerIndex + 1)
      .filter(row => row.some(value => clean(value)))
      .map((row, index) => {
        const options = choices.map(column => clean(row[column]));
        while (options.length && !options.at(-1)) options.pop();
        return {
          id: clean(row[id]) || String(index + 1), topic: row[topic], text: row[text], options,
          answer: row[answer], page: row[page]
        };
      });
    return bankQuestions(entries);
  }

  function questionRows(questions) {
    return [headers, ...questions.map(item => [
      item.id, item.topic, item.text, ...[...letters].map((_, index) => item.options[index] || ""),
      item.answer, item.page ?? ""
    ])];
  }

  function selectQuestions(items, specification) {
    const selected = new Set();
    for (const part of specification.split(/[;,]/).map(clean)) {
      const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
      if (!part) throw new Error("Escribe los números o rangos separados por comas. Por ejemplo, 1-10, 15.");
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (end < start) throw new Error(`El rango ${part} está invertido.`);
        const inRange = items.filter(item => /^\d+$/.test(item.id) && Number(item.id) >= start && Number(item.id) <= end);
        if (!inRange.length) throw new Error(`El rango ${part} no contiene preguntas.`);
        inRange.forEach(item => selected.add(item.id));
      } else {
        if (!items.some(item => item.id === part)) throw new Error(`No hay ninguna pregunta con el ID ${part}.`);
        selected.add(part);
      }
    }
    return items.filter(item => selected.has(item.id));
  }

  function shuffled(items) {
    const result = [...items];
    for (let end = result.length - 1; end > 0; end -= 1) {
      const index = Math.floor(Math.random() * (end + 1));
      [result[end], result[index]] = [result[index], result[end]];
    }
    return result;
  }

  function score(items, answers, penalty) {
    let right = 0;
    let wrong = 0;
    for (const item of items) {
      const selected = answers[item.id];
      if (selected === item.answer) right += 1;
      else if (selected) wrong += 1;
    }
    const blank = items.length - right - wrong;
    return { right, wrong, blank, total: items.length, grade: (right - wrong * penalty) / items.length * 10 };
  }

  const api = { letters, clean, bankQuestions, pdfQuestions, rowsToQuestions, questionRows, selectQuestions, shuffled, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Repaso = api;
})(globalThis);
