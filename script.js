
// ---------- Data layer (localStorage) ----------
const STORAGE_KEY = "pharmacy_data_v1";

let state = {
  medicines: [],   // {id,name,batch,supplierId,qty,expiry (ISO),rating,price,schedule:'OTC'|'H'|'H1'|'X'}
  suppliers: [],   // {id,name,contact,notes}
  customers: [],   // {id,name,phone,notes,chronic:boolean,conditions:string,refillDays:number,lastPurchaseISO?:string}
  sales: [],       // {id,date,medId,qty,total,unitPrice?,rx?,customerId?}
  purchases: [],   // ...
  disposals: [],
  controlledLogs: [],
  gstInvoices: [],
  compliance: { scheduleXRegister: [] },
  settings: { lowStockThreshold: 30 }
};

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    parsed.settings = parsed.settings || { lowStockThreshold: 30 };
    parsed.purchases = parsed.purchases || [];
    parsed.disposals = parsed.disposals || [];
    parsed.controlledLogs = parsed.controlledLogs || [];
    parsed.gstInvoices = parsed.gstInvoices || [];
    parsed.compliance = parsed.compliance || { scheduleXRegister: [] };
    parsed.customers = parsed.customers || [];
    (parsed.medicines || []).forEach(m => { if (!m.schedule) m.schedule = m.controlled ? 'X' : 'OTC'; });
    state = parsed;
  }
}

// Generate simple ID
function id(prefix = "id") { return prefix + "_" + Math.random().toString(36).slice(2, 9); }

// ---------- Sample seed data ----------
function seedSample() {
  // suppliers (same as before, trimmed)
  const suppliers = [
    { id: "s_1", name: "HealthPharma", contact: "+91 98765 43210", notes: "Preferred supplier" },
    { id: "s_2", name: "MediSupply", contact: "+91 91234 56789", notes: "Weekly delivery" },
  ];

  // customers
  const customers = [
    { id:"c_1", name:"Ravi Kumar", phone:"+919800000001", notes:"Prefers WhatsApp", chronic:true,  conditions:"Diabetes",   refillDays:30, lastPurchaseISO:null },
    { id:"c_2", name:"Anita Sharma", phone:"+919800000002", notes:"—",              chronic:false, conditions:"",          refillDays:30, lastPurchaseISO:null },
    { id:"c_3", name:"Sandeep Rao",  phone:"+919800000003", notes:"BP & Thyroid",   chronic:true,  conditions:"Hypertension, Thyroid", refillDays:30, lastPurchaseISO:null },
  ];

  function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function sample(arr){ return arr[rand(0, arr.length-1)]; }
  function randomDateBack(days){ const d=new Date(); d.setDate(d.getDate()-rand(0,days)); return d; }

  const meds = [
    "Metformin 500mg","Atorvastatin 10mg","Amlodipine 5mg","Losartan 50mg","Dolo 650",
    "Levothyroxine 50mcg","Azithromycin 500mg","Cetirizine 10mg","Pantoprazole 40mg"
  ];

  const medicines = meds.map((name, i) => {
    const supplierId = suppliers[rand(0, suppliers.length - 1)].id;
    const qty = rand(20, 200);
    const exp = new Date(); exp.setDate(exp.getDate() + rand(30, 240));
    const price = Math.random() * 9 + 0.5;
    const rating = rand(3, 5);
    const r = Math.random();
    const schedule = r < 0.08 ? 'X' : r < 0.25 ? (Math.random() < 0.6 ? 'H' : 'H1') : 'OTC';
    return { id:id("m"), name, batch:"B"+(200+i), supplierId, qty, expiry:exp.toISOString().slice(0,10), rating, price:Number(price.toFixed(2)), schedule };
  });

  const sales = [];
  for (let i=0;i<120;i++){
    const med = sample(medicines);
    const cust = sample(customers);
    if (!med.qty) continue;
    const qty = Math.min(rand(1, 2), med.qty);
    med.qty -= qty;
    const date = randomDateBack(180);
    const total = +(qty*(med.price||1)).toFixed(2);
    const rx = (med.schedule==='OTC')?undefined:{ no:"RX"+rand(1000,9999), doctor:"Dr Demo", reg:"MCI/12345", patient:cust.name, address:"-", retainedCopy: med.schedule==='X' };
    sales.push({ id:id("t"), date:date.toISOString(), medId:med.id, qty, total, unitPrice:med.price, rx, customerId: cust.id });
    cust.lastPurchaseISO = (!cust.lastPurchaseISO || new Date(date)>new Date(cust.lastPurchaseISO)) ? date.toISOString() : cust.lastPurchaseISO;
  }

  state = {
    medicines, suppliers, customers, sales,
    purchases: [], disposals: [], controlledLogs: [], gstInvoices: [],
    compliance: { scheduleXRegister: [] },
    settings: { lowStockThreshold: 30 }
  };
  saveState();
  renderAll();
}

