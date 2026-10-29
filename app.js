/* Romeo Lane Nagpur — website application
   Operated by Mamisi Ventures Private Limited.
   Data lives in Supabase (see supabase/*.sql). Settings live in config.js. */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var CFG=window.RL_CONFIG||{};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function istNow(){var n=new Date();return new Date(n.getTime()+n.getTimezoneOffset()*60000+330*60000)}
function todayISO(){return istNow().toISOString().slice(0,10)}
function normPhone(v){var d=String(v||"").replace(/\D/g,"");if(d.length===12&&d.indexOf("91")===0)d=d.slice(2);if(d.length===11&&d[0]==="0")d=d.slice(1);return /^[6-9]\d{9}$/.test(d)?d:null}
function fmtPhone(d){return d?("+91 "+d.slice(0,5)+" "+d.slice(5)):""}
function maskPhone(d){return d?("+91 "+d.slice(0,2)+"••• •"+d.slice(6)):"+91 ••••• •••••"}
function fmtDate(iso,opt){if(!iso)return"";var d=new Date(String(iso).slice(0,10)+"T00:00:00");return isNaN(d)?iso:d.toLocaleDateString("en-IN",opt||{weekday:"short",day:"numeric",month:"short"})}
function inr(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
var toastT;function toast(m){var t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},3800)}
function copyText(text,cb){try{navigator.clipboard.writeText(text).then(function(){cb(true)},function(){cb(false)})}catch(e){cb(false)}}
function errMsg(e){var m=(e&&(e.message||e.error_description||e.msg))||"";if(/fetch|network/i.test(m))return "We could not reach our booking system. Please check your connection, or call +91 89565 80661.";return m||"Something went wrong. Please call +91 89565 80661."}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||"null");localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}

var TIERS=[{n:"Silver",min:0},{n:"Gold",min:1000},{n:"Black",min:3000}];
function tierIdx(name){for(var i=0;i<TIERS.length;i++)if(TIERS[i].n===name)return i;return 0}
var SLOTS=["12:30 PM","1:30 PM","3:00 PM","5:00 PM","6:30 PM","7:30 PM","8:30 PM","9:30 PM","10:30 PM"];
var PRIZES=[
  {t:"A mocktail",c:"#8B1A2B"},{t:"10% off",c:"#1C1C1C"},{t:"50 points",c:"#6E1522"},{t:"A dessert",c:"#2D2A26"},
  {t:"Next time",c:"#8B1A2B"},{t:"Bar snack",c:"#1C1C1C"},{t:"Priority entry",c:"#6E1522"},{t:"Double points",c:"#2D2A26"}
];

/* ---------- Supabase ---------- */
var sb=null;
if(window.supabase&&CFG.supabaseUrl&&CFG.supabaseKey&&CFG.supabaseUrl.indexOf("YOUR-")<0){
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
}
function rpc(name,args){if(!sb)return Promise.reject(new Error("Online booking is not connected yet. Please call +91 89565 80661."));return sb.rpc(name,args||{}).then(function(r){if(r.error)throw r.error;return r.data})}

var S={events:[],offers:[],packages:[],member:null,session:null,staff:null,guests:2,slot:"8:30 PM",ctab:"table",lastDraw:"",cf:"upcoming",
  all:{bookings:[],members:[]},myBookings:[]};

/* ---------- static bits ---------- */
(function(){
  var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],now=istNow(),today=now.getDay(),h=now.getHours();
  [1,2,3,4,5,6,0].forEach(function(d){var tr=document.createElement("tr");if(d===today)tr.className="today";tr.innerHTML="<td>"+days[d]+"</td><td>12 PM – 1 AM</td>";$("hours").appendChild(tr)});
  var open=h>=12||h<1;$("status").innerHTML='<span class="dot'+(open?" open":"")+'"></span>'+(open?"Open now":"Opens 12 PM");
  $("yr").textContent=now.getFullYear();
})();
var mtabs=[].slice.call(document.querySelectorAll('[aria-label="Menu sections"] [role="tab"]'));
mtabs.forEach(function(t){t.addEventListener("click",function(){mtabs.forEach(function(x){x.setAttribute("aria-selected",x===t?"true":"false");$(x.getAttribute("aria-controls")).hidden=(x!==t)})})});
(function(){
  var box=$("slots");
  SLOTS.forEach(function(s){var b=document.createElement("button");b.type="button";b.textContent=s;b.setAttribute("aria-pressed",s===S.slot?"true":"false");
    b.onclick=function(){S.slot=s;[].forEach.call(box.children,function(x){x.setAttribute("aria-pressed",x===b?"true":"false")})};box.appendChild(b)});
  var d=$("rDate");d.min=todayISO();d.value=todayISO();
  $("gMinus").onclick=function(){S.guests=Math.max(1,S.guests-1);$("gOut").textContent=S.guests};
  $("gPlus").onclick=function(){S.guests=Math.min(30,S.guests+1);$("gOut").textContent=S.guests};
  $("peDate").min=todayISO();
})();

/* When the booking system is unreachable: hand the guest a ready message */
function fallback(el,lines,why){
  var text=lines.join("\n");
  el.innerHTML='<div class="notice"><p></p><pre></pre><div class="row"><button class="btn sm" type="button">Copy request</button><a class="btn ghost sm" href="https://www.instagram.com/romeolanenagpur/" target="_blank" rel="noopener">Instagram</a><a class="btn ghost sm" href="tel:+918956580661">Call</a></div></div>';
  el.querySelector("p").textContent=(why?why+" ":"")+"You can send this request to us directly:";
  el.querySelector("pre").textContent=text;
  el.querySelector("button").onclick=function(){copyText(text,function(ok){toast(ok?"Copied.":"Select the text above and copy it.")})};
}
function successRef(el,title,line,ref){
  el.innerHTML='<div class="success"><b></b><span class="muted"></span><p class="refline">Booking reference <code></code> <button class="mini" type="button">Copy</button></p><span class="muted" style="font-size:13px">Keep this reference to check or cancel your booking under Reserve.</span></div>';
  el.querySelector("b").textContent=title;el.querySelector(".muted").textContent=line;el.querySelector("code").textContent=ref;
  el.querySelector(".refline button").onclick=function(){copyText(ref,function(ok){toast(ok?"Reference copied.":ref)})};
}
function rememberBooking(ref,phone){var list=store("rl.bookings")||[];if(!list.some(function(x){return x.ref===ref}))list.unshift({ref:ref,phone:phone});store("rl.bookings",list.slice(0,20));loadMyBookings()}

/* ---------- public content ---------- */
function loadPublic(){
  if(!sb){renderEvents();renderOffers();renderPkgs();return}
  sb.from("events").select("*").gte("date",todayISO()).order("date").then(function(r){if(!r.error){S.events=r.data||[];renderEvents();renderNext();if(S.staff)renderConsole()}});
  sb.from("offers").select("*").order("sort").then(function(r){if(!r.error){S.offers=r.data||[];renderOffers();if(S.staff)renderConsole()}});
  sb.from("packages").select("*").order("sort").then(function(r){if(!r.error&&r.data&&r.data.length){S.packages=r.data.map(function(p){return {id:p.id,n:p.name,p:p.rate,bar:p.bar,royal:p.royal_dishes}});if(!S.packages.some(function(p){return p.id===PE.pkg}))PE.pkg=S.packages[0].id;renderPkgs();renderGroups();renderQuote()}});
}

