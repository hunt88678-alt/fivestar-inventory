// FIVE STAR FUEL FOODS — Cigarette Inventory Manager
// Netlify-ready version: index.html + app.js

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCHMIZb4-O3HM5xyFaWgMJDkCy9I4da8a4",
  authDomain: "fivestar-inventory-e408e.firebaseapp.com",
  projectId: "fivestar-inventory-e408e",
  storageBucket: "fivestar-inventory-e408e.firebasestorage.app",
  messagingSenderId: "102029163631",
  appId: "1:102029163631:web:86f1cccaf8b66565d3e19a"
};

const RESET_PASSCODE = "1912";
const LOW_STOCK_THRESHOLD = 3;
// Optional: put your real admin email here, for example: ["owner@gmail.com"]
// New registrations become regular users unless their email is listed here or you later change their role in Firestore.
const ADMIN_EMAILS = [];
const BRAND_COLORS = ["#e63946", "#2a9d8f", "#e9c46a", "#f4a261", "#457b9d", "#9b5de5", "#06d6a0", "#fb8500", "#818cf8", "#c77dff"];

let db = null;
let auth = null;
try {
  if (FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes("REPLACE")) {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
  }
} catch (e) {
  console.warn("Firebase unavailable, using localStorage.", e);
}

const uid = () => Math.random().toString(36).slice(2, 9);
const money = n => `$${Number(n || 0).toFixed(2)}`;
const calcProfit = (cartonCost, sellPack) => Number(sellPack || 0) - Number(cartonCost || 0) / 10;
const calcMargin = (cartonCost, sellPack) => sellPack ? (calcProfit(cartonCost, sellPack) / sellPack * 100) : 0;
const todayFull = () => new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const weekLabel = () => {
  const d = new Date();
  const s = new Date(d); s.setDate(d.getDate() - d.getDay());
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));

const defaultBrands = () => [
  { id: uid(), name: "Marlboro", color: "#e63946", products: [
    { id: uid(), type: "Red King", barcode: "", cartonCost: 52, sellPack: 9.49, maxStock: 20, cartons: 0, packs: 0 },
    { id: uid(), type: "Gold King", barcode: "", cartonCost: 52, sellPack: 9.49, maxStock: 15, cartons: 0, packs: 0 },
    { id: uid(), type: "Menthol King", barcode: "", cartonCost: 52, sellPack: 9.49, maxStock: 12, cartons: 0, packs: 0 },
    { id: uid(), type: "Silver King", barcode: "", cartonCost: 52, sellPack: 9.49, maxStock: 10, cartons: 0, packs: 0 }
  ]},
  { id: uid(), name: "Newport", color: "#2a9d8f", products: [
    { id: uid(), type: "Menthol King", barcode: "", cartonCost: 55, sellPack: 9.99, maxStock: 18, cartons: 0, packs: 0 },
    { id: uid(), type: "Menthol 100s", barcode: "", cartonCost: 55.5, sellPack: 10.09, maxStock: 12, cartons: 0, packs: 0 },
    { id: uid(), type: "Red King", barcode: "", cartonCost: 55, sellPack: 9.99, maxStock: 10, cartons: 0, packs: 0 }
  ]},
  { id: uid(), name: "Camel", color: "#e9c46a", products: [
    { id: uid(), type: "Blue King", barcode: "", cartonCost: 49, sellPack: 8.99, maxStock: 15, cartons: 0, packs: 0 },
    { id: uid(), type: "Crush King", barcode: "", cartonCost: 49.5, sellPack: 9.09, maxStock: 10, cartons: 0, packs: 0 }
  ]},
  { id: uid(), name: "Pall Mall", color: "#457b9d", products: [
    { id: uid(), type: "Red King", barcode: "", cartonCost: 40, sellPack: 7.49, maxStock: 12, cartons: 0, packs: 0 },
    { id: uid(), type: "Menthol King", barcode: "", cartonCost: 40, sellPack: 7.49, maxStock: 10, cartons: 0, packs: 0 }
  ]}
];

let state = {
  brands: [], tab: "dashboard", loading: true, search: "", toast: null, modal: null,
  scanInput: "", scanFound: null, scanNotFound: null, scanQty: 1, scanMode: "restock", scanLog: [],
  scanning: false, assignTarget: null, weeklyCounts: {}, lastCount: null, openBrands: {}, selectedBrandId: null, tempBarcode: "", authReady: false, user: null, role: null, authMode: "login", authError: ""
};

function isAdmin() { return state.role === "admin"; }
function isUser() { return state.role === "user" || state.role === "admin"; }
function requireLogin() { if (!state.user) { toast("Please log in first"); return false; } return true; }
function requireAdmin() { if (!isAdmin()) { toast("Admin access required"); return false; } return true; }
function canWriteStock() { return isUser(); }