// ---------- Utilities ----------
function daysUntil(isoDate) { const d = new Date(isoDate); const diff = d - new Date(); return Math.ceil(diff / (1000*60*60*24)); }
function formatDate(iso) { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString(); }
function getThreshold() { return Number(state.settings?.lowStockThreshold || 30); }
const scheduleBadge = (s) => s==='H' ? '<span class="badge sched h">H</span>' : s==='H1' ? '<span class="badge sched h1">H1</span>' : s==='X' ? '<span class="badge sched x">X</span>' : '<span class="badge">OTC</span>';
const phoneDigits = (p='') => p.replace(/[^\d+]/g,'');
function addDays(iso, n){ const d=new Date(iso); d.setDate(d.getDate()+n); return d.toISOString(); }

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
  renderCustomers();
  renderDueReminders();
  renderPendingRx();
  renderSalesUI();
  renderCharts();

  // sync inputs
  const thInput = document.getElementById("lowStockThreshold");
  if (thInput) thInput.value = threshold;

  // supplier select for compose
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

  // sales customer picker
  const sc = document.getElementById("saleCustomer");
  if (sc){
    const old = sc.value;
    sc.innerHTML = '<option value="">Walk-in / Unknown</option>';
    state.customers.forEach(c=>{
      const opt=document.createElement('option');
      opt.value=c.id; opt.textContent=`${c.name} (${c.phone||'no phone'})`;
      sc.appendChild(opt);
    });
    sc.value = old || "";
    showCustomerHint();
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
          <strong>${m.name}</strong> ${scheduleBadge(m.schedule)}
          <div class="muted">Batch ${m.batch} • ${m.qty} units</div>
        </div>
        <div><button class="btn small" onclick="openEditMed('${m.id}')">Edit</button></div>
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
        <td>${scheduleBadge(m.schedule)}</td>
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
    tr.innerHTML = `<td colspan="7" class="muted">All good! No items at or below ${threshold} units.</td>`;
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
      <td>${scheduleBadge(m.schedule)}</td>
      <td><button class="btn small" onclick="restockMed('${m.id}', ${suggested})">Restock</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderExpiryTable() {
  const tbody = document.querySelector("#expiryTable tbody");
  if (!tbody) return;

  const items = state.medicines
      .filter(m => m.expiry)
      .map(m => ({ m, dleft: daysUntil(m.expiry) }))
      .filter(x => x.dleft <= 30);

  items.sort((a, b) => {
      const ax = a.dleft < 0 ? -9999 : a.dleft;
      const bx = b.dleft < 0 ? -9999 : b.dleft;
      return ax - bx;
  });

  tbody.innerHTML = "";
  if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted">No items expiring within 30 days, and none expired.</td>`;
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
      <td>${scheduleBadge(m.schedule)}</td>
      <td>
          <button class="btn small" onclick="promoteMed('${m.id}')">Promote</button>
          <button class="btn small ghost" onclick="openEditMed('${m.id}')">Edit</button>
          <button class="btn small" onclick="disposeMedicine('${m.id}')">Dispose</button>
      </td>`;
      tbody.appendChild(tr);
  }
}

// ---------- Suppliers ----------
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

// ---------- Customers (CRM) ----------
function nextRefillDate(customer){
  if (!customer.lastPurchaseISO) return null;
  const days = Math.max(7, Number(customer.refillDays || 30));
  return addDays(customer.lastPurchaseISO, days);
}
function dueStatus(dueISO){
  if (!dueISO) return "No history";
  const d=new Date(dueISO), today=new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  if (d.getTime()===today.getTime()) return "Due today";
  return d<today ? `Overdue by ${Math.ceil((today-d)/(1000*60*60*24))} d` : `Due in ${Math.ceil((d-today)/(1000*60*60*24))} d`;
}
function renderCustomers(){
  const tbody = document.querySelector("#custTable tbody");
  if (!tbody) return;
  const q = (document.getElementById("customerSearch")?.value || "").toLowerCase();
  const rows = state.customers
    .filter(c => !q || (c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)));
  tbody.innerHTML = "";
  rows.forEach(c=>{
    const last = c.lastPurchaseISO ? formatDate(c.lastPurchaseISO) : "—";
    const next = nextRefillDate(c);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name} ${c.chronic?'<span class="badge crm" title="Chronic">Chronic</span>':''}</td>
      <td>${c.phone||"—"}</td>
      <td>${c.conditions||"—"}</td>
      <td>${c.refillDays||30} days</td>
      <td>${last}</td>
      <td>${next?formatDate(next):"—"}</td>
      <td>
        <button class="btn small ghost" onclick="editCustomer('${c.id}')">Edit</button>
        <button class="btn small" onclick="deleteCustomer('${c.id}')">Delete</button>
        <button class="btn small" onclick="sendReminder('${c.id}','whatsapp')">WhatsApp</button>
        <button class="btn small ghost" onclick="sendReminder('${c.id}','sms')">SMS</button>
      </td>`;
    tbody.appendChild(tr);
  });
}
function renderDueReminders(){
  const tbody = document.querySelector("#dueTable tbody");
  if (!tbody) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const dueList = state.customers
    .map(c=>({c, due: nextRefillDate(c)}))
    .filter(x => x.due && new Date(x.due) <= addDays(today.toISOString(), 3)); // due/overdue/within 3 days
  tbody.innerHTML = "";
  if (!dueList.length){
    const tr=document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="muted">No customers due in the next 3 days.</td>`;
    tbody.appendChild(tr);
    return;
  }
  dueList.sort((a,b)=> new Date(a.due)-new Date(b.due)).forEach(({c,due})=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.phone||"—"}</td>
      <td>${formatDate(due)}</td>
      <td>${dueStatus(due)}</td>
      <td>
        <button class="btn small" onclick="sendReminder('${c.id}','whatsapp')">WhatsApp</button>
        <button class="btn small ghost" onclick="sendReminder('${c.id}','sms')">SMS</button>
      </td>`;
    tbody.appendChild(tr);
  });
}
function renderPendingRx(){
  const tbody = document.querySelector("#pendingRxTable tbody");
  if (!tbody) return;
  const medById = Object.fromEntries(state.medicines.map(m=>[m.id,m]));
  const custById = Object.fromEntries(state.customers.map(c=>[c.id,c]));
  const pending = state.sales.filter(s=>{
    const med = medById[s.medId];
    if (!med || med.schedule==='OTC') return false;
    const rx = s.rx||{};
    if (med.schedule==='X'){
      return !(rx.no && rx.doctor && rx.reg && rx.patient && rx.address && rx.retainedCopy);
    }
    return !(rx.no && rx.doctor && rx.reg);
  }).map(s=>{
    const med = medById[s.medId]; const rx=s.rx||{};
    const missing=[];
    if (med.schedule==='X'){
      if(!rx.no)missing.push('Rx No'); if(!rx.doctor)missing.push('Doctor'); if(!rx.reg)missing.push('Reg');
      if(!rx.patient)missing.push('Patient'); if(!rx.address)missing.push('Address'); if(!rx.retainedCopy)missing.push('Retained Copy');
    }else{
      if(!rx.no)missing.push('Rx No'); if(!rx.doctor)missing.push('Doctor'); if(!rx.reg)missing.push('Reg');
    }
    return {
      date: s.date, customer: custById[s.customerId]?.name || '—',
      phone: custById[s.customerId]?.phone || '',
      med: med?.name || s.medId, schedule: med?.schedule || '',
      missing: missing.join(', '), customerId: s.customerId
    };
  });

  tbody.innerHTML = "";
  if (!pending.length){
    const tr=document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="muted">No pending prescriptions 🎉</td>`;
    tbody.appendChild(tr);
    return;
  }
  pending.sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(p=>{
    const tr=document.createElement("tr");
    const msg = encodeURIComponent(`Hello ${p.customer||''}, we still need the following for your ${p.med} (${p.schedule}) sale on ${formatDate(p.date)}: ${p.missing}. Please share the prescription / details.`);
    const wa = `https://wa.me/${phoneDigits(p.phone)}?text=${msg}`;
    const sm = `sms:${phoneDigits(p.phone)}?&body=${msg}`;
    tr.innerHTML = `
      <td>${formatDate(p.date)}</td>
      <td>${p.customer||'—'}</td>
      <td>${p.med}</td>
      <td>${p.schedule}</td>
      <td>${p.missing}</td>
      <td>
        ${p.phone ? `<a class="btn small" href="${wa}" target="_blank">WhatsApp</a>
        <a class="btn small ghost" href="${sm}">SMS</a>` : '<span class="muted">No phone</span>'}
      </td>`;
    tbody.appendChild(tr);
  });
}
function addCustomer(){
  const name = prompt("Customer name"); if (!name) return;
  const phone = prompt("Phone (+91...)") || "";
  const chronic = /^y/i.test(prompt("Chronic patient? (y/n)","y")||"y");
  const conditions = prompt("Conditions (comma separated)", chronic ? "Diabetes/Hypertension" : "") || "";
  const refillDays = Number(prompt("Refill cycle (days)", "30")) || 30;
  state.customers.push({ id:id("c"), name, phone, notes:"", chronic, conditions, refillDays, lastPurchaseISO:null });
  saveState(); renderAll();
}
function editCustomer(id){
  const c = state.customers.find(x=>x.id===id); if(!c) return;
  const name = prompt("Name", c.name); if (name==null) return;
  c.name = name;
  c.phone = prompt("Phone", c.phone||"") || c.phone;
  c.conditions = prompt("Conditions", c.conditions||"") || c.conditions;
  const chronic = prompt("Chronic? (y/n)", c.chronic?"y":"n"); if (chronic!=null) c.chronic = /^y/i.test(chronic);
  const rd = Number(prompt("Refill days", c.refillDays||30)); if (rd) c.refillDays = rd;
  saveState(); renderAll();
}
function deleteCustomer(id){
  if (!confirm("Delete customer?")) return;
  state.customers = state.customers.filter(c=>c.id!==id);
  // keep sales history but detach
  state.sales = state.sales.map(s=> s.customerId===id ? {...s, customerId: ""} : s);
  saveState(); renderAll();
}
function sendReminder(customerId, type='whatsapp'){
  const c = state.customers.find(x=>x.id===customerId); if(!c) return alert("Customer not found");
  const due = nextRefillDate(c);
  const dueTxt = due ? ` around ${formatDate(due)}` : "";
  const text = `Hi ${c.name}, this is a reminder from your pharmacy about your ${c.conditions||'medicine'} refill${dueTxt}. Reply to confirm or for home delivery.`;
  const enc = encodeURIComponent(text);
  if (type==='whatsapp'){
    if (!c.phone) return alert("Missing phone number");
    window.open(`https://wa.me/${phoneDigits(c.phone)}?text=${enc}`, "_blank");
  } else {
    if (!c.phone) return alert("Missing phone number");
    window.location.href = `sms:${phoneDigits(c.phone)}?&body=${enc}`;
  }
}