/* events */
function renderEvents(){
  var el=$("eventList"),t=todayISO();
  var list=S.events.filter(function(e){return (e.date||"")>=t}).sort(function(a,b){return (a.date+(a.time||"")).localeCompare(b.date+(b.time||""))});
  if(!list.length){el.innerHTML='<div class="empty">The week\'s evenings are announced on <a href="https://www.instagram.com/romeolanenagpur/" target="_blank" rel="noopener">@romeolanenagpur</a>.</div>';return}
  el.innerHTML="";
  list.forEach(function(e){
    var d=new Date(e.date+"T00:00:00"),card=document.createElement("article");card.className="ev";
    var dd=Math.round((d-new Date(t+"T00:00:00"))/864e5);
    card.innerHTML='<div class="cal"><span>'+esc(d.toLocaleDateString("en-IN",{month:"short"}))+'</span><b>'+d.getDate()+'</b><small>'+esc(d.toLocaleDateString("en-IN",{weekday:"short"}))+'</small></div>'+
      '<div style="min-width:0"><span class="tag hl">'+esc(e.kind||"Event")+'</span>'+
      '<h3>'+esc(e.title)+'</h3>'+(dd===0?'<p class="soon">Tonight</p>':dd===1?'<p class="soon">Tomorrow</p>':'')+'<div class="meta"><span>'+esc(e.time||"")+'</span><span>'+(e.price>0?inr(e.price)+" cover":"No cover")+'</span>'+(e.guestlist?'<span>Guestlist open</span>':'')+'</div>'+
      '<p class="blurb">'+esc(e.blurb||"")+'</p><div class="row"></div></div>';
    var row=card.querySelector(".row");
    if(e.price>0){var b=document.createElement("button");b.className="btn sm";b.textContent="Book tickets";b.onclick=function(){openEventSheet(e,"ticket")};row.appendChild(b)}
    if(e.guestlist){var g=document.createElement("button");g.className="btn ghost sm";g.textContent="Guestlist";g.onclick=function(){openEventSheet(e,"guestlist")};row.appendChild(g)}
    if(!(e.price>0)&&!e.guestlist){var r=document.createElement("a");r.className="btn ghost sm";r.href="#reserve";r.textContent="Reserve";row.appendChild(r)}
    el.appendChild(card);
  });
}
function openEventSheet(e,type){
  var m=S.member||{},sheet=$("sheet"),isT=type==="ticket";
  sheet.innerHTML='<header><div><p class="label">'+esc(fmtDate(e.date,{weekday:"long",day:"numeric",month:"long"}))+' · '+esc(e.time||"")+'</p><h3 id="sheetTitle" style="margin-top:8px"></h3></div><button class="x" type="button" aria-label="Close">×</button></header>'+
   '<form class="grid" novalidate id="evForm">'+
   '<div class="f full"><label for="evName">Name</label><input id="evName" autocomplete="name"></div>'+
   '<div class="f full"><label for="evPhone">Mobile</label><div class="phone"><span>+91</span><input id="evPhone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel-national"></div></div>'+
   (isT?'<div class="f"><label for="evQty">Tickets</label><select id="evQty">'+[1,2,3,4,5,6,8,10].map(function(n){return"<option>"+n+"</option>"}).join("")+'</select></div><div class="f"><label>Total</label><output id="evTot" style="font-family:var(--serif);font-weight:700;font-size:28px">'+inr(e.price)+'</output></div>'
       :'<div class="f"><label for="evQty">Your party</label><select id="evQty"><option value="1">Just me</option><option value="2">Me + 1</option><option value="3">Me + 2</option><option value="4">Me + 3</option><option value="6">Me + 5</option></select></div><div class="f"><label for="evType">Entry</label><select id="evType"><option>Couple</option><option>Ladies</option><option>Stag</option><option>Mixed group</option></select></div>')+
   '<p class="muted f full" style="font-size:13.5px;font-style:italic">'+(isT?"Settle at the door on arrival. Bookings are held until 10:30 PM.":"The guestlist closes at "+esc(e.cutoff||"10:30 PM")+". Entry is at the door team's discretion.")+'</p>'+
   '<p class="err f full" id="evErr" role="alert"></p><div class="f full"><button class="btn crimson" type="submit" style="justify-self:start">'+(isT?"Confirm booking":"Add my name")+'</button></div></form><div id="evOut"></div>';
  $("sheetTitle").textContent=e.title;
  $("evName").value=m.name||"";$("evPhone").value=m.phone||"";
  if(isT){$("evQty").onchange=function(){$("evTot").textContent=inr(e.price*Number($("evQty").value))}}
  sheet.querySelector(".x").onclick=closeSheet;
  $("evForm").onsubmit=function(ev){
    ev.preventDefault();
    var name=$("evName").value.trim(),ph=normPhone($("evPhone").value),q=Number($("evQty").value);
    if(!name){$("evErr").textContent="Please add your name.";$("evName").focus();return}
    if(!ph){$("evErr").textContent="Enter a 10-digit Indian mobile number.";$("evPhone").setAttribute("aria-invalid","true");$("evPhone").focus();return}
    $("evErr").textContent="";
    var lines=[(isT?"Ticket booking":"Guestlist")+" — Romeo Lane Nagpur","Event: "+e.title+" ("+fmtDate(e.date)+")","Name: "+name,"Mobile: "+fmtPhone(ph),(isT?"Tickets: ":"Party: ")+q];
    var btn=sheet.querySelector('button[type="submit"]');btn.disabled=true;
    rpc("create_booking",{p_type:type,p_name:name,p_phone:ph,p_date:e.date,p_time:e.time||"",p_guests:q,p_event:e.id,p_details:isT?{}:{entry:$("evType").value}}).then(function(res){
      $("evForm").hidden=true;rememberBooking(res.ref,ph);
      successRef($("evOut"),isT?"Your evening is booked.":"Your name is on the list.",isT?(q+" ticket"+(q>1?"s":"")+" for "+e.title+". "+inr(res.details.amount)+" to settle at the door."):("We will confirm your place for "+e.title+"."),res.ref);
    }).catch(function(err){btn.disabled=false;if(sb&&err&&err.code==="P0001"){$("evErr").textContent=errMsg(err);return}fallback($("evOut"),lines,errMsg(err))});
  };
  $("overlay").hidden=false;setTimeout(function(){$("evName").focus()},30);
}
function closeSheet(){$("overlay").hidden=true;$("sheet").innerHTML=""}
$("overlay").addEventListener("click",function(e){if(e.target===$("overlay"))closeSheet()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!$("overlay").hidden)closeSheet()});

/* offers */
function renderOffers(){
  var el=$("offerList"),list=S.offers.slice().sort(function(a,b){return (a.sort||0)-(b.sort||0)});
  if(!list.length){el.innerHTML='<div class="empty">Ask your server about this evening\'s offers.</div>';return}
  el.innerHTML="";
  list.forEach(function(o){var c=document.createElement("article");c.className="offer";
    c.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap">'+(o.members_only?'<span class="tag hl">Lane Club</span>':'<span class="tag gold">All guests</span>')+'</div><h3>'+esc(o.title)+'</h3><p>'+esc(o.detail)+'</p><span class="when">'+esc(o.when_text||"")+'</span>';
    el.appendChild(c)});
}

/* ---------- reservations ---------- */
$("resForm").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("rName").value.trim(),ph=normPhone($("rPhone").value),date=$("rDate").value,err=$("rErr");
  $("rPhone").removeAttribute("aria-invalid");
  if(!name){err.textContent="Please add your name.";$("rName").focus();return}
  if(!ph){err.textContent="Enter a 10-digit Indian mobile number.";$("rPhone").setAttribute("aria-invalid","true");$("rPhone").focus();return}
  if(!date||date<todayISO()){err.textContent="Choose today or a later date.";$("rDate").focus();return}
  err.textContent="";
  var details={seating:$("rSeat").value,occasion:$("rOcc").value,notes:$("rNotes").value.trim()};
  var lines=["Table request — Romeo Lane Nagpur","Name: "+name,"Mobile: "+fmtPhone(ph),"Date: "+fmtDate(date,{weekday:"short",day:"numeric",month:"short",year:"numeric"}),"Time: "+S.slot,"Guests: "+S.guests,"Seating: "+details.seating,"Occasion: "+details.occasion];
  if(details.notes)lines.push("Requests: "+details.notes);
  var btn=e.submitter;if(btn)btn.disabled=true;
  rpc("create_booking",{p_type:"table",p_name:name,p_phone:ph,p_date:date,p_time:S.slot,p_guests:S.guests,p_event:null,p_details:details}).then(function(res){
    if(btn)btn.disabled=false;rememberBooking(res.ref,ph);$("rNotes").value="";
    successRef($("rOut"),"Your request is with us.","A table for "+S.guests+", "+fmtDate(date)+" at "+S.slot+". We will confirm shortly.",res.ref);
  }).catch(function(x){if(btn)btn.disabled=false;if(sb&&x&&x.code==="P0001"){err.textContent=errMsg(x);return}fallback($("rOut"),lines,errMsg(x))});
});

