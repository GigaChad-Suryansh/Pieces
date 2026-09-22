import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const engines={
 i4:{name:'2.0L Inline-4',sub:'Petrol · DOHC · 16 valves',cyl:4,bore:1.75,stroke:2.05},
 v6:{name:'3.0L V6',sub:'Petrol · DOHC · 24 valves',cyl:6,bore:1.55,stroke:1.95},
 diesel:{name:'2.2L Turbo Diesel',sub:'Diesel · common rail · turbo',cyl:4,bore:1.82,stroke:2.15},
 bike:{name:'1.0L Motorcycle',sub:'Petrol · DOHC · high-revving',cyl:4,bore:1.42,stroke:1.75}
};
const catalog=[
['Structure','Engine block','Main structural casting containing cylinder bores and oil/coolant passages.'],
['Structure','Cylinder liner','Precision bore surface in which the piston travels.'],
['Structure','Cylinder head','Closes the cylinders and carries combustion chambers, ports and valvetrain.'],
['Structure','Head gasket','Seals combustion pressure and oil/coolant passages between head and block.'],
['Structure','Valve cover','Covers the upper valvetrain and retains lubricant.'],
['Structure','Oil pan / sump','Reservoir at the bottom of the engine that collects oil.'],
['Motion','Piston','Receives combustion pressure and transfers force to the connecting rod.'],
['Motion','Piston rings','Seal combustion gases, control oil and transfer heat to the cylinder wall.'],
['Motion','Wrist pin','Connects the piston to the small end of the connecting rod.'],
['Motion','Connecting rod','Transfers force between piston and crankshaft.'],
['Motion','Rod bearing','Precision bearing between the rod big end and crank journal.'],
['Motion','Crankshaft','Converts piston reciprocation into rotary motion.'],
['Motion','Main bearing','Supports crankshaft journals inside the block.'],
['Motion','Crank pulley','Front pulley for accessory drive and timing reference.'],
['Motion','Flywheel / flexplate','Adds rotational inertia and couples the crankshaft to the transmission.'],
['Valvetrain','Camshaft','Runs at half crank speed in a four-stroke engine and controls valve events.'],
['Valvetrain','Cam lobe','Eccentric profile that produces valve lift.'],
['Valvetrain','Intake valve','Admits fresh charge into the combustion chamber.'],
['Valvetrain','Exhaust valve','Releases combustion products.'],
['Valvetrain','Valve spring','Returns a valve toward its seat and maintains contact.'],
['Valvetrain','Rocker arm','Lever transmitting cam motion to a valve in rocker-based layouts.'],
['Valvetrain','Valve guide','Guides the valve stem.'],
['Valvetrain','Valve seat','Machined sealing surface for a closed valve.'],
['Timing','Timing chain / belt','Synchronizes crankshaft and camshaft rotation.'],
['Timing','Timing tensioner','Maintains timing-drive tension.'],
['Timing','Timing guide','Controls timing-chain path and vibration.'],
['Air & fuel','Intake manifold','Distributes incoming air or charge to the cylinders.'],
['Air & fuel','Throttle body','Controls intake airflow in throttle-controlled gasoline engines.'],
['Air & fuel','Fuel rail','Supplies pressurized fuel to injectors.'],
['Air & fuel','Fuel injector','Meters and atomizes fuel.'],
['Air & fuel','Air filter','Removes particles from intake air.'],
['Air & fuel','Exhaust manifold','Collects exhaust gas from cylinder outlets.'],
['Air & fuel','Turbocharger','Uses exhaust energy to compress intake air.'],
['Air & fuel','Intercooler','Cools compressed intake air in boosted systems.'],
['Ignition','Spark plug','Creates the spark that initiates combustion in gasoline engines.'],
['Ignition','Ignition coil','Raises battery voltage for the spark plug.'],
['Ignition','Glow plug','Assists cold starting and combustion in diesel engines.'],
['Cooling','Water pump','Circulates coolant through the engine and cooling circuit.'],
['Cooling','Thermostat','Regulates coolant flow and operating temperature.'],
['Cooling','Coolant jacket','Passages around hot areas carrying heat into coolant.'],
['Cooling','Radiator','Rejects coolant heat to ambient air.'],
['Cooling','Cooling fan','Moves air through the radiator when required.'],
['Lubrication','Oil pump','Draws oil from the sump and supplies pressurized lubricant.'],
['Lubrication','Oil filter','Removes particles and contaminants from engine oil.'],
['Lubrication','Oil gallery','Internal passage carrying lubricant to bearings and components.'],
['Lubrication','Oil jet','Directs lubricant toward piston undersides on some engines.'],
['Exhaust','Catalytic converter','Uses catalyst surfaces to reduce regulated exhaust pollutants.'],
['Exhaust','Oxygen sensor','Measures exhaust oxygen for engine-control feedback.'],
['Exhaust','EGR valve','Routes controlled exhaust gas back to the intake on equipped engines.'],
['Starting','Starter motor','Electric motor that rotates the crankshaft during startup.'],
['Starting','Alternator','Generates electrical power and maintains the vehicle battery.']
];
const info=Object.fromEntries(catalog.map(x=>[x[1],{system:x[0],desc:x[2]}]));
const state={engine:'i4',selected:'Piston',system:'All',search:'',explode:false,cutaway:false,isolate:false,running:false,rpm:900,cycle:0};
let scene,camera,renderer,controls,raycaster,mouse,root,parts=[],moving=[],last=performance.now();