// ---------- Enhanced Sales UI (includes customer linkage & Rx validation) ----------
function makeRxFields() {
  const wrap = document.createElement('div');
  wrap.className = 'rx-fields';
  wrap.innerHTML = `
    <div class="rx-title">Prescription details (required for Schedule H/H1/X)</div>
    <div class="form-row">
      <input class="rx-no" placeholder="Prescription No." />
      <input class="rx-doctor" placeholder="Prescriber name" />
      <input class="rx-reg" placeholder="Prescriber reg. no." />
    </div>
    <div class="form-row">
      <input class="rx-patient" placeholder="Patient name" />
      <input class="rx-address" placeholder="Patient address" style="min-width:260px" />
      <label class="muted" style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" class="rx-retained" /> Retained duplicate/copy (Schedule X)
      </label>
    </div>
    <div class="rx-warn"></div>`;
  return wrap;
}

function makeSaleRow(defaultQty = 1) {
  const row = document.createElement("div");
  row.className = "form-row sale-line";
  row.innerHTML = `
    <select class="sale-med" style="min-width:220px"></select>
    <input class="sale-qty" type="number" min="1" value="${defaultQty}" style="width:100px" />
    <div class="form-row" style="gap:6px">
      <span class="chip" data-q="1">1</span>
      <span class="chip" data-q="2">2</span>
      <span class="chip" data-q="5">5</span>
      <span class="chip" data-q="10">10</span>
    </div>
    <button class="btn small ghost remove-line" type="button">Remove</button>`;
  const sel = row.querySelector(".sale-med");
  sel.innerHTML = '<option value="">Select medicine</option>';
  state.medicines.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.text = `${m.name} — ${m.qty} in stock`;
    sel.appendChild(opt);
  });
  const rx = makeRxFields();
  row.appendChild(rx);
  const warnEl = rx.querySelector('.rx-warn');

  function toggleRx() {
    const medId = sel.value;
    const med = state.medicines.find(m => m.id === medId);
    if (!med || med.schedule === 'OTC') {
      rx.classList.remove('visible'); warnEl.textContent = ''; return;
    }
    rx.classList.add('visible');
    warnEl.textContent = (med.schedule==='X')
      ? 'Schedule X: Rx fields mandatory + retained copy.'
      : 'Schedule H/H1: Rx particulars required.';
  }
  sel.addEventListener('change', toggleRx);
  toggleRx();

  row.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
    row.querySelector(".sale-qty").value = chip.dataset.q;
  }));
  row.querySelector(".remove-line").addEventListener("click", () => { row.remove(); });
  return row;
}