/* My bookings: stored on this device as reference + phone, looked up on the server */
function loadMyBookings(){
  var list=store("rl.bookings")||[];
  if(!list.length||!sb){S.myBookings=[];renderMine();return}
  var byPhone={};list.forEach(function(x){(byPhone[x.phone]=byPhone[x.phone]||[]).push(x.ref)});
  Promise.all(Object.keys(byPhone).map(function(ph){return rpc("lookup_bookings",{p_phone:ph,p_refs:byPhone[ph]}).then(function(rows){return (rows||[]).map(function(r){r.phone=ph;return r})}).catch(function(){return []})}))
    .then(function(groups){S.myBookings=[].concat.apply([],groups).sort(function(a,b){return (a.on_date+a.at_time).localeCompare(b.on_date+b.at_time)});renderMine()});
}
var KIND={table:"Table",ticket:"Tickets",guestlist:"Guestlist",private:"Private event"};
function renderMine(){
  var box=$("mine"),open=["Requested","Pending","Confirmed","Approved"];box.innerHTML="";
  if(!S.myBookings.length){box.innerHTML='<p class="muted" style="font-size:14px">Bookings you make on this device appear here. To find another, enter its reference and mobile number.</p>';return}
  S.myBookings.forEach(function(x){
    var d=document.createElement("div");d.className="booking";d.innerHTML='<div><b></b><small></small></div><div class="bk-acts"><span class="st"></span></div>';
    var what=x.kind==="table"?"Table for "+x.guests:x.kind==="ticket"?x.title+" · "+x.guests+" ticket"+(x.guests>1?"s":""):x.kind==="guestlist"?x.title+" · guestlist":"Private event · "+x.title;
    d.querySelector("b").textContent=what;
    d.querySelector("small").textContent=fmtDate(x.on_date)+(x.at_time?" · "+x.at_time:"")+" · "+x.ref;
    var s=d.querySelector(".st");s.textContent=x.status;s.classList.add(String(x.status).split(" ")[0]);
    var can=x.kind==="private"?x.status==="Requested":open.indexOf(x.status)>=0;
    if(can){var b=document.createElement("button");b.className="mini bad";b.type="button";b.textContent="Cancel";
      b.onclick=function(){if(!b.dataset.c){b.dataset.c="1";b.textContent="Confirm cancel";setTimeout(function(){if(b.isConnected){delete b.dataset.c;b.textContent="Cancel"}},3500);return}
        b.disabled=true;rpc("cancel_booking",{p_ref:x.ref,p_phone:x.phone}).then(function(){toast("Cancelled · "+x.ref);loadMyBookings()}).catch(function(e){b.disabled=false;toast(errMsg(e))})};
      d.querySelector(".bk-acts").appendChild(b)}
    box.appendChild(d)});
}
$("findForm").addEventListener("submit",function(e){
  e.preventDefault();var ref=$("fRef").value.trim().toUpperCase().replace(/\s/g,""),ph=normPhone($("fPhone").value),err=$("fErr");
  if(!/^RL[A-Z0-9]{6}$/.test(ref)){err.textContent="References look like RL7K3P9Q.";return}
  if(!ph){err.textContent="Enter the mobile number used for the booking.";return}
  err.textContent="";
  rpc("lookup_bookings",{p_phone:ph,p_refs:[ref]}).then(function(rows){if(!rows||!rows.length){err.textContent="No upcoming booking matches that reference and number.";return}rememberBooking(ref,ph);$("fRef").value="";toast("Found "+ref)}).catch(function(x){err.textContent=errMsg(x)});
});

/* ---------- Lane Club ---------- */
$("enrolForm").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("enName").value.trim(),ph=normPhone($("enPhone").value),err=$("enErr");
  $("enPhone").removeAttribute("aria-invalid");
  if(!name){err.textContent="Please add your name.";$("enName").focus();return}
  if(!ph){err.textContent="Enter a 10-digit Indian mobile number, starting with 6, 7, 8 or 9.";$("enPhone").setAttribute("aria-invalid","true");$("enPhone").focus();return}
  err.textContent="";
  var bd=$("enBday").value||null,an=$("enAnniv").value||null;
  var lines=["Lane Club enrolment — Romeo Lane Nagpur","Name: "+name,"Mobile: "+fmtPhone(ph)];if(bd)lines.push("Birthday: "+fmtDate(bd,{day:"numeric",month:"long"}));
  var btn=e.submitter;if(btn)btn.disabled=true;
  rpc("enrol_member",{p_name:name,p_phone:ph,p_birthday:bd,p_anniversary:an,p_consent:$("enConsent").checked}).then(function(res){
    if(btn)btn.disabled=false;
    $("enOut").innerHTML='<div class="success"><b></b><span class="muted"></span></div>';
    $("enOut").querySelector("b").textContent=res==="exists"?"You are already a member.":"Welcome to the Lane Club, "+name.split(" ")[0]+".";
    $("enOut").querySelector(".muted").textContent=res==="exists"?"Mention "+fmtPhone(ph)+" when you settle to earn points.":"A welcome dessert is waiting for you. Mention "+fmtPhone(ph)+" when you settle to earn points.";
    $("enrolForm").reset();$("enConsent").checked=true;$("siPhone").value=ph;
  }).catch(function(x){if(btn)btn.disabled=false;if(sb&&x&&x.code==="P0001"){err.textContent=errMsg(x);return}fallback($("enOut"),lines,errMsg(x))});
});

/* member sign-in by SMS code */
var otpPhone=null;
$("siForm").addEventListener("submit",function(e){
  e.preventDefault();var err=$("siErr");
  if(!otpPhone){
    var ph=normPhone($("siPhone").value);if(!ph){err.textContent="Enter your registered 10-digit mobile number.";return}
    err.textContent="";var btn=e.submitter;if(btn)btn.disabled=true;
    sb.auth.signInWithOtp({phone:"+91"+ph}).then(function(r){if(btn)btn.disabled=false;if(r.error){err.textContent=/provider|sms|phone/i.test(r.error.message)?"Member sign-in is not available yet. Your points are shown at billing.":errMsg(r.error);return}
      otpPhone=ph;$("siCodeWrap").hidden=false;$("siSend").textContent="Verify code";$("siNote").textContent="We sent a 6-digit code to "+fmtPhone(ph)+".";$("siCode").focus()});
  }else{
    var token=$("siCode").value.replace(/\D/g,"");if(token.length<6){err.textContent="Enter the 6-digit code.";return}
    err.textContent="";var b2=e.submitter;if(b2)b2.disabled=true;
    sb.auth.verifyOtp({phone:"+91"+otpPhone,token:token,type:"sms"}).then(function(r){if(b2)b2.disabled=false;if(r.error){err.textContent="That code did not work. Check it, or request a new one.";return}
      otpPhone=null;$("siForm").reset();$("siCodeWrap").hidden=true;$("siSend").textContent="Send code";$("siNote").textContent="";loadMember()});
  }
});
$("siBack").addEventListener("click",function(){otpPhone=null;$("siCodeWrap").hidden=true;$("siSend").textContent="Send code";$("siNote").textContent=""});
$("mvOut").addEventListener("click",function(){sb.auth.signOut().then(function(){S.member=null;renderClub();toast("Signed out")})});

