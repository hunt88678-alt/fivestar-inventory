// FIVE STAR FUEL FOODS — Cigarette Inventory Manager
// AUTH + ROLE VERSION (guest/user/admin)

const FIREBASE_CONFIG = { apiKey: "AIzaSyCHMIZb4-O3HM5xyFaWgMJDkCy9I4da8a4",
                         authDomain: "fivestar-inventory-e408e.firebaseapp.com", 
                         projectId: "fivestar-inventory-e408e",
                         storageBucket: "fivestar-inventory-e408e.firebasestorage.app",
                         messagingSenderId: "102029163631",
                         appId: "1:102029163631:web:86f1cccaf8b66565d3e19a" };
firebase.initializeApp(FIREBASE_CONFIG);

const db = firebase.firestore();
const auth = firebase.auth();

const LOW_STOCK_THRESHOLD = 3;

let currentUser = null;
let currentRole = "guest";

const uid = () => Math.random().toString(36).slice(2, 9);

let state = {
brands: [],
loading: true,
toast: null,
tab: "dashboard",
search: ""
};

function toast(msg) {
state.toast = msg;
render();

setTimeout(() => {
state.toast = null;
render();
}, 2000);
}

function isAdmin() {
return currentRole === "admin";
}

function isUser() {
return currentRole === "user" || currentRole === "admin";
}

function isGuest() {
return currentRole === "guest";
}

async function register(email, password) {
try {
const cred = await auth.createUserWithEmailAndPassword(
email,
password
);

await db.collection("users").doc(cred.user.uid).set({
email,
role: "guest",
createdAt: new Date().toISOString()
});

toast("Registered successfully");
} catch (e) {
alert(e.message);
}
}

async function login(email, password) {
try {
await auth.signInWithEmailAndPassword(email, password);
} catch (e) {
alert(e.message);
}
}

async function logout() {
await auth.signOut();
}

auth.onAuthStateChanged(async user => {
currentUser = user;

if (user) {
const doc = await db.collection("users")
.doc(user.uid)
.get();

if (doc.exists) {
currentRole = doc.data().role || "guest";
} else {
currentRole = "guest";
}

await loadInventory();
}

render();
});

async function loadInventory() {
state.loading = true;
render();

try {
const snap = await db
.collection("inventory")
.doc("brands")
.get();

if (snap.exists) {
state.brands = snap.data().brands || [];
} else {
state.brands = defaultBrands();

await saveInventory();
}
} catch (e) {
console.error(e);
}

state.loading = false;
render();
}

async function saveInventory() {
if (!isUser()) return;

try {
await db.collection("inventory")
.doc("brands")
.set({
brands: state.brands,
updatedAt: new Date().toISOString()
});

toast("Saved");
} catch (e) {
console.error(e);
}
}

function defaultBrands() {
return [
{
id: uid(),
name: "Marlboro",
color: "#e63946",
products: [
{
id: uid(),
type: "Red King",
barcode: "",
cartonCost: 52,
sellPack: 9.49,
maxStock: 20,
cartons: 0
}
]
}
];
}

function render() {
const root = document.getElementById("root");

if (!currentUser) {
root.innerHTML = `
${style()}
<div class="center">
<div class="card authCard">
<h2>Five Star Fuel Foods</h2>

<div class="field">
<label>Email</label>
<input id="email" type="email">
</div>

<div class="field">
<label>Password</label>
<input id="password" type="password">
</div>

<button onclick="
login(
document.getElementById('email').value,
document.getElementById('password').value
)
">
Login
</button>

<button onclick="
register(
document.getElementById('email').value,
document.getElementById('password').value
)
">
Register
</button>
</div>
</div>
`;
return;
}

if (state.loading) {
root.innerHTML = `
${style()}
<div class="center">
<h2>Loading...</h2>
</div>
`;
return;
}

root.innerHTML = `
${style()}

${state.toast
? `<div class="toast">${state.toast}</div>`
: ""
}

<header>
<div>
<h1>🚬 Cigarette Inventory</h1>
<div class="small">
Logged in as:
<b>${currentUser.email}</b>
(${currentRole})
</div>
</div>

<div class="actions">
<button onclick="setTab('dashboard')">
Dashboard
</button>

<button onclick="setTab('inventory')">
Inventory
</button>

<button onclick="logout()">
Logout
</button>
</div>
</header>

<main>
${
state.tab === "dashboard"
? dashboardHTML()
: inventoryHTML()
}
</main>
`;
}

