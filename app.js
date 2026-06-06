const STORAGE_KEY = "assistant-calendar-tasks-v1";
const RULE_STORAGE_KEY = "assistant-calendar-day-rules-v1";
const CATEGORY_STORAGE_KEY = "assistant-calendar-categories-v1";
const FIXED_EVENT_STORAGE_KEY = "assistant-calendar-fixed-events-v1";
const DEFAULT_DAY_START = "09:00";
const DEFAULT_DAY_END = "21:00";
const DEFAULT_DAILY_HOURS = 6;
const POMODORO_WORK_MINUTES = 50;
const POMODORO_BREAK_MINUTES = 10;

const form = document.querySelector("#task-form");
const submitBtn = form.querySelector("button[type='submit']");
const cancelEditBtn = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const scheduleList = document.querySelector("#schedule-list");
const taskTemplate = document.querySelector("#task-template");
const scheduleBtn = document.querySelector("#schedule-btn");
const clearDoneBtn = document.querySelector("#clear-done");
const addRuleBtn = document.querySelector("#add-rule");
const addFixedBtn = document.querySelector("#add-fixed");
const taskCount = document.querySelector("#task-count");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressFill = document.querySelector("#progress-fill");
const briefTitle = document.querySelector("#brief-title");
const briefBody = document.querySelector("#brief-body");
const today = document.querySelector("#today");
const ruleList = document.querySelector("#rule-list");
const categorySelect = document.querySelector("#category");
const categoryNameInput = document.querySelector("#category-name");
const saveCategoryBtn = document.querySelector("#save-category");
const cancelCategoryEditBtn = document.querySelector("#cancel-category-edit");
const categoryList = document.querySelector("#category-list");
const fixedList = document.querySelector("#fixed-list");

let tasks = loadTasks();
let dayRules = loadDayRules();
let categories = loadCategories();
let fixedEvents = loadFixedEvents();
let editingTaskId = null;
let editingCategoryName = null;

const formatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

today.textContent = formatter.format(new Date());
document.querySelector("#due-date").valueAsDate = new Date();
document.querySelector("#rule-date").valueAsDate = new Date();
document.querySelector("#fixed-date").valueAsDate = new Date();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const taskValues = {
    id: createId(),
    title: getValue("#title"),
    category: getValue("#category") || "기본",
    dueDate: getValue("#due-date"),
    duration: Number(getValue("#duration")),
    priority: Number(getValue("#priority")),
    difficulty: Number(getValue("#difficulty")),
    notes: getValue("#notes"),
    done: false,
    createdAt: new Date().toISOString(),
  };

  if (editingTaskId) {
    tasks = tasks.map((task) =>
      task.id === editingTaskId
        ? {
            ...task,
            ...taskValues,
            id: task.id,
            done: task.done,
            createdAt: task.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : task
    );
  } else {
    tasks = [taskValues, ...tasks];
  }

  saveTasks();
  resetTaskForm();
  render();
  runScheduler();
});

cancelEditBtn.addEventListener("click", resetTaskForm);
saveCategoryBtn.addEventListener("click", saveCategoryFromInput);
cancelCategoryEditBtn.addEventListener("click", resetCategoryForm);
setupEnterNavigation(form);
setupEnterNavigation(document.querySelector(".rule-form"));
setupEnterNavigation(document.querySelector(".fixed-form"));
setupEnterNavigation(document.querySelector(".category-form"));

scheduleBtn.addEventListener("click", runScheduler);

clearDoneBtn.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.done);
  saveTasks();
  render();
  runScheduler();
});

addRuleBtn.addEventListener("click", () => {
  const date = getValue("#rule-date");
  const start = getValue("#rule-start") || "09:00";
  const end = getValue("#rule-end") || "21:00";
  const hours = Number(getValue("#rule-hours") || 1);

  if (!date) {
    setProgress(0, "날짜를 선택하세요", 0);
    return;
  }

  dayRules = {
    ...dayRules,
    [date]: {
      date,
      start,
      end,
      hours: Math.max(1, hours),
    },
  };
  saveDayRules();
  render();
  runScheduler();
});

