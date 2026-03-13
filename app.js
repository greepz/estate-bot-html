const WEBHOOK_URL = "https://cloud.activepieces.com/api/v1/webhooks/dhNXQ0rS4B2NDDmPOPTig";

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const currentUser = {
  id: String(tg?.initDataUnsafe?.user?.id || "demo-user"),
  firstName: tg?.initDataUnsafe?.user?.first_name || "Пользователь"
};

const state = {
  listings: [],
  wizard: {
    currentStepIndex: 0,
    values: {}
  },
  appScreen: "listings",
  listingSubScreen: "list"
};

function byId(id) {
  return document.getElementById(id);
}

const refs = {
  userName: byId("userName"),
  userIdBadge: byId("userIdBadge"),
  userAvatar: byId("userAvatar"),

  sections: [...document.querySelectorAll(".section")],
  bottomNavItems: [...document.querySelectorAll(".bottom-nav-item")],

  listingsListScreen: byId("listingsListScreen"),
  listingCreateScreen: byId("listingCreateScreen"),
  openCreateListingBtn: byId("openCreateListingBtn"),
  backToListingsBtn: byId("backToListingsBtn"),

  listingStatus: byId("listingStatus"),
  listingsList: byId("listingsList"),
  listingsEmpty: byId("listingsEmpty"),
  listingPayloadPreview: byId("listingPayloadPreview"),

  wizardStepContainer: byId("wizardStepContainer"),
  wizardStepLabel: byId("wizardStepLabel"),
  wizardStepCounter: byId("wizardStepCounter"),
  wizardProgressFill: byId("wizardProgressFill"),
  wizardBackBtn: byId("wizardBackBtn"),
  wizardNextBtn: byId("wizardNextBtn"),
  wizardSubmitBtn: byId("wizardSubmitBtn"),
  wizardStatus: byId("wizardStatus"),

  plansForm: byId("plansForm"),
  plansStatus: byId("plansStatus"),

  enhanceForm: byId("enhanceForm"),
  enhanceStatus: byId("enhanceStatus")
};

if (refs.userName) refs.userName.textContent = currentUser.firstName;
if (refs.userIdBadge) refs.userIdBadge.textContent = `ID: ${currentUser.id}`;
if (refs.userAvatar) refs.userAvatar.textContent = (currentUser.firstName || "П").trim().charAt(0).toUpperCase();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function postJson(body) {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }

  return data;
}

function getBasePayload(route) {
  return {
    route,
    userId: currentUser.id,
    firstName: currentUser.firstName,
    initData: tg?.initData || "",
    sentAt: new Date().toISOString()
  };
}

function normalizeScreen(value) {
  if (!value) return "listings";
  const v = String(value).trim().toLowerCase();

  if (["plans", "plan", "layout", "layouts"].includes(v)) return "plans";
  if (["enhance", "photo", "improve", "improve-photo"].includes(v)) return "enhance";

  return "listings";
}

function getUrlState() {
  const url = new URL(window.location.href);
  const screen = normalizeScreen(url.searchParams.get("screen") || "listings");
  const sub = url.searchParams.get("sub") || "list";

  return {
    screen,
    sub: screen === "listings" ? (sub === "create" ? "create" : "list") : "list"
  };
}

function updateUrl(screen, sub = "list", replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);

  if (screen === "listings" && sub === "create") {
    url.searchParams.set("sub", "create");
  } else {
    url.searchParams.delete("sub");
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ screen, sub }, "", url);
}

function hideKeyboard() {
  const active = document.activeElement;
  if (active && typeof active.blur === "function") {
    active.blur();
  }
}

function bindHideKeyboardOnEnter(container = document) {
  container.querySelectorAll("input").forEach((el) => {
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        hideKeyboard();
      }
    });
  });
}