function authHTML() {
  const isLogin = state.authMode !== "register";
  return `${style()}<div class="authPage"><div class="authCard"><div class="store">Five Star Fuel Foods</div><h1>🚬 Inventory Login</h1><p class="small">Sign in to view and manage inventory safely.</p>${state.authError ? `<div class="authError">${esc(state.authError)}</div>` : ""}<div class="field"><label>Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Minimum 6 characters"></div>${!isLogin ? `<p class="small">New accounts are regular user access by default. Change role to admin in Firestore users collection if needed.</p>` : ""}<button style="width:100%;margin-top:8px" onclick="${isLogin ? 'loginUser()' : 'registerUser()'}">${isLogin ? 'Login' : 'Create Account'}</button><button style="width:100%;margin-top:8px;background:none" onclick="state.authMode='${isLogin ? 'register' : 'login'}';state.authError='';render()">${isLogin ? 'Need an account? Register' : 'Already have account? Login'}</button><button style="width:100%;margin-top:8px;background:none" onclick="resetPassword()">Forgot Password</button></div></div>`;
}

async function loadUserRole(user) {
  if (!db || !user) return "user";
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data().role || "user";
  const role = ADMIN_EMAILS.map(e => e.toLowerCase()).includes((user.email || "").toLowerCase()) ? "admin" : "user";
  await ref.set({ email: user.email || "", role, createdAt: new Date().toISOString() }, { merge: true });
  return role;
}

async function loginUser() {
  if (!auth) return alert("Firebase Auth is not loaded. Check index.html Firebase Auth script.");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  state.authError = "";
  try { await auth.signInWithEmailAndPassword(email, password); }
  catch (e) { state.authError = e.message || "Login failed"; render(); }
}

async function registerUser() {
  if (!auth) return alert("Firebase Auth is not loaded. Check index.html Firebase Auth script.");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  state.authError = "";
  try { await auth.createUserWithEmailAndPassword(email, password); }
  catch (e) { state.authError = e.message || "Registration failed"; render(); }
}

async function resetPassword() {
  if (!auth) return;
  const email = document.getElementById("authEmail").value.trim();
  if (!email) { state.authError = "Enter your email first, then click Forgot Password."; render(); return; }
  try { await auth.sendPasswordResetEmail(email); state.authError = "Password reset email sent."; render(); }
  catch (e) { state.authError = e.message || "Could not send reset email"; render(); }
}

async function logoutUser() { if (auth) await auth.signOut(); }

function allProducts() {
  return state.brands.flatMap(b => b.products.map(p => ({ ...p, brandId: b.id, brandName: b.name, brandColor: b.color })));
}
function orderItems() {
  return allProducts().map(p => ({ ...p, toOrder: Math.max(0, Number(p.maxStock || 0) - Number(p.cartons || 0)) }))
    .filter(p => p.toOrder > 0).sort((a, b) => b.toOrder - a.toOrder);
}

async function loadData() {
  state.loading = true; render();
  if (db) {
    try {
      const snap = await db.collection("inventory").doc("brands").get();
      const meta = await db.collection("inventory").doc("meta").get();
      if (snap.exists) state.brands = snap.data().brands || [];
      if (meta.exists) state.lastCount = meta.data().lastCount || null;
    } catch (e) { console.warn(e); }
  }
  if (!state.brands.length) {
    try { state.brands = JSON.parse(localStorage.getItem("fivestar_brands") || "[]"); } catch {}
  }
  if (!state.brands.length) state.brands = defaultBrands();
  try { const m = JSON.parse(localStorage.getItem("fivestar_meta") || "{}"); if (m.lastCount) state.lastCount = m.lastCount; } catch {}
  state.loading = false; save(false); render();
}