function showCustomerHint(){
  const sc = document.getElementById("saleCustomer");
  const hint = document.getElementById("customerHint");
  if (!sc || !hint) return;
  const c = state.customers.find(x=>x.id===sc.value);
  if (!c){ hint.style.display='none'; return; }
  const next = nextRefillDate(c);
  hint.textContent = `Refill cycle: ${c.refillDays||30} days${next?` • Next due ${formatDate(next)}`:''}`;
  hint.style.display = '';
}

function renderSalesUI() {
  const container = document.getElementById("saleRows");
  if (container && container.querySelectorAll(".sale-line").length === 0) {
    container.appendChild(makeSaleRow(1));
  }
  const tbody = document.querySelector("#salesLog tbody");
  if (!tbody) return;
  const medById = Object.fromEntries(state.medicines.map(m=>[m.id,m]));
  const custById = Object.fromEntries(state.customers.map(c=>[c.id,c]));
  tbody.innerHTML = "";
  state.sales.slice().reverse().forEach((s) => {
    const med = medById[s.medId] || { name: "(deleted)", schedule: "OTC" };
    const cust = custById[s.customerId] || null;
    const rxInfo = s.rx ? `${med.schedule}${s.rx?.no ? " / " + s.rx.no : ""}` : med.schedule || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(s.date).toLocaleString()}</td>
      <td>${cust?cust.name:"—"}</td>
      <td>${med.name}</td>
      <td>${s.qty}</td>
      <td>₹ ${s.total.toFixed(2)}</td>
      <td>${rxInfo}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------- Edit / CRUD for meds & suppliers ----------
function openEditMed(id) {
  const m = state.medicines.find((x) => x.id === id);
  const name = prompt("Medicine name", m.name);
  if (name == null) return;
  m.name = name;
  m.qty = Number(prompt("Quantity", m.qty)) || m.qty;
  m.expiry = prompt("Expiry (YYYY-MM-DD)", m.expiry) || m.expiry;
  m.rating = Number(prompt("Rating 1-5", m.rating || 3)) || m.rating;
  const schedule = prompt("Schedule (OTC/H/H1/X)", m.schedule || "OTC") || m.schedule || "OTC";
  m.schedule = /^(OTC|H|H1|X)$/i.test(schedule) ? schedule.toUpperCase() : m.schedule;
  saveState();
  renderAll();
}
function deleteMed(id) {
  if (!confirm("Delete this medicine?")) return;
  state.medicines = state.medicines.filter((m) => m.id !== id);
  saveState(); renderAll();
}
function promoteMed(id) { alert("Marking as promotional — consider discounting or placing on front shelf."); }
function addNewMedicine() {
  const name = prompt("Name"); if (!name) return;
  const batch = prompt("Batch") || "";
  const supplier = prompt("Supplier ID (or leave blank)") || "";
  const qty = Number(prompt("Qty", "0")) || 0;
  const expiry = prompt("Expiry (YYYY-MM-DD)") || "";
  const rating = Number(prompt("Rating 1-5", "3")) || 3;
  const price = Number(prompt("Price per unit", "1.0")) || 1.0;
  const schedule = (prompt("Schedule (OTC/H/H1/X)", "OTC") || "OTC").toUpperCase();
  const med = { id: id("m"), name, batch, supplierId: supplier, qty, expiry, rating, price, schedule: /^(OTC|H|H1|X)$/.test(schedule) ? schedule : 'OTC' };
  state.medicines.push(med);
  saveState(); renderAll();
}
function addSupplier() {
  const name = prompt("Supplier name"); if (!name) return;
  const contact = prompt("Contact") || "";
  const notes = prompt("Notes") || "";
  state.suppliers.push({ id: id("s"), name, contact, notes });
  saveState(); renderAll();
}
function editSupplier(id) {
  const s = state.suppliers.find((x) => x.id === id);
  const name = prompt("Name", s.name);
  if (name == null) return;
  s.name = name;
  s.contact = prompt("Contact", s.contact) || s.contact;
  s.notes = prompt("Notes", s.notes) || s.notes;
  saveState(); renderAll();
}
function deleteSupplier(id) {
  if (!confirm("Delete supplier? This does not remove medicines.")) return;
  state.suppliers = state.suppliers.filter((s) => s.id !== id);
  saveState(); renderAll();
}

// ---------- Restock / Disposal ----------
function restockMed(medId, suggested) {
  const med = state.medicines.find((m) => m.id === medId);
  if (!med) return alert("Medicine not found");
  const qty = Number(prompt(`Restock units for "${med.name}"`, String(suggested))) || 0;
  if (qty <= 0) return;
  med.qty = (med.qty || 0) + qty;
  state.purchases.push({ date: new Date().toISOString(), supplierId: med.supplierId || "", items: [{ medId: med.id, batch: med.batch, qty, price: med.price || 0 }] });
  saveState(); renderAll(); alert(`Restocked ${qty} units of ${med.name}.`);
}
function disposeMedicine(medId) {
  const med = state.medicines.find(m => m.id === medId);
  if (!med) return alert("Medicine not found");
  const qty = Number(prompt(`Dispose quantity for "${med.name}"`, "0") || "0");
  if (!qty || qty < 0 || qty > (med.qty || 0)) return alert("Invalid quantity");
  const reason = prompt("Reason (expired/damaged/recall):", "expired") || "expired";
  med.qty -= qty;
  state.disposals.push({ date: new Date().toISOString(), medId: med.id, batch: med.batch, qty, reason });
  saveState(); renderAll(); alert(`Disposed ${qty} units of ${med.name}.`);
}

// ---------- Sales recording (validates Rx; attaches customer; updates lastPurchase) ----------
function recordAllSales() {
  const rows = Array.from(document.querySelectorAll("#saleRows .sale-line"));
  if (!rows.length) return alert("Add at least one item");
  const saleCustomerId = document.getElementById("saleCustomer")?.value || "";

  let totalLines = 0;
  for (const row of rows) {
    const medSel = row.querySelector(".sale-med");
    const qtyInput = row.querySelector(".sale-qty");
    if (!medSel || !qtyInput) continue;

    const medId = medSel.value;
    const qty = Number(qtyInput.value) || 0;
    if (!medId || qty <= 0) continue;

    const med = state.medicines.find((m) => m.id === medId);
    if (!med) { alert("Medicine not found"); continue; }
    if (med.qty < qty) { alert(`Not enough stock for ${med.name}`); continue; }

    const rxWrap = row.querySelector('.rx-fields');
    const rx = {
      no: (rxWrap?.querySelector('.rx-no')?.value || '').trim(),
      doctor: (rxWrap?.querySelector('.rx-doctor')?.value || '').trim(),
      reg: (rxWrap?.querySelector('.rx-reg')?.value || '').trim(),
      patient: (rxWrap?.querySelector('.rx-patient')?.value || '').trim(),
      address: (rxWrap?.querySelector('.rx-address')?.value || '').trim(),
      retainedCopy: !!(rxWrap?.querySelector('.rx-retained')?.checked)
    };

    if (med.schedule === 'X') {
      const missing = [];
      if (!rx.no) missing.push("Prescription No.");
      if (!rx.doctor) missing.push("Prescriber");
      if (!rx.reg) missing.push("Reg. No.");
      if (!rx.patient) missing.push("Patient");
      if (!rx.address) missing.push("Address");
      if (!rx.retainedCopy) missing.push("Retained Copy (tick)");
      if (missing.length) { alert(`Schedule X requires: ${missing.join(", ")} for ${med.name}.`); continue; }
    } else if (med.schedule === 'H' || med.schedule === 'H1') {
      if (!rx.no || !rx.doctor || !rx.reg) { alert(`Schedule ${med.schedule} requires Rx No., Prescriber name, and Reg. No. for ${med.name}.`); continue; }
    }

    med.qty -= qty;
    const unitPrice = med.price || 1;
    const total = qty * unitPrice;
    const saleEntry = { id: id("t"), date: new Date().toISOString(), medId, qty, total, unitPrice, customerId: saleCustomerId || "" };
    if (med.schedule !== 'OTC') saleEntry.rx = rx;
    state.sales.push(saleEntry);

    // update customer lastPurchase
    const cust = state.customers.find(c=>c.id===saleCustomerId);
    if (cust) cust.lastPurchaseISO = saleEntry.date;

    totalLines++;
  }

  if (!totalLines) return alert("No valid lines to record");
  saveState();

  const container = document.getElementById("saleRows");
  container.innerHTML = "";
  container.appendChild(makeSaleRow(1));
  renderAll();
  showView("sales");
  alert(`Recorded ${totalLines} line(s) of sale.`);
}

// ---------- Charts & KPIs (unchanged core logic) ----------
let salesChart, stockChart, expiryChart, monthlySalesChart, productSalesChart, supplierShareChart;
function groupSalesByMonth(sales) {
  const map = new Map();
  sales.forEach((s) => { const d = new Date(s.date); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; map.set(key, (map.get(key) || 0) + (s.total || 0)); });
  return map;
}
function lastNMonths(n) { const arr = []; const d = new Date(); d.setDate(1); for (let i=n-1;i>=0;i--){ const dt=new Date(d); dt.setMonth(d.getMonth()-i); arr.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`);} return arr; }
function monthLabel(ym) { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m)-1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" }); }
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
function renderCharts() {
  const rangeSel = document.getElementById("salesRange");
  const days = Number(rangeSel ? rangeSel.value : 7);
  const labels = [], data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString());
    const sum = state.sales.filter((s) => s.date.slice(0, 10) === key).reduce((a, b) => a + b.total, 0);
    data.push(Number(sum.toFixed(2)));
  }
  const ctx = document.getElementById("salesChart").getContext("2d");
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, { type: "line", data: { labels, datasets: [{ label: "Revenue (₹)", data, tension: 0.3 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });

  const top = state.medicines.slice().sort((a, b) => b.qty - a.qty).slice(0, 6);
  const ctx2 = document.getElementById("stockChart")?.getContext("2d");
  if (ctx2) { if (stockChart) stockChart.destroy(); stockChart = new Chart(ctx2, { type: "pie", data: { labels: top.map((x) => x.name), datasets: [{ data: top.map((x) => x.qty) }] }, options: { plugins: { legend: { position: "bottom" } } } }); }

  const soon = state.medicines.filter((m) => { const d = daysUntil(m.expiry); return d <= 30 && d >= 0; }).length;
  const expired = state.medicines.filter((m) => daysUntil(m.expiry) < 0).length;
  const ok = Math.max(0, state.medicines.length - soon - expired);
  const ctx3 = document.getElementById("expiryChart")?.getContext("2d");
  if (ctx3) { if (expiryChart) expiryChart.destroy(); expiryChart = new Chart(ctx3, { type: "doughnut", data: { labels: ["OK","Soon","Expired"], datasets: [{ data: [ok, soon, expired] }] } }); }

  const months = lastNMonths(12);
  const monthMap = groupSalesByMonth(state.sales.filter((s) => inRange(s.date)));
  const monthData = months.map((m) => Number((monthMap.get(m) || 0).toFixed(2)));
  const ctx4 = document.getElementById("monthlySalesChart")?.getContext("2d");
  if (ctx4) { if (monthlySalesChart) monthlySalesChart.destroy(); monthlySalesChart = new Chart(ctx4, { type: "line", data: { labels: months.map(monthLabel), datasets: [{ label: "Revenue (₹)", data: monthData, tension: 0.3 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); }

  const revenueByMed = new Map();
  state.sales.filter((s) => inRange(s.date)).forEach((s) => { revenueByMed.set(s.medId, (revenueByMed.get(s.medId) || 0) + (s.total || 0)); });
  const topMed = Array.from(revenueByMed.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ctx5 = document.getElementById("productSalesChart")?.getContext("2d");
  if (ctx5) { if (productSalesChart) productSalesChart.destroy(); productSalesChart = new Chart(ctx5, { type: "bar", data: { labels: topMed.map(([id]) => state.medicines.find((m) => m.id === id)?.name || "(deleted)"), datasets: [{ label: "₹", data: topMed.map(([, v]) => Number(v.toFixed(2))) }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); }

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
  if (ctx6) { if (supplierShareChart) supplierShareChart.destroy(); supplierShareChart = new Chart(ctx6, { type: "pie", data: { labels: supLabels, datasets: [{ data: supValues }] }, options: { plugins: { legend: { position: "bottom" } } } }); }

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
      parsed.settings = parsed.settings || { lowStockThreshold: 30 };
      parsed.purchases = parsed.purchases || [];
      parsed.disposals = parsed.disposals || [];
      parsed.controlledLogs = parsed.controlledLogs || [];
      parsed.gstInvoices = parsed.gstInvoices || [];
      parsed.customers = parsed.customers || [];
      parsed.compliance = parsed.compliance || { scheduleXRegister: [] };
      (parsed.medicines || []).forEach(m => { if (!m.schedule) m.schedule = m.controlled ? 'X' : 'OTC'; });
      state = parsed; saveState(); renderAll(); alert("Imported");
    } catch { alert("Invalid file"); }
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

// ---------- Compliance Register + Audit builders ----------
function parseMonthInput(val) { if (!val) return null; const [y, m] = val.split('-').map(Number); const from = new Date(Date.UTC(y, m - 1, 1)); const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); return { from: from.toISOString(), to: to.toISOString() }; }
function inRangeAudit(iso, fromIso, toIso) { if (!fromIso && !toIso) return true; const t = new Date(iso).getTime(); return (!fromIso || t >= new Date(fromIso).getTime()) && (!toIso || t <= new Date(toIso).getTime()); }

function buildScheduleXRegister() {
  const medById = Object.fromEntries(state.medicines.map(m => [m.id, m]));
  const events = [];
  (state.purchases || []).forEach(p => p.items.forEach(it => {
    const med = medById[it.medId]; if (med?.schedule !== 'X') return;
    events.push({ date: p.date, medId: med.id, batch: it.batch, type: 'RECEIPT', particulars: `From supplier ${p.supplierId || ''}`, receipt: it.qty, issue: 0 });
  }));
  (state.sales || []).forEach(s => {
    const med = medById[s.medId]; if (med?.schedule !== 'X') return;
    const rx = s.rx || {};
    events.push({ date: s.date, medId: med.id, batch: med.batch, type: 'ISSUE', particulars: `To ${rx.patient || ''} (Rx ${rx.no || ''}; Dr ${rx.doctor || ''}/${rx.reg || ''})`, receipt: 0, issue: s.qty });
  });
  (state.disposals || []).forEach(d => {
    const med = medById[d.medId]; if (med?.schedule !== 'X') return;
    events.push({ date: d.date, medId: med.id, batch: d.batch, type: 'DISPOSAL', particulars: `Disposed (${d.reason})`, receipt: 0, issue: d.qty });
  });
  events.sort((a,b)=> new Date(a.date)-new Date(b.date));
  const balanceMap = new Map();
  const rows = events.map(ev => {
    const key = ev.medId + "|" + ev.batch;
    const prev = balanceMap.get(key) || 0;
    const bal = prev + ev.receipt - ev.issue;
    balanceMap.set(key, bal);
    const med = medById[ev.medId] || {};
    return { date: ev.date, medicine: med.name || ev.medId, batch: ev.batch || (med.batch || ''), type: ev.type, particulars: ev.particulars, receipt: ev.receipt, issue: ev.issue, balance: bal };
  });
  return rows;
}

function buildAuditData() {
  const data = state;
  const fromMonth = document.getElementById('reportFrom')?.value || '';
  const toMonth   = document.getElementById('reportTo')?.value || '';
  const from = parseMonthInput(fromMonth)?.from || null;
  const to   = parseMonthInput(toMonth)?.to   || null;

  const idxMedById = Object.fromEntries(data.medicines.map(m => [m.id, m]));
  const idxSup = Object.fromEntries(data.suppliers.map(s => [s.id, s]));
  const idxCust = Object.fromEntries(data.customers.map(c=>[c.id,c]));

  const purchases = (data.purchases || []).filter(p => inRangeAudit(p.date, from, to))
    .flatMap(p => p.items.map(it => ({
      date: p.date, supplier: idxSup[p.supplierId]?.name || p.supplierId || '',
      med: (idxMedById[it.medId]?.name) || it.medId, batch: it.batch, qty: it.qty, price: it.price, amount: +(it.qty * it.price).toFixed(2)
    })));

  const sales = (data.sales || []).filter(s => inRangeAudit(s.date, from, to))
    .map(s => {
      const med = idxMedById[s.medId];
      const cust = idxCust[s.customerId];
      const amount = +(s.qty * (s.unitPrice ?? med?.price ?? 0)).toFixed(2);
      return {
        date: s.date, customer: cust?.name || '', phone: cust?.phone || '',
        med: med?.name || s.medId, batch: med?.batch || '',
        qty: s.qty, unitPrice: (s.unitPrice ?? med?.price ?? 0), amount,
        schedule: med?.schedule || 'OTC',
        rxNo: s.rx?.no || '', prescriber: s.rx?.doctor || '', regNo: s.rx?.reg || '',
        patient: s.rx?.patient || '', patientAddress: s.rx?.address || '', retainedCopy: s.rx?.retainedCopy ? 'Yes' : ''
      };
    });

  const hxSales = sales.filter(r => r.schedule === 'H' || r.schedule === 'H1');
  const scheduleXRegister = buildScheduleXRegister().filter(r => inRangeAudit(r.date, from, to));

  // Pending Rx list
  const pendingRx = (data.sales || []).filter(s => {
    if (!inRangeAudit(s.date, from, to)) return false;
    const med = idxMedById[s.medId]; if (!med || med.schedule==='OTC') return false;
    const rx=s.rx||{};
    if (med.schedule==='X') return !(rx.no && rx.doctor && rx.reg && rx.patient && rx.address && rx.retainedCopy);
    return !(rx.no && rx.doctor && rx.reg);
  }).map(s=>{
    const med = idxMedById[s.medId]; const cust=idxCust[s.customerId]; const rx=s.rx||{};
    const missing=[];
    if (med.schedule==='X'){ if(!rx.no)missing.push('Rx No'); if(!rx.doctor)missing.push('Doctor'); if(!rx.reg)missing.push('Reg'); if(!rx.patient)missing.push('Patient'); if(!rx.address)missing.push('Address'); if(!rx.retainedCopy)missing.push('Retained Copy'); }
    else { if(!rx.no)missing.push('Rx No'); if(!rx.doctor)missing.push('Doctor'); if(!rx.reg)missing.push('Reg'); }
    return { date:s.date, customer:cust?.name||'', phone:cust?.phone||'', med:med?.name||s.medId, schedule:med?.schedule||'', missing:missing.join(', ') };
  });

  const disposals = (data.disposals || []).filter(d => inRangeAudit(d.date, from, to))
    .map(d => { const med = idxMedById[d.medId]; return { date: d.date, med: med?.name || d.medId, batch: d.batch, qty: d.qty, reason: d.reason }; });

  const controlled = []; // kept for backwards compat

  const gst = (data.gstInvoices || []).filter(i => inRangeAudit(i.date, from, to))
    .map(i => { const total = i.items.reduce((sum, it) => { const med = idxMedById[it.medId]; const price = it.price ?? med?.price ?? 0; const line = it.qty * price; const tax = line * (Number(it.gstPercent || 0) / 100); return sum + line + tax; }, 0); return { date: i.date, invoiceNo: i.invoiceNo, items: i.items.length, total: +total.toFixed(2) }; });

  return {
    purchases, sales, hxSales, scheduleXRegister, pendingRx, disposals, controlled, gst,
    customers: state.customers.map(c=>({ name:c.name, phone:c.phone, chronic:c.chronic?'Yes':'No', conditions:c.conditions||'', refillDays:c.refillDays||30, lastPurchase:c.lastPurchaseISO||'' })),
    meta: { generatedAt: new Date().toISOString(), rangeFrom: from || 'All', rangeTo: to || 'All', version: 'audit.v3.crm' }
  };
}

function exportAuditExcel() {
  try {
    const safeDate = () => new Date().toISOString().slice(0,10);
    const supplierMap = Object.fromEntries(state.suppliers.map(s => [s.id, s.name]));
    const medById     = Object.fromEntries(state.medicines.map(m => [m.id, m]));
    const custById    = Object.fromEntries(state.customers.map(c=>[c.id,c]));

    const allSalesRows = state.sales.slice().sort((a,b)=> new Date(a.date)-new Date(b.date)).map(s=>{
      const m = medById[s.medId] || {};
      const c = custById[s.customerId] || {};
      const supplierName = supplierMap[m?.supplierId] || (m?.supplierId || "");
      const unitPrice = (s.unitPrice ?? m?.price ?? 0);
      const total = +(unitPrice * (s.qty || 0)).toFixed(2);
      return {
        "Date (ISO)": s.date, "Customer": c.name||"", "Phone": c.phone||"",
        "Medicine": m?.name || s.medId, "Batch": m?.batch || "", "Supplier": supplierName,
        "Qty": s.qty || 0, "Unit Price (₹)": unitPrice, "Total (₹)": total, "Schedule": m?.schedule || 'OTC',
        "Rx No.": s.rx?.no || "", "Prescriber": s.rx?.doctor || "", "Reg. No.": s.rx?.reg || "",
        "Patient": s.rx?.patient || "", "Patient Address": s.rx?.address || "", "Retained Copy (X)": s.rx?.retainedCopy ? "Yes" : ""
      };
    });

    const { purchases, sales, hxSales, scheduleXRegister, pendingRx, disposals, controlled, gst, customers, meta } = buildAuditData();

    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows, colWidths) => {
      const safe = (name || "Sheet").toString().slice(0,31).replace(/[\\/?*:[\]]/g,"-");
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "No data" }]);
      if (colWidths && Array.isArray(colWidths)) ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, safe);
    };

    addSheet("Customers", customers, [24,16,10,28,12,20]);
    addSheet("Sales_All", allSalesRows, [22,22,16,28,14,22,8,14,14,10,16,12,16,22,12]);
    addSheet("Sales_Range", sales, [22,22,16,28,14,8,14,14,10,12,12,14,18,10]);
    addSheet("Purchases", purchases, [22,22,28,14,10,12]);
    addSheet("PendingRx", pendingRx, [22,22,16,28,10,28]);
    addSheet("ScheduleHX_Sales", hxSales, [22, 28, 12, 8, 12, 12, 16, 18, 20, 10]);
    addSheet("ScheduleX_Register", scheduleXRegister, [22, 28, 14, 10, 42, 10, 10, 10]);
    addSheet("Disposals", disposals, [22, 28, 14, 8, 16]);
    addSheet("GST", gst, [22, 18, 8, 14]);
    addSheet("Meta", [meta], [30, 20, 20, 14]);

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Audit_CRM_${safeDate()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  } catch (e) { console.error(e); alert("Excel export failed. See console for details."); }
}

async function exportAuditPDF() {
  const { jsPDF } = window.jspdf;
  const audit = buildAuditData();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const line = (txt, y) => doc.text(txt, 40, y);
  let y = 40;
  doc.setFontSize(14); line('Pharmacy Audit Report', y); y += 20;
  doc.setFontSize(10);
  line(`Generated: ${audit.meta.generatedAt}`, y); y += 14;
  line(`Range: ${audit.meta.rangeFrom} → ${audit.meta.rangeTo}`, y); y += 20;

  function section(title, rows, fields, maxRows = 18) {
    doc.setFontSize(12); line(title, y); y += 14;
    doc.setFontSize(9);
    const head = fields.join(' | '); line(head, y); y += 12;
    rows.slice(0, maxRows).forEach(r => {
      const rowTxt = fields.map(f => String(r[f] ?? '')).join(' | ');
      if (y > 770) { doc.addPage(); y = 40; }
      line(rowTxt, y); y += 12;
    });
    if (rows.length > maxRows) { line(`… ${rows.length - maxRows} more`, y); y += 12; }
    y += 8;
  }

  section('Customers', audit.customers, ['name','phone','chronic','conditions','refillDays','lastPurchase'], 10);
  section('Purchases',  audit.purchases, ['date','supplier','med','batch','qty','amount']);
  section('Sales (range)', audit.sales,     ['date','customer','med','qty','unitPrice','amount']);
  section('Pending Prescriptions', audit.pendingRx, ['date','customer','med','schedule','missing']);
  section('Schedule X Register', audit.scheduleXRegister, ['date','medicine','batch','type','particulars','receipt','issue','balance']);
  section('Disposals',  audit.disposals, ['date','med','batch','qty','reason']);
  section('GST',        audit.gst,       ['date','invoiceNo','items','total']);

  if (y > 770) { doc.addPage(); y = 40; }
  doc.setFontSize(8);
  line(`Version: ${audit.meta.version}`, y);

  doc.save(`Audit_CRM_${new Date().toISOString().slice(0,10)}.pdf`);
}

async function signAuditJSON() {
  const audit = buildAuditData();
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign','verify']);
  const enc = new TextEncoder();
  const bytes = enc.encode(JSON.stringify(audit));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, bytes);
  const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const sigBundle = { algo: 'ECDSA-P256-SHA256', signatureBase64: btoa(String.fromCharCode(...new Uint8Array(signature))), publicKeyJwk: pubJwk, generatedAt: new Date().toISOString() };
  const saveBlob = async (name, obj) => { const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  await saveBlob(`Audit_${new Date().toISOString().slice(0,10)}.json`, audit);
  await saveBlob(`Audit_${new Date().toISOString().slice(0,10)}.sig.json`, sigBundle);
  alert('Signed JSON and signature exported.');
}

// ---------- Cloud Backup (optional) ----------
const firebaseConfig = { apiKey: "YOUR_API_KEY", authDomain: "your-app.firebaseapp.com", databaseURL: "https://your-app-default-rtdb.firebaseio.com", projectId: "your-app", appId: "YOUR_APP_ID" };
try { if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); firebase.auth().signInAnonymously().catch(()=>{}); } } catch(e){}

async function backupToCloud() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) { alert('Cloud not configured or login failed.'); return; }
    const ref = firebase.database().ref(`pharmacies/${user.uid}/backups`).push();
    await ref.set({ createdAt: Date.now(), payload: state });
    alert('Backup complete in cloud.');
  } catch (e) { alert('Cloud backup failed. Configure Firebase keys in the code.'); }
}

// ---------- Event bindings ----------
document.getElementById("quickSearch").addEventListener("input", renderQuickList);
document.getElementById("filterBySupplier").addEventListener("input", renderMedTable);
document.getElementById("addMedQuick").addEventListener("click", addNewMedicine);
document.getElementById("addMedBtn").addEventListener("click", addNewMedicine);
document.getElementById("addSupplierBtn").addEventListener("click", addSupplier);

// Customers
document.getElementById("addCustomerBtn").addEventListener("click", addCustomer);
document.getElementById("customerSearch").addEventListener("input", renderCustomers);

// sales: rows and record
document.getElementById("addSaleRowBtn").addEventListener("click", () => {
  document.getElementById("saleRows").appendChild(makeSaleRow(2));
});
document.getElementById("recordAllSalesBtn").addEventListener("click", recordAllSales);
document.getElementById("quickAddCustomer").addEventListener("click", addCustomer);
document.getElementById("saleCustomer").addEventListener("change", showCustomerHint);

// file import/export
document.getElementById("exportBtn").addEventListener("click", exportJSON);
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e) => importJSONFile(e.target.files[0]));

// data reset/seed
document.getElementById("resetData").addEventListener("click", () => {
  if (confirm("Reset all data?")) {
    state = { medicines: [], suppliers: [], customers: [], sales: [], purchases: [], disposals: [], controlledLogs: [], gstInvoices: [], compliance: { scheduleXRegister: [] }, settings: { lowStockThreshold: 30 } };
    saveState(); renderAll();
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

// Audit buttons
document.getElementById('exportAuditExcel').addEventListener('click', exportAuditExcel);
document.getElementById('exportAuditPDF').addEventListener('click', exportAuditPDF);
document.getElementById('auditSignJSON').addEventListener('click', signAuditJSON);
document.getElementById('backupToCloud').addEventListener('click', backupToCloud);

// expose some globals
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.sendReminder = sendReminder;
window.deleteMed = deleteMed;
window.openEditMed = openEditMed;
window.promoteMed = promoteMed;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.restockMed = restockMed;
window.disposeMedicine = disposeMedicine;

// init
renderNav();
loadState();
if (!state.medicines.length && !state.suppliers.length && !state.customers.length) seedSample();
renderAll();
(() => {
  const modal = document.getElementById('composeModal');
  const txt = document.getElementById('composeText');
  const btnClose = document.getElementById('closeCompose');
  const btnCopy = document.getElementById('copyCompose');
  const btnEmail = document.getElementById('openEmailCompose');
  const btnWA = document.getElementById('openWhatsAppCompose');

  function openCompose(initialText = '') {
    if (typeof initialText === 'string') txt.value = initialText;
    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    // trap scroll
    document.documentElement.style.overflow = 'hidden';
    // focus text area
    setTimeout(() => txt.focus(), 0);
  }

  function closeCompose() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  // Close handlers
  btnClose?.addEventListener('click', closeCompose);
  // Click outside the card closes
  modal.addEventListener('click', e => {
    if (e.target === modal) closeCompose();
  });
  // ESC to close
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeCompose();
  });

  // Copy
  btnCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(txt.value);
      btnCopy.textContent = 'Copied!';
      setTimeout(() => (btnCopy.textContent = 'Copy'), 1200);
    } catch {
      alert('Copy failed. Select the text and press Ctrl/Cmd+C.');
    }
  });

  // Email (mailto)
  btnEmail?.addEventListener('click', () => {
    const subject = 'Medicine reorder';
    const body = txt.value || '';
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  });

  // WhatsApp (mobile or web)
  btnWA?.addEventListener('click', () => {
    const message = txt.value.trim();
    const enc = encodeURIComponent(message || 'Hello!');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/?text=${enc}`
      : `https://web.whatsapp.com/send?text=${enc}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Optional: auto-wire any button with [data-open-compose]
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-open-compose]');
    if (!trigger) return;
    e.preventDefault();
    const preset = trigger.getAttribute('data-compose-text') || '';
    openCompose(preset);
  });

  // Expose openCompose globally so you can call it from anywhere
  window.openCompose = openCompose;
  window.closeCompose = closeCompose;
})();