function applyTelegramBackButton() {
  if (!tg?.BackButton) return;

  const shouldShowBack =
    (state.appScreen === "listings" && state.listingSubScreen === "create") ||
    state.appScreen !== "listings";

  if (shouldShowBack) {
    tg.BackButton.show();
  } else {
    tg.BackButton.hide();
  }
}

function updateBottomNav() {
  refs.bottomNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.screen === state.appScreen);
  });
}

function switchSection(sectionKey) {
  const normalized = normalizeScreen(sectionKey);
  state.appScreen = normalized;

  refs.sections.forEach((section) => {
    const isActive = section.id === `section-${normalized}`;
    section.classList.toggle("active", isActive);
  });

  updateBottomNav();
  applyTelegramBackButton();
}

function showListingsListScreen() {
  state.listingSubScreen = "list";
  if (refs.listingsListScreen) refs.listingsListScreen.classList.remove("hidden");
  if (refs.listingCreateScreen) refs.listingCreateScreen.classList.add("hidden");
  applyTelegramBackButton();
}

function showListingCreateScreen() {
  state.listingSubScreen = "create";
  if (refs.listingsListScreen) refs.listingsListScreen.classList.add("hidden");
  if (refs.listingCreateScreen) refs.listingCreateScreen.classList.remove("hidden");
  applyTelegramBackButton();
}

function goToListingsList(push = true) {
  switchSection("listings");
  showListingsListScreen();
  if (push) updateUrl("listings", "list");
}

function goToListingCreate(push = true) {
  switchSection("listings");
  showListingCreateScreen();
  if (push) updateUrl("listings", "create");
}

function goToMainScreen(screen, push = true) {
  switchSection(screen);

  if (screen === "listings") {
    showListingsListScreen();
    if (push) updateUrl("listings", "list");
  } else {
    if (push) updateUrl(screen);
  }
}

function renderListings() {
  if (!refs.listingsList || !refs.listingsEmpty) return;

  refs.listingsList.innerHTML = "";
  const hasItems = state.listings.length > 0;
  refs.listingsEmpty.style.display = hasItems ? "none" : "block";

  state.listings.forEach((item) => {
    const card = document.createElement("div");
    card.className = "listing-item";

    const title = item.title || item.payloadJson?.title || buildAutoTitle(item.payloadJson) || "Без названия";
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString("ru-RU") : "";

    card.innerHTML = `
      <div class="listing-item-header">
        <div>
          <div class="listing-title">${escapeHtml(title)}</div>
          <div class="meta">ID: ${escapeHtml(item.id || "")}</div>
          <div class="meta">Создано: ${escapeHtml(createdAt)}</div>
        </div>
        <button class="btn btn-danger" data-id="${escapeHtml(item.id || "")}">Удалить</button>
      </div>
      <pre class="json-box">${escapeHtml(JSON.stringify(item.payloadJson || {}, null, 2))}</pre>
    `;

    refs.listingsList.appendChild(card);
  });

  refs.listingsList.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteListing(btn.dataset.id);
    });
  });
}

async function loadListings() {
  if (!refs.listingStatus) return;

  refs.listingStatus.textContent = "Загрузка объявлений...";

  try {
    const result = await postJson({
      ...getBasePayload("list-listings")
    });

    state.listings = Array.isArray(result?.items) ? result.items : [];
    renderListings();
    refs.listingStatus.textContent = "";
  } catch (error) {
    refs.listingStatus.textContent = `Ошибка загрузки: ${error.message}`;
  }
}

async function deleteListing(id) {
  if (!refs.listingStatus) return;

  refs.listingStatus.textContent = "Удаление объявления...";

  try {
    await postJson({
      ...getBasePayload("delete-listing"),
      id
    });

    state.listings = state.listings.filter((item) => item.id !== id);
    renderListings();
    refs.listingStatus.textContent = "Объявление удалено.";
  } catch (error) {
    refs.listingStatus.textContent = `Ошибка удаления: ${error.message}`;
  }
}

