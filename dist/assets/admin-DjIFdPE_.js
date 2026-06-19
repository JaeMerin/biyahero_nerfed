import{t as e}from"./supabaseClient-B7tEIGF5.js";var t=[],n=[],r=[],i=[],a=[],o=null;function s(e){return e.slice(0,2).toUpperCase()}function c(e){let t=document.getElementById(`toast`);t.textContent=`✓  `+e,t.style.display=`block`,clearTimeout(c._t),c._t=setTimeout(()=>t.style.display=`none`,2800)}function l(e){let t=document.getElementById(`toast`);t.textContent=`✕  `+e,t.style.display=`block`,t.style.background=`var(--danger, #e53e3e)`,clearTimeout(c._t),c._t=setTimeout(()=>{t.style.display=`none`,t.style.background=``},3e3)}function u(e){document.getElementById(e).classList.remove(`open`)}document.querySelectorAll(`.overlay`).forEach(e=>{e.addEventListener(`click`,t=>{t.target===e&&e.classList.remove(`open`)})});async function d(){let{data:n,error:r}=await e.from(`profiles`).select(`*`).order(`created_at`,{ascending:!1});if(r){l(`Failed to load profiles`);return}t=n.map(e=>({id:e.id,username:e.username??e.full_name??`—`,email:e.email??`—`,created:(e.created_at??``).slice(0,10)})),a=[...t]}async function f(){let{data:t,error:r}=await e.from(`routes`).select(`*`).order(`id`,{ascending:!0});if(r){l(`Failed to load routes`);return}n=t.map(e=>({id:e.id,route_name:e.route_name}))}async function p(){let{data:t,error:n}=await e.from(`stops`).select(`*`).order(`id`,{ascending:!0});if(n){l(`Failed to load stops`);return}r=t.map(e=>({id:e.id,stop_name:e.stop_name,lat:e.lat,lng:e.lng}))}async function m(){let{data:t,error:n}=await e.from(`route_stops`).select(`*`).order(`id`,{ascending:!0});if(n){l(`Failed to load route stops`);return}i=t.map(e=>({id:e.id,route_id:e.route_id,stop_id:e.stop_id,stop_order:e.stop_order}))}var h={dashboard:[`Dashboard`,`Overview of all system data`],profiles:[`User profiles`,`Manage user accounts`],routes:[`Routes`,`Manage jeepney routes`],stops:[`Stops`,`Manage route stops`],"route-stops":[`Route stops`,`Route–stop junction table`]};async function g(e){document.querySelectorAll(`.section`).forEach(e=>e.classList.remove(`active`)),document.querySelectorAll(`.nav-item`).forEach(e=>e.classList.remove(`active`)),document.getElementById(`section-`+e).classList.add(`active`);let t=h[e]||[e,``];document.getElementById(`topbar-title`).textContent=t[0],document.getElementById(`topbar-meta`).textContent=t[1],document.querySelectorAll(`.nav-item`).forEach(t=>{t.getAttribute(`onclick`)===`showSection('${e}')`&&t.classList.add(`active`)}),e===`dashboard`&&(await Promise.all([d(),f(),p()]),_()),e===`profiles`&&(await d(),v(a)),e===`routes`&&(await f(),w(n)),e===`stops`&&(await p(),A(r)),e===`route-stops`&&(await Promise.all([f(),m()]),I(i))}function _(){document.getElementById(`stat-users`).textContent=t.length,document.getElementById(`stat-routes`).textContent=n.length,document.getElementById(`stat-stops`).textContent=r.length;let e=document.getElementById(`dash-routes-body`);e.innerHTML=n.slice(0,6).map(e=>`
    <tr>
      <td style="color:var(--text-secondary)">${e.id}</td>
      <td>${e.route_name}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditRoute(${e.id})" title="Edit route">
            <i class="ti ti-edit"></i>
          </button>
        </div>
      </td>
    </tr>`).join(``)}function v(e){document.getElementById(`profile-count`).textContent=e.length+` accounts`,document.getElementById(`profile-page-info`).textContent=`Showing 1–${e.length} of ${e.length}`,document.getElementById(`profiles-tbody`).innerHTML=e.map(e=>`
    <tr>
      <td><div class="avatar">${s(e.username)}</div></td>
      <td style="font-weight:500">${e.username}</td>
      <td style="color:var(--text-secondary);font-size:12px">${e.email}</td>
      <td style="color:var(--text-secondary);font-size:12px">${e.created}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditProfile('${e.id}')" title="Edit profile">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="openDeleteProfile('${e.id}')" title="Delete account">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join(``)}function y(e){let n=e.toLowerCase();a=t.filter(e=>e.username.toLowerCase().includes(n)||e.email.toLowerCase().includes(n)),v(a)}function b(e){let n=t.find(t=>t.id===e);n&&(document.getElementById(`ep-id`).value=n.id,document.getElementById(`ep-username`).value=n.username,document.getElementById(`ep-email`).value=n.email,document.getElementById(`modal-edit-profile`).classList.add(`open`))}async function x(){let n=document.getElementById(`ep-id`).value,r=document.getElementById(`ep-username`).value.trim(),i=document.getElementById(`ep-email`).value.trim(),{error:o}=await e.from(`profiles`).update({username:r,email:i}).eq(`id`,n);if(o){l(`Failed to update profile`);return}let s=t.find(e=>e.id===n);s&&(s.username=r,s.email=i),a=a.map(e=>e.id===n?{...e,username:r,email:i}:e),u(`modal-edit-profile`),v(a),c(`Profile updated`)}function S(e){o=e;let n=t.find(t=>t.id===e);document.getElementById(`del-username-label`).textContent=n?n.username:`this user`,document.getElementById(`modal-delete-profile`).classList.add(`open`)}async function C(){let{error:n}=await e.from(`profiles`).delete().eq(`id`,o);if(n){l(`Failed to delete profile`);return}t=t.filter(e=>e.id!==o),a=a.filter(e=>e.id!==o),u(`modal-delete-profile`),v(a),c(`Account deleted`)}function w(e){document.getElementById(`routes-tbody`).innerHTML=e.map(e=>`
    <tr>
      <td style="color:var(--text-secondary)">${e.id}</td>
      <td>${e.route_name}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditRoute(${e.id})" title="Edit route">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="deleteRoute(${e.id})" title="Delete route">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join(``)}function T(e){w(n.filter(t=>t.route_name.toLowerCase().includes(e.toLowerCase())))}function E(){document.getElementById(`er-id`).value=``,document.getElementById(`er-name`).value=``,document.getElementById(`route-modal-heading`).textContent=`Add route`,document.getElementById(`modal-edit-route`).classList.add(`open`)}function D(e){let t=n.find(t=>t.id===e);t&&(document.getElementById(`er-id`).value=t.id,document.getElementById(`er-name`).value=t.route_name,document.getElementById(`route-modal-heading`).textContent=`Edit route`,document.getElementById(`modal-edit-route`).classList.add(`open`))}async function O(){let t=parseInt(document.getElementById(`er-id`).value),r=document.getElementById(`er-name`).value.trim();if(!r){c(`Route name cannot be empty`);return}if(t){let{error:i}=await e.from(`routes`).update({route_name:r}).eq(`id`,t);if(i){l(`Failed to update route`);return}let a=n.find(e=>e.id===t);a&&(a.route_name=r),c(`Route updated`)}else{let{data:t,error:i}=await e.from(`routes`).insert({route_name:r}).select().single();if(i){l(`Failed to add route`);return}n.push({id:t.id,route_name:t.route_name}),c(`Route added`)}u(`modal-edit-route`),w(n)}async function k(t){let{error:r}=await e.from(`routes`).delete().eq(`id`,t);if(r){l(`Failed to delete route`);return}n=n.filter(e=>e.id!==t),w(n),c(`Route deleted`)}function A(e){document.getElementById(`stops-tbody`).innerHTML=e.map(e=>`
    <tr>
      <td style="color:var(--text-secondary)">${e.id}</td>
      <td>${e.stop_name}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${Number(e.lat).toFixed(6)}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${Number(e.lng).toFixed(6)}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditStop(${e.id})" title="Edit stop">
            <i class="ti ti-edit"></i>
          </button>
          <button class="icon-btn del" onclick="deleteStop(${e.id})" title="Delete stop">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join(``)}function j(e){let t=e.toLowerCase();A(r.filter(e=>e.stop_name.toLowerCase().includes(t)))}function M(){document.getElementById(`es-id`).value=``,document.getElementById(`es-name`).value=``,document.getElementById(`es-lat`).value=``,document.getElementById(`es-lng`).value=``,document.getElementById(`stop-modal-heading`).textContent=`Add stop`,document.getElementById(`modal-edit-stop`).classList.add(`open`)}function N(e){let t=r.find(t=>t.id===e);t&&(document.getElementById(`es-id`).value=t.id,document.getElementById(`es-name`).value=t.name,document.getElementById(`es-lat`).value=t.lat,document.getElementById(`es-lng`).value=t.lng,document.getElementById(`stop-modal-heading`).textContent=`Edit stop`,document.getElementById(`modal-edit-stop`).classList.add(`open`))}async function P(){let t=parseInt(document.getElementById(`es-id`).value),n=document.getElementById(`es-name`).value.trim(),i=parseFloat(document.getElementById(`es-lat`).value),a=parseFloat(document.getElementById(`es-lng`).value);if(!n){c(`Stop name cannot be empty`);return}if(t){let{error:o}=await e.from(`stops`).update({stop_name:n,lat:i,lng:a}).eq(`id`,t);if(o){l(`Failed to update stop`);return}let s=r.find(e=>e.id===t);s&&(s.stop_name=n,s.lat=i,s.lng=a),c(`Stop updated`)}else{let{data:t,error:o}=await e.from(`stops`).insert({stop_name:n,lat:i,lng:a}).select().single();if(o){l(`Failed to add stop`);return}r.push({id:t.id,stop_name:t.stop_name,lat:t.lat,lng:t.lng}),c(`Stop added`)}u(`modal-edit-stop`),A(r)}async function F(t){let{error:n}=await e.from(`stops`).delete().eq(`id`,t);if(n){l(`Failed to delete stop`);return}r=r.filter(e=>e.id!==t),A(r),c(`Stop deleted`)}function I(e){document.getElementById(`rs-count`).textContent=e.length+` records`,document.getElementById(`rs-tbody`).innerHTML=e.map(e=>{let t=n.find(t=>t.id===e.route_id);return`
      <tr>
        <td style="color:var(--text-secondary)">${e.id}</td>
        <td>${e.route_id}</td>
        <td>${e.stop_id}</td>
        <td>${e.stop_order}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${t?t.route_name:`—`}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" onclick="openEditRS(${e.id})" title="Edit">
              <i class="ti ti-edit"></i>
            </button>
            <button class="icon-btn del" onclick="deleteRS(${e.id})" title="Delete">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`}).join(``)}function L(e){let t=e.toLowerCase();I(i.filter(e=>{let r=n.find(t=>t.id===e.route_id);return String(e.id).includes(t)||String(e.route_id).includes(t)||String(e.stop_id).includes(t)||String(e.stop_order).includes(t)||(r?.route_name||``).toLowerCase().includes(t)}))}function R(e){let t=i.find(t=>t.id===e);t&&(document.getElementById(`ers-id`).value=t.id,document.getElementById(`ers-route`).value=t.route_id,document.getElementById(`ers-stop`).value=t.stop_id,document.getElementById(`ers-order`).value=t.stop_order,document.getElementById(`modal-edit-rs`).classList.add(`open`))}async function z(){let t=parseInt(document.getElementById(`ers-id`).value),n=parseInt(document.getElementById(`ers-route`).value),r=parseInt(document.getElementById(`ers-stop`).value),a=parseInt(document.getElementById(`ers-order`).value),{error:o}=await e.from(`route_stops`).update({route_id:n,stop_id:r,stop_order:a}).eq(`id`,t);if(o){l(`Failed to update route stop`);return}let s=i.find(e=>e.id===t);s&&(s.route_id=n,s.stop_id=r,s.stop_order=a),u(`modal-edit-rs`),I(i),c(`Route stop updated`)}async function B(t){let{error:n}=await e.from(`route_stops`).delete().eq(`id`,t);if(n){l(`Failed to delete record`);return}i=i.filter(e=>e.id!==t),I(i),c(`Record deleted`)}async function V(){if(!confirm(`Are you sure you want to logout?`))return;let{error:t}=await e.auth.signOut();if(t){l(t.message);return}window.location.href=window.location.origin}Object.assign(window,{showSection:g,logout:V,renderDashboard:_,filterProfiles:y,openEditProfile:b,saveProfile:x,openDeleteProfile:S,confirmDeleteProfile:C,filterRoutes:T,openAddRoute:E,openEditRoute:D,saveRoute:O,deleteRoute:k,filterStops:j,openAddStop:M,openEditStop:N,saveStop:P,deleteStop:F,renderRS:I,filterRouteStops:L,openEditRS:R,saveRS:z,deleteRS:B,closeModal:u,toast:c}),g(`dashboard`);