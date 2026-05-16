(function () {
  const config = window.AGENDA_CONFIG;
  const maxFileSize = 2.5 * 1024 * 1024;
  const agendaEl = document.querySelector("#agenda");
  const emptyStateEl = document.querySelector("#emptyState");
  const searchInput = document.querySelector("#searchInput");
  const importInput = document.querySelector("#importInput");
  const exportBtn = document.querySelector("#exportBtn");
  const resetBtn = document.querySelector("#resetBtn");
  const rowTemplate = document.querySelector("#rowTemplate");
  const metrics = {
    examCount: document.querySelector("#examCount"),
    plannedTime: document.querySelector("#plannedTime"),
    sessionCount: document.querySelector("#sessionCount"),
    completionRate: document.querySelector("#completionRate")
  };

  let state = loadState();
  let filter = "all";

  function createDefaultState() {
    const days = {};
    getDays().forEach((day) => {
      days[day.day] = {
        open: day.exams.length > 0,
        files: createExamFiles(day),
        rows: [{ subject: "", customSubject: "", minutes: "", done: false, notes: "" }]
      };
    });
    return { version: 7, updatedAt: new Date().toISOString(), days };
  }

  function createExamFiles(day) {
    return day.exams.reduce((files, exam) => {
      files[examKey(exam.name)] = { notes: [], practice: [] };
      return files;
    }, {});
  }

  function loadState() {
    const fallback = createDefaultState();
    try {
      const raw = localStorage.getItem(config.storageKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return normalizeState(parsed, fallback);
    } catch (error) {
      console.warn("No se pudo cargar la agenda guardada.", error);
      return fallback;
    }
  }

  function normalizeState(saved, fallback) {
    const merged = { ...fallback, ...saved, days: { ...fallback.days } };
    Object.keys(fallback.days).forEach((day) => {
      const savedDay = saved.days && saved.days[day];
      if (!savedDay) return;
      merged.days[day] = {
        ...fallback.days[day],
        ...savedDay,
        files: normalizeFiles(savedDay.files, fallback.days[day].files),
        rows: normalizeRows(savedDay.rows)
      };
    });
    return merged;
  }

  function normalizeFiles(savedFiles, fallbackFiles) {
    const files = { ...fallbackFiles };
    Object.keys(files).forEach((exam) => {
      files[exam] = {
        notes: Array.isArray(savedFiles && savedFiles[exam] && savedFiles[exam].notes) ? savedFiles[exam].notes : [],
        practice: Array.isArray(savedFiles && savedFiles[exam] && savedFiles[exam].practice) ? savedFiles[exam].practice : []
      };
    });
    return files;
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [{ subject: "", customSubject: "", minutes: "", done: false, notes: "" }];
    }
    return rows.map((row) => ({
      subject: row.subject || row.asig || "",
      customSubject: row.customSubject || row.customVal || "",
      minutes: row.minutes || row.mins || "",
      done: Boolean(row.done),
      notes: row.notes || ""
    }));
  }

  function getDays() {
    return config.weeks.flatMap((week) => week.days);
  }

  function getDayState(day) {
    if (!state.days[day]) {
      const dayConfig = getDays().find((item) => item.day === Number(day));
      state.days[day] = {
        open: false,
        files: dayConfig ? createExamFiles(dayConfig) : {},
        rows: [{ subject: "", customSubject: "", minutes: "", done: false, notes: "" }]
      };
    }
    return state.days[day];
  }

  function examKey(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("No se pudo guardar la agenda.", error);
      alert("El navegador no pudo guardar todos los datos. Prueba con archivos más ligeros o exporta una copia antes de añadir más.");
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMinutes(total) {
    if (!total) return "0 min";
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
  }

  function subjectName(row) {
    return row.subject === "__custom__" ? row.customSubject.trim() : row.subject;
  }

  function dayMatches(day) {
    const query = searchInput.value.trim().toLowerCase();
    const dayState = getDayState(day.day);
    const hasStudy = Boolean(dayState.notes && dayState.notes.trim()) ||
      dayState.rows.some((row) => subjectName(row) || Number(row.minutes) > 0 || row.notes.trim());
    const hasExam = day.exams.length > 0;

    if (filter === "exam" && !hasExam) return false;
    if (filter === "study" && !hasStudy) return false;
    if (!query) return true;

    const haystack = [
      day.day,
      day.weekday,
      ...day.exams.map((exam) => exam.name),
      dayState.notes || "",
      ...Object.values(dayState.files || {}).flatMap((groups) => [...groups.notes, ...groups.practice].map((file) => file.name)),
      ...dayState.rows.map(subjectName),
      ...dayState.rows.map((row) => row.notes)
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  }

  function render() {
    agendaEl.innerHTML = "";
    let visibleCount = 0;

    config.weeks.forEach((week) => {
      const visibleDays = week.days.filter(dayMatches);
      if (visibleDays.length === 0) return;

      const weekEl = document.createElement("section");
      weekEl.className = "week";
      weekEl.innerHTML = `
        <div class="week-label">
          <span>${escapeHtml(week.label)}</span>
          <small>${escapeHtml(week.range)}</small>
        </div>
      `;

      visibleDays.forEach((day) => {
        weekEl.appendChild(renderDay(day));
        visibleCount += 1;
      });

      agendaEl.appendChild(weekEl);
    });

    emptyStateEl.hidden = visibleCount > 0;
    updateMetrics();
  }

  function renderDay(day) {
    const dayState = getDayState(day.day);
    const total = dayState.rows.reduce((sum, row) => sum + (Number.parseInt(row.minutes, 10) || 0), 0);
    const card = document.createElement("article");
    card.className = "day-card";
    card.dataset.day = day.day;

    card.innerHTML = `
      <button class="day-header" type="button" aria-expanded="${dayState.open}">
        <span class="day-left">
          <span class="day-num">${day.day}</span>
          <span>
            <span class="day-name">${escapeHtml(day.weekday)}</span>
            <span class="day-subtitle">${day.exams.length ? `${day.exams.length} examen${day.exams.length > 1 ? "es" : ""}` : "Sin examen"}</span>
          </span>
        </span>
        <span class="day-total">${formatMinutes(total)}</span>
        <i class="ti ti-chevron-down chevron ${dayState.open ? "open" : ""}" aria-hidden="true"></i>
      </button>
      <div class="day-body ${dayState.open ? "open" : ""}">
        <div class="section-block">
          <div class="section-label">Examen</div>
          <div class="exam-list"></div>
        </div>
        <div class="section-block">
          <div class="section-label">Qué estudio hoy</div>
          <div class="study-rows"></div>
          <button class="add-btn" type="button">
            <i class="ti ti-plus" aria-hidden="true"></i>
            <span>Añadir sesión</span>
          </button>
        </div>
        <label class="notes-field">
          <span>Notas rápidas</span>
          <textarea rows="2" placeholder="Tareas, páginas o prioridades"></textarea>
        </label>
      </div>
    `;

    card.querySelector(".day-header").addEventListener("click", () => toggleDay(day.day, card));
    card.querySelector(".add-btn").addEventListener("click", () => addRow(day.day));
    const examsEl = card.querySelector(".exam-list");
    if (day.exams.length === 0) {
      examsEl.innerHTML = '<p class="no-exam">Sin examen</p>';
    } else {
      day.exams.forEach((exam) => examsEl.appendChild(renderExam(day.day, exam)));
    }

    const rowsEl = card.querySelector(".study-rows");
    dayState.rows.forEach((row, index) => rowsEl.appendChild(renderRow(day, row, index)));

    const textarea = card.querySelector("textarea");
    textarea.value = dayState.notes || "";
    textarea.addEventListener("input", () => {
      dayState.notes = textarea.value;
      saveState();
      updateMetrics();
    });

    return card;
  }

  function renderExam(day, exam) {
    const wrapper = document.createElement("article");
    wrapper.className = "exam-item";
    wrapper.innerHTML = `
      <div class="exam-box">
        <i class="ti ${escapeHtml(exam.icon)}" aria-hidden="true"></i>
        <span>${escapeHtml(exam.name)}</span>
      </div>
      <div class="file-columns">
        ${renderFileGroup(day, exam.name, "notes", "Apuntes", "ti-notebook")}
        ${renderFileGroup(day, exam.name, "practice", "Exámenes prueba", "ti-file-check")}
      </div>
    `;

    wrapper.querySelectorAll("input[type='file']").forEach((input) => {
      input.addEventListener("change", () => addFiles(day, exam.name, input.dataset.group, Array.from(input.files)));
    });

    wrapper.querySelectorAll("[data-remove-file]").forEach((button) => {
      button.addEventListener("click", () => removeFile(day, exam.name, button.dataset.group, Number(button.dataset.index)));
    });

    return wrapper;
  }

  function renderFileGroup(day, examName, group, title, icon) {
    const files = getExamFiles(day, examName)[group];
    const fileList = files.length
      ? files.map((file, index) => `
        <li>
          <a href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name)}" title="Descargar ${escapeHtml(file.name)}">
            <i class="ti ti-paperclip" aria-hidden="true"></i>
            <span>${escapeHtml(file.name)}</span>
          </a>
          <small>${formatBytes(file.size)}</small>
          <button class="icon-btn small" type="button" data-remove-file data-group="${group}" data-index="${index}" title="Eliminar archivo" aria-label="Eliminar ${escapeHtml(file.name)}">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </li>
      `).join("")
      : '<li class="file-empty">Sin archivos</li>';

    return `
      <div class="file-group">
        <div class="file-group-head">
          <span><i class="ti ${icon}" aria-hidden="true"></i>${title}</span>
          <label class="icon-btn small" title="Añadir archivo" aria-label="Añadir archivo a ${title}">
            <i class="ti ti-plus" aria-hidden="true"></i>
            <input type="file" multiple data-group="${group}">
          </label>
        </div>
        <ul class="file-list">${fileList}</ul>
      </div>
    `;
  }

  function getExamFiles(day, examName) {
    const dayState = getDayState(day);
    const key = examKey(examName);
    if (!dayState.files) dayState.files = {};
    if (!dayState.files[key]) dayState.files[key] = { notes: [], practice: [] };
    return dayState.files[key];
  }

  function addFiles(day, examName, group, files) {
    if (!files.length) return;
    const tooLarge = files.filter((file) => file.size > maxFileSize);
    if (tooLarge.length) {
      alert(`Estos archivos son demasiado grandes para guardarlos dentro de esta web: ${tooLarge.map((file) => file.name).join(", ")}`);
      files = files.filter((file) => file.size <= maxFileSize);
      if (!files.length) return;
    }

    const readers = files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          addedAt: new Date().toISOString(),
          dataUrl: reader.result
        });
      });
      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
    }));

    Promise.all(readers)
      .then((uploadedFiles) => {
        const examFiles = getExamFiles(day, examName)[group];
        examFiles.push(...uploadedFiles);
        if (!saveState()) {
          examFiles.splice(examFiles.length - uploadedFiles.length, uploadedFiles.length);
        }
        render();
      })
      .catch(() => alert("No se pudieron añadir algunos archivos."));
  }

  function removeFile(day, examName, group, index) {
    getExamFiles(day, examName)[group].splice(index, 1);
    saveState();
    render();
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderRow(day, row, index) {
    const fragment = rowTemplate.content.cloneNode(true);
    const rowEl = fragment.querySelector(".study-row");
    const selectField = fragment.querySelector(".select-field");
    const doneInput = fragment.querySelector(".study-done");
    const minsInput = fragment.querySelector(".study-mins");
    const removeBtn = fragment.querySelector(".remove-row");

    selectField.appendChild(row.subject === "__custom__" ? renderCustomInput(row) : renderSubjectSelect(day, row));
    doneInput.checked = Boolean(row.done);
    minsInput.value = row.minutes;

    doneInput.addEventListener("change", () => {
      row.done = doneInput.checked;
      saveState();
      updateMetrics();
    });

    minsInput.addEventListener("input", () => {
      row.minutes = minsInput.value;
      saveState();
      updateDayTotal(day.day);
      updateMetrics();
    });

    removeBtn.addEventListener("click", () => removeRow(day.day, index));
    rowEl.classList.toggle("completed", row.done);
    return fragment;
  }

  function renderSubjectSelect(day, row) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Asignatura");
    const examNames = day.exams.map((exam) => exam.name);
    const groups = [
      { label: "Examen de hoy", options: examNames },
      { label: "Otras", options: config.subjects.filter((subject) => !examNames.includes(subject)) }
    ].filter((group) => group.options.length > 0);

    select.innerHTML = `<option value="" disabled ${row.subject ? "" : "selected"}>Elige asignatura</option>`;
    groups.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.options.forEach((subject) => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        option.selected = row.subject === subject;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "+ Otra";
    select.appendChild(customOption);

    select.addEventListener("change", () => {
      row.subject = select.value;
      row.customSubject = "";
      saveState();
      render();
    });

    return select;
  }

  function renderCustomInput(row) {
    const input = document.createElement("input");
    input.className = "custom-subject";
    input.type = "text";
    input.placeholder = "Escribe asignatura";
    input.value = row.customSubject;
    input.setAttribute("aria-label", "Asignatura personalizada");
    input.addEventListener("input", () => {
      row.customSubject = input.value;
      saveState();
      updateMetrics();
    });
    return input;
  }

  function toggleDay(day, card) {
    const dayState = getDayState(day);
    dayState.open = !dayState.open;
    card.querySelector(".day-body").classList.toggle("open", dayState.open);
    card.querySelector(".chevron").classList.toggle("open", dayState.open);
    card.querySelector(".day-header").setAttribute("aria-expanded", String(dayState.open));
    saveState();
  }

  function addRow(day) {
    getDayState(day).rows.push({ subject: "", customSubject: "", minutes: "", done: false, notes: "" });
    saveState();
    render();
  }

  function removeRow(day, index) {
    const rows = getDayState(day).rows;
    if (rows.length === 1) {
      rows[0] = { subject: "", customSubject: "", minutes: "", done: false, notes: "" };
    } else {
      rows.splice(index, 1);
    }
    saveState();
    render();
  }

  function updateMetrics() {
    const days = getDays();
    const allRows = days.flatMap((day) => getDayState(day.day).rows);
    const usefulRows = allRows.filter((row) => subjectName(row) || Number(row.minutes) > 0);
    const totalMinutes = allRows.reduce((sum, row) => sum + (Number.parseInt(row.minutes, 10) || 0), 0);
    const doneRows = usefulRows.filter((row) => row.done).length;
    const examCount = days.reduce((sum, day) => sum + day.exams.length, 0);

    metrics.examCount.textContent = String(examCount);
    metrics.plannedTime.textContent = formatMinutes(totalMinutes);
    metrics.sessionCount.textContent = String(usefulRows.length);
    metrics.completionRate.textContent = usefulRows.length ? `${Math.round((doneRows / usefulRows.length) * 100)}%` : "0%";
  }

  function updateDayTotal(day) {
    const card = agendaEl.querySelector(`[data-day="${day}"]`);
    if (!card) return;
    const dayState = getDayState(day);
    const total = dayState.rows.reduce((sum, row) => sum + (Number.parseInt(row.minutes, 10) || 0), 0);
    card.querySelector(".day-total").textContent = formatMinutes(total);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agenda-examenes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = normalizeState(parsed, createDefaultState());
        saveState();
        render();
      } catch (error) {
        alert("El archivo no parece una copia válida de la agenda.");
      }
    });
    reader.readAsText(file);
  }

  function resetData() {
    const confirmed = confirm("¿Seguro que quieres borrar la planificación guardada?");
    if (!confirmed) return;
    state = createDefaultState();
    saveState();
    render();
  }

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      filter = button.dataset.filter;
      render();
    });
  });

  searchInput.addEventListener("input", render);
  exportBtn.addEventListener("click", exportData);
  resetBtn.addEventListener("click", resetData);
  importInput.addEventListener("change", () => importData(importInput.files[0]));

  render();
})();
