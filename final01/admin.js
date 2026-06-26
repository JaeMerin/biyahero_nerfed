import supabase from "../supabaseClient.js";

// ── State ─────────────────────────────────────────────────────────────────────
let profiles      = [];
let routes        = [];
let stops         = [];
let routeStops    = [];
let filteredProfiles = [];
let deleteTargetId   = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name) { return name.slice(0, 2).toUpperCase(); }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = '✓  ' + msg;
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.style.display = 'none', 2800);
}

function toastError(msg) {
  const el = document.getElementById('toast');
  el.textContent = '✕  ' + msg;
  el.style.display = 'block';
  el.style.background = 'var(--danger, #e53e3e)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.style.display = 'none';
    el.style.background = '';
  }, 3000);
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close overlay on backdrop click
document.querySelectorAll('.overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// Add this helper to manage your mobile drawer menu
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// ── Supabase Fetchers ─────────────────────────────────────────────────────────
async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { toastError('Failed to load profiles'); return; }
  profiles         = data.map(p => ({
    id:       p.id,
    username: p.username  ?? p.full_name ?? '—',
    email:    p.email     ?? '—',
    created:  (p.created_at ?? '').slice(0, 10),
  }));
  filteredProfiles = [...profiles];
}

async function fetchRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('id', { ascending: true });
  if (error) { toastError('Failed to load routes'); return; }
  routes = data.map(r => ({ id: r.id, route_name: r.route_name }));
}

async function fetchStops() {
  const { data, error } = await supabase
    .from('stops')
    .select('*')
    .order('id', { ascending: true });
  if (error) { toastError('Failed to load stops'); return; }
  stops = data.map(s => ({ id: s.id, stop_name: s.stop_name, lat: s.lat, lng: s.lng }));
}

async function fetchRouteStops() {
  const { data, error } = await supabase
    .from('route_stops')
    .select('*')
    .order('id', { ascending: true });
  if (error) { toastError('Failed to load route stops'); return; }
  routeStops = data.map(r => ({
    id:         r.id,
    route_id:   r.route_id,
    stop_id:    r.stop_id,
    stop_order: r.stop_order,
  }));
}


// ── Section navigation ────────────────────────────────────────────────────────
const sectionMeta = {
  dashboard:    ['Dashboard',      'Overview of all system data'],
  profiles:     ['User profiles',  'Manage user accounts'],
  routes:       ['Routes',         'Manage jeepney routes'],
  stops:        ['Stops',          'Manage route stops'],
  'route-stops':['Route stops',    'Route–stop junction table'],
  fares:         ['Fare settings',  'Configure fare computation'],
};

async function showSection(key) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('section-' + key).classList.add('active');
  const meta = sectionMeta[key] || [key, ''];
  document.getElementById('topbar-title').textContent = meta[0];
  document.getElementById('topbar-meta').textContent  = meta[1];

  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('onclick') === `showSection('${key}')`) btn.classList.add('active');
  });

  if (key === 'dashboard') {
    await Promise.all([fetchProfiles(), fetchRoutes(), fetchStops()]);
    renderDashboard();
  }
  if (key === 'profiles') {
    await fetchProfiles();
    renderProfiles(filteredProfiles);
  }
  if (key === 'routes') {
    await fetchRoutes();
    renderRoutes(routes);
  }
  if (key === 'stops') {
    await fetchStops();
    renderStops(stops);
  }
  if (key === 'route-stops') {
    await Promise.all([fetchRoutes(), fetchRouteStops()]);
    renderRS(routeStops);
  }
  if (key === 'fares') {
     await fetchFares();
  renderFares(fares);
}
}


// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  document.getElementById('stat-users').textContent  = profiles.length;
  document.getElementById('stat-routes').textContent = routes.length;
  document.getElementById('stat-stops').textContent  = stops.length;

  const tbody = document.getElementById('dash-routes-body');
  tbody.innerHTML = routes.slice(0, 6).map(r => `
    <tr>
      <td style="color:var(--text-secondary)">${r.id}</td>
      <td>${r.route_name}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditRoute(${r.id})" title="Edit route">
            <i class="ti ti-edit"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Profiles ──────────────────────────────────────────────────────────────────
function renderProfiles(arr) {
  document.getElementById('profile-count').textContent = arr.length + ' accounts';
  document.getElementById('profile-page-info').textContent =
    `Showing 1–${arr.length} of ${arr.length}`;

  document.getElementById('profiles-tbody').innerHTML = arr.map(p => `
    <tr>
      <td><div class="avatar">${initials(p.username)}</div></td>
      <td style="font-weight:500">${p.username}</td>
      <td style="color:var(--text-secondary);font-size:12px">${p.email}</td>
      <td style="color:var(--text-secondary);font-size:12px">${p.created}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditProfile('${p.id}')" title="Edit profile">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="openDeleteProfile('${p.id}')" title="Delete account">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function filterProfiles(v) {
  const q = v.toLowerCase();
  filteredProfiles = profiles.filter(p =>
    p.username.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  );
  renderProfiles(filteredProfiles);
}

