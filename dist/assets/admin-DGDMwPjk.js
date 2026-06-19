import{t as a}from"./supabaseClient-DaN6boGH.js";var p=[],l=[],c=[],m=[],u=[],g=null;function x(t){return t.slice(0,2).toUpperCase()}function i(t){const e=document.getElementById("toast");e.textContent="✓  "+t,e.style.display="block",clearTimeout(i._t),i._t=setTimeout(()=>e.style.display="none",2800)}function r(t){const e=document.getElementById("toast");e.textContent="✕  "+t,e.style.display="block",e.style.background="var(--danger, #e53e3e)",clearTimeout(i._t),i._t=setTimeout(()=>{e.style.display="none",e.style.background=""},3e3)}function f(t){document.getElementById(t).classList.remove("open")}document.querySelectorAll(".overlay").forEach(t=>{t.addEventListener("click",e=>{e.target===t&&t.classList.remove("open")})});async function _(){const{data:t,error:e}=await a.from("profiles").select("*").order("created_at",{ascending:!1});if(e){r("Failed to load profiles");return}p=t.map(o=>({id:o.id,username:o.username??o.full_name??"—",email:o.email??"—",created:(o.created_at??"").slice(0,10)})),u=[...p]}async function b(){const{data:t,error:e}=await a.from("routes").select("*").order("id",{ascending:!0});if(e){r("Failed to load routes");return}l=t.map(o=>({id:o.id,route_name:o.route_name}))}async function w(){const{data:t,error:e}=await a.from("stops").select("*").order("id",{ascending:!0});if(e){r("Failed to load stops");return}c=t.map(o=>({id:o.id,stop_name:o.stop_name,lat:o.lat,lng:o.lng}))}async function $(){const{data:t,error:e}=await a.from("route_stops").select("*").order("id",{ascending:!0});if(e){r("Failed to load route stops");return}m=t.map(o=>({id:o.id,route_id:o.route_id,stop_id:o.stop_id,stop_order:o.stop_order}))}var L={dashboard:["Dashboard","Overview of all system data"],profiles:["User profiles","Manage user accounts"],routes:["Routes","Manage jeepney routes"],stops:["Stops","Manage route stops"],"route-stops":["Route stops","Route–stop junction table"]};async function h(t){document.querySelectorAll(".section").forEach(o=>o.classList.remove("active")),document.querySelectorAll(".nav-item").forEach(o=>o.classList.remove("active")),document.getElementById("section-"+t).classList.add("active");const e=L[t]||[t,""];document.getElementById("topbar-title").textContent=e[0],document.getElementById("topbar-meta").textContent=e[1],document.querySelectorAll(".nav-item").forEach(o=>{o.getAttribute("onclick")===`showSection('${t}')`&&o.classList.add("active")}),t==="dashboard"&&(await Promise.all([_(),b(),w()]),S()),t==="profiles"&&(await _(),E(u)),t==="routes"&&(await b(),v(l)),t==="stops"&&(await w(),I(c)),t==="route-stops"&&(await Promise.all([b(),$()]),y(m))}function S(){document.getElementById("stat-users").textContent=p.length,document.getElementById("stat-routes").textContent=l.length,document.getElementById("stat-stops").textContent=c.length;const t=document.getElementById("dash-routes-body");t.innerHTML=l.slice(0,6).map(e=>`
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
    </tr>`).join("")}function E(t){document.getElementById("profile-count").textContent=t.length+" accounts",document.getElementById("profile-page-info").textContent=`Showing 1–${t.length} of ${t.length}`,document.getElementById("profiles-tbody").innerHTML=t.map(e=>`
    <tr>
      <td><div class="avatar">${x(e.username)}</div></td>
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
    </tr>`).join("")}function R(t){const e=t.toLowerCase();u=p.filter(o=>o.username.toLowerCase().includes(e)||o.email.toLowerCase().includes(e)),E(u)}function C(t){const e=p.find(o=>o.id===t);e&&(document.getElementById("ep-id").value=e.id,document.getElementById("ep-username").value=e.username,document.getElementById("ep-email").value=e.email,document.getElementById("modal-edit-profile").classList.add("open"))}async function F(){const t=document.getElementById("ep-id").value,e=document.getElementById("ep-username").value.trim(),o=document.getElementById("ep-email").value.trim(),{error:n}=await a.from("profiles").update({username:e,email:o}).eq("id",t);if(n){r("Failed to update profile");return}const s=p.find(d=>d.id===t);s&&(s.username=e,s.email=o),u=u.map(d=>d.id===t?{...d,username:e,email:o}:d),f("modal-edit-profile"),E(u),i("Profile updated")}function q(t){g=t;const e=p.find(o=>o.id===t);document.getElementById("del-username-label").textContent=e?e.username:"this user",document.getElementById("modal-delete-profile").classList.add("open")}async function P(){const{error:t}=await a.from("profiles").delete().eq("id",g);if(t){r("Failed to delete profile");return}p=p.filter(e=>e.id!==g),u=u.filter(e=>e.id!==g),f("modal-delete-profile"),E(u),i("Account deleted")}function v(t){document.getElementById("routes-tbody").innerHTML=t.map(e=>`
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
    </tr>`).join("")}function A(t){v(l.filter(e=>e.route_name.toLowerCase().includes(t.toLowerCase())))}function M(){document.getElementById("er-id").value="",document.getElementById("er-name").value="",document.getElementById("route-modal-heading").textContent="Add route",document.getElementById("modal-edit-route").classList.add("open")}function T(t){const e=l.find(o=>o.id===t);e&&(document.getElementById("er-id").value=e.id,document.getElementById("er-name").value=e.route_name,document.getElementById("route-modal-heading").textContent="Edit route",document.getElementById("modal-edit-route").classList.add("open"))}async function D(){const t=parseInt(document.getElementById("er-id").value),e=document.getElementById("er-name").value.trim();if(!e){i("Route name cannot be empty");return}if(t){const{error:o}=await a.from("routes").update({route_name:e}).eq("id",t);if(o){r("Failed to update route");return}const n=l.find(s=>s.id===t);n&&(n.route_name=e),i("Route updated")}else{const{data:o,error:n}=await a.from("routes").insert({route_name:e}).select().single();if(n){r("Failed to add route");return}l.push({id:o.id,route_name:o.route_name}),i("Route added")}f("modal-edit-route"),v(l)}async function j(t){const{error:e}=await a.from("routes").delete().eq("id",t);if(e){r("Failed to delete route");return}l=l.filter(o=>o.id!==t),v(l),i("Route deleted")}function I(t){document.getElementById("stops-tbody").innerHTML=t.map(e=>`
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
    </tr>`).join("")}function k(t){const e=t.toLowerCase();I(c.filter(o=>o.stop_name.toLowerCase().includes(e)))}function z(){document.getElementById("es-id").value="",document.getElementById("es-name").value="",document.getElementById("es-lat").value="",document.getElementById("es-lng").value="",document.getElementById("stop-modal-heading").textContent="Add stop",document.getElementById("modal-edit-stop").classList.add("open")}function H(t){const e=c.find(o=>o.id===t);e&&(document.getElementById("es-id").value=e.id,document.getElementById("es-name").value=e.name,document.getElementById("es-lat").value=e.lat,document.getElementById("es-lng").value=e.lng,document.getElementById("stop-modal-heading").textContent="Edit stop",document.getElementById("modal-edit-stop").classList.add("open"))}async function O(){const t=parseInt(document.getElementById("es-id").value),e=document.getElementById("es-name").value.trim(),o=parseFloat(document.getElementById("es-lat").value),n=parseFloat(document.getElementById("es-lng").value);if(!e){i("Stop name cannot be empty");return}if(t){const{error:s}=await a.from("stops").update({stop_name:e,lat:o,lng:n}).eq("id",t);if(s){r("Failed to update stop");return}const d=c.find(B=>B.id===t);d&&(d.stop_name=e,d.lat=o,d.lng=n),i("Stop updated")}else{const{data:s,error:d}=await a.from("stops").insert({stop_name:e,lat:o,lng:n}).select().single();if(d){r("Failed to add stop");return}c.push({id:s.id,stop_name:s.stop_name,lat:s.lat,lng:s.lng}),i("Stop added")}f("modal-edit-stop"),I(c)}async function N(t){const{error:e}=await a.from("stops").delete().eq("id",t);if(e){r("Failed to delete stop");return}c=c.filter(o=>o.id!==t),I(c),i("Stop deleted")}function y(t){document.getElementById("rs-count").textContent=t.length+" records",document.getElementById("rs-tbody").innerHTML=t.map(e=>{const o=l.find(n=>n.id===e.route_id);return`
      <tr>
        <td style="color:var(--text-secondary)">${e.id}</td>
        <td>${e.route_id}</td>
        <td>${e.stop_id}</td>
        <td>${e.stop_order}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${o?o.route_name:"—"}</td>
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
      </tr>`}).join("")}function U(t){const e=t.toLowerCase();y(m.filter(o=>{const n=l.find(s=>s.id===o.route_id);return String(o.id).includes(e)||String(o.route_id).includes(e)||String(o.stop_id).includes(e)||String(o.stop_order).includes(e)||(n?.route_name||"").toLowerCase().includes(e)}))}function G(t){const e=m.find(o=>o.id===t);e&&(document.getElementById("ers-id").value=e.id,document.getElementById("ers-route").value=e.route_id,document.getElementById("ers-stop").value=e.stop_id,document.getElementById("ers-order").value=e.stop_order,document.getElementById("modal-edit-rs").classList.add("open"))}async function J(){const t=parseInt(document.getElementById("ers-id").value),e=parseInt(document.getElementById("ers-route").value),o=parseInt(document.getElementById("ers-stop").value),n=parseInt(document.getElementById("ers-order").value),{error:s}=await a.from("route_stops").update({route_id:e,stop_id:o,stop_order:n}).eq("id",t);if(s){r("Failed to update route stop");return}const d=m.find(B=>B.id===t);d&&(d.route_id=e,d.stop_id=o,d.stop_order=n),f("modal-edit-rs"),y(m),i("Route stop updated")}async function K(t){const{error:e}=await a.from("route_stops").delete().eq("id",t);if(e){r("Failed to delete record");return}m=m.filter(o=>o.id!==t),y(m),i("Record deleted")}async function Q(){if(!confirm("Are you sure you want to logout?"))return;const{error:t}=await a.auth.signOut();if(t){r(t.message);return}window.location.href=window.location.origin}Object.assign(window,{showSection:h,logout:Q,renderDashboard:S,filterProfiles:R,openEditProfile:C,saveProfile:F,openDeleteProfile:q,confirmDeleteProfile:P,filterRoutes:A,openAddRoute:M,openEditRoute:T,saveRoute:D,deleteRoute:j,filterStops:k,openAddStop:z,openEditStop:H,saveStop:O,deleteStop:N,renderRS:y,filterRouteStops:U,openEditRS:G,saveRS:J,deleteRS:K,closeModal:f,toast:i});h("dashboard");