async function save(show = false) {
  localStorage.setItem("fivestar_brands", JSON.stringify(state.brands));
  localStorage.setItem("fivestar_meta", JSON.stringify({ lastCount: state.lastCount }));
  if (db) {
    try { await db.collection("inventory").doc("brands").set({ brands: state.brands, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
    try { await db.collection("inventory").doc("meta").set({ lastCount: state.lastCount }); } catch {}
  }
  if (show) toast("Saved ✓");
}
function toast(msg) { state.toast = msg; render(); setTimeout(() => { state.toast = null; render(); }, 2200); }

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  if (!state.authReady) { root.innerHTML = `<div class="center"><div class="emoji">🔐</div><div class="muted pulse">CHECKING LOGIN...</div></div>${style()}`; return; }
  if (!state.user) { root.innerHTML = authHTML(); return; }
  if (state.loading) { root.innerHTML = `<div class="center"><div class="emoji">🚬</div><div class="muted pulse">CONNECTING...</div></div>${style()}`; return; }
  const ap = allProducts(), oi = orderItems(), low = ap.filter(p => p.cartons <= LOW_STOCK_THRESHOLD), out = ap.filter(p => p.cartons === 0);
  root.innerHTML = `${style()}${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}${state.modal ? modalHTML() : ""}${state.scanning ? cameraHTML() : ""}
    <header><div><div class="store">Oklahoma City · Five Star Fuel Foods</div><h1>🚬 Cigarette Inventory</h1><div class="small">${esc(state.user?.email || "")} · ${isAdmin()?"Admin":"User"}</div></div><div class="actions">
      ${out.length ? `<span class="pill danger">⛔ ${out.length} OUT</span>` : ""}${low.filter(p => p.cartons > 0).length ? `<span class="pill warn">⚠ ${low.filter(p => p.cartons > 0).length} LOW</span>` : ""}
      <button onclick="openScanner()">📷 Scan</button><button onclick="openWeekly()">📋 Count</button>${isAdmin()?`<button onclick="openBrandModal()">+ Brand</button>`:""}<button onclick="logoutUser()">Logout</button></div></header>
    <nav>${[["dashboard","Dashboard"],["inventory","Inventory"],["scanner","📷 Scanner"],["weekly","📋 Weekly"],["order",`📦 Order (${oi.length})`],["pricing","Pricing"],["alerts",`Alerts (${low.length})`],...(isAdmin() ? [["reset","🔴 Reset"]] : [])].map(([k,v]) => `<button class="${state.tab===k?'active':''}" onclick="setTab('${k}')">${v}</button>`).join("")}</nav>
    <main>${tabHTML(ap, oi, low, out)}</main>`;
  if (state.scanning) setTimeout(startCamera, 150);
}

function style() { return `<style>
  .center{height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:15px}.emoji{font-size:48px}.pulse{animation:pulse 1.2s infinite}.muted{color:#c8a96e;font-family:monospace;letter-spacing:3px}
  header{position:sticky;top:0;z-index:10;background:#0a0a0a;border-bottom:1px solid #181818;padding:14px 20px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:20px;margin:3px 0 0}.store{font-size:10px;letter-spacing:3px;color:#444;text-transform:uppercase}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  button{background:#c8a96e22;border:1px solid #c8a96e66;color:#c8a96e;border-radius:7px;padding:8px 12px;cursor:pointer;font-family:monospace;font-weight:700}button:hover{filter:brightness(1.2)}button.danger{border-color:#ef233c66;color:#ef233c;background:#ef233c18}
  nav{display:flex;overflow-x:auto;border-bottom:1px solid #181818;padding:0 20px}nav button{background:none;border:0;border-bottom:2px solid transparent;border-radius:0;color:#444;padding:12px 14px;text-transform:uppercase;font-size:11px;white-space:nowrap}.active{color:#c8a96e!important;border-bottom-color:#c8a96e!important}
  main{padding:20px;max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card{background:#131313;border:1px solid #1f1f1f;border-radius:12px;padding:15px}.kpi .label{font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase}.kpi .value{font-size:24px;font-family:monospace;font-weight:800;margin-top:6px}.row{display:flex;align-items:center;gap:10px;background:#0f0f0f;border:1px solid #181818;border-radius:9px;padding:11px;margin:6px 0}.grow{flex:1}.small{font-size:11px;color:#555;font-family:monospace}.pill{padding:4px 9px;border-radius:5px;font-size:10px;font-family:monospace}.danger{color:#ef233c}.warn{color:#fb8500}.ok{color:#06d6a0}.pill.danger{background:#ef233c18;border:1px solid #ef233c44}.pill.warn{background:#fb850018;border:1px solid #fb850044}.toast{position:fixed;top:16px;right:16px;background:#06d6a0;color:#000;padding:12px 18px;border-radius:9px;z-index:5000;font-family:monospace;font-weight:800}.modalBack{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px}.modal{background:#151515;border:1px solid #2a2a2a;border-top:3px solid #c8a96e;border-radius:14px;padding:22px;width:460px;max-width:100%;max-height:92vh;overflow:auto}.field{display:flex;flex-direction:column;gap:5px;margin:10px 0}.field label{font-size:10px;color:#666;letter-spacing:2px;text-transform:uppercase}.field input,.field select{background:#1c1c1c;border:1px solid #2a2a2a;color:#ddd;border-radius:7px;padding:10px;font-family:monospace;width:100%}.split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-family:monospace;font-size:12px}td,th{border-bottom:1px solid #181818;padding:9px;text-align:left}th{color:#555;text-transform:uppercase;font-size:10px}.camera{position:fixed;inset:0;z-index:2000;background:#000;display:flex;flex-direction:column}.camera video{width:100%;height:100%;object-fit:cover}.scanbox{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:75%;max-width:340px;aspect-ratio:3/1.7;border:3px solid #c8a96e;box-shadow:0 0 0 9999px rgba(0,0,0,.45)}.brandHeader{cursor:pointer;user-select:none}.brandHeader:hover{filter:brightness(1.12)}.brandCard{cursor:pointer;transition:transform .12s ease,filter .12s ease}.brandCard:hover{transform:translateY(-1px);filter:brightness(1.12)}input,select{max-width:100%}.productActions{display:flex;gap:6px;flex-wrap:wrap}.barcodeLine{display:flex;gap:8px;align-items:center}.barcodeLine input{flex:1;min-width:0}.authPage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:18px}.authCard{width:420px;max-width:100%;background:#131313;border:1px solid #2a2a2a;border-top:3px solid #c8a96e;border-radius:14px;padding:22px}.authError{background:#ef233c18;border:1px solid #ef233c44;color:#ffb3bf;border-radius:8px;padding:10px;margin:10px 0;font-size:12px}
  @media(max-width:720px){header{padding:12px}main{padding:12px}nav{padding:0 8px}.split{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.row{align-items:stretch;flex-wrap:wrap;gap:8px;padding:9px}.row>.grow{min-width:180px}.actions{width:100%}.actions button{flex:1}.productActions{width:100%}.productActions button{flex:1;min-width:70px}.modal{width:100%;padding:16px}.card{padding:12px}.kpi .value{font-size:20px}.store{font-size:9px;letter-spacing:2px}}@media(max-width:420px){.grid{grid-template-columns:1fr}button{padding:8px 9px}.row>.grow{min-width:130px}}
</style>`; }

function tabHTML(ap, oi, low, out) {
  if (state.tab === "dashboard") return dashboardHTML(ap, oi, low, out);
  if (state.tab === "inventory") return inventoryHTML();
  if (state.tab === "scanner") return scannerHTML();
  if (state.tab === "weekly") return weeklyHTML(ap);
  if (state.tab === "order") return orderHTML(oi);
  if (state.tab === "pricing") return pricingHTML();
  if (state.tab === "alerts") return alertsHTML(low, out);
  if (state.tab === "reset") return resetHTML();
  return "";
}
function kpi(label, value, color) { return `<div class="card kpi"><div class="label">${label}</div><div class="value" style="color:${color}">${value}</div></div>`; }
function dashboardHTML(ap, oi) {
  const cost = ap.reduce((s,p)=>s+p.cartons*p.cartonCost+p.packs*(p.cartonCost/10),0);
  const retail = ap.reduce((s,p)=>s+(p.cartons*10+p.packs)*p.sellPack,0);
  const orderCost = oi.reduce((s,p)=>s+p.toOrder*p.cartonCost,0);
  return `<div class="grid">${kpi("Brands", state.brands.length, "#c8a96e")}${kpi("SKUs", ap.length, "#818cf8")}${kpi("Cartons", ap.reduce((s,p)=>s+p.cartons,0), "#06d6a0")}${kpi("Cost", money(cost), "#ffd166")}${kpi("Retail", money(retail), "#a8dadc")}${kpi("To Order", money(orderCost), oi.length?"#fb8500":"#06d6a0")}</div>
  <div class="card" style="margin-top:18px"><b>${state.lastCount ? `✓ Last weekly count: ${state.lastCount}` : "⚠ No weekly count yet"}</b><p class="small">Count inventory, generate order quantities, then export the order sheet.</p><button onclick="openWeekly()">📋 Count Now</button> ${oi.length ? `<button onclick="setTab('order')">📦 View Order</button>` : ""}</div>
  <h3>Brands Overview</h3>${state.brands.map(b => `<div class="card brandCard" onclick="openBrandInventory('${b.id}')" style="border-left:4px solid ${b.color};margin-bottom:10px"><b style="color:${b.color}">${esc(b.name)}</b><div class="small">${b.products.length} SKUs · ${b.products.reduce((s,p)=>s+p.cartons,0)} cartons · ${b.products.filter(p=>!p.barcode).length} missing barcodes</div><div class="small" style="margin-top:6px;color:#c8a96e">Tap to open this brand →</div></div>`).join("")}`;
}
function inventoryHTML() {
  const s = state.search.toLowerCase();
  return `<input class="field" placeholder="🔍 Search brand or type..." value="${esc(state.search)}" oninput="state.search=this.value;render()" style="background:#141414;border:1px solid #222;color:#ddd;padding:12px;border-radius:9px;width:100%;font-family:monospace;margin-bottom:16px">
  ${state.brands.map(b => {
    const prods = b.products.filter(p => !s || p.type.toLowerCase().includes(s) || b.name.toLowerCase().includes(s));
    if (!prods.length && s) return "";
    const isOpen = !!s || state.openBrands[b.id] === true;
    return `<section id="brand_${b.id}" class="card" style="border-left:4px solid ${b.color};margin-bottom:12px">
      <div class="row brandHeader" onclick="toggleBrand('${b.id}')" style="background:transparent;border:0;padding:0;margin:0 0 6px 0">
        <h3 class="grow" style="color:${b.color};margin:0">${isOpen?'▾':'▸'} ${esc(b.name)}</h3>
        <span class="small">${prods.length} types</span>
        ${isAdmin()?`<button onclick="event.stopPropagation();openProductModal('${b.id}')">+ Type</button><button class="danger" onclick="event.stopPropagation();deleteBrand('${b.id}')">✕</button>`:""}
      </div>
      ${isOpen ? (prods.length ? prods.map(p => productRow(b,p)).join("") : `<p class="small">No products yet. Tap + Type.</p>`) : ""}
    </section>`;
  }).join("")}`;
}
function productRow(b, p) {
  const need = Math.max(0, p.maxStock - p.cartons), color = p.cartons === 0 ? "#ef233c" : p.cartons <= LOW_STOCK_THRESHOLD ? "#fb8500" : "#06d6a0";
  return `<div class="row"><div style="width:4px;min-height:42px;background:${color};border-radius:3px"></div><div class="grow"><b>${esc(p.type)}</b><div class="small">${p.barcode?`📷 ${esc(p.barcode)} · `:"+ barcode · "}Buy ${money(p.cartonCost/10)} · Sell ${money(p.sellPack)} · Margin ${calcMargin(p.cartonCost,p.sellPack).toFixed(1)}%</div></div><div><b style="color:${color};font-family:monospace;font-size:22px">${p.cartons}</b><div class="small">/${p.maxStock} ctn</div></div>${need?`<span class="warn">📦 +${need}</span>`:"<span class='ok'>✓</span>"}<div class="productActions"><button onclick="openStockModal('${b.id}','${p.id}')">Stock</button>${isAdmin()?`<button onclick="openProductModal('${b.id}','${p.id}')">Edit</button><button class="danger" onclick="deleteProduct('${b.id}','${p.id}')">✕</button>`:""}</div></div>`;
}
function scannerHTML() {
  return `<button style="width:100%;padding:24px;font-size:16px" onclick="openScanner()">📷 Open Camera & Scan</button><div class="split" style="margin-top:18px"><div class="card"><h3>Manual / USB Scanner Entry</h3><input id="manualScan" placeholder="Type barcode + Enter" value="${esc(state.scanInput)}" onkeydown="if(event.key==='Enter')manualScan(this.value)"><button onclick="manualScan(document.getElementById('manualScan').value)">Search</button>${scanResultHTML()}</div><div class="card"><h3>Scan Log</h3>${state.scanLog.length?state.scanLog.map(e=>`<div class="row"><span class="small">${e.time}</span><span class="${e.action==='restock'?'ok':'danger'}">${e.action}</span><span class="grow">${esc(e.brand)} — ${esc(e.type)}</span><b>${e.action==='restock'?'+':'-'}${e.qty}</b></div>`).join(""):`<p class="small">No scans yet.</p>`}</div></div>${isAdmin()?`<h3>Assign Barcodes</h3>${allProducts().map(p=>`<div class="row"><div class="grow"><b style="color:${p.brandColor}">${esc(p.brandName)}</b> — ${esc(p.type)}<div class="small">${p.barcode||'No barcode assigned'}</div></div><button onclick="openAssignScanner('${p.brandId}','${p.id}')">📷 Camera</button><input id="bc_${p.id}" value="${esc(p.barcode)}" placeholder="Type UPC"><button onclick="assignBarcode('${p.brandId}','${p.id}',document.getElementById('bc_${p.id}').value)">Save</button></div>`).join("")}`:""}`;
}
function scanResultHTML() {
  if (state.scanFound) return `<div class="card" style="border-left:4px solid ${state.scanFound.brand.color};margin-top:14px"><b class="ok">✓ Product Found</b><h3>${esc(state.scanFound.brand.name)} — ${esc(state.scanFound.product.type)}</h3><div class="small">Stock: ${state.scanFound.product.cartons} · Max: ${state.scanFound.product.maxStock}</div><div><button onclick="state.scanMode='restock';render()">➕ Add</button><button class="danger" onclick="state.scanMode='sale';render()">➖ Remove</button></div><input id="scanQty" type="number" min="1" value="${state.scanQty}"><button onclick="applyScan()">Apply ${state.scanMode}</button></div>`;
  if (state.scanNotFound) return `<div class="card" style="border-left:4px solid #ef233c;margin-top:14px"><b class="danger">Not Found</b><p class="small">${esc(state.scanNotFound)}</p></div>`;
  return "";
}
function weeklyHTML(ap) { return `<div class="card"><h3>Weekly Count</h3><p class="small">Enter actual counts. Order quantities calculate automatically.</p><button onclick="openWeekly()">📋 Start Weekly Count</button>${state.lastCount?`<p class="small">Last count: ${state.lastCount}</p>`:""}</div>${ap.map(p=>`<div class="row"><div class="grow"><b style="color:${p.brandColor}">${esc(p.brandName)}</b> — ${esc(p.type)}</div><span>${p.cartons}/${p.maxStock}</span><span class="${p.maxStock>p.cartons?'warn':'ok'}">${p.maxStock>p.cartons?'📦 +'+(p.maxStock-p.cartons):'✓'}</span></div>`).join("")}`; }
function orderHTML(oi) { const total = oi.reduce((s,p)=>s+p.toOrder*p.cartonCost,0); return `<div class="row"><div class="grow"><h3>Order Sheet · ${weekLabel()}</h3><div class="small">${oi.length} items · ${oi.reduce((s,p)=>s+p.toOrder,0)} cartons · ${money(total)}</div></div><button onclick="openWeekly()">📋 Update Count</button><button onclick="exportPDF()" ${!oi.length?'disabled':''}>🖨 Export PDF</button></div>${oi.length?oi.map(p=>`<div class="row"><div class="grow"><b style="color:${p.brandColor}">${esc(p.brandName)}</b> — ${esc(p.type)}<div class="small">${p.cartons}/${p.maxStock} · ${money(p.cartonCost)}/ctn</div></div><b class="warn" style="font-size:26px">${p.toOrder}</b><b>${money(p.toOrder*p.cartonCost)}</b></div>`).join(""):`<div class="center" style="height:250px"><b class="ok">✓ All products at max stock!</b></div>`}`; }
function pricingHTML() { return `<div class="table"><table><thead><tr><th>Brand</th><th>Type</th><th>Barcode</th><th>Max</th><th>Ctn$</th><th>Buy/Pk</th><th>Sell/Pk</th><th>Profit</th><th>Margin</th><th>Stock</th></tr></thead><tbody>${allProducts().map(p=>`<tr><td style="color:${p.brandColor};font-weight:700">${esc(p.brandName)}</td><td>${esc(p.type)}</td><td>${esc(p.barcode)||'—'}</td><td>${p.maxStock}</td><td>${money(p.cartonCost)}</td><td>${money(p.cartonCost/10)}</td><td>${money(p.sellPack)}</td><td>${money(calcProfit(p.cartonCost,p.sellPack))}</td><td>${calcMargin(p.cartonCost,p.sellPack).toFixed(1)}%</td><td>${p.cartons}/${p.maxStock}</td></tr>`).join("")}</tbody></table></div>`; }
function alertsHTML(low, out) { return (!low.length && !out.length) ? `<div class="center" style="height:250px"><b class="ok">✓ All well stocked!</b></div>` : `${out.length?`<h3 class="danger">Out of Stock</h3>${out.map(p=>`<div class="row"><div class="grow"><b>${esc(p.brandName)} — ${esc(p.type)}</b><div class="small">Max ${p.maxStock}</div></div><button onclick="openStockModal('${p.brandId}','${p.id}')">Restock</button></div>`).join("")}`:""}<h3 class="warn">Low Stock</h3>${low.filter(p=>p.cartons>0).map(p=>`<div class="row"><div class="grow"><b>${esc(p.brandName)} — ${esc(p.type)}</b><div class="small">${p.cartons} left · order ${Math.max(0,p.maxStock-p.cartons)}</div></div><button onclick="openStockModal('${p.brandId}','${p.id}')">Restock</button></div>`).join("")}`; }
function resetHTML() { return `<div class="card" style="max-width:520px;margin:auto;border-color:#ef233c44"><h2 class="danger">🔐 Reset All Inventory Stock</h2><p class="small">This sets cartons and packs to zero. Brand names, products, prices, barcodes, and max stock stay saved. Passcode: 1912</p><button class="danger" onclick="openResetModal()">🔴 Reset All Stock to Zero</button></div>`; }

function modalHTML() {
  const m = state.modal;
  if (m.type === "brand") return modalWrap("Add Brand", `<div class="field"><label>Brand Name</label><input id="brandName"></div><div class="field"><label>Color</label><select id="brandColor">${BRAND_COLORS.map(c=>`<option value="${c}">${c}</option>`).join("")}</select></div><button onclick="saveBrand()">Add Brand</button><button onclick="closeModal()">Cancel</button>`);
  if (m.type === "product") { const b = getBrand(m.brandId), p = m.productId ? getProduct(m.brandId,m.productId) : {}; const barcodeValue = m.productId ? (p.barcode||"") : (state.tempBarcode || p.barcode || ""); return modalWrap(m.productId?"Edit Product":"Add Product", `<div class="field"><label>Type / Variant</label><input id="pType" value="${esc(p.type)}"></div><div class="field"><label>Barcode / UPC</label><div class="barcodeLine"><input id="pBarcode" value="${esc(barcodeValue)}" placeholder="Scan or type UPC"><button type="button" onclick="scanProductBarcode('${b.id}','${p.id||''}')">📷 Scan</button></div><div class="small">You can scan the barcode before saving this new cigarette type.</div></div><div class="split"><div class="field"><label>Carton Cost</label><input id="pCost" type="number" step="0.01" value="${p.cartonCost??''}"></div><div class="field"><label>Pack Sell Price</label><input id="pSell" type="number" step="0.01" value="${p.sellPack??''}"></div></div><div class="split"><div class="field"><label>Max Stock</label><input id="pMax" type="number" value="${p.maxStock??0}"></div><div class="field"><label>Cartons Now</label><input id="pCartons" type="number" value="${p.cartons??0}"></div></div><div class="field"><label>Loose Packs</label><input id="pPacks" type="number" value="${p.packs??0}"></div><button onclick="saveProduct('${b.id}','${p.id||''}')">Save</button><button onclick="closeModal()">Cancel</button>`); }
  if (m.type === "stock") { const b = getBrand(m.brandId), p = getProduct(m.brandId,m.productId); return modalWrap(`Update Stock — ${esc(p.type)}`, `<div class="field"><label>Mode</label><select id="stockMode"><option value="restock">Add / Restock</option><option value="sale">Remove / Sale</option><option value="set">Set Exact Count</option></select></div><div class="split"><div class="field"><label>Cartons</label><input id="stockC" type="number" value="0"></div><div class="field"><label>Packs</label><input id="stockP" type="number" value="0"></div></div><p class="small">Current: ${p.cartons} cartons + ${p.packs} packs</p><button onclick="saveStock('${b.id}','${p.id}')">Confirm</button><button onclick="closeModal()">Cancel</button>`); }
  if (m.type === "weekly") return modalWrap("📋 Weekly Count", `${state.brands.map(b=>`<h3 style="color:${b.color}">${esc(b.name)}</h3>${b.products.map(p=>`<div class="row"><div class="grow">${esc(p.type)}<div class="small">max ${p.maxStock}</div></div><input class="wkC" data-pid="${p.id}" type="number" value="${p.cartons}" style="width:70px"><input class="wkP" data-pid="${p.id}" type="number" value="${p.packs}" style="width:70px"></div>`).join("")}`).join("")}<button onclick="saveWeekly()">💾 Save Weekly Count</button><button onclick="closeModal()">Cancel</button>`);
  if (m.type === "reset") return modalWrap("🔐 Confirm Reset", `<p class="small">Enter passcode to reset all stock counts to zero.</p><input id="resetCode" type="password" placeholder="Passcode"><button class="danger" onclick="confirmReset()">Reset Stock</button><button onclick="closeModal()">Cancel</button>`);
  return "";
}
function modalWrap(title, body) { return `<div class="modalBack" onclick="if(event.target.className==='modalBack')closeModal()"><div class="modal"><h2>${title}</h2>${body}</div></div>`; }
function cameraHTML() { return `<div class="camera"><div class="row" style="border-radius:0;background:#050505"><b class="grow">📷 ${state.assignTarget?'Scan to Assign Barcode':'Scan Product Barcode'}</b><button class="danger" onclick="closeCamera()">✕ Close</button></div><div style="position:relative;flex:1"><video id="scanner-video" autoplay muted playsinline></video><div class="scanbox"></div></div><div class="row" style="border-radius:0;background:#050505;justify-content:center"><span class="small">Point camera at barcode — scans automatically</span></div></div>`; }

function setTab(t){ state.tab=t; render(); }
function openBrandInventory(brandId){ state.tab="inventory"; state.selectedBrandId=brandId; state.openBrands[brandId]=true; render(); setTimeout(()=>{ const el=document.getElementById("brand_"+brandId); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },60); }
function toggleBrand(brandId){ state.openBrands[brandId] = !(state.openBrands[brandId] === true); render(); }
function closeModal(){ if(state.modal?.type==="product") state.tempBarcode=""; state.modal=null; render(); }
function getBrand(id){ return state.brands.find(b=>b.id===id); }
function getProduct(bid,pid){ return getBrand(bid)?.products.find(p=>p.id===pid); }
function openBrandModal(){ if(!requireAdmin()) return; state.modal={type:"brand"}; render(); }
function openProductModal(brandId, productId=""){ if(!requireAdmin()) return; if(!productId) state.tempBarcode=""; state.modal={type:"product", brandId, productId}; render(); }
function openStockModal(brandId, productId){ state.modal={type:"stock", brandId, productId}; render(); }
function openWeekly(){ state.modal={type:"weekly"}; render(); }
function openResetModal(){ if(!requireAdmin()) return; state.modal={type:"reset"}; render(); }
function openScanner(){ state.tab="scanner"; state.assignTarget=null; state.scanning=true; render(); }
function openAssignScanner(brandId, productId){ if(!requireAdmin()) return; state.assignTarget={brandId,productId}; state.scanning=true; render(); }
function scanProductBarcode(brandId, productId=""){ if(!requireAdmin()) return; state.assignTarget = productId ? {brandId, productId} : {brandId, tempProduct:true}; state.scanning=true; render(); }
function closeCamera(){ stopCamera(); state.scanning=false; state.assignTarget=null; render(); }

function saveBrand(){ if(!requireAdmin()) return; const name=document.getElementById("brandName").value.trim(); if(!name) return; state.brands.push({id:uid(),name,color:document.getElementById("brandColor").value,products:[]}); closeModal(); save(true); }
function deleteBrand(id){ if(!requireAdmin()) return; if(confirm("Remove this brand and all products?")){ state.brands=state.brands.filter(b=>b.id!==id); save(true); render(); } }
function saveProduct(bid,pid){ if(!requireAdmin()) return; const b=getBrand(bid); const p={ id: pid||uid(), type:document.getElementById("pType").value.trim(), barcode:document.getElementById("pBarcode").value.trim(), cartonCost:parseFloat(document.getElementById("pCost").value)||0, sellPack:parseFloat(document.getElementById("pSell").value)||0, maxStock:parseInt(document.getElementById("pMax").value)||0, cartons:parseInt(document.getElementById("pCartons").value)||0, packs:Math.min(9,parseInt(document.getElementById("pPacks").value)||0) }; if(!p.type) return; if(pid) b.products=b.products.map(x=>x.id===pid?p:x); else b.products.push(p); state.tempBarcode=""; closeModal(); save(true); }
function deleteProduct(bid,pid){ if(!requireAdmin()) return; if(confirm("Delete this product?")){ const b=getBrand(bid); b.products=b.products.filter(p=>p.id!==pid); save(true); render(); } }
function saveStock(bid,pid){ if(!canWriteStock()) return; const p=getProduct(bid,pid), mode=document.getElementById("stockMode").value, c=parseInt(document.getElementById("stockC").value)||0, pk=parseInt(document.getElementById("stockP").value)||0; if(mode==="restock"){ p.cartons+=c; p.packs+=pk; } else if(mode==="sale"){ p.cartons-=c; p.packs-=pk; } else { p.cartons=c; p.packs=pk; } while(p.packs>9){p.cartons++;p.packs-=10} while(p.packs<0){p.cartons--;p.packs+=10} p.cartons=Math.max(0,p.cartons); p.packs=Math.max(0,Math.min(9,p.packs)); closeModal(); save(true); }
function saveWeekly(){ if(!canWriteStock()) return; document.querySelectorAll(".wkC").forEach(el=>{ const p=allProducts().find(x=>x.id===el.dataset.pid); const real=getProduct(p.brandId,p.id); real.cartons=parseInt(el.value)||0; }); document.querySelectorAll(".wkP").forEach(el=>{ const p=allProducts().find(x=>x.id===el.dataset.pid); const real=getProduct(p.brandId,p.id); real.packs=Math.min(9,parseInt(el.value)||0); }); state.lastCount=new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); closeModal(); save(true); }
function confirmReset(){ if(!requireAdmin()) return; if(document.getElementById("resetCode").value===RESET_PASSCODE){ state.brands.forEach(b=>b.products.forEach(p=>{p.cartons=0;p.packs=0;})); closeModal(); save(true); } else alert("Incorrect passcode"); }
function assignBarcode(bid,pid,code){ if(!requireAdmin()) return; const p=getProduct(bid,pid); p.barcode=String(code||"").trim(); save(true); render(); }

function manualScan(code){ code=String(code||"").trim(); if(!code) return; state.scanInput=code; let hit=null; for(const b of state.brands){ for(const p of b.products){ if(p.barcode && p.barcode===code) hit={brand:b,product:p}; } } state.scanFound=hit; state.scanNotFound=hit?null:code; render(); }
function applyScan(){ if(!canWriteStock()) return; if(!state.scanFound) return; const qty=parseInt(document.getElementById("scanQty")?.value)||1; const p=state.scanFound.product; if(state.scanMode==="restock") p.cartons+=qty; else p.cartons=Math.max(0,p.cartons-qty); state.scanLog.unshift({time:new Date().toLocaleTimeString(),action:state.scanMode,brand:state.scanFound.brand.name,type:p.type,qty}); state.scanLog=state.scanLog.slice(0,50); state.scanFound=null; state.scanInput=""; save(true); render(); }

let zxingReader=null, scannerActive=false;
async function startCamera(){ if(!window.ZXing) return alert("Barcode library not loaded. Check internet connection."); try{ if(zxingReader) zxingReader.reset(); zxingReader=new ZXing.BrowserMultiFormatReader(); const devices=await zxingReader.listVideoInputDevices(); if(!devices.length) return alert("No camera found."); const back=devices.find(d=>/back|rear|environment/i.test(d.label)) || devices[0]; scannerActive=true; await zxingReader.decodeFromVideoDevice(back.deviceId, "scanner-video", result=>{ if(result && scannerActive){ const code=result.getText(); if(state.assignTarget?.tempProduct){ state.tempBarcode=code; stopCamera(); state.scanning=false; state.assignTarget=null; render(); } else if(state.assignTarget){ assignBarcode(state.assignTarget.brandId,state.assignTarget.productId,code); closeCamera(); } else { closeCamera(); manualScan(code); } } }); } catch(e){ console.error(e); alert("Camera access failed. Allow camera permission in browser settings."); closeCamera(); } }
function stopCamera(){ scannerActive=false; if(zxingReader){ try{zxingReader.reset();}catch{} zxingReader=null; } }

function exportPDF(){ const items=orderItems(); if(!items.length) return; const total=items.reduce((s,i)=>s+i.toOrder*i.cartonCost,0); const rows=items.map(i=>`<tr><td>☐</td><td style="color:${i.brandColor};font-weight:700">${esc(i.brandName)}</td><td>${esc(i.type)}</td><td>${esc(i.barcode)||'—'}</td><td>${i.cartons}</td><td>${i.maxStock}</td><td style="font-size:18px;font-weight:700;color:#c00">${i.toOrder}</td><td>${money(i.cartonCost)}</td><td>${money(i.toOrder*i.cartonCost)}</td></tr>`).join(""); const html=`<!doctype html><html><head><title>Order Sheet</title><style>body{font-family:Georgia,serif;padding:34px;color:#111}.hdr{border-bottom:3px solid #111;padding-bottom:15px;margin-bottom:20px}.store{font-size:10px;letter-spacing:3px;color:#777;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:9px;text-align:left;font-size:10px;text-transform:uppercase}td{border-bottom:1px solid #eee;padding:8px;font-size:13px}.sig{margin-top:45px;display:flex;gap:45px}.sig div{flex:1;border-top:1px solid #aaa;padding-top:7px;color:#777;font-size:11px}</style></head><body><div class="hdr"><div class="store">Oklahoma City · Five Star Fuel Foods</div><h1>🚬 Weekly Cigarette Order Sheet</h1><p>Week: <b>${weekLabel()}</b> · Generated: <b>${todayFull()}</b> · Items: <b>${items.length}</b></p></div><table><thead><tr><th>✓</th><th>Brand</th><th>Type</th><th>Barcode/UPC</th><th>In Stock</th><th>Max</th><th>Order Qty</th><th>$/Ctn</th><th>Total</th></tr></thead><tbody>${rows}<tr><td colspan="6"></td><td><b>${items.reduce((s,i)=>s+i.toOrder,0)}</b></td><td></td><td><b>${money(total)}</b></td></tr></tbody></table><div class="sig"><div>Ordered By</div><div>Date Ordered</div><div>Received By</div><div>Date Received</div></div></body></html>`; const w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }

if (auth) {
  auth.onAuthStateChanged(async user => {
    state.authReady = true;
    state.user = user;
    state.role = null;
    if (user) {
      try { state.role = await loadUserRole(user); } catch (e) { console.warn(e); state.role = "user"; }
      await loadData();
    } else {
      state.loading = false;
      state.brands = [];
      render();
    }
  });
} else {
  state.authReady = true;
  state.loading = false;
  render();
}
