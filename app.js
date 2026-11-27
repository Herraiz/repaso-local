(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const { clean, letters, bankQuestions, selectQuestions, shuffled, score } = Repaso;
  const files = RepasoFiles;
  const storeKey = "repaso-local-v1";
  const gradeText = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
  const dateText = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
  const routes = { estudiar: "Estudiar", bancos: "Bancos", historial: "Historial", test: "Test en curso", resultado: "Resultado" };
  const modeName = { random: "Aleatoria", selection: "Por número", review: "Fallos", all: "Completo" };
  let importCandidate;
  let importRun = 0;
  let resultId;
  let storageAvailable = true;
  let storageSnapshot = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, onClick) {
    const node = element("button", "button " + className, text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function makeId() {
    return globalThis.crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function labelMessage(id, text, error = false) {
    const label = $(id);
    label.textContent = text || "";
    label.hidden = !text;
    label.classList.toggle("message-error", error);
  }

  function checkBank(bank) {
    if (!clean(bank.id) || !clean(bank.name)) throw new Error("Hay un banco sin identificador o nombre.");
    return { id: clean(bank.id), name: clean(bank.name), source: clean(bank.source), questions: bankQuestions(bank.questions) };
  }

  function checkAttempt(attempt, finished) {
    if (!clean(attempt.id) || !clean(attempt.bankId) || !clean(attempt.bankName) || !Object.hasOwn(modeName, attempt.mode) ||
        !Number.isFinite(attempt.penalty) || attempt.penalty < 0 || attempt.penalty > 1 ||
        !attempt.answers || typeof attempt.answers !== "object") throw new Error("Hay un test con datos incompletos.");
    const questions = bankQuestions(attempt.questions);
    const answers = Object.create(null);
    for (const item of questions) {
      const choice = Object.hasOwn(attempt.answers, item.id) ? attempt.answers[item.id] : "";
      if (choice && (typeof choice !== "string" || choice.length !== 1 || !letters.slice(0, item.options.length).includes(choice))) {
        throw new Error("Una respuesta guardada tiene una letra no válida.");
      }
      if (choice) answers[item.id] = choice;
    }
    let date = null;
    if (finished) {
      if (!attempt.date || !Number.isFinite(Date.parse(attempt.date))) throw new Error("Un resultado tiene una fecha no válida.");
      date = new Date(attempt.date).toISOString();
      if (attempt.originalTotal !== undefined &&
          (!Number.isInteger(attempt.originalTotal) || attempt.originalTotal < questions.length)) {
        throw new Error("Un resultado tiene un número de preguntas incorrecto.");
      }
    }
    return {
      id: clean(attempt.id), bankId: clean(attempt.bankId), bankName: clean(attempt.bankName),
      mode: attempt.mode, penalty: attempt.penalty, questions, answers,
      index: Number.isInteger(attempt.index) ? Math.max(0, Math.min(questions.length - 1, attempt.index)) : 0,
      ...(finished ? { date } : {}),
      ...(finished && attempt.originalTotal > questions.length ? { originalTotal: attempt.originalTotal } : {})
    };
  }

  function validateHistory(input) {
    if (input?.version !== 1 || !Array.isArray(input.history)) {
      throw new Error("El archivo no contiene un historial válido de Repaso.");
    }
    const history = input.history.map(attempt => checkAttempt(attempt, true));
    if (new Set(history.map(item => item.id)).size !== history.length) {
      throw new Error("El archivo contiene tests repetidos.");
    }
    return history;
  }

  function validateState(input) {
    if (input?.version !== 1 || !Array.isArray(input.banks)) {
      throw new Error("El archivo no es una copia válida de Repaso.");
    }
    const banks = input.banks.map(checkBank);
    const history = validateHistory(input);
    if (new Set(banks.map(bank => bank.id)).size !== banks.length) throw new Error("La copia contiene bancos repetidos.");
    return {
      version: 1, banks, history,
      selected: banks.some(bank => bank.id === input.selected) ? input.selected : banks[0]?.id ?? null,
      active: input.active ? checkAttempt(input.active, false) : null
    };
  }

  function initialState() {
    const initial = globalThis.RepasoInitialBank;
    const banks = initial ? [checkBank(initial)] : [];
    return { version: 1, banks, history: [], selected: banks[0]?.id ?? null, active: null };
  }

  function openState() {
    try {
      storageSnapshot = localStorage.getItem(storeKey);
      return storageSnapshot ? validateState(JSON.parse(storageSnapshot)) : initialState();
    } catch (error) {
      storageAvailable = false;
      labelMessage("notice", "No se pudieron abrir los datos guardados. Puedes estudiar y descargar una copia JSON durante esta sesión.", true);
      return initialState();
    }
  }

  let state = openState();

  function storageStatus() {
    $("storage-status").textContent = storageAvailable ? "Datos en este navegador" : "Guardado manual en JSON";
  }

  function persist(replace = false) {
    if (!storageAvailable) return;
    try {
      if (!replace && localStorage.getItem(storeKey) !== storageSnapshot) {
        storageAvailable = false;
        storageStatus();
        labelMessage("notice", "Otra pestaña guardó cambios a la vez. Descarga una copia JSON de esta sesión antes de recargar.", true);
        return;
      }
      const data = JSON.stringify(state);
      localStorage.setItem(storeKey, data);
      storageSnapshot = data;
    } catch {
      storageAvailable = false;
      storageStatus();
      labelMessage("notice", "El navegador no pudo guardar los cambios. Descarga una copia JSON desde Historial antes de cerrar.", true);
    }
  }

  function activeMode() {
    return $("setup").querySelector('input[name="mode"]:checked').value;
  }

  function currentBank() {
    return state.banks.find(bank => bank.id === state.selected);
  }

  function sortedHistory() {
    return [...state.history].sort((a, b) => b.date.localeCompare(a.date));
  }

  function missed(bank) {
    const lastByQuestion = new Map();
    for (const record of sortedHistory()) {
      if (record.bankId !== bank.id) continue;
      for (const item of record.questions) {
        if (!lastByQuestion.has(item.id)) lastByQuestion.set(item.id, record.answers[item.id] !== item.answer);
      }
    }
    return bank.questions.filter(item => lastByQuestion.get(item.id));
  }

  function eligibleQuestions(mode) {
    const bank = currentBank();
    if (!bank) return [];
    if (mode === "all") return bank.questions;
    const source = mode === "review" ? missed(bank) : bank.questions;
    const topic = $("topic").value;
    return topic ? source.filter(item => item.topic === topic) : source;
  }

  function updateSettings() {
    const mode = activeMode();
    const available = eligibleQuestions(mode).length;
    const countNeeded = mode === "random" || mode === "review";
    $("count-field").hidden = !countNeeded;
    $("range-field").hidden = mode !== "selection";
    $("all-field").hidden = mode !== "all";
    $("all-count").textContent = available === 1 ? "1 del banco" : available + " del banco";
    $("topic-field").hidden = mode === "all" || $("topic").options.length < 2;
    $("count").disabled = !countNeeded;
    $("range").required = mode === "selection";
    $("count").required = countNeeded;
    $("count").max = Math.max(1, available);
    if (countNeeded && available > 0 && Number($("count").value) > available) $("count").value = available;
    $("start").disabled = !available;
    $("resume").hidden = !state.active;
    labelMessage("setup-error", mode === "review" && !available ? "Aquí aparecerán tus fallos y preguntas en blanco pendientes de repasar." : "");
  }

  function renderStudy() {
    const bank = currentBank();
    const topics = bank ? [...new Set(bank.questions.map(item => item.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")) : [];
    const previousTopic = $("topic").value;
    $("bank-select").replaceChildren(...(state.banks.length ? state.banks.map(item => new Option(item.name, item.id)) : [new Option("Importa un banco para empezar", "")]));
    $("bank-select").value = bank?.id ?? "";
    $("bank-select").disabled = !bank;
    $("topic").replaceChildren(new Option("Todos los temas", ""), ...topics.map(topic => new Option(topic, topic)));
    if (topics.includes(previousTopic)) $("topic").value = previousTopic;
    $("hero-count").textContent = bank?.questions.length ?? 0;
    $("hero-label").textContent = bank?.questions.length === 1 ? "Pregunta disponible" : "Preguntas disponibles";
    const records = sortedHistory().filter(item => item.bankId === bank?.id);
    const results = records.map(item => score(item.questions, item.answers, item.penalty));
    const right = results.reduce((sum, item) => sum + item.right, 0);
    const total = results.reduce((sum, item) => sum + item.total, 0);
    $("stat-tests").textContent = records.length;
    $("stat-rate").textContent = total ? Math.round(right / total * 100) + " %" : "—";
    $("stat-last").textContent = records.length ? gradeText.format(results[0].grade) : "—";
    const recent = $("recent");
    if (records.length) {
      const latest = records[0];
      recent.replaceChildren(element("span", "muted", "Último test"), element("strong", "", dateText.format(new Date(latest.date))));
    } else {
      recent.replaceChildren(element("span", "muted", "Completa un test para ver tus resultados aquí."));
    }
    updateSettings();
  }

  function renderBanks() {
    const bankList = $("bank-list");
    bankList.replaceChildren();
    if (!state.banks.length) bankList.append(element("p", "card muted", "Todavía no hay bancos guardados."));
    for (const bank of state.banks) {
      const article = element("article", "card list-card");
      const body = element("div", "list-body");
      body.append(element("h2", "", bank.name), element("p", "muted", bank.questions.length + " preguntas" + (bank.source ? " · " + bank.source : "")));
      const actions = element("div", "list-actions");
      actions.append(
        button("Estudiar", "subtle small", () => {
          state.selected = bank.id;
          $("topic").value = "";
          persist();
          navigate("estudiar");
        }),
        button("Descargar Excel", "subtle small", () => runExport(() => files.exportBank(bank.questions, filename(bank.name) + ".xlsx"))),
        button("Quitar", "plain small", () => {
          if (!confirm('¿Quitar el banco "' + bank.name + '"? Sus tests terminados seguirán en el historial.')) return;
          state.banks = state.banks.filter(item => item.id !== bank.id);
          if (state.selected === bank.id) state.selected = state.banks[0]?.id ?? null;
          persist();
          renderBanks();
        })
      );
      article.append(body, actions);
      bankList.append(article);
    }
  }

  function renderHistory() {
    const list = $("history-list");
    list.replaceChildren();
    $("history-xlsx").disabled = !state.history.length;
    $("history-json-export").disabled = !state.history.length;
    if (!state.history.length) list.append(element("p", "card muted", "Todavía no has terminado ningún test."));
    for (const record of sortedHistory()) {
      const result = score(record.questions, record.answers, record.penalty);
      const item = element("article", "card list-card");
      const body = element("div", "list-body");
      body.append(element("h2", "", record.bankName),
        element("p", "muted", dateText.format(new Date(record.date)) + " · " + modeName[record.mode] + " · " +
          result.right + " de " + result.total + " acertadas" +
          (record.originalTotal ? " · Terminado en la " + result.total + " de " + record.originalTotal : "")));
      const actions = element("div", "list-actions");
      actions.append(element("strong", "history-grade", gradeText.format(result.grade) + " / 10"),
        button("Ver corrección", "subtle small", () => showResult(record.id)));
      item.append(body, actions);
      list.append(item);
    }
  }

  function currentQuestion() {
    return state.active.questions[state.active.index];
  }

  function renderTracker() {
    const { questions, answers, index } = state.active;
    $("answered-count").textContent = Object.keys(answers).length + " de " + questions.length + " respondidas";
    const pager = $("question-nav");
    pager.replaceChildren();
    questions.forEach((item, i) => {
      const jump = button(String(i + 1), answers[item.id] ? "jump answered" : "jump", () => goToQuestion(i));
      jump.setAttribute("aria-label", "Pregunta " + (i + 1) + (answers[item.id] ? ", respondida" : ", sin responder"));
      if (i === index) jump.setAttribute("aria-current", "step");
      pager.append(jump);
    });
  }

  function renderTest() {
    const active = state.active;
    const item = currentQuestion();
    $("test-bank").textContent = active.bankName;
    $("question-step").textContent = "Pregunta " + (active.index + 1) + " de " + active.questions.length;
    $("question-source").textContent = "ID " + item.id + (item.page ? " · Pág. " + item.page : "");
    $("question-text").textContent = item.text;
    const options = $("answer-options");
    options.replaceChildren(element("legend", "sr-only", "Opciones de respuesta"));
    item.options.forEach((option, i) => {
      const letter = letters[i];
      const label = element("label", "answer");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = letter;
      input.checked = active.answers[item.id] === letter;
      input.addEventListener("click", () => {
        if (active.answers[item.id] === letter) advance();
      });
      input.addEventListener("change", () => {
        active.answers[item.id] = letter;
        $("clear").disabled = false;
        persist();
        renderTracker();
      });
      label.append(input, element("span", "answer-letter", letter), element("span", "answer-text", option));
      options.append(label);
    });
    $("previous").disabled = active.index === 0;
    $("clear").disabled = !active.answers[item.id];
    $("next").textContent = active.index === active.questions.length - 1 ? "Terminar test" : "Siguiente";
    renderTracker();
  }

  function goToQuestion(index) {
    state.active.index = index;
    persist();
    renderTest();
    $("question-text").focus();
  }

  function showResult(id) {
    resultId = id;
    $("mistakes-only").checked = true;
    navigate("resultado");
  }

  function renderResult() {
    const record = state.history.find(item => item.id === resultId);
    const result = score(record.questions, record.answers, record.penalty);
    $("result-subtitle").textContent = record.bankName + " · " + dateText.format(new Date(record.date)) +
      (record.originalTotal ? " · Corregidas " + result.total + " de " + record.originalTotal + " preguntas" : "");
    const summary = $("result-summary");
    summary.replaceChildren();
    for (const [value, label] of [
      [gradeText.format(result.grade) + " / 10", "Nota"], [result.right, "Aciertos"], [result.wrong, "Fallos"], [result.blank, "En blanco"]
    ]) {
      const stat = element("div", "result-stat");
      stat.append(element("strong", "", value), element("span", "muted", label));
      summary.append(stat);
    }
    const reviewList = $("review-list");
    reviewList.replaceChildren();
    for (const item of record.questions) {
      const answer = record.answers[item.id];
      if ($("mistakes-only").checked && answer === item.answer) continue;
      const card = element("article", "card review-card");
      const status = answer === item.answer ? "Acierto" : answer ? "Fallo" : "En blanco";
      card.append(element("p", "review-tag muted", status + " · ID " + item.id + (item.page ? " · Pág. " + item.page : "")),
        element("h3", "", item.text));
      if (answer && answer !== item.answer) card.append(element("p", "wrong", "Tu respuesta · " + answer + ") " + item.options[letters.indexOf(answer)]));
      card.append(element("p", "correct", "Correcta · " + item.answer + ") " + item.options[letters.indexOf(item.answer)]));
      reviewList.append(card);
    }
    if (!reviewList.children.length) reviewList.append(element("p", "card muted", "Has acertado todas las preguntas."));
  }

  function view() {
    let name = location.hash.slice(1);
    if (!Object.hasOwn(routes, name)) name = "estudiar";
    if (name === "test" && !state.active) name = "estudiar";
    if (name === "resultado" && !state.history.some(item => item.id === resultId)) name = "historial";
    for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== name;
    for (const link of document.querySelectorAll("[data-view]")) {
      if (link.dataset.view === (name === "test" ? "estudiar" : name === "resultado" ? "historial" : name)) {
        link.setAttribute("aria-current", "page");
      } else link.removeAttribute("aria-current");
    }
    $("breadcrumb").textContent = routes[name];
    ({ estudiar: renderStudy, bancos: renderBanks, historial: renderHistory, test: renderTest, resultado: renderResult })[name]();
    window.scrollTo(0, 0);
  }

  function navigate(name) {
    if (location.hash === "#" + name) view();
    else location.hash = name;
  }

  function filename(name) {
    return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 120) || "banco";
  }

  async function runExport(operation) {
    try {
      await operation();
    } catch (error) {
      labelMessage("notice", "No se pudo generar el archivo. " + error.message, true);
    }
  }

  function clearImport() {
    importRun += 1;
    importCandidate = null;
    $("import-file").value = "";
    $("import-preview").hidden = true;
    labelMessage("import-status", "");
  }

  async function importBank(file) {
    const run = ++importRun;
    importCandidate = null;
    $("import-preview").hidden = true;
    labelMessage("import-status", "Leyendo " + file.name + "…");
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error("El archivo supera el límite de 30 MB.");
      const name = file.name.toLowerCase();
      let result;
      if (name.endsWith(".pdf")) {
        result = await files.readPdf(file, (page, total) => {
          if (run === importRun) labelMessage("import-status", "Leyendo página " + page + " de " + total + "…");
        });
        if (!result.questions.length) throw new Error("No se encontraron preguntas con una clave reconocible. Comprueba que el PDF tiene texto seleccionable y muestra «Respuesta correcta: A» en cada pregunta.");
      } else if (name.endsWith(".xlsx")) {
        result = await files.readExcel(file);
      } else {
        throw new Error("Selecciona un PDF o un Excel .xlsx.");
      }
      if (run !== importRun) return;
      importCandidate = { source: file.name, questions: result.questions };
      $("import-name").value = file.name.replace(/\.[^.]+$/, "").slice(0, 140);
      $("import-summary").textContent = result.questions.length + " preguntas listas para guardar." +
        (result.warnings.length ? " Revisa los avisos antes de estudiar." : "");
      $("warning-list").replaceChildren(...result.warnings.map(warning => element("li", "", warning)));
      $("import-warnings").hidden = !result.warnings.length;
      $("import-warnings").open = !!result.warnings.length;
      labelMessage("import-status", "");
      $("import-preview").hidden = false;
    } catch (error) {
      if (run === importRun) labelMessage("import-status", error.message, true);
    }
  }

  $("setup").addEventListener("submit", event => {
    event.preventDefault();
    const bank = currentBank();
    const mode = activeMode();
    const eligible = eligibleQuestions(mode);
    if (!bank || !eligible.length) return;
    try {
      let questions;
      if (mode === "all") {
        questions = eligible;
      } else if (mode === "selection") {
        questions = selectQuestions(eligible, $("range").value);
      } else {
        const count = Number($("count").value);
        if (!Number.isInteger(count) || count < 1 || count > eligible.length) throw new Error("Elige entre 1 y " + eligible.length + " preguntas.");
        questions = shuffled(eligible).slice(0, count);
      }
      if (state.active && !confirm("Hay un test en curso. ¿Quieres sustituirlo por este test nuevo?")) return;
      state.active = {
        id: makeId(), bankId: bank.id, bankName: bank.name, mode, questions,
        penalty: Number($("penalty").value), answers: Object.create(null), index: 0
      };
      persist();
      navigate("test");
    } catch (error) {
      labelMessage("setup-error", error.message, true);
    }
  });
  $("bank-select").addEventListener("change", () => {
    state.selected = $("bank-select").value;
    $("topic").value = "";
    $("count").value = 20;
    persist();
    renderStudy();
  });
  $("topic").addEventListener("change", updateSettings);
  $("setup").querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener("change", updateSettings));
  $("resume").addEventListener("click", () => navigate("test"));
  $("pause").addEventListener("click", () => navigate("estudiar"));
  $("previous").addEventListener("click", () => goToQuestion(state.active.index - 1));
  $("clear").addEventListener("click", () => {
    delete state.active.answers[currentQuestion().id];
    persist();
    renderTest();
    $("question-text").focus();
  });

  function finish(here = false) {
    const active = state.active;
    if (!active) return;
    const total = active.questions.length;
    const lastAnswered = here ? active.questions.findLastIndex(item => Object.hasOwn(active.answers, item.id)) : total - 1;
    const limit = Math.max(active.index, lastAnswered) + 1;
    const questions = active.questions.slice(0, limit);
    const { blank } = score(questions, active.answers, active.penalty);
    if (blank) {
      const scope = limit < total ? "Se corregirán las primeras " + limit + " de " + total + " preguntas. " : "";
      const summary = blank === 1 ? "Hay 1 pregunta en blanco." : "Hay " + blank + " preguntas en blanco.";
      if (!confirm(scope + summary + " ¿Quieres corregir ya el test?")) return;
    }
    state.history.push({
      ...active, questions, date: new Date().toISOString(),
      ...(limit < total ? { originalTotal: total } : {})
    });
    state.active = null;
    persist();
    showResult(active.id);
  }

  function advance() {
    const active = state.active;
    if (!active) return;
    if (active.index === active.questions.length - 1) finish();
    else goToQuestion(active.index + 1);
  }

  $("next").addEventListener("click", advance);
  $("finish").addEventListener("click", () => finish());
  $("finish-here").addEventListener("click", () => finish(true));
  $("mistakes-only").addEventListener("change", renderResult);
  $("quick-import").addEventListener("click", () => {
    navigate("bancos");
    requestAnimationFrame(() => $("import-file").focus());
  });
  $("import-file").addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) importBank(file);
  });
  $("cancel-import").addEventListener("click", clearImport);
  $("save-bank").addEventListener("click", () => {
    if (!importCandidate) return;
    const name = clean($("import-name").value);
    if (!name) {
      labelMessage("import-status", "Escribe un nombre para el banco.", true);
      $("import-name").focus();
      return;
    }
    const bank = { id: makeId(), name, ...importCandidate };
    state.banks.push(bank);
    state.selected = bank.id;
    $("topic").value = "";
    $("count").value = 20;
    persist();
    clearImport();
    renderBanks();
    labelMessage("import-status", "Banco guardado con " + bank.questions.length + " preguntas.");
  });
  $("template").addEventListener("click", () => runExport(() => files.exportBank([{
    id: "1", topic: "Ejemplo", text: "¿Cuántos minutos tiene una hora?", options: ["30", "45", "60", "90"], answer: "C", page: null
  }], "plantilla-repaso.xlsx")));
  function downloadJson(data, prefix) {
    const date = new Date().toISOString().slice(0, 10);
    files.save(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      "repaso-" + prefix + "-" + date + ".json");
  }

  $("backup").addEventListener("click", () => downloadJson(state, "copia"));
  $("history-json-export").addEventListener("click", () => downloadJson({
    version: 1, history: sortedHistory()
  }, "historial"));

  $("restore").addEventListener("click", () => $("backup-file").click());
  $("backup-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const restored = validateState(JSON.parse(await file.text()));
      if (!confirm("¿Sustituir los bancos, el historial y el test en curso por los de esta copia?")) return;
      state = restored;
      storageAvailable = true;
      persist(true);
      storageStatus();
      if (storageAvailable) labelMessage("notice", "Copia restaurada.");
      renderHistory();
    } catch (error) {
      labelMessage("notice", "No se pudo restaurar la copia. " + error.message, true);
    }
  });
  $("history-json-import").addEventListener("click", () => $("history-file").click());
  $("history-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const history = validateHistory(JSON.parse(await file.text()));
      const known = new Set(state.history.map(record => record.id));
      const added = history.filter(record => !known.has(record.id));
      if (!added.length) {
        labelMessage("notice", history.length ? "Estos tests ya están en tu historial." : "El archivo no contiene tests terminados.");
        return;
      }
      state.history = [...state.history, ...added];
      labelMessage("notice", added.length === 1 ? "Se ha añadido 1 test al historial." : "Se han añadido " + added.length + " tests al historial.");
      persist();
      renderHistory();
    } catch (error) {
      labelMessage("notice", "No se pudo importar el historial. " + error.message, true);
    }
  });
  $("history-xlsx").addEventListener("click", () => runExport(() => {
    const rows = sortedHistory().map(record => {
      const result = score(record.questions, record.answers, record.penalty);
      return [dateText.format(new Date(record.date)), record.bankName, modeName[record.mode], result.total, result.right,
        result.wrong, result.blank, record.penalty, Number(result.grade.toFixed(4))];
    });
    rows.unshift(["Fecha local", "Banco", "Sesión", "Preguntas", "Aciertos", "Fallos", "En blanco", "Penalización", "Nota / 10"]);
    return files.writeExcel(rows, "Historial", "repaso-historial.xlsx", [26, 40, 16, 12, 12, 11, 13, 17, 13]);
  }));
  window.addEventListener("storage", event => {
    if (event.key !== storeKey || !event.newValue || event.newValue === storageSnapshot || !storageAvailable) return;
    try {
      state = validateState(JSON.parse(event.newValue));
      storageSnapshot = event.newValue;
      view();
    } catch {
      labelMessage("notice", "No se pudieron leer los cambios guardados por otra pestaña.", true);
    }
  });
  window.addEventListener("hashchange", view);
  storageStatus();
  view();
})();
