(() => {
  const state = {
    people: [{ id: 1, name: "You", color: "#e9f2ff" }, { id: 2, name: "Alex", color: "#fceee8" }],
    items: [], nextPersonId: 3, nextItemId: 1, currency: "INR", symbol: "₹", locale: "en-IN", lastResult: null,
  };
  const colors = ["#e9f2ff", "#fceee8", "#eaf0fa", "#f8f1dd", "#f1eafa", "#e6f3f1"];
  const peopleList = document.querySelector("#peopleList");
  const itemsList = document.querySelector("#itemsList");
  const symbol = () => state.symbol;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatMoney = (value) => `${symbol()}${Number(value || 0).toLocaleString(state.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function renderPeople() {
    peopleList.innerHTML = state.people.map((person, index) => `<div class="person-chip"><span class="avatar" style="background:${person.color}">${escapeHtml((person.name || "?").trim().slice(0, 1).toUpperCase())}</span><input aria-label="Person name" maxlength="48" value="${escapeHtml(person.name)}" data-person-name="${person.id}"><button class="remove-person" data-remove-person="${person.id}" aria-label="Remove ${escapeHtml(person.name)}" ${state.people.length === 1 ? "disabled" : ""}>×</button></div>`).join("");
    document.querySelector("#peopleCount").textContent = `${state.people.length} ${state.people.length === 1 ? "person" : "people"}`;
    renderItems();
  }

  function renderItems() {
    document.querySelector("#itemCount").textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
    itemsList.innerHTML = state.items.map((item, index) => `<div class="item-row" data-item="${item.id}"><input class="field" placeholder="e.g. Masala dosa" aria-label="Item name" value="${escapeHtml(item.name)}" data-field="name"><input class="field field-number" type="number" min="0" step="1" aria-label="Quantity" value="${escapeHtml(item.quantity)}" data-field="quantity"><input class="field field-number" type="number" min="0" step="0.01" placeholder="0.00" aria-label="Unit price" value="${escapeHtml(item.price)}" data-field="price"><button class="remove-item" data-remove-item="${item.id}" aria-label="Remove item">×</button><div class="assign-wrap"><span class="assign-label">Ordered by</span>${state.people.map(person => `<button type="button" class="assign-chip ${item.assignedTo.includes(person.id) ? "selected" : ""}" data-assign="${item.id}" data-person="${person.id}" aria-pressed="${item.assignedTo.includes(person.id)}">${escapeHtml(person.name || "Unnamed")}</button>`).join("")}</div></div>`).join("");
  }

  document.querySelector("#addPerson").addEventListener("click", () => {
    const person = { id: state.nextPersonId++, name: `Person ${state.people.length + 1}`, color: colors[(state.people.length) % colors.length] };
    state.people.push(person); renderPeople();
  });
  peopleList.addEventListener("input", event => {
    const id = Number(event.target.dataset.personName); if (!id) return;
    const person = state.people.find(entry => entry.id === id); person.name = event.target.value;
    event.target.previousElementSibling.textContent = (person.name.trim()[0] || "?").toUpperCase();
    const active = document.activeElement; renderItems();
    if (active?.dataset.personName) { const input = peopleList.querySelector(`[data-person-name="${id}"]`); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }
  });
  peopleList.addEventListener("click", event => {
    const id = Number(event.target.dataset.removePerson); if (!id || state.people.length < 2) return;
    state.people = state.people.filter(person => person.id !== id);
    state.items.forEach(item => { item.assignedTo = item.assignedTo.filter(personId => personId !== id); }); renderPeople();
  });
  document.querySelector("#addItem").addEventListener("click", () => {
    state.items.push({ id: state.nextItemId++, name: "", quantity: "1", price: "", assignedTo: [state.people[0]?.id].filter(Boolean) }); renderItems();
    itemsList.querySelector(".item-row:last-child input")?.focus();
  });
  itemsList.addEventListener("input", event => {
    const row = event.target.closest("[data-item]"); if (!row || !event.target.dataset.field) return;
    const item = state.items.find(entry => entry.id === Number(row.dataset.item)); if (item) item[event.target.dataset.field] = event.target.value;
  });
  itemsList.addEventListener("click", event => {
    const removeId = Number(event.target.dataset.removeItem);
    if (removeId) { state.items = state.items.filter(item => item.id !== removeId); renderItems(); return; }
    const itemId = Number(event.target.dataset.assign); const personId = Number(event.target.dataset.person);
    if (!itemId || !personId) return;
    const item = state.items.find(entry => entry.id === itemId);
    item.assignedTo = item.assignedTo.includes(personId) ? item.assignedTo.filter(id => id !== personId) : [...item.assignedTo, personId]; renderItems();
  });

  const toast = (message) => { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2800); };
  document.querySelector("#calculate").addEventListener("click", async event => {
    const button = event.currentTarget;
    const people = state.people.map(person => person.name.trim());
    if (people.some(name => !name)) { toast("Give everyone a name before calculating."); return; }
    button.disabled = true; button.textContent = "Adding it all up…";
    try {
      const response = await fetch("/api/split", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ people, gstRate: document.querySelector("#gstRate").value, items: state.items.map(item => ({ ...item, assignedTo: item.assignedTo.map(id => state.people.find(person => person.id === id)?.name).filter(Boolean) })) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not calculate the split.");
      renderResults(result);
    } catch (error) { toast(error.message || "Something went wrong. Try again."); }
    finally { button.disabled = false; button.innerHTML = 'Calculate the split <span>↗</span>'; }
  });

  function renderResults(result) {
    state.lastResult = result;
    const total = Number(result.total).toFixed(2).split(".");
    document.querySelector("#grandTotal").innerHTML = `${symbol()}${Number(total[0]).toLocaleString("en-IN")}<small>.${total[1]}</small>`;
    document.querySelector("#subtotal").textContent = formatMoney(result.subtotal);
    document.querySelector("#gstTotal").textContent = formatMoney(result.gst);
    document.querySelector("#gstLabel").textContent = `(${Number(result.gstRate)}%)`;
    const palette = colors;
    document.querySelector("#sharesList").innerHTML = result.people.map((person, index) => {
      const count = result.items.filter(item => item.assignedTo.includes(person.name)).length;
      return `<div class="share-row"><span class="avatar" style="background:${palette[index % palette.length]}">${escapeHtml(person.name.trim()[0]?.toUpperCase() || "?")}</span><div><span class="share-name">${escapeHtml(person.name)}</span><span class="share-detail">${count} ${count === 1 ? "item" : "items"}, incl. GST</span></div><span class="share-amount">${formatMoney(person.total)}</span></div>`;
    }).join("");
  }

  const currencies = [{ code: "INR", symbol: "₹", locale: "en-IN" }, { code: "USD", symbol: "$", locale: "en-US" }, { code: "EUR", symbol: "€", locale: "de-DE" }, { code: "GBP", symbol: "£", locale: "en-GB" }];
  document.querySelector("#currencyButton").addEventListener("click", () => {
    let menu = document.querySelector(".currency-menu"); if (menu) { menu.remove(); return; }
    menu = document.createElement("div"); menu.className = "currency-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML = currencies.map(currency => `<button type="button" role="menuitem" data-currency="${currency.code}">${currency.symbol} &nbsp; ${currency.code}</button>`).join(""); document.body.append(menu);
    menu.addEventListener("click", event => {
      const selected = currencies.find(currency => currency.code === event.target.dataset.currency); if (!selected) return;
      state.currency = selected.code; state.symbol = selected.symbol; state.locale = selected.locale; document.querySelector("#currencySymbol").textContent = selected.symbol; document.querySelector("#currencyButton").innerHTML = `<span id="currencySymbol">${selected.symbol}</span> ${selected.code} <span class="chevron">⌄</span>`;
      if (state.lastResult) renderResults(state.lastResult); else { document.querySelector("#grandTotal").innerHTML = `${selected.symbol}<span>0</span><small>.00</small>`; document.querySelector("#subtotal").textContent = formatMoney(0); document.querySelector("#gstTotal").textContent = formatMoney(0); }
      menu.remove();
    });
  });
  renderPeople();
})();