function dashboardHTML() {
const totalBrands = state.brands.length;

const totalProducts = state.brands.reduce(
(sum, b) => sum + b.products.length,
0
);

return `
<div class="grid">
<div class="card">
<div class="label">Brands</div>
<div class="value">${totalBrands}</div>
</div>

<div class="card">
<div class="label">Products</div>
<div class="value">${totalProducts}</div>
</div>

<div class="card">
<div class="label">Role</div>
<div class="value">${currentRole}</div>
</div>
</div>

${
isGuest()
? `
<div class="card" style="margin-top:20px">
<h3>Guest Access</h3>
<p>
You can only view inventory.
Contact admin for access.
</p>
</div>
`
: ""
}
`;
}

function inventoryHTML() {
return `
<div style="margin-bottom:20px">
${
isAdmin()
? `
<button onclick="addBrand()">
+ Add Brand
</button>
`
: ""
}
</div>

${
state.brands.map(brand => `
<div class="card"
style="
margin-bottom:15px;
border-left:4px solid ${brand.color};
"
>
<div class="row">
<div class="grow">
<h3>${brand.name}</h3>
</div>

${
isAdmin()
? `
<button onclick="deleteBrand('${brand.id}')">
Delete
</button>
`
: ""
}
</div>

${
brand.products.map(product => `
<div class="product">
<div class="grow">
<b>${product.type}</b>

<div class="small">
Cartons:
${product.cartons}
</div>
</div>

${
isUser()
? `
<button onclick="
updateStock(
'${brand.id}',
'${product.id}',
1
)
">
+
</button>

<button onclick="
updateStock(
'${brand.id}',
'${product.id}',
-1
)
">
-
</button>
`
: ""
}

${
isAdmin()
? `
<button onclick="
deleteProduct(
'${brand.id}',
'${product.id}'
)
">
Delete
</button>
`
: ""
}
</div>
`).join("")
}

${
isAdmin()
? `
<button onclick="
addProduct('${brand.id}')
">
+ Add Product
</button>
`
: ""
}
</div>
`).join("")
}
`;
}

function setTab(tab) {
state.tab = tab;
render();
}

async function addBrand() {
const name = prompt("Brand name");

if (!name) return;

state.brands.push({
id: uid(),
name,
color: "#c8a96e",
products: []
});

await saveInventory();
render();
}

async function deleteBrand(id) {
if (!confirm("Delete brand?")) return;

state.brands = state.brands.filter(
b => b.id !== id
);

await saveInventory();
render();
}

async function addProduct(brandId) {
const type = prompt("Product type");

if (!type) return;

const brand = state.brands.find(
b => b.id === brandId
);

brand.products.push({
id: uid(),
type,
cartons: 0
});

await saveInventory();
render();
}

async function deleteProduct(brandId, productId) {
const brand = state.brands.find(
b => b.id === brandId
);

brand.products = brand.products.filter(
p => p.id !== productId
);

await saveInventory();
render();
}

async function updateStock(
brandId,
productId,
amount
) {
const brand = state.brands.find(
b => b.id === brandId
);

const product = brand.products.find(
p => p.id === productId
);

product.cartons += amount;

if (product.cartons < 0) {
product.cartons = 0;
}

await saveInventory();
render();
}

function style() {
return `
<style>
body {
margin: 0;
background: #0a0a0a;
color: #eee;
font-family: Arial;
}

header {
padding: 20px;
border-bottom: 1px solid #222;
display: flex;
justify-content: space-between;
align-items: center;
flex-wrap: wrap;
}

main {
padding: 20px;
}

.actions {
display: flex;
gap: 10px;
}

button {
background: #222;
color: #fff;
border: 1px solid #444;
padding: 10px 14px;
cursor: pointer;
border-radius: 8px;
}

button:hover {
background: #333;
}

.card {
background: #151515;
border: 1px solid #222;
border-radius: 10px;
padding: 15px;
}

.grid {
display: grid;
grid-template-columns:
repeat(auto-fit, minmax(200px, 1fr));
gap: 15px;
}

.label {
color: #777;
font-size: 12px;
}

.value {
font-size: 30px;
margin-top: 10px;
}

.small {
color: #888;
font-size: 12px;
}

.row {
display: flex;
align-items: center;
gap: 10px;
}

.grow {
flex: 1;
}

.product {
display: flex;
align-items: center;
gap: 10px;
padding: 10px 0;
border-top: 1px solid #222;
}

.center {
height: 100vh;
display: flex;
justify-content: center;
align-items: center;
}

.authCard {
width: 350px;
}

.field {
display: flex;
flex-direction: column;
gap: 5px;
margin-bottom: 15px;
}

input {
background: #111;
border: 1px solid #333;
color: white;
padding: 10px;
border-radius: 8px;
}

.toast {
position: fixed;
top: 15px;
right: 15px;
background: #06d6a0;
color: black;
padding: 10px 15px;
border-radius: 8px;
font-weight: bold;
}
</style>
`;
}

render();