addFixedBtn.addEventListener("click", () => {
  const title = getValue("#fixed-title") || "기존 일정";
  const date = getValue("#fixed-date");
  const start = getValue("#fixed-start");
  const end = getValue("#fixed-end");

  if (!date || !start || !end) {
    setProgress(0, "기존 일정 날짜와 시간을 입력하세요", 0);
    return;
  }

  if (toMinutes(end) <= toMinutes(start)) {
    setProgress(0, "종료 시간이 시작보다 늦어야 합니다", 0);
    return;
  }

  fixedEvents = [
    ...fixedEvents,
    {
      id: createId(),
      title,
      date,
      start,
      end,
      createdAt: new Date().toISOString(),
    },
  ];
  saveFixedEvents();
  resetFixedForm();
  render();
  runScheduler();
});

function getValue(selector) {
  return document.querySelector(selector).value.trim();
}

function setupEnterNavigation(container) {
  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const target = event.target;

    if (!target.matches("input, select, textarea")) {
      return;
    }

    event.preventDefault();

    const fields = [...container.querySelectorAll("input, select, textarea, button")].filter(
      (field) => !field.disabled && !field.classList.contains("hidden") && field.offsetParent !== null
    );
    const currentIndex = fields.indexOf(target);
    const nextField = fields[currentIndex + 1];

    if (!nextField) {
      return;
    }

    if (nextField.tagName === "BUTTON") {
      nextField.click();
      return;
    }

    nextField.focus();
  });
}

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadDayRules() {
  try {
    return JSON.parse(localStorage.getItem(RULE_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY));
    return uniqueCategories([...(saved ?? []), ...tasks.map((task) => task.category || "기본"), "기본"]);
  } catch {
    return uniqueCategories([...tasks.map((task) => task.category || "기본"), "기본"]);
  }
}

function loadFixedEvents() {
  try {
    return JSON.parse(localStorage.getItem(FIXED_EVENT_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function saveDayRules() {
  localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(dayRules));
}

function saveCategories() {
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
}

function saveFixedEvents() {
  localStorage.setItem(FIXED_EVENT_STORAGE_KEY, JSON.stringify(fixedEvents));
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function render() {
  renderCategories();
  renderCategoryList();
  renderDayRules();
  renderFixedEvents();
  renderTasks();
  renderBrief();
}

function renderFixedEvents() {
  fixedList.innerHTML = "";
  const events = [...fixedEvents].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "rule-empty";
    empty.textContent = "기존 일정 없음";
    fixedList.append(empty);
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("div");
    item.className = "fixed-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.date)} · ${escapeHtml(event.start)} - ${escapeHtml(event.end)}</span>
      </div>
      <button type="button" aria-label="기존 일정 삭제">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      fixedEvents = fixedEvents.filter((candidate) => candidate.id !== event.id);
      saveFixedEvents();
      render();
      runScheduler(false);
    });
    fixedList.append(item);
  });
}

function renderDayRules() {
  const rules = Object.values(dayRules).sort((a, b) => a.date.localeCompare(b.date));
  ruleList.innerHTML = "";

  if (!rules.length) {
    const empty = document.createElement("div");
    empty.className = "rule-empty";
    empty.textContent = "날짜별 설정 없음";
    ruleList.append(empty);
    return;
  }

  rules.forEach((rule) => {
    const item = document.createElement("div");
    item.className = "rule-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(rule.date)}</strong>
        <span>${escapeHtml(rule.start)} - ${escapeHtml(rule.end)} · ${rule.hours}시간</span>
      </div>
      <button type="button" aria-label="날짜 설정 삭제">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      const nextRules = { ...dayRules };
      delete nextRules[rule.date];
      dayRules = nextRules;
      saveDayRules();
      render();
      runScheduler(false);
    });
    ruleList.append(item);
  });
}

function renderCategories() {
  const selected = categorySelect.value;
  categorySelect.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.textContent = category;
    option.value = category;
    categorySelect.append(option);
  });

  categorySelect.value = categories.includes(selected) ? selected : categories[0];
}

