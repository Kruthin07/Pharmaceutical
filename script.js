// ---------- Data layer (localStorage) ----------
      const STORAGE_KEY = "pharmacy_data_v1";

      let state = {
        medicines: [],   // {id,name,batch,supplierId,qty,expiry (ISO),rating,price}
        suppliers: [],   // {id,name,contact,notes}
        sales: [],       // {id,date,medId,qty,total}
        settings: { lowStockThreshold: 30 } // default threshold
      };

      function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          state = JSON.parse(raw);
          if (!state.settings) state.settings = { lowStockThreshold: 30 };
          if (typeof state.settings.lowStockThreshold !== "number") state.settings.lowStockThreshold = 30;
        }
      }

      // Generate simple ID
      function id(prefix = "id") { return prefix + "_" + Math.random().toString(36).slice(2, 9); }

      // ---------- Sample seed data ----------
      function seedSample() {
        const suppliers = [
          { id: "s_1", name: "HealthPharma", contact: "+91 98765 43210", notes: "Preferred supplier" },
          { id: "s_2", name: "MediSupply", contact: "+91 91234 56789", notes: "Weekly delivery" },
          { id: "s_3", name: "CareWell Distributors", contact: "+91 99876 54321", notes: "Good bulk discounts" },
          { id: "s_4", name: "ZenRx Depot", contact: "+91 90123 45678", notes: "Cold-chain capable" },
          { id: "s_5", name: "PulseMed", contact: "+91 90000 11122", notes: "Monthly invoicing" },
          { id: "s_6", name: "SureLife Suppliers", contact: "+91 95555 22233", notes: "Fast shipping" },
        ];

        const names = [
          "Paracetamol 500mg","Cetirizine 10mg","Amoxicillin 250mg","Ibuprofen 200mg","Azithromycin 500mg",
          "Diclofenac 50mg","Pantoprazole 40mg","Omeprazole 20mg","Metformin 500mg","Atorvastatin 10mg",
          "Amlodipine 5mg","Losartan 50mg","Telmisartan 40mg","Levocetirizine 5mg","Montelukast 10mg",
          "Dolo 650","Ranitidine 150mg","Ondansetron 4mg","Domperidone 10mg","ORS Sachet",
          "Betadine Ointment","Amox-Clav 625","Cefixime 200mg","Doxycycline 100mg","Erythromycin 250mg",
          "Loratadine 10mg","Fexofenadine 120mg","B-Complex Caps","Vitamin C 500mg","Vitamin D3 60k",
          "Calcium + D3","Ferrous Sulfate","Folic Acid 5mg","Zinc 50mg","ORS Liquid 200ml",
          "Salbutamol Inhaler","Budesonide Inhaler","Cetaphil Lotion","Clotrimazole Cream",
          "Hydrocortisone Cream","Mupirocin Ointment","Acyclovir 400mg","Metronidazole 400mg",
          "Tinidazole 500mg","Cetirizine Syrup","Paracetamol Syrup","Insulin 30/70","Gliclazide 80mg",
          "Glimipride 2mg","Thyroxine 50mcg","Thyroxine 100mcg",
        ];

        function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
        function sample(arr){ return arr[rand(0, arr.length-1)]; }
        function randomDateBack(days){ const d=new Date(); d.setDate(d.getDate()-rand(0,days)); return d; }

        const medicines = names.map((name, i) => {
          const supplierId = suppliers[rand(0, suppliers.length - 1)].id;
          const qty = rand(10, 250);
          const exp = new Date(); exp.setDate(exp.getDate() + rand(-20, 240));
          const price = Math.random() * 9 + 0.5;
          const rating = rand(1, 5);
          return {
            id: id("m"),
            name,
            batch: "B" + String(100 + i),
            supplierId,
            qty,
            expiry: exp.toISOString().slice(0, 10),
            rating,
            price: Number(price.toFixed(2)),
          };
        });

        const sales = [];
        const transactions = rand(250, 400);
        for (let i = 0; i < transactions; i++) {
          const med = sample(medicines);
          if (!med.qty) continue;
          const qty = Math.min(rand(1, 5), med.qty);
          med.qty -= qty;
          const date = randomDateBack(360);
          const total = qty * (med.price || 1);
          sales.push({ id: id("t"), date: date.toISOString(), medId: med.id, qty, total });
        }

        state = { medicines, suppliers, sales, settings: { lowStockThreshold: 30 } };
        saveState();
        renderAll();
      }

      // ---------- Utilities ----------
      function daysUntil(isoDate) { const d = new Date(isoDate); const diff = d - new Date(); return Math.ceil(diff / (1000*60*60*24)); }
      function formatDate(iso) { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString(); }
      function getThreshold() { return Number(state.settings?.lowStockThreshold || 30); }

      // ---------- Renderers ----------
      function renderNav() {
        document.querySelectorAll("#mainNav button").forEach((btn) => {
          btn.onclick = () => {
            document.querySelectorAll("#mainNav button").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            showView(btn.dataset.view);
          };
        });
      }

      function showView(view) {
        document.querySelectorAll("main section").forEach((s) => (s.style.display = "none"));
        const el = document.getElementById("view-" + view);
        if (el) el.style.display = "";
        updateSummaries();
      }

      function updateSummaries() {
        const threshold = getThreshold();

        // inventory summary
        const totalItems = state.medicines.reduce((s, m) => s + (m.qty || 0), 0);
        const lowStock = state.medicines.filter((m) => (m.qty || 0) <= threshold).length;
        document.getElementById("summaryInventory").innerText =
          `${state.medicines.length} SKUs — ${totalItems} units in stock. ${lowStock} item(s) low stock.`;

        // Low Stock nav count
        const lowNav = document.getElementById("lowStockNav");
        if (lowNav) lowNav.textContent = `Low Stock (${lowStock})`;

        // expiry summary
        const soon = state.medicines.filter((m) => daysUntil(m.expiry) <= 14 && daysUntil(m.expiry) >= 0).length;
        const expired = state.medicines.filter((m) => daysUntil(m.expiry) < 0).length;
        document.getElementById("summaryExpiry").innerText = `${soon} expiring within 14 days, ${expired} already expired.`;

        // sales summary for today
        const today = new Date().toISOString().slice(0, 10);
        const todaysSales = state.sales
          .filter((s) => s.date.slice(0, 10) === today)
          .reduce((sum, x) => sum + (x.total || 0), 0);
        document.getElementById("summarySales").innerText = `₹ ${todaysSales.toFixed(2)} today.`;

        renderQuickList();
        renderMedTable();
        renderLowStockTable();
        renderExpiryTable(); 
        renderSuppliers();
        renderSalesUI();
        renderCharts();

        // sync inputs
        const thInput = document.getElementById("lowStockThreshold");
        if (thInput) thInput.value = threshold;

        // fill supplier select for compose
        const sel = document.getElementById("reorderSupplier");
        if (sel) {
          const val = sel.value;
          sel.innerHTML = '<option value="">All suppliers</option>';
          state.suppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id; opt.textContent = s.name;
            sel.appendChild(opt);
          });
          sel.value = val || "";
        }
      }

      function renderQuickList() {
        const q = (document.getElementById("quickSearch").value || "").toLowerCase();
        const list = state.medicines.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
        const target = document.getElementById("quickList");
        target.innerHTML =
          list.map((m) =>
            `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,0.02)">
              <div>
                <strong>${m.name}</strong>
                <div class="muted">Batch ${m.batch} • ${m.qty} units</div>
              </div>
              <div>
                <button class="btn small" onclick="openEditMed('${m.id}')">Edit</button>
              </div>
            </div>`
          ).join("") || '<div class="muted">No matches</div>';
      }

      function renderMedTable() {
        const tbody = document.querySelector("#medTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";
        const supplierMap = Object.fromEntries(state.suppliers.map((s) => [s.id, s.name]));
        const filter = (document.getElementById("filterBySupplier").value || "").toLowerCase();

        state.medicines
          .filter((m) => !filter || (supplierMap[m.supplierId] || "").toLowerCase().includes(filter))
          .forEach((m) => {
            const dleft = daysUntil(m.expiry);
            const expiryClass = dleft < 0 ? "expired" : dleft <= 14 ? "expiry-soon" : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${m.name}</td>
              <td>${m.batch}</td>
              <td>${supplierMap[m.supplierId] || "—"}</td>
              <td>${m.qty}</td>
              <td class="${expiryClass}">${formatDate(m.expiry)}</td>
              <td>${"★".repeat(m.rating || 0)}</td>
              <td>
                <button class="btn small ghost" onclick="openEditMed('${m.id}')">Edit</button>
                <button class="btn small" onclick="deleteMed('${m.id}')">Delete</button>
              </td>`;
            tbody.appendChild(tr);
          });
      }

      function renderLowStockTable() {
        const tbody = document.querySelector("#lowStockTable tbody");
        if (!tbody) return;
        const supplierMap = Object.fromEntries(state.suppliers.map((s) => [s.id, s.name]));
        const threshold = getThreshold();

        const lowList = state.medicines
          .filter((m) => (m.qty || 0) <= threshold)
          .sort((a, b) => (a.qty || 0) - (b.qty || 0));

        tbody.innerHTML = "";
        if (!lowList.length) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="6" class="muted">All good! No items at or below ${threshold} units.</td>`;
          tbody.appendChild(tr);
          return;
        }

        lowList.forEach((m) => {
          const suggested = Math.max(threshold * 2 - (m.qty || 0), threshold);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${m.name}</td>
            <td>${m.batch}</td>
            <td>${supplierMap[m.supplierId] || "—"}</td>
            <td><span class="badge">${m.qty}</span></td>
            <td>${suggested}</td>
            <td>
              <button class="btn small" onclick="restockMed('${m.id}', ${suggested})">Restock</button>
            </td>`;
          tbody.appendChild(tr);
        });
      }

      function renderSuppliers() {
        const tbody = document.querySelector("#supTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";
        state.suppliers.forEach((s) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${s.name}</td>
            <td>${s.contact}</td>
            <td>${s.notes || ""}</td>
            <td>
              <button class="btn small ghost" onclick="editSupplier('${s.id}')">Edit</button>
              <button class="btn small" onclick="deleteSupplier('${s.id}')">Delete</button>
            </td>`;
          tbody.appendChild(tr);
        });
      }

      // ---------- Enhanced Sales UI ----------
      function makeSaleRow(defaultQty = 1) {
        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML = `
          <select class="sale-med" style="min-width:220px"></select>
          <input class="sale-qty" type="number" min="1" value="${defaultQty}" style="width:100px" />
          <div class="form-row" style="gap:6px">
            <span class="chip" data-q="1">1</span>
            <span class="chip" data-q="2">2</span>
            <span class="chip" data-q="5">5</span>
            <span class="chip" data-q="10">10</span>
          </div>
          <button class="btn small ghost remove-line">Remove</button>
        `;
        // fill select
        const sel = row.querySelector(".sale-med");
        sel.innerHTML = '<option value="">Select medicine</option>';
        state.medicines.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.text = `${m.name} — ${m.qty} in stock`;
          sel.appendChild(opt);
        });
        // qty chips
        row.querySelectorAll(".chip").forEach(chip => {
          chip.addEventListener("click", () => {
            row.querySelector(".sale-qty").value = chip.dataset.q;
          });
        });
        // remove
        row.querySelector(".remove-line").addEventListener("click", () => {
          row.remove();
        });
        return row;
      }

      function renderSalesUI() {
        // sales rows container
        const container = document.getElementById("saleRows");
        if (container && container.children.length === 0) {
          container.appendChild(makeSaleRow(1)); // start with one row
        }
        // sales log table
        const tbody = document.querySelector("#salesLog tbody");
        if (!tbody) return;
        tbody.innerHTML = "";
        state.sales.slice().reverse().forEach((s) => {
          const med = state.medicines.find((m) => m.id === s.medId) || { name: "(deleted)" };
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${new Date(s.date).toLocaleString()}</td>
            <td>${med.name}</td>
            <td>${s.qty}</td>
            <td>₹ ${s.total.toFixed(2)}</td>`;
          tbody.appendChild(tr);
        });
      }

      // ---------- Actions ----------
      function openEditMed(id) {
        const m = state.medicines.find((x) => x.id === id);
        const name = prompt("Medicine name", m.name);
        if (name == null) return;
        m.name = name;
        m.qty = Number(prompt("Quantity", m.qty)) || m.qty;
        m.expiry = prompt("Expiry (YYYY-MM-DD)", m.expiry) || m.expiry;
        m.rating = Number(prompt("Rating 1-5", m.rating || 3)) || m.rating;
        saveState();
        renderAll();
      }

      function deleteMed(id) {
        if (!confirm("Delete this medicine?")) return;
        state.medicines = state.medicines.filter((m) => m.id !== id);
        saveState();
        renderAll();
      }

      function promoteMed(id) { alert("Marking as promotional — consider discounting or placing on front shelf."); }

      function addNewMedicine() {
        const name = prompt("Name");
        if (!name) return;
        const batch = prompt("Batch");
        const supplier = prompt("Supplier ID (or leave blank)");
        const qty = Number(prompt("Qty", "0"));
        const expiry = prompt("Expiry (YYYY-MM-DD)");
        const rating = Number(prompt("Rating 1-5", "3")) || 3;
        const price = Number(prompt("Price per unit", "1.0")) || 1.0;
        const med = { id: id("m"), name, batch, supplierId: supplier || "", qty, expiry: expiry || "", rating, price };
        state.medicines.push(med);
        saveState();
        renderAll();
      }

      function addSupplier() {
        const name = prompt("Supplier name"); if (!name) return;
        const contact = prompt("Contact");
        const notes = prompt("Notes");
        state.suppliers.push({ id: id("s"), name, contact, notes });
        saveState();
        renderAll();
      }

      function editSupplier(id) {
        const s = state.suppliers.find((x) => x.id === id);
        const name = prompt("Name", s.name);
        if (name == null) return;
        s.name = name;
        s.contact = prompt("Contact", s.contact) || s.contact;
        s.notes = prompt("Notes", s.notes) || s.notes;
        saveState();
        renderAll();
      }

      function deleteSupplier(id) {
        if (!confirm("Delete supplier? This does not remove medicines.")) return;
        state.suppliers = state.suppliers.filter((s) => s.id !== id);
        saveState();
        renderAll();
      }

      // Restock
      function restockMed(medId, suggested) {
        const med = state.medicines.find((m) => m.id === medId);
        if (!med) return alert("Medicine not found");
        const qty = Number(prompt(`Restock units for "${med.name}"`, String(suggested))) || 0;
        if (qty <= 0) return;
        med.qty = (med.qty || 0) + qty;
        saveState();
        renderAll();
        alert(`Restocked ${qty} units of ${med.name}.`);
      }

      // Record ALL sales from rows
      function recordAllSales() {
        const rows = Array.from(document.querySelectorAll("#saleRows .form-row"));
        if (!rows.length) return alert("Add at least one item");
        let totalLines = 0;
        for (const row of rows) {
          const medId = row.querySelector(".sale-med").value;
          const qty = Number(row.querySelector(".sale-qty").value) || 0;
          if (!medId || qty <= 0) continue; // skip invalid
          const med = state.medicines.find((m) => m.id === medId);
          if (!med) { alert("Medicine not found"); continue; }
          if (med.qty < qty) { alert(`Not enough stock for ${med.name}`); continue; }

          med.qty -= qty;
          const total = qty * (med.price || 1);
          state.sales.push({ id: id("t"), date: new Date().toISOString(), medId, qty, total });
          totalLines++;
        }
        if (!totalLines) return alert("No valid lines to record");
        saveState();
        // reset to one row for next entry
        const container = document.getElementById("saleRows");
        container.innerHTML = "";
        container.appendChild(makeSaleRow(1));
        renderAll();
        alert(`Recorded ${totalLines} line(s) of sale.`);
      }

      // ---------- Reorder message composer ----------
      function composeReorderText(supplierId = "") {
        const threshold = getThreshold();
        const supplierMap = Object.fromEntries(state.suppliers.map((s) => [s.id, s]));
        const list = state.medicines
          .filter(m => (m.qty || 0) <= threshold)
          .filter(m => !supplierId || m.supplierId === supplierId);

        if (!list.length) return "No items below threshold.";

        // group per supplier for nicer formatting
        const groups = new Map();
        list.forEach(m => {
          const sid = m.supplierId || "unknown";
          if (!groups.has(sid)) groups.set(sid, []);
          const suggested = Math.max(threshold * 2 - (m.qty || 0), threshold);
          groups.get(sid).push({ m, suggested });
        });

        let lines = [];
        lines.push("Hello,\n\nPlease find our reorder request for low-stock items:\n");
        groups.forEach((items, sid) => {
          const supName = supplierMap[sid]?.name || "Unknown Supplier";
          lines.push(`Supplier: ${supName}`);
          items.forEach(({ m, suggested }) => {
            lines.push(`- ${m.name} (Batch ${m.batch}) — On hand: ${m.qty}, Request: ${suggested}`);
          });
          lines.push(""); // blank line between suppliers
        });
        lines.push("Kindly confirm availability and expected delivery timeline.\n\nThanks,\nPharmacy");
        return lines.join("\n");
      }

      function openComposeModal(text) {
        const modal = document.getElementById("composeModal");
        const ta = document.getElementById("composeText");
        ta.value = text;
        modal.classList.add("open");
      }

      // ---------- Charts & KPIs ----------
      let salesChart, stockChart, expiryChart, monthlySalesChart, productSalesChart, supplierShareChart;

      function groupSalesByMonth(sales) {
        const map = new Map();
        sales.forEach((s) => {
          const d = new Date(s.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          map.set(key, (map.get(key) || 0) + (s.total || 0));
        });
        return map;
      }

      function lastNMonths(n) {
        const arr = [];
        const d = new Date(); d.setDate(1);
        for (let i = n - 1; i >= 0; i--) {
          const dt = new Date(d); dt.setMonth(d.getMonth() - i);
          arr.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
        }
        return arr;
      }

      function monthLabel(ym) {
        const [y, m] = ym.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" });
      }

      function inRange(dateIso) {
        const from = document.getElementById("reportFrom")?.value;
        const to = document.getElementById("reportTo")?.value;
        if (!from && !to) return true;
        const d = new Date(dateIso);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (from && ym < from) return false;
        if (to && ym > to) return false;
        return true;
      }
      
      function renderExpiryTable() {
        const tbody = document.querySelector("#expiryTable tbody");
        if (!tbody) return;

        // collect items that are expiring within 30 days or already expired
        const items = state.medicines
            .filter(m => m.expiry) // must have a date
            .map(m => ({ m, dleft: daysUntil(m.expiry) }))
            .filter(x => x.dleft <= 30); // includes negatives (expired)

        // sort: expired first, then soonest to latest
        items.sort((a, b) => {
            const ax = a.dleft < 0 ? -9999 : a.dleft;
            const bx = b.dleft < 0 ? -9999 : b.dleft;
            return ax - bx;
        });

        tbody.innerHTML = "";
        if (!items.length) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="6" class="muted">No items expiring within 30 days, and none expired.</td>`;
            tbody.appendChild(tr);
            return;
        }

        for (const { m, dleft } of items) {
            const cls = dleft < 0 ? "expired" : (dleft <= 14 ? "expiry-soon" : "");
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td>${m.name}</td>
            <td>${m.batch}</td>
            <td class="${cls}">${formatDate(m.expiry)}</td>
            <td class="${cls}">${dleft < 0 ? "Expired" : `${dleft} day(s)`}</td>
            <td>${m.qty}</td>
            <td>
                <button class="btn small" onclick="promoteMed('${m.id}')">Promote</button>
                <button class="btn small ghost" onclick="openEditMed('${m.id}')">Edit</button>
            </td>
            `;
            tbody.appendChild(tr);
        }
      }

      function renderCharts() {
        // Dashboard — Sales overview (7/30/90 days)
        const rangeSel = document.getElementById("salesRange");
        const days = Number(rangeSel ? rangeSel.value : 7);
        const labels = [];
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          labels.push(d.toLocaleDateString());
          const sum = state.sales.filter((s) => s.date.slice(0, 10) === key).reduce((a, b) => a + b.total, 0);
          data.push(Number(sum.toFixed(2)));
        }
        const ctx = document.getElementById("salesChart").getContext("2d");
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(ctx, {
          type: "line",
          data: { labels, datasets: [{ label: "Revenue (₹)", data, tension: 0.3 }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });

        // Reports — stock distribution (top 6 by qty)
        const top = state.medicines.slice().sort((a, b) => b.qty - a.qty).slice(0, 6);
        const ctx2 = document.getElementById("stockChart")?.getContext("2d");
        if (ctx2) {
          if (stockChart) stockChart.destroy();
          stockChart = new Chart(ctx2, {
            type: "pie",
            data: { labels: top.map((x) => x.name), datasets: [{ data: top.map((x) => x.qty) }] },
            options: { plugins: { legend: { position: "bottom" } } },
          });
        }

        // Reports — expiry status
        const soon = state.medicines.filter((m) => { const d = daysUntil(m.expiry); return d <= 30 && d >= 0; }).length;
        const expired = state.medicines.filter((m) => daysUntil(m.expiry) < 0).length;
        const ok = Math.max(0, state.medicines.length - soon - expired);
        const ctx3 = document.getElementById("expiryChart")?.getContext("2d");
        if (ctx3) {
          if (expiryChart) expiryChart.destroy();
          expiryChart = new Chart(ctx3, { type: "doughnut", data: { labels: ["OK","Soon","Expired"], datasets: [{ data: [ok, soon, expired] }] } });
        }

        // Reports — Monthly sales (last 12 months)
        const months = lastNMonths(12);
        const monthMap = groupSalesByMonth(state.sales.filter((s) => inRange(s.date)));
        const monthData = months.map((m) => Number((monthMap.get(m) || 0).toFixed(2)));
        const ctx4 = document.getElementById("monthlySalesChart")?.getContext("2d");
        if (ctx4) {
          if (monthlySalesChart) monthlySalesChart.destroy();
          monthlySalesChart = new Chart(ctx4, {
            type: "line",
            data: { labels: months.map(monthLabel), datasets: [{ label: "Revenue (₹)", data: monthData, tension: 0.3 }] },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
          });
        }

        // Reports — Top products by revenue
        const revenueByMed = new Map();
        state.sales.filter((s) => inRange(s.date)).forEach((s) => {
          revenueByMed.set(s.medId, (revenueByMed.get(s.medId) || 0) + (s.total || 0));
        });
        const topMed = Array.from(revenueByMed.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const ctx5 = document.getElementById("productSalesChart")?.getContext("2d");
        if (ctx5) {
          if (productSalesChart) productSalesChart.destroy();
          productSalesChart = new Chart(ctx5, {
            type: "bar",
            data: {
              labels: topMed.map(([id]) => state.medicines.find((m) => m.id === id)?.name || "(deleted)"),
              datasets: [{ label: "₹", data: topMed.map(([, v]) => Number(v.toFixed(2))) }],
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
          });
        }

        // Reports — Supplier share
        const supplierMap = Object.fromEntries(state.suppliers.map((s) => [s.id, s.name]));
        const bySupplier = new Map();
        state.sales.filter((s) => inRange(s.date)).forEach((s) => {
          const med = state.medicines.find((m) => m.id === s.medId);
          const supId = med?.supplierId || "unknown";
          bySupplier.set(supId, (bySupplier.get(supId) || 0) + (s.total || 0));
        });
        const supLabels = Array.from(bySupplier.keys()).map((id) => supplierMap[id] || "Unknown");
        const supValues = Array.from(bySupplier.values()).map((v) => Number(v.toFixed(2)));
        const ctx6 = document.getElementById("supplierShareChart")?.getContext("2d");
        if (ctx6) {
          if (supplierShareChart) supplierShareChart.destroy();
          supplierShareChart = new Chart(ctx6, { type: "pie", data: { labels: supLabels, datasets: [{ data: supValues }] }, options: { plugins: { legend: { position: "bottom" } } } });
        }

        // KPIs
        const gross = state.sales.filter((s) => inRange(s.date)).reduce((a, b) => a + (b.total || 0), 0);
        document.getElementById("kpiGross").innerText = `₹ ${gross.toFixed(2)}`;
        const expiredUnits = state.medicines.filter((m) => daysUntil(m.expiry) < 0).reduce((a, b) => a + (b.qty || 0), 0);
        document.getElementById("kpiExpiredUnits").innerText = String(expiredUnits);
        const stockValue = state.medicines.reduce((a, b) => a + (b.qty || 0) * (b.price || 0), 0);
        document.getElementById("kpiStockValue").innerText = `₹ ${stockValue.toFixed(2)}`;
      }

      // ---------- Export / Import ----------
      function exportJSON() {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pharmacy_data.json";
        a.click();
        URL.revokeObjectURL(url);
      }
      function importJSONFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed.settings) parsed.settings = { lowStockThreshold: 30 };
            state = parsed;
            saveState();
            renderAll();
            alert("Imported");
          } catch {
            alert("Invalid file");
          }
        };
        reader.readAsText(file);
      }

      // ---------- Sorting ----------
      let currentSort = { key: null, dir: 1 };
      function sortMedicines(key) {
        currentSort.dir = currentSort.key === key ? -currentSort.dir : 1;
        currentSort.key = key;
        const supplierMap = Object.fromEntries(state.suppliers.map((s) => [s.id, s.name]));
        state.medicines.sort((a, b) => {
          let av, bv;
          if (key === "supplier") { av = supplierMap[a.supplierId] || ""; bv = supplierMap[b.supplierId] || ""; }
          else if (key === "expiry") { av = a.expiry; bv = b.expiry; }
          else if (key === "qty") { av = a.qty || 0; bv = b.qty || 0; }
          else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
          if (av < bv) return -1 * currentSort.dir;
          if (av > bv) return 1 * currentSort.dir;
          return 0;
        });
        renderMedTable();
      }

      // ---------- Helpers ----------
      function renderAll() { updateSummaries(); }

      // ---------- Event bindings ----------
      document.getElementById("quickSearch").addEventListener("input", renderQuickList);
      document.getElementById("filterBySupplier").addEventListener("input", renderMedTable);
      document.getElementById("addMedQuick").addEventListener("click", addNewMedicine);
      document.getElementById("addMedBtn").addEventListener("click", addNewMedicine);
      document.getElementById("addSupplierBtn").addEventListener("click", addSupplier);

      // sales: rows and record
      document.getElementById("addSaleRowBtn").addEventListener("click", () => {
        document.getElementById("saleRows").appendChild(makeSaleRow(2)); // default to 2 for tablets
      });
      document.getElementById("recordAllSalesBtn").addEventListener("click", recordAllSales);

      // file import/export
      document.getElementById("exportBtn").addEventListener("click", exportJSON);
      document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
      document.getElementById("importFile").addEventListener("change", (e) => importJSONFile(e.target.files[0]));

      // data reset/seed
      document.getElementById("resetData").addEventListener("click", () => {
        if (confirm("Reset all data?")) {
          state = { medicines: [], suppliers: [], sales: [], settings: { lowStockThreshold: 30 } };
          saveState();
          renderAll();
        }
      });
      document.getElementById("seedData").addEventListener("click", () => { if (confirm("Seed sample data?")) seedSample(); });

      // promote soon
      document.getElementById("promoSoon").addEventListener("click", () => {
        const list = state.medicines.filter((m) => daysUntil(m.expiry) <= 14 && daysUntil(m.expiry) >= 0);
        if (!list.length) return alert("No items expiring within 14 days");
        alert("Consider promoting these: " + list.map((x) => x.name).join(", "));
      });

      // go to low stock from dashboard
      document.getElementById("gotoLowStock").addEventListener("click", () => {
        document.querySelectorAll("#mainNav button").forEach((b) => b.classList.remove("active"));
        document.querySelector('#mainNav button[data-view="lowstock"]').classList.add("active");
        showView("lowstock");
      });

      // sort header clicks
      Array.from(document.querySelectorAll("#medTable th.sortable")).forEach((th) =>
        th.addEventListener("click", () => sortMedicines(th.dataset.sort))
      );

      // dashboard range selector
      const salesRangeEl = document.getElementById("salesRange");
      if (salesRangeEl) salesRangeEl.addEventListener("change", () => renderCharts());

      // reports range buttons
      const applyRangeBtn = document.getElementById("applyRange");
      const clearRangeBtn = document.getElementById("clearRange");
      if (applyRangeBtn) applyRangeBtn.addEventListener("click", () => renderCharts());
      if (clearRangeBtn) clearRangeBtn.addEventListener("click", () => {
        document.getElementById("reportFrom").value = "";
        document.getElementById("reportTo").value = "";
        renderCharts();
      });

      // Low stock threshold and reorder actions
      document.getElementById("applyLowStockThreshold").addEventListener("click", () => {
        const val = Number(document.getElementById("lowStockThreshold").value) || 1;
        state.settings.lowStockThreshold = Math.max(1, Math.floor(val));
        saveState(); renderAll();
      });

      // Compose: open modal prefilled
      function handleCompose(openWhatsApp = false) {
        const supplierId = document.getElementById("reorderSupplier").value || "";
        const text = composeReorderText(supplierId);
        openComposeModal(text);
        // store flag on buttons for quick open
        document.getElementById("openWhatsAppCompose").dataset.autotrigger = openWhatsApp ? "1" : "0";
        document.getElementById("openEmailCompose").dataset.autotrigger = openWhatsApp ? "0" : "1";
      }

      document.getElementById("reorderEmail").addEventListener("click", () => handleCompose(false));
      document.getElementById("reorderWhatsApp").addEventListener("click", () => handleCompose(true));

      // Compose modal controls
      document.getElementById("closeCompose").addEventListener("click", () => {
        document.getElementById("composeModal").classList.remove("open");
      });
      document.getElementById("copyCompose").addEventListener("click", async () => {
        const text = document.getElementById("composeText").value;
        try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
        catch { alert("Copy failed—please select and copy manually."); }
      });
      document.getElementById("openEmailCompose").addEventListener("click", () => {
        const subject = encodeURIComponent("Reorder request - Low stock");
        const body = encodeURIComponent(document.getElementById("composeText").value);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      });
      document.getElementById("openWhatsAppCompose").addEventListener("click", () => {
        const text = encodeURIComponent(document.getElementById("composeText").value);
        window.open(`https://wa.me/?text=${text}`, "_blank");
      });

      // expose some globals
      window.deleteMed = deleteMed;
      window.openEditMed = openEditMed;
      window.promoteMed = promoteMed;
      window.editSupplier = editSupplier;
      window.deleteSupplier = deleteSupplier;
      window.restockMed = restockMed;

      // init
      renderNav();
      loadState();
      if (!state.medicines.length && !state.suppliers.length) seedSample();
      renderAll();