document.querySelector('#app').innerHTML=`
<header class="topbar"><div class="brand">ENGINE <span>ATLAS</span></div><div class="search"><span>⌕</span><input id="search" placeholder="Search parts, systems, engines…"></div><nav><button class="nav active" data-tab="library">Library</button><button class="nav" data-tab="learn">Learn</button><button class="nav" data-tab="compare">Compare</button></nav><kbd>K</kbd><div class="avatar">S</div></header>
<main class="appShell"><section class="intro"><div><span class="eyebrow">MICRO-MECHANICS / 3D EXPLORER</span><h1>See how an engine<br><em>actually moves.</em></h1><p>Explore everyday road engines, reveal their hidden mechanisms and follow combustion down to individual components.</p></div><div class="stats"><b>50+</b><span>catalogued parts</span><b>4</b><span>road-engine families</span><b>720°</b><span>four-stroke cycle</span></div></section><section id="workspace"></section></main>`;

const M={steel:new THREE.MeshStandardMaterial({color:0x777a78,roughness:.32,metalness:.85}),alloy:new THREE.MeshStandardMaterial({color:0xbfc2be,roughness:.48,metalness:.7}),dark:new THREE.MeshStandardMaterial({color:0x202322,roughness:.3,metalness:.8}),black:new THREE.MeshStandardMaterial({color:0x141615,roughness:.65,metalness:.15}),red:new THREE.MeshStandardMaterial({color:0xb94139,roughness:.4,metalness:.35}),blue:new THREE.MeshStandardMaterial({color:0x416fa4,roughness:.42,metalness:.35}),gold:new THREE.MeshStandardMaterial({color:0xc79439,roughness:.3,metalness:.75}),rubber:new THREE.MeshStandardMaterial({color:0x202220,roughness:.82}),white:new THREE.MeshStandardMaterial({color:0xe5e6e2,roughness:.55,metalness:.15})};
const geo={box:(x,y,z)=>new THREE.BoxGeometry(x,y,z),cyl:(r,h,s=24)=>new THREE.CylinderGeometry(r,r,h,s),tor:(R,r)=>new THREE.TorusGeometry(R,r,12,36)};
function add(g,m,name,system,parent=root){const o=new THREE.Mesh(g,m);o.userData={part:name,system};o.castShadow=o.receiveShadow=true;parent.add(o);parts.push(o);return o}
function init3D(){
 const el=document.querySelector('#viewport');scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f0ec);
 camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(10,6.5,13);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;el.appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=5;controls.maxDistance=23;controls.target.set(0,.7,0);
 raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
 scene.add(new THREE.HemisphereLight(0xffffff,0x777771,2.1));const l=new THREE.DirectionalLight(0xffffff,3.2);l.position.set(7,12,9);l.castShadow=true;scene.add(l);const f=new THREE.DirectionalLight(0xb8c6d6,1.4);f.position.set(-8,4,-8);scene.add(f);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(12,64),new THREE.MeshStandardMaterial({color:0xe2e2de,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.25;floor.receiveShadow=true;scene.add(floor);
 build();resize();renderer.domElement.addEventListener('pointermove',pointer);renderer.domElement.addEventListener('click',pick);requestAnimationFrame(loop)
}
function build(){
 root=new THREE.Group();scene.add(root);parts=[];moving=[];const E=engines[state.engine],n=E.cyl,s=3,xs=Array.from({length:n},(_,i)=>(i-(n-1)/2)*s);
 const block=add(geo.box(n*2.55,3.8,4.8),M.alloy,'Engine block','Structure');const pan=add(geo.box(n*2.7,1.05,4.95),M.black,'Oil pan / sump','Structure');pan.position.y=-2.35;
 const head=add(geo.box(n*2.48,1.5,4.65),M.alloy,'Cylinder head','Structure');head.position.y=2.55;
 const cover=add(geo.box(n*2.42,.55,4.5),M.dark,'Valve cover','Structure');cover.position.y=3.62;
 const gasket=add(geo.box(n*2.36,.12,4.4),M.rubber,'Head gasket','Structure');gasket.position.y=1.78;
 xs.forEach((x,i)=>{
  const liner=add(geo.cyl(E.bore,3.55,32),M.steel,'Cylinder liner','Structure');liner.position.x=x;liner.scale.z=.86;
  const piston=add(geo.cyl(E.bore*.9,.72,32),M.alloy,'Piston','Motion');piston.position.set(x,.4,0);
  for(let r=0;r<3;r++){const ring=add(geo.tor(E.bore*.9,.055),r===2?M.gold:M.dark,'Piston rings','Motion',piston);ring.rotation.x=Math.PI/2;ring.position.y=.22-r*.13}
  const pin=add(geo.cyl(.16,.9,20),M.steel,'Wrist pin','Motion',piston);pin.rotation.z=Math.PI/2;
  const rod=add(geo.box(.34,2,.34),M.steel,'Connecting rod','Motion');rod.position.set(x,-.55,0);
  const bearing=add(geo.cyl(.52,.38,24),M.dark,'Rod bearing','Motion');bearing.rotation.z=Math.PI/2;bearing.position.set(x,-1.48,0);
  const iv=add(geo.cyl(.13,.72,18),M.blue,'Intake valve','Valvetrain');iv.position.set(x-.48,2.03,.2);
  const ev=add(geo.cyl(.13,.72,18),M.red,'Exhaust valve','Valvetrain');ev.position.set(x+.48,2.03,.2);
  const plug=add(geo.cyl(.09,.5,16),M.gold,'Spark plug','Ignition');plug.position.set(x,2.83,.2);
  moving.push({piston,rod,phase:i*2*Math.PI/n});
 });
 const crank=add(geo.cyl(.31,n*3.15,32),M.dark,'Crankshaft','Motion');crank.rotation.z=Math.PI/2;crank.position.y=-1.48;
 xs.forEach(x=>{const w=add(geo.cyl(.68,.32,28),M.steel,'Crankshaft','Motion');w.rotation.z=Math.PI/2;w.position.set(x,-1.48,0)});
 const main=add(geo.cyl(.47,n*3.05,28),M.gold,'Main bearing','Motion');main.rotation.z=Math.PI/2;main.position.y=-1.48;main.scale.z=.7;
 const fly=add(geo.cyl(1.62,.38,48),M.dark,'Flywheel / flexplate','Motion');fly.rotation.z=Math.PI/2;fly.position.set(n*1.7,-1.48,0);
 const cam=add(geo.cyl(.24,n*3,24),M.dark,'Camshaft','Valvetrain');cam.rotation.z=Math.PI/2;cam.position.set(0,3,.75);
 xs.forEach(x=>[0,1].forEach(j=>{const l=add(geo.cyl(.42,.2,20),M.steel,'Cam lobe','Valvetrain');l.rotation.z=Math.PI/2;l.position.set(x+(j-.5)*.52,3,.75)}));
 const timing=add(geo.tor(1.2,.13),M.dark,'Timing chain / belt','Timing');timing.rotation.x=Math.PI/2;timing.position.set(-n*1.45,1,0);
 const intake=add(geo.box(n*2.35,.72,1.25),M.blue,'Intake manifold','Air & fuel');intake.position.set(0,3.08,2.55);
 const throttle=add(geo.cyl(.48,1,24),M.steel,'Throttle body','Air & fuel');throttle.rotation.x=Math.PI/2;throttle.position.set(0,3.08,3.2);
 const exhaust=add(geo.box(n*2.3,.72,1),M.red,'Exhaust manifold','Air & fuel');exhaust.position.set(0,2.35,-2.45);
 const turbo=add(geo.tor(.8,.28),M.steel,'Turbocharger','Air & fuel');turbo.rotation.x=Math.PI/2;turbo.position.set(n*1.7,1.7,-3);
 const oil=add(geo.cyl(.5,.42,24),M.dark,'Oil pump','Lubrication');oil.rotation.z=Math.PI/2;oil.position.set(-n*1.3,-1.9,.8);
 const filter=add(geo.cyl(.42,.75,24),M.white,'Oil filter','Lubrication');filter.position.set(-n*1.2,-.8,2.35);
 const water=add(geo.cyl(.65,.35,28),M.blue,'Water pump','Cooling');water.rotation.z=Math.PI/2;water.position.set(-n*1.5,0,2.35);
 const starter=add(geo.cyl(.38,1.1,24),M.dark,'Starter motor','Starting');starter.rotation.z=Math.PI/2;starter.position.set(n*1.7,-.8,2.1);
 const alt=add(geo.cyl(.62,.42,32),M.alloy,'Alternator','Starting');alt.rotation.z=Math.PI/2;alt.position.set(-n*1.65,1.15,2.2);
 updateVisibility();select(state.selected,false)
}
function updateVisibility(){
 parts.forEach(o=>o.visible=(state.system==='All'||o.userData.system===state.system)&&(!state.isolate||o.userData.part===state.selected));
 const block=parts.find(o=>o.userData.part==='Engine block');if(block)block.material=state.cutaway?new THREE.MeshStandardMaterial({color:0xb8bbb7,transparent:true,opacity:.15,metalness:.5,roughness:.55}):M.alloy;
}
function select(name,focus=true){
 state.selected=name;document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===name));
 const d=document.querySelector('#detail');if(d)d.innerHTML=`<span class="detailLabel">${info[name]?.system||'ENGINE'} · COMPONENT</span><h3>${name}</h3><p>${info[name]?.desc||'Mechanical component in the engine assembly.'}</p><div class="chips"><span>3D SELECTABLE</span><span>INTERACTIVE</span></div>`;
 if(focus){const o=parts.find(x=>x.userData.part===name);if(o){controls.target.copy(o.getWorldPosition(new THREE.Vector3()));controls.update()}}
}
function pointer(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1}
function pick(){raycaster.setFromCamera(mouse,camera);const h=raycaster.intersectObjects(parts,true)[0];if(h){let o=h.object;while(o&&!o.userData.part)o=o.parent;if(o?.userData.part){select(o.userData.part);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===state.selected))}}}
function resize(){if(!renderer)return;const el=document.querySelector('#viewport');if(!el)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight,false)}
function explode(){
 parts.forEach(o=>{if(!o.userData.base)o.userData.base=o.position.clone();let d=new THREE.Vector3(),n=o.userData.part;
  if(['Cylinder head','Valve cover','Head gasket','Camshaft','Cam lobe','Intake valve','Exhaust valve','Spark plug'].includes(n))d.y=2.3;
  if(['Piston','Piston rings','Wrist pin'].includes(n))d.y=1.15;
  if(['Connecting rod','Rod bearing'].includes(n))d.y=-1;
  if(['Crankshaft','Main bearing','Oil pump'].includes(n))d.y=-1.5;
  if(n==='Oil pan / sump')d.y=-2.7;if(['Intake manifold','Throttle body'].includes(n))d.z=2.5;if(['Exhaust manifold','Turbocharger'].includes(n))d.z=-2.6;if(['Alternator','Water pump','Starter motor','Oil filter'].includes(n))d.x=2.5;
  const target=o.userData.base.clone().add(d);o.position.lerp(state.explode?target:o.userData.base,.16);
 });
}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000);last=now;if(state.running)state.cycle=(state.cycle+dt*state.rpm*6)%720;moving.forEach(m=>{const a=state.cycle*Math.PI/180+m.phase,y=.1+Math.cos(a)*.82;m.piston.position.y=y;m.rod.position.y=(y-1.48)/2;m.rod.scale.y=Math.max(.4,Math.abs(y+1.48)/2)});explode();controls?.update();renderer?.render(scene,camera);if(state.running)requestRenderMeta()}
function requestRenderMeta(){const deg=document.querySelector('#cycleDeg');if(deg)deg.textContent=Math.round(state.cycle)+'°';const bar=document.querySelector('#cycleBar');if(bar)bar.style.width=state.cycle/7.2+'%'}
function renderLibrary(){
 const systems=['All',...new Set(catalog.map(x=>x[0]))],q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 document.querySelector('#workspace').innerHTML=`
 <div class="atlasGrid"><aside class="library panel"><div class="panelTitle"><div><span class="eyebrow">ENGINE LIBRARY</span><h2>Choose a machine</h2></div><span class="count">04</span></div>
 <div class="engineList">${Object.entries(engines).map(([id,e])=>`<button class="engineCard ${id===state.engine?'selected':''}" data-engine="${id}"><span class="engineIcon">◎</span><div><b>${e.name}</b><small>${e.sub}</small></div><i>↗</i></button>`).join('')}</div>
 <div class="catalogHead"><span class="eyebrow">SYSTEMS</span><button id="clear">CLEAR</button></div><div class="systemList">${systems.map(s=>`<button class="systemBtn ${s===state.system?'active':''}" data-system="${s}"><span class="dot"></span>${s}<small>${s==='All'?catalog.length:catalog.filter(x=>x[0]===s).length}</small></button>`).join('')}</div></aside>
 <section class="viewer panel"><div class="viewerHead"><div><span class="eyebrow">LIVE 3D ASSEMBLY</span><h2>${engines[state.engine].name}</h2><small>Orbit · zoom · click any component</small></div><div class="actions"><button id="explodeBtn">${state.explode?'ASSEMBLE':'EXPLODE'}</button><button id="cutBtn">${state.cutaway?'SOLID':'CUTAWAY'}</button><button id="isoBtn">${state.isolate?'SHOW ALL':'ISOLATE'}</button><button id="reset">RESET</button></div></div>
 <div id="viewport" class="viewport"><div class="hud"><b>INTERACTIVE MODEL</b><span>WEBGL · REAL TIME</span></div><div class="cycle"><span>CRANK ANGLE</span><b id="cycleDeg">${Math.round(state.cycle)}°</b><div class="cycleBar"><i id="cycleBar" style="width:${state.cycle/7.2}%"></i></div><button id="play">${state.running?'Ⅱ':'▶'}</button></div><label class="speed">RPM <input id="rpm" type="range" min="300" max="4000" value="${state.rpm}"><b>${state.rpm}</b></label></div>
 <div id="detail" class="detail"></div></section></div>
 <section class="catalog panel"><div class="panelTitle"><div><span class="eyebrow">COMPONENT CATALOGUE</span><h2>${list.length} parts in view</h2></div><span class="subtle">Click a part to inspect it</span></div><div class="partsGrid">${list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('')}</div></section>`;
 bindLibrary();init3D()
}
function bindLibrary(){
 document.querySelectorAll('[data-engine]').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;state.selected='Piston';renderLibrary()});
 document.querySelectorAll('[data-system]').forEach(b=>b.onclick=()=>{state.system=b.dataset.system;renderLibrary()});
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
 document.querySelector('#explodeBtn').onclick=()=>state.explode=!state.explode;
 document.querySelector('#cutBtn').onclick=()=>{state.cutaway=!state.cutaway;updateVisibility()};
 document.querySelector('#isoBtn').onclick=()=>{state.isolate=!state.isolate;updateVisibility()};
 document.querySelector('#reset').onclick=()=>{state.explode=false;state.cutaway=false;state.isolate=false;state.cycle=0;state.running=false;controls.reset();updateVisibility()};
 document.querySelector('#play').onclick=()=>state.running=!state.running;
 document.querySelector('#rpm').oninput=e=>{state.rpm=+e.target.value;e.target.nextElementSibling.textContent=state.rpm};
 document.querySelector('#clear').onclick=()=>{state.system='All';state.search='';document.querySelector('#search').value='';renderLibrary()}
}
function learn(){
 document.querySelector('#workspace').innerHTML=`<div class="learning panel"><span class="eyebrow">HOW IT WORKS</span><h2>One cycle. Two crank revolutions.</h2><p class="lead">A four-stroke engine moves through intake, compression, power and exhaust. In a typical four-stroke layout the camshaft rotates at half crankshaft speed.</p><div class="cycleCards">${[['01','INTAKE','Piston moves down; the intake valve opens and fresh charge enters.'],['02','COMPRESSION','Both valves close; the piston moves up and compresses the charge.'],['03','POWER','Ignition initiates combustion and expanding gases push the piston down.'],['04','EXHAUST','The exhaust valve opens and the rising piston expels spent gases.']].map(x=>`<article><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div><div class="sourceBox"><b>Knowledge note</b><p>Component descriptions are synthesized from automotive engineering references. Actual designs vary by engine, fuel system, valvetrain, emissions package and manufacturer.</p></div></div>`
}
function compare(){
 document.querySelector('#workspace').innerHTML=`<div class="compare panel"><span class="eyebrow">ARCHITECTURES</span><h2>Road-engine families</h2><div class="compareGrid">${Object.entries(engines).map(([id,e])=>`<button data-engine="${id}"><div class="orb">◌</div><b>${e.name}</b><span>${e.sub}</span><small>${e.cyl} cylinders · bore ${e.bore.toFixed(2)} · stroke ${e.stroke.toFixed(2)}</small></button>`).join('')}</div></div>`;document.querySelectorAll('.compareGrid button').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;tab('library')})
}
function tab(t){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));t==='library'?renderLibrary():t==='learn'?learn():compare()}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));let searchTimer;document.querySelector('#search').oninput=e=>{state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderLibrary(),180)};document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search').focus()}});
renderLibrary();