function buildAutoTitle(payload) {
  if (!payload) return "";
  const deal = payload.dealType || "";
  const estate = payload.propertyType || "";
  const rooms = payload.rooms || payload.commercialSubtype || payload.estateSubtype || "";
  const area = payload.area || "";
  const location = payload.location || "";

  const parts = [];
  if (deal) parts.push(deal);
  if (estate) parts.push(estate);
  if (rooms) parts.push(rooms);
  if (area) parts.push(`${area} м²`);
  if (location) parts.push(location);

  return parts.join(" • ");
}

function getWizardSteps(values) {
  const dealType = values.dealType;
  const propertyType = values.propertyType;

  const base = [
    {
      key: "dealType",
      title: "Тип сделки",
      hint: "Продажа или аренда.",
      type: "options",
      options: ["Продажа", "Аренда"],
      required: true
    },
    {
      key: "propertyType",
      title: "Тип недвижимости",
      hint: "Выберите тип объекта.",
      type: "options",
      options: ["Квартира", "Загородная недвижимость", "Коммерческая недвижимость"],
      required: true
    }
  ];

  if (!dealType || !propertyType) return base;

  if (propertyType === "Квартира" && dealType === "Продажа") {
    return [
      ...base,
      { key: "market", title: "Рынок", type: "options", options: ["Новостройка", "Вторичка", "Свой вариант"], required: true },
      { key: "objectClass", title: "Класс объекта недвижимости", type: "options", options: ["Эконом", "Комфорт", "Элитное", "Свой вариант"], required: true },
      { key: "rooms", title: "Количество комнат", type: "options", options: ["Студия", "1", "2", "3", "4+", "Свой вариант"], required: true },
      { key: "mortgage", title: "Подходит для ипотеки?", type: "options", options: ["Да", "Нет", "Свой вариант"], required: true },
      { key: "area", title: "Площадь объекта", type: "input", placeholder: "Например: 58", required: true },
      { key: "kitchenArea", title: "Площадь кухни", type: "input", placeholder: "Например: 12", required: true },
      { key: "floor", title: "Этаж расположения", type: "input", placeholder: "Например: 8", required: true },
      { key: "floorsTotal", title: "Этажность здания", type: "input", placeholder: "Например: 17", required: true },
      { key: "bathroom", title: "Санузел", type: "options", options: ["Совмещенный", "Раздельный", "Свой вариант"], required: true },
      { key: "windows", title: "Окна", type: "options", options: ["Во двор", "На улицу", "На солнечную сторону", "Разное", "Свой вариант"], required: true },
      { key: "elevator", title: "Лифт", type: "options", options: ["Нет", "Пассажирский", "Грузовой", "Оба", "Свой вариант"], required: true },
      { key: "parking", title: "Парковка", type: "options", options: ["Подземная", "Надземная", "Многоуровневая", "Открытая во дворе", "За шлагбаумом", "Свой вариант"], required: true },
      { key: "repair", title: "Ремонт", type: "options", options: ["Требуется", "Евро", "Коммерческий", "Дизайнерский", "Свой вариант"], required: true },
      { key: "layoutRooms", title: "Планировка комнат", type: "options", options: ["Изолированные", "Смежные", "И то и другое", "Свой вариант"], required: true },
      { key: "balcony", title: "Балкон/Лоджия", type: "options", options: ["Нет", "Балкон", "Лоджия", "Несколько", "Свой вариант"], required: true },
      { key: "ceilingHeight", title: "Высота потолков", type: "input", placeholder: "Можно пропустить", required: false },
      { key: "location", title: "Локация", type: "textarea", placeholder: "Опишите местоположение объекта. Адрес", required: true },
      { key: "infrastructure", title: "Ближайшие точки инфраструктуры", type: "textarea", placeholder: "Школы, сады, остановки, парки, достопримечательности", required: true },
      { key: "legal", title: "Юридические особенности объекта", type: "textarea", placeholder: "Маткапитал, ипотека, аресты, готовность к заселению", required: true },
      { key: "comment", title: "Свободный комментарий", type: "textarea", placeholder: "Детали планировки, состояние, окружение и прочее", required: false }
    ];
  }

  return base;
}