function openEditProfile(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;
  document.getElementById('ep-id').value      = p.id;
  document.getElementById('ep-username').value = p.username;
  document.getElementById('ep-email').value    = p.email;
  document.getElementById('modal-edit-profile').classList.add('open');
}

async function saveProfile() {
  const id       = document.getElementById('ep-id').value;
  const username = document.getElementById('ep-username').value.trim();
  const email    = document.getElementById('ep-email').value.trim();

  const { error } = await supabase
    .from('profiles')
    .update({ username, email })
    .eq('id', id);

  if (error) { toastError('Failed to update profile'); return; }

  const p = profiles.find(x => x.id === id);
  if (p) { p.username = username; p.email = email; }
  filteredProfiles = filteredProfiles.map(x => x.id === id ? { ...x, username, email } : x);

  closeModal('modal-edit-profile');
  renderProfiles(filteredProfiles);
  toast('Profile updated');
}

function openDeleteProfile(id) {
  deleteTargetId = id;
  const p = profiles.find(x => x.id === id);
  document.getElementById('del-username-label').textContent = p ? p.username : 'this user';
  document.getElementById('modal-delete-profile').classList.add('open');
}

async function confirmDeleteProfile() {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', deleteTargetId);

  if (error) { toastError('Failed to delete profile'); return; }

  profiles         = profiles.filter(x => x.id !== deleteTargetId);
  filteredProfiles = filteredProfiles.filter(x => x.id !== deleteTargetId);
  closeModal('modal-delete-profile');
  renderProfiles(filteredProfiles);
  toast('Account deleted');
}

