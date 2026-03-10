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
  listings: []
};

function byId(id) {
  return document.getElementById(id);
}

const refs = {
  userName: byId("userName"),
  userIdBadge: byId("userIdBadge"),
  sections: [...document.querySelectorAll(".section")],
  listingForm: byId("listingForm"),
  listingStatus: byId("listingStatus"),
  listingPayloadPreview: byId("listingPayloadPreview"),
  listingsList: byId("listingsList"),
  listingsEmpty: byId("listingsEmpty"),
  plansForm: byId("plansForm"),
  plansStatus: byId("plansStatus"),
  enhanceForm: byId("enhanceForm"),
  enhanceStatus: byId("enhanceStatus")
};

if (refs.userName) refs.userName.textContent = currentUser.firstName;
if (refs.userIdBadge) refs.userIdBadge.textContent = `userId: ${currentUser.id}`;

function escapeHtml(value) {
  return String(value)
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

  if (v === "plans" || v === "plan" || v === "layout" || v === "layouts") {
    return "plans";
  }

  if (v === "enhance" || v === "photo" || v === "improve" || v === "improve-photo") {
    return "enhance";
  }

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

  console.log("Active screen:", normalized);
}

function buildListingPayloadFromForm() {
  const formData = new FormData(refs.listingForm);

  return {
    ...getBasePayload("create-listing"),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payloadJson: {
      title: String(formData.get("title") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      infrastructure: String(formData.get("infrastructure") || "").trim(),
      characteristics: String(formData.get("characteristics") || "").trim(),
      legal: String(formData.get("legal") || "").trim()
    }
  };
}

function renderPayloadPreview() {
  if (!refs.listingPayloadPreview || !refs.listingForm) return;
  refs.listingPayloadPreview.textContent = JSON.stringify(buildListingPayloadFromForm(), null, 2);
}

function renderListings() {
  if (!refs.listingsList || !refs.listingsEmpty) return;

  refs.listingsList.innerHTML = "";

  const hasItems = state.listings.length > 0;
  refs.listingsEmpty.style.display = hasItems ? "none" : "block";

  state.listings.forEach((item) => {
    const card = document.createElement("div");
    card.className = "listing-item";

    const title = item.title || item.payloadJson?.title || "Без названия";
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

function bindListingForm() {
  if (!refs.listingForm) return;

  refs.listingForm.addEventListener("input", renderPayloadPreview);

  refs.listingForm.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      renderPayloadPreview();
      if (refs.listingStatus) refs.listingStatus.textContent = "";
    });
  });

  refs.listingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (refs.listingStatus) refs.listingStatus.textContent = "Отправка объявления...";

    const body = buildListingPayloadFromForm();

    try {
      const result = await postJson(body);

      if (result?.item) {
        state.listings.unshift(result.item);
      } else {
        state.listings.unshift({
          id: body.id,
          createdAt: body.createdAt,
          title: body.payloadJson.title || "Новое объявление",
          payloadJson: body.payloadJson
        });
      }

      renderListings();
      if (refs.listingStatus) refs.listingStatus.textContent = "Объявление создано.";
      refs.listingForm.reset();
      renderPayloadPreview();
    } catch (error) {
      if (refs.listingStatus) refs.listingStatus.textContent = `Ошибка: ${error.message}`;
    }
  });
}

function bindPlansForm() {
  if (!refs.plansForm) return;

  refs.plansForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (refs.plansStatus) refs.plansStatus.textContent = "Отправка планировки...";

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
      if (refs.plansStatus) refs.plansStatus.textContent = "Планировка отправлена.";
      refs.plansForm.reset();
    } catch (error) {
      if (refs.plansStatus) refs.plansStatus.textContent = `Ошибка: ${error.message}`;
    }
  });
}

function bindEnhanceForm() {
  if (!refs.enhanceForm) return;

  refs.enhanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (refs.enhanceStatus) refs.enhanceStatus.textContent = "Отправка фото...";

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
      if (refs.enhanceStatus) refs.enhanceStatus.textContent = "Фото отправлено.";
      refs.enhanceForm.reset();
    } catch (error) {
      if (refs.enhanceStatus) refs.enhanceStatus.textContent = `Ошибка: ${error.message}`;
    }
  });
}

function init() {
  const screen = getScreenFromUrl();

  console.log("window.location.href =", window.location.href);
  console.log("Detected screen =", screen);

  switchSection(screen);
  bindListingForm();
  bindPlansForm();
  bindEnhanceForm();
  renderPayloadPreview();
  renderListings();

  if (screen === "listings") {
    loadListings();
  }
}

document.addEventListener("DOMContentLoaded", init);