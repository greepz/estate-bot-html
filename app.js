const WEBHOOKS = {
  createListing: "https://your-activepieces-instance.com/webhooks/create-listing",
  listListings: "https://your-activepieces-instance.com/webhooks/listings",
  deleteListing: "https://your-activepieces-instance.com/webhooks/delete-listing",
  generateInterior: "https://your-activepieces-instance.com/webhooks/generate-interior",
  enhancePhoto: "https://your-activepieces-instance.com/webhooks/enhance-photo"
};

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
  listings: [
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: "2-комнатная квартира, Москва",
      payloadJson: {
        title: "2-комнатная квартира, Москва",
        location: "Москва, ул. Ленина, 10",
        infrastructure: "Школы, магазины, метро, парк",
        characteristics: "2 комнаты, 58 м², евроремонт, лоджия",
        legal: "1 собственник, без обременений"
      }
    }
  ]
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

function buildListingPayloadFromForm() {
  const formData = new FormData(refs.listingForm);
  return {
    userId: currentUser.id,
    route: "create-listing",
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

    card.innerHTML = `
      <div class="listing-item-header">
        <div>
          <div class="listing-title">${escapeHtml(item.title || "Без названия")}</div>
          <div class="meta">ID: ${escapeHtml(item.id)}</div>
          <div class="meta">Создано: ${escapeHtml(new Date(item.createdAt).toLocaleString("ru-RU"))}</div>
        </div>
        <button class="btn btn-danger" data-id="${escapeHtml(item.id)}">Удалить</button>
      </div>
      <pre class="json-box">${escapeHtml(JSON.stringify(item.payloadJson, null, 2))}</pre>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function postJson(url, body) {
  const response = await fetch(url, {
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

refs.listingForm.addEventListener("input", renderPayloadPreview);
refs.listingForm.addEventListener("reset", () => {
  requestAnimationFrame(renderPayloadPreview);
  refs.listingStatus.textContent = "";
});

refs.listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.listingStatus.textContent = "Отправка объявления...";

  const body = buildListingPayloadFromForm();

  try {
    // Для production используйте webhook:
    // await postJson(WEBHOOKS.createListing, body);

    state.listings.unshift({
      id: body.id,
      createdAt: body.createdAt,
      title: body.payloadJson.title || "Новое объявление",
      payloadJson: body.payloadJson
    });

    refs.listingStatus.textContent = "Объявление отправлено в webhook и сохранено.";
    refs.listingForm.reset();
    renderListings();
    renderPayloadPreview();
  } catch (error) {
    refs.listingStatus.textContent = `Ошибка: ${error.message}`;
  }
});

async function deleteListing(id) {
  try {
    // await postJson(WEBHOOKS.deleteListing, {
    //   userId: currentUser.id,
    //   route: "delete-listing",
    //   id
    // });

    state.listings = state.listings.filter((item) => item.id !== id);
    renderListings();
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
    route: "generate-interior",
    userId: currentUser.id,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payloadJson: {
      fileName: file?.name || "",
      prompt
    }
  };

  try {
    // await postJson(WEBHOOKS.generateInterior, body);
    refs.plansStatus.textContent = "Планировка отправлена в webhook.";
    refs.plansForm.reset();
  } catch (error) {
    refs.plansStatus.textContent = `Ошибка: ${error.message}`;
  }
});

refs.enhanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.enhanceStatus.textContent = "Отправка фото на улучшение...";

  const file = document.getElementById("enhanceFile").files[0];
  const prompt = document.getElementById("enhancePrompt").value.trim();

  const body = {
    route: "enhance-photo",
    userId: currentUser.id,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payloadJson: {
      fileName: file?.name || "",
      prompt
    }
  };

  try {
    // await postJson(WEBHOOKS.enhancePhoto, body);
    refs.enhanceStatus.textContent = "Фото отправлено в webhook.";
    refs.enhanceForm.reset();
  } catch (error) {
    refs.enhanceStatus.textContent = `Ошибка: ${error.message}`;
  }
});

renderPayloadPreview();
renderListings();