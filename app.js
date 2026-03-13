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
  }
};

function byId(id) {
  return document.getElementById(id);
}

const refs = {
  userName: byId("userName"),
  userIdBadge: byId("userIdBadge"),
  sections: [...document.querySelectorAll(".section")],

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
if (refs.userIdBadge) refs.userIdBadge.textContent = `userId: ${currentUser.id}`;

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

  if (v === "plans" || v === "plan" || v === "layout" || v === "layouts") return "plans";
  if (v === "enhance" || v === "photo" || v === "improve" || v === "improve-photo") return "enhance";

  return "listings";
}

function getScreenFromUrl() {
  const url = new URL(window.location.href);

  const queryScreen = url.searchParams.get("screen");
  if (queryScreen) return normalizeScreen(queryScreen);

  const hash = window.location.hash.replace("#", "").trim();
  if (hash) return normalizeScreen(hash);

  return "listings";
}

function switchSection(sectionKey) {
  const normalized = normalizeScreen(sectionKey);

  refs.sections.forEach((section) => {
    const isActive = section.id === `section-${normalized}`;
    section.classList.toggle("active", isActive);
    section.style.display = isActive ? "block" : "none";
  });
}

function showListingsListScreen() {
  if (refs.listingsListScreen) refs.listingsListScreen.classList.remove("hidden");
  if (refs.listingCreateScreen) refs.listingCreateScreen.classList.add("hidden");
}