function renderCategoryList() {
  categoryList.innerHTML = "";

  categories.forEach((category) => {
    const usedCount = tasks.filter((task) => (task.category || "기본") === category).length;
    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(category)}</strong>
        <span>${usedCount}개 일정</span>
      </div>
      <div class="category-actions">
        <button type="button" class="category-edit">수정</button>
        <button type="button" class="category-delete" ${category === "기본" ? "disabled" : ""}>×</button>
      </div>
    `;

    item.querySelector(".category-edit").addEventListener("click", () => startEditCategory(category));
    item.querySelector(".category-delete").addEventListener("click", () => deleteCategory(category));
    categoryList.append(item);
  });
}

function saveCategoryFromInput() {
  const nextName = categoryNameInput.value.trim();

  if (!nextName) {
    setProgress(0, "카테고리 이름을 입력하세요", 0);
    return;
  }

  if (editingCategoryName) {
    if (nextName !== editingCategoryName && categories.includes(nextName)) {
      setProgress(0, "이미 있는 카테고리입니다", 0);
      return;
    }

    categories = categories.map((category) => (category === editingCategoryName ? nextName : category));
    tasks = tasks.map((task) =>
      (task.category || "기본") === editingCategoryName ? { ...task, category: nextName } : task
    );
    saveTasks();
  } else {
    if (categories.includes(nextName)) {
      setProgress(0, "이미 있는 카테고리입니다", 0);
      return;
    }

    categories = uniqueCategories([...categories, nextName]);
  }

  saveCategories();
  resetCategoryForm();
  render();
  runScheduler(false);
}

function startEditCategory(category) {
  editingCategoryName = category;
  categoryNameInput.value = category;
  saveCategoryBtn.textContent = "카테고리 수정";
  cancelCategoryEditBtn.classList.remove("hidden");
}

function deleteCategory(category) {
  if (category === "기본") {
    setProgress(0, "기본 카테고리는 삭제할 수 없습니다", 0);
    return;
  }

  categories = categories.filter((candidate) => candidate !== category);
  tasks = tasks.map((task) => ((task.category || "기본") === category ? { ...task, category: "기본" } : task));
  saveCategories();
  saveTasks();
  resetCategoryForm();
  render();
  runScheduler(false);
}

function resetCategoryForm() {
  editingCategoryName = null;
  categoryNameInput.value = "";
  saveCategoryBtn.textContent = "카테고리 추가";
  cancelCategoryEditBtn.classList.add("hidden");
}

function resetFixedForm() {
  document.querySelector("#fixed-title").value = "";
  document.querySelector("#fixed-date").valueAsDate = new Date();
  document.querySelector("#fixed-start").value = "18:00";
  document.querySelector("#fixed-end").value = "22:00";
}

function uniqueCategories(source) {
  return [...new Set(source.map((category) => category.trim()).filter(Boolean))].sort((a, b) => {
    if (a === "기본") return -1;
    if (b === "기본") return 1;
    return a.localeCompare(b, "ko-KR");
  });
}

function renderTasks() {
  taskList.innerHTML = "";
  taskCount.textContent = `${tasks.length}개`;

  if (!tasks.length) {
    taskList.append(emptyState("아직 일정이 없습니다."));
    return;
  }

  getRankedTasks(tasks).forEach((task) => {
    const item = taskTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = item.querySelector(".task-done");
    const editBtn = item.querySelector(".edit-btn");
    const deleteBtn = item.querySelector(".delete-btn");

    item.classList.toggle("done", task.done);
    checkbox.checked = task.done;
    item.querySelector("h3").textContent = task.title;
    item.querySelector(".category-badge").textContent = task.category || "기본";
    item.querySelector(".task-meta").textContent = metaText(task);
    item.querySelector(".task-notes").textContent = task.notes || "메모 없음";

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      render();
      runScheduler(false);
    });

    editBtn.addEventListener("click", () => {
      startEditTask(task);
    });

    deleteBtn.addEventListener("click", () => {
      if (editingTaskId === task.id) {
        resetTaskForm();
      }

      tasks = tasks.filter((candidate) => candidate.id !== task.id);
      saveTasks();
      render();
      runScheduler(false);
    });

    taskList.append(item);
  });
}

function startEditTask(task) {
  editingTaskId = task.id;
  document.querySelector("#title").value = task.title;
  document.querySelector("#category").value = task.category || "기본";
  document.querySelector("#due-date").value = task.dueDate;
  document.querySelector("#duration").value = task.duration;
  document.querySelector("#priority").value = task.priority;
  document.querySelector("#difficulty").value = task.difficulty;
  document.querySelector("#notes").value = task.notes || "";
  submitBtn.textContent = "수정 저장";
  cancelEditBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTaskForm() {
  editingTaskId = null;
  form.reset();
  document.querySelector("#duration").value = "1";
  document.querySelector("#priority").value = "3";
  document.querySelector("#difficulty").value = "3";
  document.querySelector("#category").value = categories[0] || "기본";
  document.querySelector("#due-date").valueAsDate = new Date();
  submitBtn.textContent = "추가";
  cancelEditBtn.classList.add("hidden");
}

function renderBrief() {
  const active = tasks.filter((task) => !task.done);

  if (!active.length) {
    briefTitle.textContent = "일정을 추가하면 자동으로 순서를 제안합니다.";
    briefBody.textContent = "중요도, 마감일, 예상 시간, 난이도를 함께 보고 오늘 처리할 일을 계산합니다.";
    return;
  }

  const topTask = getRankedTasks(active)[0];
  const overdueCount = active.filter((task) => daysUntil(task.dueDate) < 0).length;
  const hours = active.reduce((sum, task) => sum + task.duration, 0);
  const categoryCount = new Set(active.map((task) => task.category || "기본")).size;

  briefTitle.textContent = `가장 먼저 볼 일은 "${topTask.title}"입니다.`;
  briefBody.textContent = `남은 일정 ${active.length}개, 카테고리 ${categoryCount}개, 총 예상 ${hours.toFixed(1)}시간입니다. ${
    overdueCount ? `마감 지난 항목 ${overdueCount}개를 먼저 정리하세요.` : "마감과 부담도를 기준으로 안정적으로 배치했습니다."
  }`;
}

function getRankedTasks(source) {
  return [...source].sort((a, b) => {
    const dayGap = daysUntil(a.dueDate) - daysUntil(b.dueDate);

    if (dayGap !== 0) {
      return dayGap;
    }

    return scoreTask(b) - scoreTask(a);
  });
}

function scoreTask(task) {
  const effort = task.duration * 0.8 + task.difficulty * 1.2;
  return task.priority * 10 + effort;
}

function daysUntil(dateValue) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const due = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((due - todayStart) / 86400000);
}

function metaText(task) {
  const days = daysUntil(task.dueDate);
  const dueText = days < 0 ? `${Math.abs(days)}일 지남` : days === 0 ? "오늘 마감" : `${days}일 남음`;
  return `마감 ${task.dueDate} · ${dueText} · ${task.duration}시간 · 중요도 ${task.priority}/5 · 난이도 ${task.difficulty}/5`;
}

async function runScheduler(animated = true) {
  try {
    if (animated) {
      await setProgress(15, "일정 정보 분석 중");
      await setProgress(42, "마감일 우선순위 계산 중");
      await setProgress(68, "날짜별 가능 시간 확인 중");
      await setProgress(90, "추천 순서 정리 중");
    }

    const schedule = buildSchedule();
    renderSchedule(schedule);
    if (!animated) {
      setProgress(0, "대기 중", 0);
      return;
    }

    await setProgress(100, "자동 일정 완성");
    window.setTimeout(() => setProgress(0, "대기 중", 0), 1200);
  } catch (error) {
    console.error(error);
    setProgress(0, "오류 발생: 입력값을 확인하세요", 0);
  }
}

function buildSchedule() {
  const activeTasks = getRankedTasks(tasks.filter((task) => !task.done));
  const schedule = [];
  let cursorDate = new Date();
  let availability = getAvailability(cursorDate);
  let cursorMinutes = availability.startMinutes;
  let usedToday = 0;

  activeTasks.forEach((task, index) => {
    let remaining = task.duration * 60;

    while (remaining > 0) {
      availability = getAvailability(cursorDate);
      cursorMinutes = Math.max(cursorMinutes, availability.startMinutes);
      const endLimit = Math.min(availability.endMinutes, availability.startMinutes + availability.maxMinutes);
      const busyBlocks = getBusyBlocks(cursorDate);
      const activeBusy = busyBlocks.find((block) => block.start < endLimit && block.end > cursorMinutes);

      if (activeBusy && cursorMinutes >= activeBusy.start) {
        cursorMinutes = Math.max(cursorMinutes, activeBusy.end);
        continue;
      }

      const availableUntil = activeBusy ? Math.min(activeBusy.start, endLimit) : endLimit;
      const available = availableUntil - cursorMinutes;

      if (available <= 0 || usedToday >= availability.maxMinutes) {
        cursorDate = addDays(cursorDate, 1);
        availability = getAvailability(cursorDate);
        cursorMinutes = availability.startMinutes;
        usedToday = 0;
        continue;
      }

      const workBudget = Math.min(remaining, availability.maxMinutes - usedToday);
      const block = getWorkThatFits(available, workBudget);

      if (block <= 0) {
        cursorMinutes = availableUntil;
        continue;
      }

      const workEnd = cursorMinutes + getElapsedForWork(block);
      schedule.push({
        type: "task",
        task,
        date: new Date(cursorDate),
        start: cursorMinutes,
        end: workEnd,
        minutes: block,
      });
      cursorMinutes = workEnd;
      usedToday += block;
      remaining -= block;

      const hasMoreWork = remaining > 0 || index < activeTasks.length - 1;
      const needsBreakBeforeNext = block % POMODORO_WORK_MINUTES === 0 && block >= POMODORO_WORK_MINUTES;
      const canAddBreak = needsBreakBeforeNext && workEnd + POMODORO_BREAK_MINUTES <= availableUntil;

      if (hasMoreWork && canAddBreak) {
        cursorMinutes = workEnd + POMODORO_BREAK_MINUTES;
      } else if (hasMoreWork && needsBreakBeforeNext) {
        cursorMinutes = endLimit;
      }
    }
  });

  return schedule;
}

function getWorkThatFits(availableMinutes, workBudget) {
  let low = 0;
  let high = Math.floor(workBudget);

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if (getElapsedForWork(middle) <= availableMinutes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

function getElapsedForWork(workMinutes) {
  if (workMinutes <= POMODORO_WORK_MINUTES) {
    return workMinutes;
  }

  const hiddenBreaks = Math.floor((workMinutes - 1) / POMODORO_WORK_MINUTES);
  return workMinutes + hiddenBreaks * POMODORO_BREAK_MINUTES;
}

function getBusyBlocks(date) {
  const key = toDateKey(date);
  return fixedEvents
    .filter((event) => event.date === key)
    .map((event) => ({
      start: toMinutes(event.start),
      end: toMinutes(event.end),
    }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);
}

function getAvailability(date) {
  const key = toDateKey(date);
  const rule = dayRules[key];
  const start = rule?.start || DEFAULT_DAY_START;
  const end = rule?.end || DEFAULT_DAY_END;
  const hours = Number(rule?.hours || DEFAULT_DAILY_HOURS);
  const startMinutes = toMinutes(start);
  const configuredEnd = toMinutes(end);
  const maxMinutes = Math.max(60, hours * 60);
  const endMinutes = configuredEnd > startMinutes ? configuredEnd : startMinutes + maxMinutes;

  return {
    start,
    end,
    maxMinutes,
    startMinutes,
    endMinutes,
  };
}

function renderSchedule(schedule) {
  scheduleList.innerHTML = "";

  if (!schedule.length) {
    scheduleList.append(emptyState("배치할 일정이 없습니다."));
    return;
  }

  const grouped = groupByDate(schedule);

  Object.values(grouped).forEach((slots, index) => {
    const day = document.createElement("article");
    day.className = "schedule-day";

    const heading = document.createElement("button");
    heading.className = "schedule-toggle";
    heading.type = "button";
    heading.setAttribute("aria-expanded", "false");
    heading.innerHTML = `
      <span>${formatter.format(slots[0].date)}</span>
      <strong>${slots.length}개</strong>
    `;
    day.append(heading);

    const body = document.createElement("div");
    body.className = "schedule-day-body";
    body.hidden = true;

    heading.addEventListener("click", () => {
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      heading.setAttribute("aria-expanded", String(!isOpen));
    });

    slots.forEach((slot) => {
      const item = document.createElement("div");
      item.className = "slot";

      const risk = riskClass(slot.task);
      item.innerHTML = `
        <time>${formatTime(slot.start)} - ${formatTime(slot.end)}</time>
        <div>
          <strong>${escapeHtml(slot.task.title)}</strong>
          <span class="slot-detail">
            ${escapeHtml(slot.task.category || "기본")} ·
            <span class="${risk.className}">${risk.label}</span>
          </span>
        </div>
      `;
      body.append(item);
    });

    day.append(body);
    scheduleList.append(day);
  });
}

function groupByDate(schedule) {
  return schedule.reduce((groups, slot) => {
    const key = slot.date.toDateString();
    groups[key] ??= [];
    groups[key].push(slot);
    return groups;
  }, {});
}

function riskClass(task) {
  const days = daysUntil(task.dueDate);
  if (days <= 1 || task.priority >= 5) {
    return { className: "risk-high", label: "긴급 집중" };
  }
  if (task.difficulty >= 4 || task.priority >= 4) {
    return { className: "risk-mid", label: "중요 작업" };
  }
  return { className: "risk-low", label: "일반 작업" };
}

function emptyState(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = Math.round(minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setProgress(percent, label, delay = 180) {
  progressLabel.textContent = label;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

render();
runScheduler(false);