function loadMember(){
  if(!sb||!S.session||S.staff)return renderClub();
  rpc("my_member").then(function(m){
    if(m&&m.enrolled===false){S.member=null;renderClub();$("siErr").textContent="No membership is registered to "+fmtPhone(m.phone)+". Enrol first, then sign in.";return}
    S.member=m;renderClub();
  }).catch(function(){S.member=null;renderClub()});
}
var spinning=false,rot=0;
function renderClub(){
  var m=S.member,ti=m?tierIdx(m.tier):0,life=m?m.lifetime:0;
  $("cardTier").textContent=TIERS[ti].n;$("cardPts").textContent=(m?m.balance:0).toLocaleString("en-IN");
  $("cardName").textContent=m?m.name:"Your name";$("cardPhone").textContent=m?maskPhone(m.phone):"+91 ••••• •••••";
  [].forEach.call($("tiers").children,function(d){d.classList.toggle("on",!!m&&Number(d.dataset.t)===ti)});
  $("enrolView").hidden=!!m;$("memberView").hidden=!m;$("signinBox").hidden=!!m||!CFG.memberSignIn||!sb;
  $("navClub").textContent=m?"My Club":"Lane Club";
  if(!m)return;
  $("mvName").textContent=m.name;$("mvTier").textContent=TIERS[ti].n;
  var next=TIERS[ti+1];
  $("mvNext").textContent=next?((next.min-life).toLocaleString("en-IN")+" points to "+next.n):"You have reached Black";
  $("mvLife").textContent=life.toLocaleString("en-IN")+" lifetime · "+(m.visits||0)+" visits";
  $("mvBar").style.width=(next?Math.min(100,(life-TIERS[ti].min)/(next.min-TIERS[ti].min)*100):100)+"%";
  var vb=$("mvVouchers");vb.innerHTML="";var t=todayISO();
  if(!m.vouchers||!m.vouchers.length)vb.innerHTML='<p class="muted" style="font-size:14px">No vouchers yet.</p>';
  (m.vouchers||[]).forEach(function(v){var exp=v.expires_on&&v.expires_on<t;var d=document.createElement("div");d.className="voucher"+(v.used||exp?" used":"");d.innerHTML='<div><b></b><small class="muted" style="display:block;font-size:12.5px"></small></div><code></code>';
    d.querySelector("b").textContent=v.title;d.querySelector("small").textContent=v.used?"Redeemed":exp?"Expired":(v.source+(v.expires_on?" · valid until "+fmtDate(v.expires_on,{day:"numeric",month:"short"}):"")+" · present when you settle");d.querySelector("code").textContent=v.code;vb.appendChild(d)});
  $("spinBtn").disabled=!!m.drawn_today||spinning;
  if(m.drawn_today&&!spinning)$("spinMsg").textContent=S.lastDraw||"Today's draw is done. Another awaits tomorrow.";
  var hb=$("mvHistory");hb.innerHTML="";
  if(!m.history||!m.history.length)hb.innerHTML='<p class="muted" style="font-size:14px">Points appear after your first bill. Mention your number when you settle.</p>';
  (m.history||[]).forEach(function(x){var d=document.createElement("div");d.className="booking";d.innerHTML='<div><b></b><small></small></div><span class="st"></span>';
    d.querySelector("b").textContent=x.note||"Visit";d.querySelector("small").textContent=new Date(x.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
    var s=d.querySelector(".st");s.textContent=(x.delta>0?"+":"")+x.delta;s.style.color=x.delta>0?"var(--ok)":"var(--bad)";hb.appendChild(d)});
}
function drawWheel(){
  var c=$("wheel");if(!c)return;var x=c.getContext("2d"),n=PRIZES.length,r=c.width/2,a=2*Math.PI/n;
  x.clearRect(0,0,c.width,c.height);
  for(var i=0;i<n;i++){
    x.beginPath();x.moveTo(r,r);x.arc(r,r,r-4,i*a-Math.PI/2,(i+1)*a-Math.PI/2);x.closePath();x.fillStyle=PRIZES[i].c;x.fill();
    x.strokeStyle="#C9A84C";x.lineWidth=1.5;x.stroke();
    x.save();x.translate(r,r);x.rotate(i*a+a/2-Math.PI/2);x.textAlign="right";x.fillStyle="#C9A84C";x.font="600 15px Montserrat, sans-serif";x.fillText(PRIZES[i].t.toUpperCase(),r-24,5);x.restore();
  }
  x.beginPath();x.arc(r,r,r-3,0,2*Math.PI);x.strokeStyle="#C9A84C";x.lineWidth=4;x.stroke();
}
drawWheel();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(drawWheel);
$("spinBtn").addEventListener("click",function(){
  if(spinning||!S.member||S.member.drawn_today)return;
  spinning=true;$("spinBtn").disabled=true;$("spinMsg").textContent="Drawing…";
  rpc("spin_draw").then(function(res){
    var n=PRIZES.length,seg=360/n,target=360-(res.index*seg+seg/2);
    rot=rot-(rot%360)+360*6+target;$("wheel").style.transform="rotate("+rot+"deg)";
    var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(function(){spinning=false;S.lastDraw=res.code?(res.prize+". It is waiting in your vouchers as "+res.code+"."):"Not this evening. Another draw awaits tomorrow.";$("spinMsg").textContent=S.lastDraw;loadMember()},reduce?300:4300);
  }).catch(function(e){spinning=false;$("spinBtn").disabled=false;$("spinMsg").textContent=errMsg(e)});
});

/* ---------- bartender's choice ---------- */
var QS=[
  {q:"What brings you in tonight?",o:[["A celebration","Something worth a toast",{fizz:2}],["A quiet unwind","A long day, a slow glass",{smooth:2}],["The music","The DJ, the room, the night",{bold:2}],["An evening for two","Soft light, close company",{fruit:2}]]},
  {q:"Which flavours draw you?",o:[["Citrus","Lime, orange, grapefruit",{fizz:1,fruit:1}],["Berry and floral","Rose, berries, hibiscus",{fruit:2}],["Smoke and oak","Wood, coffee, spice",{smooth:2}],["Heat","Chilli, ginger, pepper",{bold:2}]]},
  {q:"And the spirit?",o:[["Gin","Botanical and crisp",{fizz:1}],["Whisky","Warm and woody",{smooth:2}],["Tequila or rum","Sun and warmth",{bold:1,fruit:1}],["None at all","Every flavour, no spirit",{zero:3}]]}
];
var RES={
  fizz:{n:"A Sundowner Spritz",d:"Ask for a citrus gin spritz, lengthened with bubbles and finished with a twist. Bright, and best as the sky turns.",c:"#C9A84C"},
  smooth:{n:"A Balcony Old Fashioned",d:"A stirred whisky drink with a smoked edge and orange oils, over one large cube. Made to be taken slowly.",c:"#A8893C"},
  bold:{n:"A Lane Margarita",d:"Tequila, fresh lime and a chilli-salt rim. Sharp and assured, for when the room comes alive.",c:"#8B1A2B"},
  fruit:{n:"A Juliet Sour",d:"Berries and rose, shaken to a silken foam. Composed, and quietly persuasive.",c:"#8B1A2B"},
  zero:{n:"A Rooftop Cooler",d:"Fresh fruit, herbs and soda, built with the same care as any cocktail. Without the spirit.",c:"#A8893C"}
};
var qi=0,score={};
function renderQuiz(){
  var box=$("quiz"),liq=$("liquid");
  if(qi>=QS.length){
    var best="fizz",bv=-1;Object.keys(score).forEach(function(k){if(k!=="zero"&&score[k]>bv){bv=score[k];best=k}});if((score.zero||0)>=3)best="zero";
    var r=RES[best];liq.setAttribute("y","42");liq.setAttribute("height","70");liq.setAttribute("fill",r.c);
    box.innerHTML='<div class="result"><p class="label">The bartender suggests</p><h3></h3><p class="muted"></p><div class="ctas" style="margin-top:8px"><a class="btn sm" href="#reserve">Reserve a table</a><button class="btn ghost sm" type="button" id="qAgain">Begin again</button></div></div>';
    box.querySelector("h3").textContent=r.n;box.querySelector("p.muted").textContent=r.d;
    $("qAgain").onclick=function(){qi=0;score={};renderQuiz()};return;
  }
  var lvl=[0,22,44][qi];liq.setAttribute("y",String(110-lvl));liq.setAttribute("height",String(lvl));liq.setAttribute("fill","#8B1A2B");
  var q=QS[qi];box.innerHTML='<div class="q"><span class="qstep">Question '+(qi+1)+' of '+QS.length+'</span><h3></h3><div class="opts"></div></div>';
  box.querySelector("h3").textContent=q.q;
  q.o.forEach(function(o){var b=document.createElement("button");b.type="button";b.innerHTML="<b></b><small></small>";b.querySelector("b").textContent=o[0];b.querySelector("small").textContent=o[1];
    b.onclick=function(){Object.keys(o[2]).forEach(function(k){score[k]=(score[k]||0)+o[2][k]});qi++;renderQuiz()};box.querySelector(".opts").appendChild(b)});
}
renderQuiz();

/* ---------- private events ---------- */
var PKG_DEFAULT=[
 {id:"deluxe",n:"Deluxe",p:2200,royal:false,bar:[["Bar","Mocktails and aerated beverages"]]},
 {id:"blended",n:"Blended",p:4200,royal:false,bar:[["Whisky","JW Blonde or JNB Rare"],["Vodka","Skyy, Smirnoff or equivalent"],["Gin","Greater Than, Gordon's or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Kingfisher Ultra, Budweiser or RL draught"]]},
 {id:"royal",n:"Royal",p:5200,royal:true,bar:[["Whisky","JW Black Label, Chivas 12 or equivalent"],["Vodka","Absolut, Ketel One or equivalent"],["Gin","Greater Than, Gordon's or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Kingfisher Ultra, Budweiser or RL draught"],["Wine","House red and white"]]},
 {id:"premium",n:"Premium",p:6200,royal:false,bar:[["Whisky","JW Black Label, Chivas 12, Jack Daniel's or equivalent"],["Single malt","Glenlivet 12, Glenfiddich 12 or equivalent"],["Vodka","Grey Goose, Belvedere or equivalent"],["Gin","Tanqueray, Bombay Sapphire or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Imported beers"],["Wine","Imported house wine"]]},
 {id:"platinum",n:"Platinum",p:7200,royal:true,bar:[["Whisky","Gold Label, Chivas 18 or equivalent"],["Single malt","Glenlivet 18, Glenfiddich 18 or equivalent"],["Vodka","Cîroc, Grey Goose or equivalent"],["Gin","Roku, Monkey 47 or equivalent"],["Beer","Imported beer or RL draught"],["Wine","Premium imported wines"]]}
];
var GROUPS=[
 {k:"sv",t:"Small plates · vegetarian",max:3,items:["Falafel with hummus","Dahi kebab","Subz shikampuri","Jaipuri paneer tikka","Masala soya chaap boti","Multani mushroom tikka","Peppercorn cheese roll","Park Street honey chilli potato","Wok-tossed cottage cheese","Mutter and pyaz sambousek","Cottage cheese satay",["Mock meat shawarma",1],"Crisp chilli lotus stem","Pita with hummus","Sure-crisp fries","Spicy zesty peanuts","Farmhouse","Margherita","Penne vegetables, Alfredo, Arrabbiata or Rosa"]},
 {k:"sn",t:"Small plates · non-vegetarian",max:3,items:["Chicken tikka","Dhungar malai murg","Papad fried chicken","Chicken dhaniya seekh",["Chicken Chettinad taco",1],"Korean chicken wings","Chicken rara waffle","Chutney cheese chicken",["Slow-cooked chicken shawarma",1],["Galouti kebab, mutton",1],["Amritsari fish",1],"Chicken tikka and mint","Chicken pepperoni","Penne, Alfredo, Arrabbiata or Rosa"]},
 {k:"mv",t:"Mains · vegetarian",max:2,items:["Paneer kandhari","Masala palak paneer","Vilayati subz kadhai","Saoji paneer masala","Punjabi kofta curry","Soya chaap lababdar","Dal makhani","Tadkewali dal"]},
 {k:"mn",t:"Mains · non-vegetarian",max:2,items:["South Indian OG roast","Ghee roast chicken","Cilantro chicken curry","Saoji chicken curry","Mutton rogan josh","Thai green curry with steamed rice","Thai red curry with steamed rice","Chicken pad krapao"]},
 {k:"st",t:"Staple",max:1,items:["Burnt garlic fried rice, veg or chicken","Plain, jeera or peas pulao","Biryani, veg or chicken"]},
 {k:"ds",t:"Desserts",max:2,items:["Tres leches","Skillet brookie","Berry cheesecake","Nut crumble gulab jamun"]}
];
S.packages=PKG_DEFAULT;
var PE={pkg:"royal",picks:{sv:[],sn:[],mv:[],mn:[],st:[],ds:[]}};
function pkgObj(){return S.packages.filter(function(p){return p.id===PE.pkg})[0]||S.packages[0]}
function renderPkgs(){
  var box=$("pkgs");box.innerHTML="";
  S.packages.forEach(function(p){var b=document.createElement("button");b.type="button";b.className="pkg";b.setAttribute("aria-pressed",PE.pkg===p.id?"true":"false");
    b.innerHTML='<span class="pname"></span><span class="price">'+inr(p.p)+'<small>per guest + taxes</small></span><dl></dl><span class="pick">'+(PE.pkg===p.id?"Selected":"Choose")+'</span>';
    b.querySelector(".pname").textContent=p.n;var dl=b.querySelector("dl");
    (p.bar||[]).forEach(function(r){var dt=document.createElement("dt");dt.textContent=r[0];var dd=document.createElement("dd");dd.textContent=r[1];dl.appendChild(dt);dl.appendChild(dd)});
    b.onclick=function(){PE.pkg=p.id;
      if(!p.royal){GROUPS.forEach(function(g){g.items.forEach(function(it){if(Array.isArray(it)){var i=PE.picks[g.k].indexOf(it[0]);if(i>=0)PE.picks[g.k].splice(i,1)}})})}
      renderPkgs();renderGroups();renderQuote()};
    box.appendChild(b)});
}
function renderGroups(){
  var box=$("groups");box.innerHTML="";var royal=!!pkgObj().royal;
  var royalNames=S.packages.filter(function(p){return p.royal}).map(function(p){return p.n}).join(" & ");
  GROUPS.forEach(function(g){var sel=PE.picks[g.k],full=sel.length>=g.max;
    var d=document.createElement("div");d.className="group";d.innerHTML='<h4><span></span><span class="cnt'+(full?" done":"")+'">'+sel.length+' of '+g.max+' chosen</span></h4><div class="chips"></div>';
    d.querySelector("h4 span").textContent=g.t;var chips=d.querySelector(".chips");
    g.items.forEach(function(it){var name=Array.isArray(it)?it[0]:it,rp=Array.isArray(it),on=sel.indexOf(name)>=0;
      var c=document.createElement("button");c.type="button";c.className="chip";c.setAttribute("aria-pressed",on?"true":"false");c.textContent=name;
      if(rp){var em=document.createElement("em");em.textContent=royalNames;c.appendChild(em)}
      c.disabled=(!on&&full)||(rp&&!royal);
      c.onclick=function(){var i=sel.indexOf(name);if(i>=0)sel.splice(i,1);else if(sel.length<g.max)sel.push(name);renderGroups();renderQuote()};
      chips.appendChild(c)});
    box.appendChild(d)});
}
function renderQuote(){
  var p=pkgObj(),g=Math.max(15,Math.floor(Number($("peGuests").value)||0)),sub=g*p.p;
  $("qPkg").textContent=p.n+" package";
  $("qLine").textContent=g+" guests × "+inr(p.p);$("qSub").textContent=inr(sub);
  $("qDep").textContent=inr(Math.round(sub/2));$("qBal").textContent=inr(sub-Math.round(sub/2));$("qTot").textContent=inr(sub);
}
$("peGuests").addEventListener("input",renderQuote);
$("peForm").addEventListener("submit",function(e){
  e.preventDefault();
  var err=$("peErr"),name=$("peName").value.trim(),ph=normPhone($("pePhone").value),date=$("peDate").value,guests=Math.floor(Number($("peGuests").value)||0),p=pkgObj();
  $("pePhone").removeAttribute("aria-invalid");
  if(!name){err.textContent="Please add the host's name.";$("peName").focus();return}
  if(!ph){err.textContent="Enter a 10-digit Indian mobile number.";$("pePhone").setAttribute("aria-invalid","true");$("pePhone").focus();return}
  if(!date||date<todayISO()){err.textContent="Choose a date from today onwards.";$("peDate").focus();return}
  if(guests<15){err.textContent="Packages start at a minimum guarantee of 15 guests.";$("peGuests").focus();return}
  var missing=GROUPS.filter(function(g){return PE.picks[g.k].length<g.max});
  if(missing.length){err.textContent="Complete the menu: "+missing.map(function(g){return g.t.toLowerCase()+" ("+PE.picks[g.k].length+" of "+g.max+")"}).join(", ")+".";return}
  err.textContent="";
  var menu={};GROUPS.forEach(function(g){menu[g.k]=PE.picks[g.k].slice()});
  var details={package:p.id,occasion:$("peOcc").value,notes:$("peNotes").value.trim(),menu:menu};
  var lines=["Private event enquiry — Romeo Lane Nagpur","Host: "+name,"Mobile: "+fmtPhone(ph),"Date: "+fmtDate(date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+", "+$("peTime").value,"Guests: "+guests,"Occasion: "+details.occasion,"Package: "+p.n+" ("+inr(p.p)+" per guest + taxes)"];
  GROUPS.forEach(function(g){lines.push(g.t+": "+menu[g.k].join("; "))});
  if(details.notes)lines.push("Notes: "+details.notes);
  var btn=document.querySelector('button[form="peForm"]');btn.disabled=true;
  rpc("create_booking",{p_type:"private",p_name:name,p_phone:ph,p_date:date,p_time:$("peTime").value,p_guests:guests,p_event:null,p_details:details}).then(function(res){
    btn.disabled=false;rememberBooking(res.ref,ph);
    successRef($("peOut"),"Your enquiry is with our events team.",p.n+" package for "+guests+" guests on "+fmtDate(date)+". We will call you on "+fmtPhone(ph)+" to confirm.",res.ref);
  }).catch(function(x){btn.disabled=false;if(sb&&x&&x.code==="P0001"){err.textContent=errMsg(x);return}fallback($("peOut"),lines,errMsg(x))});
});
renderPkgs();renderGroups();renderQuote();

/* ---------- staff ---------- */
$("staffForm").addEventListener("submit",function(e){
  e.preventDefault();var err=$("stErr"),email=$("stEmail").value.trim(),pw=$("stPass").value;
  if(!sb){err.textContent="The site is not connected to the database yet.";return}
  if(!email||!pw){err.textContent="Enter your staff email and password.";return}
  err.textContent="";var btn=e.submitter;if(btn)btn.disabled=true;
  sb.auth.signInWithPassword({email:email,password:pw}).then(function(r){if(btn)btn.disabled=false;
    if(r.error){err.textContent="That email and password did not match a staff account.";return}
    $("stPass").value="";checkStaff();
  });
});
$("stOut").addEventListener("click",function(){sb.auth.signOut().then(function(){S.staff=null;applyStaff();location.hash="#home";toast("Signed out")})});
function checkStaff(){
  if(!sb||!S.session){S.staff=null;applyStaff();return}
  rpc("am_i_staff").then(function(r){S.staff=r&&r.staff?r:null;applyStaff();if(!S.staff&&S.session&&S.session.user&&S.session.user.email)$("stErr").textContent="This account is not on the staff list. Ask the owner to add it.";else loadMember()}).catch(function(){S.staff=null;applyStaff()});
}
var chan=null;
function applyStaff(){
  $("navStaff").hidden=!S.staff;$("staffLogin").hidden=!!S.staff;$("staffConsole").hidden=!S.staff;
  if(S.staff){$("stWho").textContent=(S.staff.name||"Staff")+" · "+S.staff.role;loadStaffData();
    if(!chan){chan=sb.channel("staff-live").on("postgres_changes",{event:"*",schema:"public",table:"bookings"},function(p){if(p.eventType==="INSERT")toast("New "+(KIND[p.new.type]||"booking").toLowerCase()+" · "+p.new.name);loadStaffData()})
      .on("postgres_changes",{event:"*",schema:"public",table:"members"},loadStaffData).on("postgres_changes",{event:"*",schema:"public",table:"points_ledger"},loadStaffData).subscribe()}}
  else if(chan){sb.removeChannel(chan);chan=null}
  route();
}
var loadT=null;
function loadStaffData(){clearTimeout(loadT);loadT=setTimeout(function(){
  var from=new Date(Date.now()-120*864e5).toISOString().slice(0,10);
  Promise.all([
    sb.from("bookings").select("*").gte("date",from).order("date").limit(2000),
    sb.from("member_summary").select("*").order("joined_at",{ascending:false}).limit(2000),
    sb.from("events").select("*").order("date")
  ]).then(function(r){
    if(!r[0].error)S.all.bookings=r[0].data||[];if(!r[1].error)S.all.members=r[1].data||[];if(!r[2].error)S.allEvents=r[2].data||[];
    renderConsole();
  });
},150)}

var CT=[["table","Tables"],["private","Private events"],["ticket","Tickets"],["guestlist","Guestlist"],["mem","Members"],["ev","Events"],["of","Offers"]];
function inRange(d){var t=todayISO();d=d||"";return S.cf==="all"||(S.cf==="today"&&d===t)||(S.cf==="upcoming"&&d>=t)||(S.cf==="past"&&d<t)}
function csvCell(v){v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function exportCsv(name,heads,rows){
  var csv="﻿"+[heads.map(csvCell).join(",")].concat(rows.map(function(r){return r.map(csvCell).join(",")})).join("\n");
  var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name+".csv";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
function tools(onCsv){
  var w=document.createElement("div");w.className="ctools";var seg=document.createElement("div");seg.className="seg";seg.setAttribute("role","group");seg.setAttribute("aria-label","Date range");
  [["today","Today"],["upcoming","Upcoming"],["past","Past"],["all","All"]].forEach(function(o){var b=document.createElement("button");b.type="button";b.textContent=o[1];b.setAttribute("aria-pressed",S.cf===o[0]?"true":"false");b.onclick=function(){S.cf=o[0];renderConsole(true)};seg.appendChild(b)});
  var c=document.createElement("button");c.type="button";c.className="btn ghost sm";c.textContent="Export CSV";c.onclick=onCsv;
  w.appendChild(seg);w.appendChild(c);return w;
}
function d(x,k){return (x.details||{})[k]}
function renderConsole(force){
  if(!S.staff)return;
  var B=S.all.bookings,t=todayISO();
  var by=function(type){return B.filter(function(b){return b.type===type})};
  var counts={table:by("table").filter(function(r){return r.status==="Requested"}).length,private:by("private").filter(function(r){return r.status==="Requested"}).length,ticket:by("ticket").filter(function(r){return r.date>=t&&r.status!=="Cancelled"}).length,guestlist:by("guestlist").filter(function(r){return r.status==="Pending"}).length,mem:S.all.members.length,ev:(S.allEvents||[]).length,of:S.offers.length};
  var covers=by("table").filter(function(r){return r.date===t&&["Declined","Cancelled"].indexOf(r.status)<0}).reduce(function(a,r){return a+r.guests},0);
  $("kpis").innerHTML='<div><span class="label">Tables to confirm</span><b>'+counts.table+'</b></div><div><span class="label">Event enquiries</span><b>'+counts.private+'</b></div><div><span class="label">Covers today</span><b>'+covers+'</b></div><div><span class="label">Members</span><b>'+counts.mem+'</b></div>';
  var tabs=$("ctabs");tabs.innerHTML="";
  CT.forEach(function(c){var b=document.createElement("button");b.setAttribute("role","tab");b.setAttribute("aria-selected",S.ctab===c[0]?"true":"false");b.innerHTML=esc(c[1])+'<span class="n">'+counts[c[0]]+'</span>';b.onclick=function(){S.ctab=c[0];renderConsole(true)};tabs.appendChild(b)});
  var body=$("cbody");
  if(!force&&["mem","ev","of"].indexOf(S.ctab)>=0&&body.dataset.tab===S.ctab&&body.firstChild){if(S.ctab==="mem")refreshMembers();if(S.ctab==="ev")refreshEv();if(S.ctab==="of")refreshOf();return}
  body.innerHTML="";body.dataset.tab=S.ctab;
  var rows=by(S.ctab).filter(function(r){return inRange(r.date)}).sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time)});
  if(S.ctab==="table"){
    body.appendChild(tools(function(){exportCsv("romeo-lane-tables-"+S.cf,["Ref","Date","Time","Guest","Mobile","Guests","Seating","Occasion","Notes","Status"],rows.map(function(r){return [r.ref,r.date,r.time,r.name,"+91"+r.phone,r.guests,d(r,"seating"),d(r,"occasion"),d(r,"notes"),r.status]}))}));
    body.appendChild(table(["Date","Time","Guest","Mobile","Pax","Seating · occasion","Notes","Status",""],rows,function(r){return [fmtDate(r.date),r.time,r.name+" · "+r.ref,fmtPhone(r.phone),r.guests,(d(r,"seating")||"")+" · "+(d(r,"occasion")||""),d(r,"notes")||"—",stTag(r.status),acts(r,["Confirmed","Declined","Arrived","No-show"])]}));
  }
  if(S.ctab==="private"){
    body.appendChild(tools(function(){exportCsv("romeo-lane-private-events-"+S.cf,["Ref","Date","Start","Host","Mobile","Guests","Occasion","Package","Rate","Estimate","Menu","Notes","Status"],rows.map(function(r){var m=d(r,"menu")||{};return [r.ref,r.date,r.time,r.name,"+91"+r.phone,r.guests,d(r,"occasion"),d(r,"package_name"),d(r,"rate"),d(r,"estimate"),GROUPS.map(function(g){return g.t+": "+(m[g.k]||[]).join("; ")}).join(" | "),d(r,"notes"),r.status]}))}));
    body.appendChild(table(["Date","Start","Host","Mobile","Guests","Package","Estimate","Menu","Notes","Status",""],rows,function(r){
      var m=d(r,"menu")||{},menu=GROUPS.map(function(g){return g.t.split(" · ").pop()+": "+((m[g.k]||[]).join(", ")||"—")}).join("\n");
      var pre=document.createElement("div");pre.style.cssText="white-space:pre-line;font-size:12.5px;min-width:260px";pre.textContent=menu;
      return [fmtDate(r.date),r.time,r.name+" · "+(d(r,"occasion")||"")+" · "+r.ref,fmtPhone(r.phone),r.guests,(d(r,"package_name")||"")+" · "+inr(d(r,"rate")),inr(d(r,"estimate"))+" + tax",pre,d(r,"notes")||"—",stTag(r.status),acts(r,["Confirmed","Deposit received","Completed","Declined"])]}));
  }
  if(S.ctab==="ticket"){
    body.appendChild(tools(function(){exportCsv("romeo-lane-tickets-"+S.cf,["Ref","Event","Date","Guest","Mobile","Tickets","Due","Status"],rows.map(function(r){return [r.ref,d(r,"event_title"),r.date,r.name,"+91"+r.phone,r.guests,d(r,"amount"),r.status]}))}));
    body.appendChild(table(["Event","Date","Guest","Mobile","Tickets","Due","Status",""],rows,function(r){return [d(r,"event_title"),fmtDate(r.date),r.name+" · "+r.ref,fmtPhone(r.phone),r.guests,inr(d(r,"amount")),stTag(r.status),acts(r,["Arrived","Cancelled"])]}));
  }
  if(S.ctab==="guestlist"){
    body.appendChild(tools(function(){exportCsv("romeo-lane-guestlist-"+S.cf,["Ref","Event","Date","Guest","Mobile","Party","Entry","Status"],rows.map(function(r){return [r.ref,d(r,"event_title"),r.date,r.name,"+91"+r.phone,r.guests,d(r,"entry"),r.status]}))}));
    body.appendChild(table(["Event","Date","Guest","Mobile","Party","Entry","Status",""],rows,function(r){return [d(r,"event_title"),fmtDate(r.date),r.name+" · "+r.ref,fmtPhone(r.phone),r.guests,d(r,"entry")||"—",stTag(r.status),acts(r,["Approved","Declined","Arrived"])]}));
  }
  if(S.ctab==="mem")renderMembers(body);
  if(S.ctab==="ev")renderEvEditor(body);
  if(S.ctab==="of")renderOfEditor(body);
}
function stTag(s){var e=document.createElement("span");e.className="st "+String(s).split(/[ -]/)[0];e.textContent=s;return e}
function table(heads,rows,fn){
  var w=document.createElement("div");w.className="tbl";
  if(!rows.length){w.innerHTML='<p class="muted" style="padding:18px">Nothing here for this range.</p>';return w}
  var tb=document.createElement("table");tb.innerHTML="<thead><tr>"+heads.map(function(h){return"<th>"+esc(h)+"</th>"}).join("")+"</tr></thead>";
  var body=document.createElement("tbody");
  rows.forEach(function(r){var tr=document.createElement("tr");fn(r).forEach(function(v){var td=document.createElement("td");if(v instanceof Node)td.appendChild(v);else td.textContent=v==null?"":String(v);tr.appendChild(td)});body.appendChild(tr)});
  tb.appendChild(body);w.appendChild(tb);return w;
}
function acts(r,states){
  var w=document.createElement("div");w.className="acts";
  states.forEach(function(s){if(r.status===s)return;var b=document.createElement("button");b.className="mini "+(/Declin|Cancel|No-show/.test(s)?"bad":"ok");b.textContent=s;
    b.onclick=function(){b.disabled=true;sb.from("bookings").update({status:s}).eq("id",r.id).then(function(x){if(x.error){b.disabled=false;toast("That change did not save. Please try again.");return}toast(r.name+" · "+s);loadStaffData()})};
    w.appendChild(b)});
  var wa=document.createElement("a");wa.className="mini";wa.textContent="WhatsApp";wa.target="_blank";wa.rel="noopener";
  wa.href="https://wa.me/91"+r.phone+"?text="+encodeURIComponent("Romeo Lane Nagpur: your "+(KIND[r.type]||"booking").toLowerCase()+" "+r.ref+" for "+fmtDate(r.date)+" is "+r.status.toLowerCase()+".");
  w.appendChild(wa);
  return w;
}
function renderMembers(body){
  body.innerHTML='<div class="cgrid"><div class="panel-box"><p class="label">At billing</p><form class="grid" id="ptForm" novalidate>'+
   '<div class="f full"><label for="ptPhone">Member mobile</label><div class="phone"><span>+91</span><input id="ptPhone" type="tel" inputmode="numeric" maxlength="11"></div></div>'+
   '<div class="f full" id="ptWho"></div>'+
   '<div class="f"><label for="ptBill">Bill amount (₹, before tax)</label><input id="ptBill" type="number" min="0" step="1" inputmode="numeric" placeholder="2400"></div>'+
   '<div class="f"><label for="ptRedeem">Points to redeem</label><input id="ptRedeem" type="number" min="0" step="500" inputmode="numeric" placeholder="0"></div>'+
   '<p class="muted f full" style="font-size:13.5px" id="ptCalc">One point per ₹10. Gold earns 5% more, Black 10% more.</p><p class="err f full" id="ptErr"></p>'+
   '<div class="f full"><button class="btn" type="submit" style="justify-self:start">Apply</button></div></form>'+
   '<div id="ptVouchers"></div>'+
   '<form class="grid" id="vcForm" novalidate style="grid-template-columns:1fr auto;align-items:end;margin-top:6px"><div class="f"><label for="vcCode">Redeem a voucher code</label><input id="vcCode" placeholder="RL-XXXXXX" autocomplete="off"></div><button class="btn ghost sm" type="submit">Redeem</button><p class="err f full" id="vcErr"></p></form>'+
   '</div><div id="memTbl"></div></div>';
  ["ptPhone","ptBill","ptRedeem"].forEach(function(id){$(id).addEventListener("input",memCalc)});
  $("ptForm").onsubmit=function(e){e.preventDefault();var m=memFind(),err=$("ptErr");
    if(!m){err.textContent="Enter an enrolled member's mobile number.";return}
    var bill=Number($("ptBill").value||0),red=Number($("ptRedeem").value||0);
    if(!bill&&!red){err.textContent="Enter a bill amount or points to redeem.";return}
    err.textContent="";var btn=e.submitter;if(btn)btn.disabled=true;
    rpc("staff_credit",{p_phone:m.phone,p_bill:bill,p_redeem:red}).then(function(r){if(btn)btn.disabled=false;toast(m.name+" · "+(r.earned?"+"+r.earned:"")+(r.redeemed?" −"+r.redeemed:"")+" points · "+r.tier);$("ptBill").value="";$("ptRedeem").value="";loadStaffData()})
      .catch(function(x){if(btn)btn.disabled=false;err.textContent=errMsg(x)});
  };
  $("vcForm").onsubmit=function(e){e.preventDefault();var c=$("vcCode").value.trim();if(!c){$("vcErr").textContent="Enter the code shown by the guest.";return}
    rpc("staff_redeem_voucher",{p_code:c}).then(function(title){$("vcErr").textContent="";$("vcCode").value="";toast("Redeemed · "+title);memCalc()}).catch(function(x){$("vcErr").textContent=errMsg(x)})};
  refreshMembers();
}
function memFind(){var el=$("ptPhone");var ph=el&&normPhone(el.value);return ph?S.all.members.filter(function(m){return m.phone===ph})[0]:null}
function memCalc(){
  if(!$("ptWho"))return;var m=memFind(),who=$("ptWho"),vb=$("ptVouchers");vb.innerHTML="";
  if(!m){who.innerHTML=$("ptPhone").value.replace(/\D/g,"").length>=10?'<span class="err">No member is enrolled with this number.</span>':"";$("ptCalc").textContent="One point per ₹10. Gold earns 5% more, Black 10% more.";return}
  var mult=m.tier==="Black"?1.1:m.tier==="Gold"?1.05:1,bill=Number($("ptBill").value||0),earn=Math.floor(bill/10*mult),red=Number($("ptRedeem").value||0);
  who.innerHTML="";var s=document.createElement("span");s.textContent=m.name+" · "+m.tier+" · "+m.balance.toLocaleString("en-IN")+" points · "+m.visits+" visits";who.appendChild(s);
  $("ptCalc").textContent="Earns "+earn+" points"+(red?(", redeems "+red+" (₹"+red+" off)"):"")+".";
  sb.from("vouchers").select("*").eq("member_id",m.id).is("used_at",null).order("issued_at",{ascending:false}).then(function(r){
    if(r.error||memFind()!==m)return;var t=todayISO(),live=(r.data||[]).filter(function(v){return !v.expires_on||v.expires_on>=t});vb.innerHTML="";
    var h=document.createElement("p");h.className="label";h.style.marginTop="6px";h.textContent=live.length?"Open vouchers":"No open vouchers";vb.appendChild(h);
    var list=document.createElement("div");list.className="vlist";
    live.forEach(function(v){var dv=document.createElement("div");dv.className="voucher";dv.innerHTML='<div><b></b><small class="muted" style="display:block;font-size:12px"></small></div><div class="bk-acts"><code></code></div>';
      dv.querySelector("b").textContent=v.title;dv.querySelector("small").textContent=v.source+(v.expires_on?" · until "+fmtDate(v.expires_on,{day:"numeric",month:"short"}):"");dv.querySelector("code").textContent=v.code;
      var b=document.createElement("button");b.type="button";b.className="mini ok";b.textContent="Redeem";
      b.onclick=function(){b.disabled=true;rpc("staff_redeem_voucher",{p_code:v.code}).then(function(){toast(v.code+" redeemed for "+m.name);memCalc()}).catch(function(x){b.disabled=false;toast(errMsg(x))})};
      dv.querySelector(".bk-acts").appendChild(b);list.appendChild(dv)});
    vb.appendChild(list);
  });
}
function refreshMembers(){
  var box=$("memTbl");if(!box)return;box.innerHTML="";
  var rows=S.all.members,mm=todayISO().slice(5,7);
  var c=document.createElement("div");c.className="ctools";var info=document.createElement("p");info.className="muted";info.style.fontSize="13.5px";
  info.textContent=rows.length+" members · "+rows.filter(function(m){return m.birthday&&m.birthday.slice(5,7)===mm}).length+" birthdays this month";
  var ex=document.createElement("button");ex.type="button";ex.className="btn ghost sm";ex.textContent="Export CSV";
  ex.onclick=function(){exportCsv("romeo-lane-members",["Name","Mobile","Tier","Balance","Lifetime","Visits","Birthday","Anniversary","Offers consent","Joined"],rows.map(function(m){return [m.name,"+91"+m.phone,m.tier,m.balance,m.lifetime,m.visits,m.birthday,m.anniversary,m.consent?"Yes":"No",(m.joined_at||"").slice(0,10)]}))};
  c.appendChild(info);c.appendChild(ex);box.appendChild(c);
  box.appendChild(table(["Member","Mobile","Tier","Balance","Lifetime","Visits","Birthday","Joined"],rows,function(m){return [m.name,fmtPhone(m.phone),m.tier,m.balance.toLocaleString("en-IN"),m.lifetime.toLocaleString("en-IN"),m.visits,m.birthday?fmtDate(m.birthday,{day:"numeric",month:"short"})+(m.birthday.slice(5,7)===mm?" · this month":""):"—",m.joined_at?new Date(m.joined_at).toLocaleDateString("en-IN"):"—"]}));
  memCalc();
}
function refreshEv(){var box=$("evTbl");if(!box)return;box.innerHTML="";
  var B=S.all.bookings,rows=(S.allEvents||[]).slice();
  box.appendChild(table(["Date","Evening","Type","Cover","Guestlist","Tickets",""],rows,function(e){
    var g=B.filter(function(r){return r.event_id===e.id&&r.type==="guestlist"&&["Declined","Cancelled"].indexOf(r.status)<0}).reduce(function(a,r){return a+r.guests},0);
    var t=B.filter(function(r){return r.event_id===e.id&&r.type==="ticket"&&r.status!=="Cancelled"}).reduce(function(a,r){return a+r.guests},0);
    return [fmtDate(e.date),e.title+(e.sample?" (sample)":""),e.kind,e.price>0?inr(e.price):"None",e.guestlist?g+" names":"—",e.price>0?t+" sold":"—",delBtn("events",e.id,e.title)]}))}
function refreshOf(){var box=$("ofTbl");if(!box)return;box.innerHTML="";
  box.appendChild(table(["Offer","When","For",""],S.offers,function(o){return [o.title+(o.sample?" (sample)":""),o.when_text||"—",o.members_only?"Lane Club":"All guests",delBtn("offers",o.id,o.title)]}))}
function renderEvEditor(body){
  body.innerHTML='<div class="cgrid"><div class="panel-box"><p class="label">Announce an evening</p><form class="grid" id="evAdd" novalidate>'+
   '<div class="f full"><label for="eaT">Title</label><input id="eaT" placeholder="An Evening of Elegance"></div><div class="f"><label for="eaK">Type</label><select id="eaK"><option>DJ night</option><option>Live music</option><option>Festive</option><option>Ladies night</option><option>Brunch</option><option>Private screening</option></select></div>'+
   '<div class="f"><label for="eaD">Date</label><input id="eaD" type="date"></div><div class="f"><label for="eaTm">Doors</label><input id="eaTm" placeholder="Doors 8 PM"></div><div class="f"><label for="eaP">Cover ₹ (0 for none)</label><input id="eaP" type="number" min="0" value="0"></div>'+
   '<label class="check f full"><input type="checkbox" id="eaG" checked> Open a guestlist</label><div class="f full"><label for="eaB">Caption</label><textarea id="eaB" placeholder="Short, evocative, no exclamation marks."></textarea></div>'+
   '<p class="err f full" id="eaE"></p><div class="f full"><button class="btn" type="submit" style="justify-self:start">Publish</button></div></form></div><div id="evTbl"></div></div>';
  $("eaD").min=todayISO();refreshEv();
  $("evAdd").onsubmit=function(ev){ev.preventDefault();var t=$("eaT").value.trim(),dt=$("eaD").value;if(!t||!dt){$("eaE").textContent="A title and a date are required.";return}
    sb.from("events").insert({title:t,kind:$("eaK").value,date:dt,time:$("eaTm").value.trim()||"Doors 8 PM",price:Number($("eaP").value||0),guestlist:$("eaG").checked,blurb:$("eaB").value.trim()}).then(function(r){if(r.error){$("eaE").textContent="That did not publish. Please try again.";return}toast("Published · "+t);$("evAdd").reset();$("eaG").checked=true;loadPublic();loadStaffData()})};
}
function renderOfEditor(body){
  body.innerHTML='<div class="cgrid"><div class="panel-box"><p class="label">Add an offer</p><form class="grid" id="ofAdd" novalidate>'+
   '<div class="f full"><label for="oaT">Headline</label><input id="oaT" placeholder="Two cocktails, one bill"></div><div class="f full"><label for="oaD">Details</label><textarea id="oaD"></textarea></div>'+
   '<div class="f"><label for="oaW">When</label><input id="oaW" placeholder="Mon – Thu · 12 – 7 PM"></div><label class="check f" style="align-self:end"><input type="checkbox" id="oaM"> Lane Club only</label>'+
   '<p class="err f full" id="oaE"></p><div class="f full"><button class="btn" type="submit" style="justify-self:start">Publish</button></div></form></div><div id="ofTbl"></div></div>';
  refreshOf();
  $("ofAdd").onsubmit=function(ev){ev.preventDefault();var t=$("oaT").value.trim();if(!t){$("oaE").textContent="Add a headline.";return}
    sb.from("offers").insert({title:t,detail:$("oaD").value.trim(),when_text:$("oaW").value.trim(),members_only:$("oaM").checked,sort:S.offers.length+1}).then(function(r){if(r.error){$("oaE").textContent="That did not publish. Please try again.";return}toast("Published · "+t);$("ofAdd").reset();loadPublic()})};
}
function delBtn(tbl,id,label){var wrap=document.createElement("div");wrap.className="acts";var b=document.createElement("button");b.className="mini bad";b.textContent="Remove";
  b.onclick=function(){if(b.dataset.c){sb.from(tbl).delete().eq("id",id).then(function(r){if(r.error){toast("That did not remove. Please try again.");return}toast("Removed · "+label);loadPublic();loadStaffData()})}else{b.dataset.c="1";b.textContent="Confirm";setTimeout(function(){delete b.dataset.c;b.textContent="Remove"},3000)}};
  wrap.appendChild(b);return wrap}

/* ---------- router ---------- */
var VIEWS=["home","events","private","club","reserve","menu","gallery","visit","staff"];
var curView=null;
function route(){
  var v=(location.hash||"").replace("#","");
  if(v==="offers")v="home";
  if(VIEWS.indexOf(v)<0)v="home";
  var changed=v!==curView;curView=v;
  [].forEach.call(document.querySelectorAll("[data-view]"),function(el){var on=el.getAttribute("data-view")===v;el.classList.toggle("on",on);if(on&&changed){el.classList.remove("view-in");void el.offsetWidth;el.classList.add("view-in")}});
  [].forEach.call(document.querySelectorAll("#tabbar a"),function(a){if(a.getAttribute("href")==="#"+v){a.setAttribute("aria-current","page");if(changed&&a.scrollIntoView)a.scrollIntoView({block:"nearest",inline:"center"})}else a.removeAttribute("aria-current")});
  if(changed)window.scrollTo(0,0);
  if(v==="club")drawWheel();
  var titles={home:"Romeo Lane Nagpur · Restaurant, Bar & Events",events:"This week · Romeo Lane Nagpur",private:"Private events & party packages · Romeo Lane Nagpur",club:"Lane Club · Romeo Lane Nagpur",reserve:"Reserve a table · Romeo Lane Nagpur",menu:"Menu · Romeo Lane Nagpur",gallery:"Gallery · Romeo Lane Nagpur",visit:"Visit · Romeo Lane Nagpur",staff:"Staff · Romeo Lane Nagpur"};
  document.title=titles[v];
}
window.addEventListener("hashchange",route);
route();

/* hero crossfade + rotating line */
(function(){
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce)return;
  var imgs=document.querySelectorAll(".hero-bg img"),i=0;
  setInterval(function(){if(curView!=="home")return;imgs[i].classList.remove("on");i=(i+1)%imgs.length;imgs[i].classList.add("on")},7000);
  var lines=["Live music · Cocktails · Nights","Organic cocktails · Small plates","Private celebrations · From 15 guests","Sixth floor · Ajni Square"],j=0,r=$("rotator");
  setInterval(function(){if(curView!=="home")return;j=(j+1)%lines.length;r.innerHTML="";var sp=document.createElement("span");sp.textContent=lines[j];r.appendChild(sp)},3500);
})();