// ── Routes ────────────────────────────────────────────────────────────────────
function renderRoutes(arr) {
  document.getElementById('routes-tbody').innerHTML = arr.map(r => `
    <tr>
      <td style="color:var(--text-secondary)">${r.id}</td>
      <td>${r.route_name}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditRoute(${r.id})" title="Edit route">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="deleteRoute(${r.id})" title="Delete route">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function filterRoutes(v) {
  renderRoutes(routes.filter(r => r.route_name.toLowerCase().includes(v.toLowerCase())));
}

function openAddRoute() {
  document.getElementById('er-id').value   = '';
  document.getElementById('er-name').value = '';
  document.getElementById('route-modal-heading').textContent = 'Add route';
  document.getElementById('modal-edit-route').classList.add('open');
}

function openEditRoute(id) {
  const r = routes.find(x => x.id === id);
  if (!r) return;
  document.getElementById('er-id').value   = r.id;
  document.getElementById('er-name').value = r.route_name;
  document.getElementById('route-modal-heading').textContent = 'Edit route';
  document.getElementById('modal-edit-route').classList.add('open');
}

async function saveRoute() {
  const id   = parseInt(document.getElementById('er-id').value);
  const name = document.getElementById('er-name').value.trim();
  if (!name) { toast('Route name cannot be empty'); return; }

  if (id) {
    const { error } = await supabase.from('routes').update({ route_name: name }).eq('id', id);
    if (error) { toastError('Failed to update route'); return; }
    const r = routes.find(x => x.id === id);
    if (r) r.route_name = name;
    toast('Route updated');
  } else {
  const { data, error } = await supabase
      .from('routes')
      .insert({ route_name: name })
      .select()
      .single();
      
    if (error) {
      // This will now show you the exact Postgres error message and code
      console.error("Supabase Insert Error:", error);
      toastError(`Failed to add route: ${error.message}`); 
      return; 
    }
    
    routes.push({ id: data.id,  route_name: data.route_name });
    toast('Route added');
  }

  closeModal('modal-edit-route');
  renderRoutes(routes);
}

async function deleteRoute(id) {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) { toastError('Failed to delete route'); return; }
  routes = routes.filter(x => x.id !== id);
  renderRoutes(routes);
  toast('Route deleted');
}

// ── Stops ─────────────────────────────────────────────────────────────────────
function renderStops(arr) {
  document.getElementById('stops-tbody').innerHTML = arr.map(s => `
    <tr>
      <td style="color:var(--text-secondary)">${s.id}</td>
      <td>${s.stop_name}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${Number(s.lat).toFixed(6)}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${Number(s.lng).toFixed(6)}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditStop(${s.id})" title="Edit stop">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="deleteStop(${s.id})" title="Delete stop">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function filterStops(v) {
  const q = v.toLowerCase();

  renderStops(
    stops.filter(s =>
      s.stop_name.toLowerCase().includes(q)
    )
  );
}

function openAddStop() {
  document.getElementById('es-id').value   = '';
  document.getElementById('es-name').value = '';
  document.getElementById('es-lat').value  = '';
  document.getElementById('es-lng').value  = '';
  document.getElementById('stop-modal-heading').textContent = 'Add stop';
  document.getElementById('modal-edit-stop').classList.add('open');
}

function openEditStop(id) {
  const s = stops.find(x => x.id === id);
  if (!s) return;
  document.getElementById('es-id').value   = s.id;
  document.getElementById('es-name').value = s.name;
  document.getElementById('es-lat').value  = s.lat;
  document.getElementById('es-lng').value  = s.lng;
  document.getElementById('stop-modal-heading').textContent = 'Edit stop';
  document.getElementById('modal-edit-stop').classList.add('open');
}

async function saveStop() {
  const id   = parseInt(document.getElementById('es-id').value);
  const name = document.getElementById('es-name').value.trim();
  const lat  = parseFloat(document.getElementById('es-lat').value);
  const lng  = parseFloat(document.getElementById('es-lng').value);
  if (!name) { toast('Stop name cannot be empty'); return; }

  if (id) {
    const { error } = await supabase.from('stops').update({ stop_name: name, lat, lng }).eq('id', id);
    if (error) { toastError('Failed to update stop'); return; }
    const s = stops.find(x => x.id === id);
    if (s) { s.stop_name = name; s.lat = lat; s.lng = lng; }
    toast('Stop updated');
  } else {
    const { data, error } = await supabase.from('stops').insert({ stop_name: name, lat, lng }).select().single();
    if (error) { toastError('Failed to add stop'); return; }
    stops.push({ id: data.id, stop_name: data.stop_name, lat: data.lat, lng: data.lng });
    toast('Stop added');
  }

  closeModal('modal-edit-stop');
  renderStops(stops);
}

async function deleteStop(id) {
  const { error } = await supabase.from('stops').delete().eq('id', id);
  if (error) { toastError('Failed to delete stop'); return; }
  stops = stops.filter(x => x.id !== id);
  renderStops(stops);
  toast('Stop deleted');
}

// ── Route stops ───────────────────────────────────────────────────────────────
function renderRS(arr) {
  document.getElementById('rs-count').textContent = arr.length + ' records';
  document.getElementById('rs-tbody').innerHTML = arr.map(r => {
    const route = routes.find(x => x.id === r.route_id);
    return `
      <tr>
        <td style="color:var(--text-secondary)">${r.id}</td>
        <td>${r.route_id}</td>
        <td>${r.stop_id}</td>
        <td>${r.stop_order}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${route ? route.route_name : '—'}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" onclick="openEditRS(${r.id})" title="Edit">
              <i class="ti ti-edit"></i>
            </button>
            <button class="icon-btn del" onclick="deleteRS(${r.id})" title="Delete">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function filterRouteStops(v) {
  const q = v.toLowerCase();
  const filtered = routeStops.filter(r => {
    const route = routes.find(x => x.id === r.route_id);
    return (
      String(r.id).includes(q) ||
      String(r.route_id).includes(q) ||
      String(r.stop_id).includes(q) ||
      String(r.stop_order).includes(q) ||
      (route?.route_name || "").toLowerCase().includes(q)
    );
  });
  renderRS(filtered);
}

// ── Fares ─────────────────────────────────────────────────────────────────────
let fares = [];

async function fetchFares() {
  const { data, error } = await supabase
    .from('fares')
    .select('*')
    .order('id', { ascending: true });

  if (error) { toastError('Failed to load fares'); return; }
  fares = data.map(f => ({
    id:          f.id,
    base_fare:   f.Base_rate,
    fare_per_km: f.Per_kmrate,
    jeepney_type:  f.Jeepney_type ?? '—',
  }));
}

function renderFares(arr) {
  document.getElementById('fares-tbody').innerHTML = arr.map(f => `
    <tr>
      <td style="color:var(--text-secondary)">${f.id}</td>
      <td>${f.jeepney_type}</td>
      <td>₱${Number(f.base_fare).toFixed(2)}</td>
      <td>₱${Number(f.fare_per_km).toFixed(2)} / km</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditFare(${f.id})" title="Edit fare">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="deleteFare(${f.id})" title="Delete fare">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function filterFares(v) {
  const q = v.toLowerCase();
  renderFares(fares.filter(f =>
    String(f.base_fare).includes(q) ||
    String(f.fare_per_km).includes(q) ||
    f.jeepney_type.toLowerCase().includes(q)
  ));
}

function populateRouteSelect(selectedRouteId = null) {
  const sel = document.getElementById('ef-route');
  sel.innerHTML = routes.map(r =>
    `<option value="${r.id}" ${r.id === selectedRouteId ? 'selected' : ''}>${r.route_name}</option>`
  ).join('');
}

function updateFarePreview() {
  const base  = parseFloat(document.getElementById('ef-base').value)  || 0;
  const perkm = parseFloat(document.getElementById('ef-perkm').value) || 0;
  const grid  = document.getElementById('fare-preview-grid');
  const kms   = [1, 2, 4, 5, 8, 10, 15, 20];
  grid.innerHTML = kms.map(km => `
    <div class="fare-chip">
      <div class="fare-chip-km">${km} km</div>
      <div class="fare-chip-val">₱${(base + perkm * km).toFixed(2)}</div>
    </div>`).join('');
}

function openAddFare() {
  document.getElementById('ef-id').value      = '';
  document.getElementById('ef-type').value    = 'Traditional';
  document.getElementById('ef-base').value    = '13.00';
  document.getElementById('ef-perkm').value   = '1.80';
  document.getElementById('fare-modal-heading').textContent = 'Add fare';
  updateFarePreview();
  document.getElementById('ef-base').oninput  = updateFarePreview;
  document.getElementById('ef-perkm').oninput = updateFarePreview;
  document.getElementById('modal-edit-fare').classList.add('open');
}

function openEditFare(id) {
  const f = fares.find(x => x.id === id);
  if (!f) return;
  document.getElementById('ef-id').value      = f.id;
  document.getElementById('ef-type').value    = f.jeepney_type;
  document.getElementById('ef-base').value    = f.base_fare;
  document.getElementById('ef-perkm').value   = f.fare_per_km;
  document.getElementById('fare-modal-heading').textContent = 'Edit fare';
  updateFarePreview();
  document.getElementById('ef-base').oninput  = updateFarePreview;
  document.getElementById('ef-perkm').oninput = updateFarePreview;
  document.getElementById('modal-edit-fare').classList.add('open');
}
async function saveFare() {
  const idRaw       = document.getElementById('ef-id').value;
  const id          = idRaw ? parseInt(idRaw) : null;
  const jeepneyType = document.getElementById('ef-type').value;
  const base_fare    = parseFloat(document.getElementById('ef-base').value);
  const fare_per_km  = parseFloat(document.getElementById('ef-perkm').value);

  if (isNaN(base_fare) || isNaN(fare_per_km)) {
    toastError('Both fields must be valid numbers'); return;
  }
  if (!jeepneyType) {
    toastError('Please select a jeepney type'); return;
  }

  if (id) {
    const { error } = await supabase
      .from('fares')
      .update({ Base_rate: base_fare, Per_kmrate: fare_per_km, Jeepney_type: jeepneyType })
      .eq('id', id);
    if (error) { toastError(`Failed to update fare: ${error.message}`); return; }
    const f = fares.find(x => x.id === id);
    if (f) { f.base_fare = base_fare; f.fare_per_km = fare_per_km; f.jeepney_type = jeepneyType; }
    toast('Fare updated');
  } else {
    const { data, error } = await supabase
      .from('fares')
      .insert({ Base_rate: base_fare, Per_kmrate: fare_per_km, Jeepney_type: jeepneyType })
      .select()
      .single();
    if (error) { toastError(`Failed to add fare: ${error.message}`); return; }
    fares.push({ id: data.id, base_fare: data.Base_rate, fare_per_km: data.Per_kmrate, jeepney_type: data.Jeepney_type });
    toast('Fare added');
  }

  closeModal('modal-edit-fare');
  renderFares(fares);
}

async function deleteFare(id) {
  const { error } = await supabase.from('fares').delete().eq('id', id);
  if (error) { toastError('Failed to delete fare'); return; }
  fares = fares.filter(x => x.id !== id);
  renderFares(fares);
  toast('Fare deleted');
}

// NEW: Function to open the modal for a fresh insert
function openAddRS() {
  document.getElementById('ers-id').value    = '';
  document.getElementById('ers-route').value = '';
  document.getElementById('ers-stop').value  = '';
  document.getElementById('ers-order').value = '';
  
  const heading = document.getElementById('rs-modal-heading');
  if (heading) heading.textContent = 'Add Route Stop';
  
  document.getElementById('modal-edit-rs').classList.add('open');
}

function openEditRS(id) {
  const r = routeStops.find(x => x.id === id);
  if (!r) return;
  document.getElementById('ers-id').value    = r.id;
  document.getElementById('ers-route').value = r.route_id;
  document.getElementById('ers-stop').value  = r.stop_id;
  document.getElementById('ers-order').value = r.stop_order;
  
  const heading = document.getElementById('rs-modal-heading');
  if (heading) heading.textContent = 'Edit Route Stop';
  
  document.getElementById('modal-edit-rs').classList.add('open');
}

// UPDATED: Handles both Insert (Add) and Update (Edit) dynamically
async function saveRS() {
  const idRaw      = document.getElementById('ers-id').value;
  const id         = idRaw ? parseInt(idRaw) : null;
  const route_id   = parseInt(document.getElementById('ers-route').value);
  const stop_id    = parseInt(document.getElementById('ers-stop').value);
  const stop_order = parseInt(document.getElementById('ers-order').value);

  if (isNaN(route_id) || isNaN(stop_id) || isNaN(stop_order)) {
    toastError('All fields must be valid numbers');
    return;
  }

  if (id) {
    // ── UPDATE EXISTING RECORD ──
    const { error } = await supabase
      .from('route_stops')
      .update({ route_id, stop_id, stop_order })
      .eq('id', id);

    if (error) { toastError(`Failed to update: ${error.message}`); return; }

    const r = routeStops.find(x => x.id === id);
    if (r) { r.route_id = route_id; r.stop_id = stop_id; r.stop_order = stop_order; }
    toast('Route stop updated');
  } else {
    // ── INSERT NEW RECORD ──
    const { data, error } = await supabase
      .from('route_stops')
      .insert({ route_id, stop_id, stop_order })
      .select()
      .single();

    if (error) { toastError(`Failed to add: ${error.message}`); return; }
    
    routeStops.push({
      id:         data.id,
      route_id:   data.route_id,
      stop_id:    data.stop_id,
      stop_order: data.stop_order,
    });
    toast('Route stop added');
  }

  closeModal('modal-edit-rs');
  renderRS(routeStops);
}

async function deleteRS(id) {
  const { error } = await supabase.from('route_stops').delete().eq('id', id);
  if (error) { toastError('Failed to delete record'); return; }
  routeStops = routeStops.filter(x => x.id !== id);
  renderRS(routeStops);
  toast('Record deleted');
}



async function logout() {
  const confirmLogout = confirm("Are you sure you want to logout?");
  if (!confirmLogout) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    toastError(error.message);
    return;
  }

  window.location.href = window.location.origin;;
}

// ── Expose to global scope (required for onclick in HTML with ES modules) ─────
Object.assign(window, {
  filterFares, openAddFare, openEditFare, saveFare, deleteFare,
  showSection,
  logout,
  renderDashboard, toggleSidebar,
  filterProfiles, openEditProfile, saveProfile, openDeleteProfile, confirmDeleteProfile,
  filterRoutes, openAddRoute, openEditRoute, saveRoute, deleteRoute,
  filterStops, openAddStop, openEditStop, saveStop, deleteStop,
  renderRS, filterRouteStops , openAddRS, openEditRS, saveRS, deleteRS,
  closeModal, toast,
});

// ── Init ──────────────────────────────────────────────────────────────────────
showSection('dashboard');