function getCurrentSteps() {
  return getWizardSteps(state.wizard.values);
}

function getCurrentStep() {
  const steps = getCurrentSteps();
  return steps[state.wizard.currentStepIndex];
}

function isOwnVariantOption(step, value) {
  return step?.options?.includes("Свой вариант") && value === "Свой вариант";
}

function renderWizard() {
  if (!refs.wizardStepContainer) return;

  const steps = getCurrentSteps();
  const step = steps[state.wizard.currentStepIndex];
  if (!step) return;

  refs.wizardStepLabel.textContent = `${state.wizard.currentStepIndex + 1} шаг`;
  refs.wizardStepCounter.textContent = `${state.wizard.currentStepIndex + 1} / ${steps.length}`;
  refs.wizardProgressFill.style.width = `${((state.wizard.currentStepIndex + 1) / steps.length) * 100}%`;

  const value = state.wizard.values[step.key] || "";
  const needsCustomInput = isOwnVariantOption(step, value);

  let html = `
    <div class="wizard-step">
      <div class="wizard-question">${escapeHtml(step.title)}</div>
      ${step.hint ? `<div class="wizard-hint">${escapeHtml(step.hint)}</div>` : ""}
  `;

  if (step.type === "options") {
    html += `<div class="option-list">`;
    step.options.forEach((option) => {
      const active = value === option ? "active" : "";
      html += `
        <button
          type="button"
          class="option-button ${active}"
          data-option-value="${escapeHtml(option)}"
        >
          ${escapeHtml(option)}
        </button>
      `;
    });
    html += `</div>`;

    if (needsCustomInput) {
      const customKey = `${step.key}_custom`;
      const customValue = state.wizard.values[customKey] || "";
      html += `
        <div class="input-stack">
          <label for="customValueInput">Введите свой вариант</label>
          <input id="customValueInput" type="text" value="${escapeHtml(customValue)}" placeholder="Введите значение" />
        </div>
      `;
    }
  }

  if (step.type === "input") {
    html += `
      <div class="input-stack">
        <label for="wizardInput">${escapeHtml(step.title)}</label>
        <input
          id="wizardInput"
          type="text"
          value="${escapeHtml(value)}"
          placeholder="${escapeHtml(step.placeholder || "")}"
        />
      </div>
    `;
  }

  if (step.type === "textarea") {
    html += `
      <div class="input-stack">
        <label for="wizardTextarea">${escapeHtml(step.title)}</label>
        <textarea
          id="wizardTextarea"
          rows="5"
          placeholder="${escapeHtml(step.placeholder || "")}"
        >${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  html += `</div>`;
  refs.wizardStepContainer.innerHTML = html;

  refs.wizardBackBtn.disabled = state.wizard.currentStepIndex === 0;
  const isLast = state.wizard.currentStepIndex === steps.length - 1;
  refs.wizardNextBtn.classList.toggle("hidden", isLast);
  refs.wizardSubmitBtn.classList.toggle("hidden", !isLast);

  bindWizardStepEvents();
  bindHideKeyboardOnEnter(refs.wizardStepContainer);
  renderPayloadPreview();
}

function bindWizardStepEvents() {
  const step = getCurrentStep();
  if (!step) return;

  refs.wizardStepContainer.querySelectorAll("[data-option-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.wizard.values[step.key] = btn.dataset.optionValue;

      if (btn.dataset.optionValue !== "Свой вариант") {
        delete state.wizard.values[`${step.key}_custom`];
      }

      if (step.key === "dealType") {
        state.wizard.values = { dealType: state.wizard.values.dealType };
        state.wizard.currentStepIndex = 0;
      }

      if (step.key === "propertyType") {
        state.wizard.values = {
          dealType: state.wizard.values.dealType,
          propertyType: state.wizard.values.propertyType
        };
        state.wizard.currentStepIndex = Math.min(state.wizard.currentStepIndex, getCurrentSteps().length - 1);
      }

      renderWizard();
    });
  });

  const customInput = byId("customValueInput");
  if (customInput) {
    customInput.addEventListener("input", (e) => {
      state.wizard.values[`${step.key}_custom`] = e.target.value;
      renderPayloadPreview();
    });
  }

  const input = byId("wizardInput");
  if (input) {
    input.addEventListener("input", (e) => {
      state.wizard.values[step.key] = e.target.value;
      renderPayloadPreview();
    });
  }

  const textarea = byId("wizardTextarea");
  if (textarea) {
    textarea.addEventListener("input", (e) => {
      state.wizard.values[step.key] = e.target.value;
      renderPayloadPreview();
    });
  }
}

function getResolvedWizardValues() {
  const result = { ...state.wizard.values };

  Object.keys(result).forEach((key) => {
    if (result[key] === "Свой вариант") {
      const custom = result[`${key}_custom`];
      if (custom) result[key] = custom;
    }
  });

  Object.keys(result).forEach((key) => {
    if (key.endsWith("_custom")) delete result[key];
  });

  return result;
}

function validateCurrentStep() {
  const step = getCurrentStep();
  if (!step) return true;

  const values = state.wizard.values;
  const value = values[step.key];

  if (!step.required) return true;

  if (step.type === "options") {
    if (!value) return false;
    if (value === "Свой вариант") {
      return Boolean(String(values[`${step.key}_custom`] || "").trim());
    }
    return true;
  }

  return Boolean(String(value || "").trim());
}

function buildListingPayloadFromWizard() {
  const payloadJson = getResolvedWizardValues();

  return {
    ...getBasePayload("create-listing"),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payloadJson
  };
}

function renderPayloadPreview() {
  if (!refs.listingPayloadPreview) return;
  refs.listingPayloadPreview.textContent = JSON.stringify(buildListingPayloadFromWizard(), null, 2);
}

function resetWizard() {
  state.wizard.currentStepIndex = 0;
  state.wizard.values = {};
  if (refs.wizardStatus) refs.wizardStatus.textContent = "";
  renderWizard();
}

function goNextStep() {
  hideKeyboard();

  if (!validateCurrentStep()) {
    if (refs.wizardStatus) refs.wizardStatus.textContent = "Пожалуйста, заполните текущий шаг.";
    return;
  }

  if (refs.wizardStatus) refs.wizardStatus.textContent = "";
  const steps = getCurrentSteps();

  if (state.wizard.currentStepIndex < steps.length - 1) {
    state.wizard.currentStepIndex += 1;
    renderWizard();
  }
}

function goBackStep() {
  hideKeyboard();

  if (refs.wizardStatus) refs.wizardStatus.textContent = "";
  if (state.wizard.currentStepIndex > 0) {
    state.wizard.currentStepIndex -= 1;
    renderWizard();
  }
}

async function submitWizard() {
  hideKeyboard();

  if (!validateCurrentStep()) {
    if (refs.wizardStatus) refs.wizardStatus.textContent = "Пожалуйста, заполните текущий шаг.";
    return;
  }

  if (refs.wizardStatus) refs.wizardStatus.textContent = "Создание объявления...";
  const body = buildListingPayloadFromWizard();

  try {
    const result = await postJson(body);

    if (result?.item) {
      state.listings.unshift(result.item);
    } else {
      state.listings.unshift({
        id: body.id,
        createdAt: body.createdAt,
        title: buildAutoTitle(body.payloadJson),
        payloadJson: body.payloadJson
      });
    }

    renderListings();
    if (refs.listingStatus) refs.listingStatus.textContent = "Объявление создано.";
    if (refs.wizardStatus) refs.wizardStatus.textContent = "Объявление успешно создано.";
    resetWizard();
    goToListingsList();
  } catch (error) {
    if (refs.wizardStatus) refs.wizardStatus.textContent = `Ошибка: ${error.message}`;
  }
}

function bindWizardNavigation() {
  if (refs.openCreateListingBtn) {
    refs.openCreateListingBtn.addEventListener("click", () => {
      resetWizard();
      goToListingCreate();
    });
  }

  if (refs.backToListingsBtn) {
    refs.backToListingsBtn.addEventListener("click", () => {
      hideKeyboard();
      goToListingsList();
    });
  }

  if (refs.wizardBackBtn) refs.wizardBackBtn.addEventListener("click", goBackStep);
  if (refs.wizardNextBtn) refs.wizardNextBtn.addEventListener("click", goNextStep);
  if (refs.wizardSubmitBtn) refs.wizardSubmitBtn.addEventListener("click", submitWizard);
}

function bindPlansForm() {
  if (!refs.plansForm) return;

  bindHideKeyboardOnEnter(refs.plansForm);

  refs.plansForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideKeyboard();
    refs.plansStatus.textContent = "Отправка планировки...";

    const file = byId("planFile")?.files?.[0];
    const prompt = byId("planPrompt")?.value?.trim() || "";

    const body = {
      ...getBasePayload("generate-interior"),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payloadJson: {
        fileName: file?.name || "",
        prompt
      }
    };

    try {
      await postJson(body);
      refs.plansStatus.textContent = "Планировка отправлена.";
      refs.plansForm.reset();
    } catch (error) {
      refs.plansStatus.textContent = `Ошибка: ${error.message}`;
    }
  });
}

function bindEnhanceForm() {
  if (!refs.enhanceForm) return;

  bindHideKeyboardOnEnter(refs.enhanceForm);

  refs.enhanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideKeyboard();
    refs.enhanceStatus.textContent = "Отправка фото...";

    const file = byId("enhanceFile")?.files?.[0];
    const prompt = byId("enhancePrompt")?.value?.trim() || "";

    const body = {
      ...getBasePayload("enhance-photo"),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payloadJson: {
        fileName: file?.name || "",
        prompt
      }
    };

    try {
      await postJson(body);
      refs.enhanceStatus.textContent = "Фото отправлено.";
      refs.enhanceForm.reset();
    } catch (error) {
      refs.enhanceStatus.textContent = `Ошибка: ${error.message}`;
    }
  });
}

function bindBottomNav() {
  refs.bottomNavItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      hideKeyboard();
      goToMainScreen(btn.dataset.screen);
    });
  });
}

function bindHistoryNavigation() {
  window.addEventListener("popstate", () => {
    const { screen, sub } = getUrlState();

    switchSection(screen);

    if (screen === "listings") {
      if (sub === "create") {
        showListingCreateScreen();
      } else {
        showListingsListScreen();
      }
    }
  });

  if (tg?.BackButton) {
    tg.BackButton.onClick(() => {
      if (state.appScreen === "listings" && state.listingSubScreen === "create") {
        window.history.back();
        return;
      }

      if (state.appScreen !== "listings") {
        goToMainScreen("listings");
      }
    });
  }
}

function init() {
  const { screen, sub } = getUrlState();

  bindBottomNav();
  bindWizardNavigation();
  bindPlansForm();
  bindEnhanceForm();
  bindHistoryNavigation();

  renderListings();
  renderWizard();
  loadListings();

  switchSection(screen);

  if (screen === "listings") {
    if (sub === "create") {
      showListingCreateScreen();
    } else {
      showListingsListScreen();
    }
  }

  updateUrl(screen, sub, true);
}

document.addEventListener("DOMContentLoaded", init);