/* next-event countdown */
function parseStart(e){var m=/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(e.time||"");var h=20,mi=0;if(m){h=Number(m[1])%12+(m[3].toLowerCase()==="pm"?12:0);mi=Number(m[2]||0)}return new Date(e.date+"T"+String(h).padStart(2,"0")+":"+String(mi).padStart(2,"0")+":00+05:30")}
function renderNext(){
  var now=new Date(),list=S.events.map(function(e){return {e:e,t:parseStart(e)}}).filter(function(x){return x.t.getTime()+3*3600e3>now.getTime()}).sort(function(a,b){return a.t-b.t});
  var box=$("nextEv");if(!list.length){box.hidden=true;return}
  var x=list[0],ms=Math.max(0,x.t-now);box.hidden=false;
  $("nextTitle").textContent=x.e.title;$("nextMeta").textContent=fmtDate(x.e.date,{weekday:"long",day:"numeric",month:"long"})+" · "+(x.e.time||"")+(x.e.price>0?" · "+inr(x.e.price)+" cover":"");
  $("nextLabel").textContent=ms===0?"Happening now":"Next at the Lane";
  $("cD").textContent=Math.floor(ms/864e5);$("cH").textContent=Math.floor(ms/36e5)%24;$("cM").textContent=Math.floor(ms/6e4)%60;
}
setInterval(renderNext,30000);

/* ---------- boot ---------- */
if(!sb){$("offlineNote").hidden=false}
loadPublic();loadMyBookings();renderClub();
if(sb){
  sb.auth.getSession().then(function(r){S.session=r.data&&r.data.session;checkStaff();loadMember()});
  sb.auth.onAuthStateChange(function(ev,session){S.session=session;if(ev==="SIGNED_OUT"){S.member=null;S.staff=null;applyStaff();renderClub()}});
}
})();
