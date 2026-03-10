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

const refs = {
  sidebar: document.getElementById("sidebar"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  userName: document.getElementById("userName"),
  userIdBadge: document.getElementById("userIdBadge"),
  menuItems: [...document.querySelectorAll(".menu-item")],
  sections: [...document.querySelectorAll(".section")],
  listingForm: document.getElementById("listingForm"),
  listingStatus: document.getElementById("listingStatus"),
  listingPayloadPreview: document.getElementById("listingPayloadPreview"),
  listingsList: document.getElementById("listingsList"),
  listingsEmpty: document.getElementById("listingsEmpty"),
  plansForm: document.getElementById("plansForm"),
  plansStatus: document.getElementById("plansStatus"),
  enhanceForm: document.getElementById("enhanceForm"),
  enhanceStatus: document.getElementById("enhanceStatus")
};

refs.userName.textContent = currentUser.firstName;
refs.userIdBadge.textContent = `userId: ${currentUser.id}`;

function switchSection(sectionKey) {
  refs.menuItems.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === sectionKey);
  });

  refs.sections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionKey}`);
  });

  refs.sidebar.classList.remove("open");
}

refs.menuItems.forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

refs.mobileMenuBtn.addEventListener("click", () => {
  refs.sidebar.classList.toggle("open");
});

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
  const payload = buildListingPayloadFromForm();
  refs.listingPayloadPreview.textContent = JSON.stringify(payload, null, 2);
}

function renderListings() {
  refs.listingsList.innerHTML = "";

  const hasItems = state.listings.length > 0;
  refs.listingsEmpty.style.display = hasItems ? "none" : "block";

  state.listings.forEach((item) => {
    const card = document.createElement("div");
    card.className = "listing-item";

    const title =
      item.title ||
      item.payloadJson?.title ||
      "Без названия";

    const createdAt = item.createdAt
      ? new Date(item.createdAt).toLocaleString("ru-RU")
      : "";

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
      const id = btn.dataset.id;
      await deleteListing(id);
    });
  });
}

async function loadListings() {
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

refs.listingForm.addEventListener("input", renderPayloadPreview);

refs.listingForm.addEventListener("reset", () => {
  requestAnimationFrame(() => {
    renderPayloadPreview();
    refs.listingStatus.textContent = "";
  });
});

refs.listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.listingStatus.textContent = "Отправка объявления...";

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
    refs.listingStatus.textContent = "Объявление создано.";
    refs.listingForm.reset();
    renderPayloadPreview();
  } catch (error) {
    refs.listingStatus.textContent = `Ошибка: ${error.message}`;
  }
});

async function deleteListing(id) {
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

refs.plansForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.plansStatus.textContent = "Отправка планировки...";

  const file = document.getElementById("planFile").files[0];
  const prompt = document.getElementById("planPrompt").value.trim();

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

refs.enhanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.enhanceStatus.textContent = "Отправка фото...";

  const file = document.getElementById("enhanceFile").files[0];
  const prompt = document.getElementById("enhancePrompt").value.trim();

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

renderPayloadPreview();
renderListings();
loadListings();