function showListingCreateScreen() {
  if (refs.listingsListScreen) refs.listingsListScreen.classList.add("hidden");
  if (refs.listingCreateScreen) refs.listingCreateScreen.classList.remove("hidden");
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
      title: "Шаг 1. Тип сделки",
      hint: "Продажа или аренда.",
      type: "options",
      options: ["Продажа", "Аренда"],
      required: true
    },
    {
      key: "propertyType",
      title: "Шаг 2. Тип недвижимости",
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
      { key: "market", title: "Шаг 3. Рынок", type: "options", options: ["Новостройка", "Вторичка", "Свой вариант"], required: true },
      { key: "objectClass", title: "Шаг 4. Класс объекта недвижимости", type: "options", options: ["Эконом", "Комфорт", "Элитное", "Свой вариант"], required: true },
      { key: "rooms", title: "Шаг 5. Количество комнат", type: "options", options: ["Студия", "1", "2", "3", "4+", "Свой вариант"], required: true },
      { key: "mortgage", title: "Шаг 6. Подходит для ипотеки?", type: "options", options: ["Да", "Нет", "Свой вариант"], required: true },
      { key: "area", title: "Шаг 7. Площадь объекта", type: "input", placeholder: "Например: 58", required: true },
      { key: "kitchenArea", title: "Шаг 8. Площадь кухни", type: "input", placeholder: "Например: 12", required: true },
      { key: "floor", title: "Шаг 9. Этаж расположения", type: "input", placeholder: "Например: 8", required: true },
      { key: "floorsTotal", title: "Шаг 10. Этажность здания", type: "input", placeholder: "Например: 17", required: true },
      { key: "bathroom", title: "Шаг 11. Санузел", type: "options", options: ["Совмещенный", "Раздельный", "Свой вариант"], required: true },
      { key: "windows", title: "Шаг 12. Окна", type: "options", options: ["Во двор", "На улицу", "На солнечную сторону", "Разное", "Свой вариант"], required: true },
      { key: "elevator", title: "Шаг 13. Лифт", type: "options", options: ["Нет", "Пассажирский", "Грузовой", "Оба", "Свой вариант"], required: true },
      { key: "parking", title: "Шаг 14. Парковка", type: "options", options: ["Подземная", "Надземная", "Многоуровневая", "Открытая во дворе", "За шлагбаумом", "Свой вариант"], required: true },
      { key: "repair", title: "Шаг 15. Ремонт", type: "options", options: ["Требуется", "Евро", "Коммерческий", "Дизайнерский", "Свой вариант"], required: true },
      { key: "layoutRooms", title: "Шаг 16. Планировка комнат", type: "options", options: ["Изолированные", "Смежные", "И то и другое", "Свой вариант"], required: true },
      { key: "balcony", title: "Шаг 17. Балкон/Лоджия", type: "options", options: ["Нет", "Балкон", "Лоджия", "Несколько", "Свой вариант"], required: true },
      { key: "ceilingHeight", title: "Шаг 18. Высота потолков", type: "input", placeholder: "Можно пропустить", required: false },
      { key: "location", title: "Шаг 19. Локация", type: "textarea", placeholder: "Опишите местоположение объекта. Адрес", required: true },
      { key: "infrastructure", title: "Шаг 20. Ближайшие точки инфраструктуры", type: "textarea", placeholder: "Школы, сады, остановки, парки, достопримечательности", required: true },
      { key: "legal", title: "Шаг 21. Юридические особенности объекта", type: "textarea", placeholder: "Маткапитал, ипотека, аресты, готовность к заселению", required: true },
      { key: "comment", title: "Шаг 22. Свободный комментарий", type: "textarea", placeholder: "Детали планировки, состояние, окружение и прочее", required: false }
    ];
  }

  if (propertyType === "Квартира" && dealType === "Аренда") {
    return [
      ...base,
      { key: "market", title: "Шаг 3. Рынок", type: "options", options: ["Новостройка", "Вторичка", "Свой вариант"], required: true },
      { key: "objectClass", title: "Шаг 4. Класс объекта недвижимости", type: "options", options: ["Эконом", "Комфорт", "Элитное", "Свой вариант"], required: true },
      { key: "rooms", title: "Шаг 5. Количество комнат", type: "options", options: ["Студия", "1", "2", "3", "4+", "Свой вариант"], required: true },
      { key: "area", title: "Шаг 6. Площадь объекта", type: "input", placeholder: "Например: 42", required: true },
      { key: "kitchenArea", title: "Шаг 7. Площадь кухни", type: "input", placeholder: "Например: 9", required: false },
      { key: "floor", title: "Шаг 8. Этаж расположения", type: "input", placeholder: "Например: 5", required: true },
      { key: "floorsTotal", title: "Шаг 9. Этажность здания", type: "input", placeholder: "Например: 12", required: true },
      { key: "bathroom", title: "Шаг 10. Санузел", type: "options", options: ["Совмещенный", "Раздельный", "Свой вариант"], required: true },
      { key: "windows", title: "Шаг 11. Окна", type: "options", options: ["Во двор", "На улицу", "На солнечную сторону", "Разное", "Свой вариант"], required: false },
      { key: "elevator", title: "Шаг 12. Лифт", type: "options", options: ["Нет", "Пассажирский", "Грузовой", "Оба", "Свой вариант"], required: false },
      { key: "parking", title: "Шаг 13. Парковка", type: "options", options: ["Подземная", "Надземная", "Открытая во дворе", "За шлагбаумом", "Свой вариант"], required: false },
      { key: "repair", title: "Шаг 14. Ремонт", type: "options", options: ["Требуется", "Евро", "Дизайнерский", "Свой вариант"], required: true },
      { key: "balcony", title: "Шаг 15. Балкон/Лоджия", type: "options", options: ["Нет", "Балкон", "Лоджия", "Несколько", "Свой вариант"], required: false },
      { key: "pets", title: "Шаг 16. Можно с животными?", type: "options", options: ["Да", "Нет", "По договоренности", "Свой вариант"], required: false },
      { key: "children", title: "Шаг 17. Можно с детьми?", type: "options", options: ["Да", "Нет", "По договоренности", "Свой вариант"], required: false },
      { key: "furniture", title: "Шаг 18. Мебель и техника", type: "textarea", placeholder: "Что есть в квартире", required: false },
      { key: "location", title: "Шаг 19. Локация", type: "textarea", placeholder: "Опишите местоположение объекта. Адрес", required: true },
      { key: "infrastructure", title: "Шаг 20. Ближайшие точки инфраструктуры", type: "textarea", placeholder: "Школы, сады, остановки, парки, достопримечательности", required: true },
      { key: "legal", title: "Шаг 21. Условия аренды", type: "textarea", placeholder: "Залог, сроки, коммунальные, заселение", required: true },
      { key: "comment", title: "Шаг 22. Свободный комментарий", type: "textarea", placeholder: "Дополнительные детали", required: false }
    ];
  }

  if (propertyType === "Загородная недвижимость" && dealType === "Продажа") {
    return [
      ...base,
      { key: "estateSubtype", title: "Шаг 3. Тип загородного объекта", type: "options", options: ["Дом", "Коттедж", "Таунхаус", "Дача", "Участок", "Свой вариант"], required: true },
      { key: "objectClass", title: "Шаг 4. Класс объекта", type: "options", options: ["Эконом", "Комфорт", "Бизнес", "Элитное", "Свой вариант"], required: false },
      { key: "area", title: "Шаг 5. Площадь объекта", type: "input", placeholder: "Например: 140", required: true },
      { key: "landArea", title: "Шаг 6. Площадь участка", type: "input", placeholder: "Например: 8 соток", required: true },
      { key: "floorsTotal", title: "Шаг 7. Этажность", type: "input", placeholder: "Например: 2", required: false },
      { key: "rooms", title: "Шаг 8. Количество комнат / помещений", type: "options", options: ["1", "2", "3", "4+", "Свой вариант"], required: false },
      { key: "houseCondition", title: "Шаг 9. Состояние объекта", type: "options", options: ["Требуется ремонт", "Готов к проживанию", "После ремонта", "Свой вариант"], required: true },
      { key: "communications", title: "Шаг 10. Коммуникации", type: "textarea", placeholder: "Газ, вода, электричество, канализация, отопление", required: true },
      { key: "road", title: "Шаг 11. Подъезд и дорога", type: "textarea", placeholder: "Асфальт, грунт, круглогодичный подъезд", required: false },
      { key: "parking", title: "Шаг 12. Парковка / гараж", type: "options", options: ["Нет", "Парковка на участке", "Гараж", "Навес", "Свой вариант"], required: false },
      { key: "mortgage", title: "Шаг 13. Подходит для ипотеки?", type: "options", options: ["Да", "Нет", "Свой вариант"], required: false },
      { key: "location", title: "Шаг 14. Локация", type: "textarea", placeholder: "Поселок, район, ориентиры, адрес", required: true },
      { key: "infrastructure", title: "Шаг 15. Ближайшая инфраструктура", type: "textarea", placeholder: "Магазины, школы, водоемы, лес, остановки", required: true },
      { key: "legal", title: "Шаг 16. Юридические особенности", type: "textarea", placeholder: "Документы на дом и участок, границы, ипотека, обременения", required: true },
      { key: "comment", title: "Шаг 17. Свободный комментарий", type: "textarea", placeholder: "Материал дома, виды, баня, терраса, сад и др.", required: false }
    ];
  }

  if (propertyType === "Загородная недвижимость" && dealType === "Аренда") {
    return [
      ...base,
      { key: "estateSubtype", title: "Шаг 3. Тип загородного объекта", type: "options", options: ["Дом", "Коттедж", "Таунхаус", "Дача", "Свой вариант"], required: true },
      { key: "area", title: "Шаг 4. Площадь объекта", type: "input", placeholder: "Например: 120", required: true },
      { key: "landArea", title: "Шаг 5. Площадь участка", type: "input", placeholder: "Например: 6 соток", required: false },
      { key: "floorsTotal", title: "Шаг 6. Этажность", type: "input", placeholder: "Например: 2", required: false },
      { key: "rooms", title: "Шаг 7. Количество комнат", type: "options", options: ["1", "2", "3", "4+", "Свой вариант"], required: false },
      { key: "houseCondition", title: "Шаг 8. Состояние объекта", type: "options", options: ["Готов к проживанию", "После ремонта", "Свой вариант"], required: true },
      { key: "communications", title: "Шаг 9. Коммуникации", type: "textarea", placeholder: "Отопление, вода, интернет, электричество", required: true },
      { key: "parking", title: "Шаг 10. Парковка / гараж", type: "options", options: ["Нет", "Парковка на участке", "Гараж", "Навес", "Свой вариант"], required: false },
      { key: "seasonality", title: "Шаг 11. Сезонность аренды", type: "options", options: ["Круглый год", "Только лето", "Посуточно", "Долгосрочно", "Свой вариант"], required: true },
      { key: "pets", title: "Шаг 12. Можно с животными?", type: "options", options: ["Да", "Нет", "По договоренности", "Свой вариант"], required: false },
      { key: "location", title: "Шаг 13. Локация", type: "textarea", placeholder: "Поселок, район, ориентиры, адрес", required: true },
      { key: "infrastructure", title: "Шаг 14. Ближайшая инфраструктура", type: "textarea", placeholder: "Магазины, остановки, лес, водоемы, сервисы", required: true },
      { key: "legal", title: "Шаг 15. Условия аренды", type: "textarea", placeholder: "Срок аренды, залог, коммунальные платежи, заселение", required: true },
      { key: "comment", title: "Шаг 16. Свободный комментарий", type: "textarea", placeholder: "Баня, терраса, мангал, охрана, участок", required: false }
    ];
  }

  if (propertyType === "Коммерческая недвижимость" && dealType === "Продажа") {
    return [
      ...base,
      { key: "commercialSubtype", title: "Шаг 3. Тип коммерческого объекта", type: "options", options: ["Офис", "Торговое помещение", "Склад", "Производство", "Помещение свободного назначения", "Свой вариант"], required: true },
      { key: "objectClass", title: "Шаг 4. Класс объекта", type: "options", options: ["Эконом", "Комфорт", "Бизнес", "Премиум", "Свой вариант"], required: false },
      { key: "area", title: "Шаг 5. Площадь объекта", type: "input", placeholder: "Например: 215", required: true },
      { key: "floor", title: "Шаг 6. Этаж расположения", type: "input", placeholder: "Например: 1", required: false },
      { key: "floorsTotal", title: "Шаг 7. Этажность здания", type: "input", placeholder: "Например: 8", required: false },
      { key: "repair", title: "Шаг 8. Состояние / ремонт", type: "options", options: ["Требуется", "Офисный", "Коммерческий", "Дизайнерский", "Свой вариант"], required: true },
      { key: "entrance", title: "Шаг 9. Вход", type: "options", options: ["Общий", "Отдельный", "Несколько входов", "Свой вариант"], required: true },
      { key: "parking", title: "Шаг 10. Парковка", type: "options", options: ["Нет", "Гостевая", "Подземная", "Наземная", "Свой вариант"], required: false },
      { key: "ceilingHeight", title: "Шаг 11. Высота потолков", type: "input", placeholder: "Можно пропустить", required: false },
      { key: "power", title: "Шаг 12. Электрическая мощность", type: "input", placeholder: "Например: 30 кВт", required: false },
      { key: "communications", title: "Шаг 13. Коммуникации / оснащение", type: "textarea", placeholder: "Вентиляция, кондиционирование, отопление, интернет, вода", required: false },
      { key: "location", title: "Шаг 14. Локация", type: "textarea", placeholder: "Адрес, район, ориентиры, деловая активность", required: true },
      { key: "infrastructure", title: "Шаг 15. Окружение и трафик", type: "textarea", placeholder: "Транспорт, парковки, соседние бизнесы, пешеходный трафик", required: true },
      { key: "legal", title: "Шаг 16. Юридические особенности", type: "textarea", placeholder: "Собственность, арендаторы, обременения, документы", required: true },
      { key: "comment", title: "Шаг 17. Свободный комментарий", type: "textarea", placeholder: "Назначение, доходность, планировка, витрины, складская зона", required: false }
    ];
  }

  if (propertyType === "Коммерческая недвижимость" && dealType === "Аренда") {
    return [
      ...base,
      { key: "commercialSubtype", title: "Шаг 3. Тип коммерческого объекта", type: "options", options: ["Офис", "Торговое помещение", "Склад", "Производство", "Помещение свободного назначения", "Свой вариант"], required: true },
      { key: "area", title: "Шаг 4. Площадь объекта", type: "input", placeholder: "Например: 90", required: true },
      { key: "floor", title: "Шаг 5. Этаж расположения", type: "input", placeholder: "Например: 1", required: false },
      { key: "floorsTotal", title: "Шаг 6. Этажность здания", type: "input", placeholder: "Например: 4", required: false },
      { key: "repair", title: "Шаг 7. Состояние / ремонт", type: "options", options: ["Требуется", "Офисный", "Коммерческий", "Дизайнерский", "Свой вариант"], required: true },
      { key: "entrance", title: "Шаг 8. Вход", type: "options", options: ["Общий", "Отдельный", "Несколько входов", "Свой вариант"], required: true },
      { key: "parking", title: "Шаг 9. Парковка", type: "options", options: ["Нет", "Гостевая", "Подземная", "Наземная", "Свой вариант"], required: false },
      { key: "power", title: "Шаг 10. Электрическая мощность", type: "input", placeholder: "Например: 15 кВт", required: false },
      { key: "communications", title: "Шаг 11. Коммуникации / оснащение", type: "textarea", placeholder: "Вода, отопление, кондиционирование, вентиляция, интернет", required: false },
      { key: "location", title: "Шаг 12. Локация", type: "textarea", placeholder: "Адрес, район, ориентиры", required: true },
      { key: "infrastructure", title: "Шаг 13. Окружение и трафик", type: "textarea", placeholder: "Транспорт, парковки, соседи, поток клиентов", required: true },
      { key: "legal", title: "Шаг 14. Условия аренды", type: "textarea", placeholder: "Срок аренды, коммунальные, обеспечительный платеж, индексация", required: true },
      { key: "comment", title: "Шаг 15. Свободный комментарий", type: "textarea", placeholder: "Под какой бизнес подходит помещение", required: false }
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

  refs.wizardStepLabel.textContent = step.title;
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
  if (refs.wizardStatus) refs.wizardStatus.textContent = "";
  if (state.wizard.currentStepIndex > 0) {
    state.wizard.currentStepIndex -= 1;
    renderWizard();
  }
}

async function submitWizard() {
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
    showListingsListScreen();
  } catch (error) {
    if (refs.wizardStatus) refs.wizardStatus.textContent = `Ошибка: ${error.message}`;
  }
}

function bindWizardNavigation() {
  if (refs.openCreateListingBtn) {
    refs.openCreateListingBtn.addEventListener("click", () => {
      showListingCreateScreen();
      resetWizard();
    });
  }

  if (refs.backToListingsBtn) {
    refs.backToListingsBtn.addEventListener("click", () => {
      showListingsListScreen();
    });
  }

  if (refs.wizardBackBtn) refs.wizardBackBtn.addEventListener("click", goBackStep);
  if (refs.wizardNextBtn) refs.wizardNextBtn.addEventListener("click", goNextStep);
  if (refs.wizardSubmitBtn) refs.wizardSubmitBtn.addEventListener("click", submitWizard);
}

function bindPlansForm() {
  if (!refs.plansForm) return;

  refs.plansForm.addEventListener("submit", async (event) => {
    event.preventDefault();
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

  refs.enhanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
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

function init() {
  const screen = getScreenFromUrl();

  switchSection(screen);
  bindWizardNavigation();
  bindPlansForm();
  bindEnhanceForm();
  renderListings();

  if (screen === "listings") {
    showListingsListScreen();
    renderWizard();
    loadListings();
  }
}

document.addEventListener("DOMContentLoaded", init);