(function(){
 var M={auto:1,light:1,dark:1,ocean:1,forest:1,purple:1,sepia:1,sunset:1,mono:1,neon:1};
 var m=null;try{m=localStorage.getItem('doc-theme')}catch(e){}
 window.__docMode=M[m]?m:'auto';
 window.__docAuto=function(){var h=new Date().getHours();return(h>=7&&h<20)?'light':'dark';};
 window.__docEff=function(){return window.__docMode==='auto'?window.__docAuto():window.__docMode;};
 var t=window.__docEff();if(t==='dark')document.documentElement.dataset.theme='dark';
 var lg=null;try{lg=localStorage.getItem('keengen.lang')}catch(e){}
 window.__kgLang=lg==='en'?'en':'ru';
 document.documentElement.lang=window.__kgLang;
})();
var KG_I18N={
 ru:{
  pageTitle:'keengen · конфиги Keenetic / XKeen',
  sub:'вкладки как в XKeen-UI · язык панели (vnext) · ZIP для /opt/etc/xray/configs/',
  howto:'📖 как пользоваться',clockz:'местное время',clockTitle:'Местное время',
  themeChip:'🎨 тема',
  langTitle:'Язык',
  h1:'1. Ссылки и файлы',
  note1:'«Прочитать с Keenetic» сразу показывает подключения в секции 2. Активное в таблице пишется в 05_routing. «Залить» / правый клик по вкладке — запись на роутер после входа. «Прочитать ссылки» — только поле ниже.',
  authBtn:'Настройка входа',readBtn:'Прочитать с Keenetic',whereWait:'Проверяю, дома ли вы…',
  ipkTitle:'Установить keengen на Keenetic (Entware)',
  ipkHint:'Нужен SSH под root (в «Настройка входа»). Кнопка сделает бэкап конфигов, скачает .ipk с GitHub, поставит через opkg и запустит UI на порту 1001. XKeen-UI на :1000 не трогается. Конфиги XKeen этой кнопкой не заливаются.',
  ipkBtn:'Установить IPK на роутер',
  ipkConfirm:'Установить keengen IPK на роутер? Нужен root. Будет бэкап, затем wget с GitHub и opkg install. Конфиги XKeen не изменятся.',
  ipkNeedRoot:'для установки IPK в форме входа укажите логин root',
  ipkBusy:'ставлю IPK…',
  ipkOk:'IPK установлен · UI {0}',
  ipkFail:'установка не удалась: {0}',
  linksLbl:'Вставьте ссылки или JSON вкладки, затем «Прочитать ссылки». Проверка в этот момент: битое не попадает, живые 03/04/05 не затираются.',
  drop:'Одна настройка за раз: нажмите или перетащите QR, .txt, JSON со ссылками — или вставьте текст JSON 01–06 либо .lst (ip_exclude / port_exclude / port_proxying / xkeen). Формат распознается автоматически.',
  clearBtn:'Очистить поле',parseBtn:'Прочитать ссылки',
  h2:'2. Outbound и routing',hintEmpty:'Пока пусто. Вставьте ссылки или QR.',
  thActive:'активное',thName:'имя',thServer:'сервер',thProto:'протокол',
  hPreview:'Превью файлов',backupBtn:'Скачать все файлы разом',applyAllBtn:'Залить всё на Keenetic',
  previewHint:'Это итоговые файлы, не черновик. Двойной щелчок копирует. Правая кнопка — скачать или залить этот файл. Правка — в поле сверху, затем «Прочитать ссылки»: проверка и замена только этой вкладки, остальные не трогаются.',
  footer:'keengen · конфиги для XKeen-UI · SSH только через локальный helper',
  tabCopy:'Скопировать в буфер',tabSave:'Скачать этот файл',tabApply:'Применить на Keenetic',
  applyTitle:'Применить на Keenetic',applyCancel:'Отмена',applyDo:'Применить',
  mergeTitle:'Что сделать с 04?',mergeMsg:'Есть файл с роутера и новые ссылки.',
  doMerge:'Смержить',doReplace:'Заменить',doCancel:'Отмена',
  authTitle:'Вход на Keenetic',
  authIntro:'Название, адрес LAN, порт, логин и пароль Entware SSH. «Сохранить» проверяет вход. Пока вход не сохранён, «Прочитать с Keenetic» выключена. Пароль не уходит на сайт и не пишется в логи. Нужен локальный helper (python keengen.py).',
  authPick:'Подключение',authName:'Название',authHost:'Адрес',authPort:'Порт',authUser:'Логин',authPass:'Пароль',
  phName:'router',phPass:'пароль Entware (пусто — ключ KEENGEN_SSH_KEY)',
  authAdd:'Добавить',authDel:'Удалить',authCancel:'Отмена',authSave:'Сохранить',
  needSsh:'сначала вход и проверка SSH',
  writeRestart:'записать файлы на роутер и перезапустить XKeen',
  downloaded:'скачан {0}',copiedOk:'✓ скопировано',downloadedOk:'✓ скачано',
  copyFail:'не удалось скопировать: {0}',
  hintNone:'Пока пусто. Вставьте ссылки, QR или файлы из XKeen-UI.',
  hintNo04:'Файлы загружены, подключений в 04 ещё нет. Добавьте ссылки или прочитайте конфиг с Keenetic.',
  hintOne:'Подключение: {0}. Оно запишется в 05_routing. Точку слева можно не трогать.',
  hintMany:'{0} подключения: {1}. Выберите одно активное — оно запишется в 05_routing.',
  copiedBuf:'скопировано в буфер',
  emptyLst:'// нет файла — перетащите .lst / xkeen сюда\n',
  tabTip:'один щелчок — открыть, два — копировать в буфер',
  mergeBody:'На роутере сейчас {0} {1}, из ссылок получится {2}. На Keenetic ничего не пишем — только превью.',
  conn1:'подключение',connN:'подключения',
  emptyLink:'пустая ссылка',noParser:'нет парсера XkeenXray',noAddr:'нет адреса сервера',
  badPort:'некорректный порт',badUuid:'UUID битый',noPbk:'Reality без publicKey (pbk)',
  noOutbound:'нет outbound',proxyMissing:'proxy-тег не среди outbound',
  emptyJson:'пустой JSON',jsonArray:'нужен объект вкладки { … }, не массив. В файлы не кладу.',
  jsonStart:'JSON должен начинаться с {. В файлы не кладу.',
  jsonObj:'JSON должен быть объектом { … }. В файлы не кладу.',
  jsonBrace:' фигурные скобки { {0} ≠ } {1}.',jsonSquare:' квадратные [ {0} ≠ ] {1}.',
  jsonBroken:'JSON битый:{0} {1}. В файлы не кладу.',
  notXkeen:'не похоже на файл XKeen 01–06. В файлы не кладу.',
  multiSection:'это сразу несколько разделов ({0}). Нужен один файл вкладки, не весь Xray. В файлы не кладу.',
  noOutbounds:'в 04 нет массива outbounds. В файлы не кладу.',
  noProtocol:'outbound {0}: нет protocol. В файлы не кладу.',
  noTag:'outbound {0}: нет tag. В файлы не кладу.',
  noRules:'в 05 нет routing.rules. В файлы не кладу.',
  noInbounds:'в 03 нет массива inbounds. В файлы не кладу.',
  noLog:'в 01 нет log. В файлы не кладу.',
  noPolicy:'в 06 нет policy. В файлы не кладу.',
  linkN:'ссылка {0}: {1}',
  httpNotShare:'в тексте есть http(s):// — это не share-ссылка. Нужны строки vless:// / hy2:// (не подписка панели).',
  linksRejected:'ссылки не приняты, в файлы ничего не кладу:\n{0}',
  noShare:'в поле нет vless:// / hy2:// — секция 2 не трогаю',
  notImage:'не картинка: {0}',qrFail:'QR не прочитан: {0}',
  oneFile:'можно загрузить только один файл. Выберите один JSON или .lst',
  oneFileShort:'можно загрузить только один файл',
  needAuth:'сначала настройка входа: сохранить и проверить SSH',
  applyAllTitle:'Залить всё на Keenetic',applyOneTitle:'Применить на Keenetic',
  applyAllDo:'Залить всё',applyOneDo:'Применить',
  applyAllMsg:'На роутер уйдут эти файлы. Сначала бэкап, потом запись и xkeen -restart.',
  applyOneMsg:'На роутер уйдёт один файл. Сначала бэкап, потом запись и xkeen -restart.',
  applyNote04:'Routing (05) не меняется. Если сменили активное подключение — примените и 05_routing.',
  applyNoteVpn:'VPN на секунды моргнёт. Откат — из бэкапа на роутере.',
  needAuthFiles:'сначала настройка входа и файлы в превью',
  nothingWrite:'нечего записывать',writing:'записываю на Keenetic…',
  notHome:'не дома — откройте из домашней сети',
  written:'записано: {0}',writtenRestart:' · XKeen перезапущен',
  writeFail:'не записалось: {0}',
  newConn:'новое подключение',
  titleAway:'откройте из домашней сети',
  titleNeedAuth:'сначала настройка входа: сохранить и проверить SSH',
  titleRead:'прочитать 01–06 и списки с роутера (запись не делается)',
  whereNeedSave:'сохраните вход — проверка SSH',
  whereOk:'вход «{0}» проверен',
  needFields:'нужны название, адрес, порт и логин',
  probing:'проверяю SSH…',
  sshDenied:'SSH не пустил — проверьте адрес, порт, логин и пароль',
  probeFail:'не удалось проверить вход',
  readNo04file:'прочитано, но на роутере нет 04_outbounds.json — секция 2 пустая',
  readNo04conn:'прочитано, в 04 нет подключений — секция 2 пустая',
  readMissing:'прочитано, на роутере нет: {0}',
  readFail:'не удалось прочитать с Keenetic: {0}'
 },
 en:{
  pageTitle:'keengen · Keenetic / XKeen configs',
  sub:'tabs like XKeen-UI · panel language (vnext) · ZIP for /opt/etc/xray/configs/',
  howto:'📖 how to use',clockz:'local time',clockTitle:'Local time',
  themeChip:'🎨 theme',
  langTitle:'Language',
  h1:'1. Links and files',
  note1:'“Read from Keenetic” fills connections in section 2. The active row is written to 05_routing. “Write” / right-click a tab uploads after login. “Read links” only fills the box below.',
  authBtn:'Login settings',readBtn:'Read from Keenetic',whereWait:'Checking if you are at home…',
  ipkTitle:'Install keengen on Keenetic (Entware)',
  ipkHint:'Needs SSH as root (in Login settings). The button backs up configs, downloads the .ipk from GitHub, runs opkg install, and starts the UI on port 1001. XKeen-UI on :1000 is untouched. XKeen configs are not written by this button.',
  ipkBtn:'Install IPK on router',
  ipkConfirm:'Install keengen IPK on the router? Requires root. Will backup, then wget from GitHub and opkg install. XKeen configs stay unchanged.',
  ipkNeedRoot:'for IPK install set login to root in Login settings',
  ipkBusy:'installing IPK…',
  ipkOk:'IPK installed · UI {0}',
  ipkFail:'install failed: {0}',
  linksLbl:'Paste share links or a tab JSON, then “Read links”. Broken input is rejected; live 03/04/05 are not wiped.',
  drop:'One setting at a time: click or drop a QR, .txt, JSON with links — or paste JSON 01–06 / .lst (ip_exclude / port_exclude / port_proxying / xkeen). The format is detected automatically.',
  clearBtn:'Clear box',parseBtn:'Read links',
  h2:'2. Outbound and routing',hintEmpty:'Empty for now. Paste links or a QR.',
  thActive:'active',thName:'name',thServer:'server',thProto:'protocol',
  hPreview:'File preview',backupBtn:'Download all files',applyAllBtn:'Write all to Keenetic',
  previewHint:'These are the final files, not a draft. Double-click copies. Right-click downloads or writes that file. Edit in the box above, then “Read links”: only this tab is checked and replaced.',
  footer:'keengen · configs for XKeen-UI · SSH only via the local helper',
  tabCopy:'Copy to clipboard',tabSave:'Download this file',tabApply:'Apply on Keenetic',
  applyTitle:'Apply on Keenetic',applyCancel:'Cancel',applyDo:'Apply',
  mergeTitle:'What to do with 04?',mergeMsg:'There is a router file and new links.',
  doMerge:'Merge',doReplace:'Replace',doCancel:'Cancel',
  authTitle:'Keenetic login',
  authIntro:'Name, LAN address, port, login and Entware SSH password. “Save” probes SSH. Until it is saved, “Read from Keenetic” stays off. The password never goes to a website or into logs. You need the local helper (python keengen.py).',
  authPick:'Connection',authName:'Name',authHost:'Address',authPort:'Port',authUser:'Login',authPass:'Password',
  phName:'router',phPass:'Entware password (empty = KEENGEN_SSH_KEY)',
  authAdd:'Add',authDel:'Delete',authCancel:'Cancel',authSave:'Save',
  needSsh:'log in and probe SSH first',
  writeRestart:'write files to the router and restart XKeen',
  downloaded:'downloaded {0}',copiedOk:'✓ copied',downloadedOk:'✓ downloaded',
  copyFail:'could not copy: {0}',
  hintNone:'Empty for now. Paste links, a QR, or XKeen-UI files.',
  hintNo04:'Files loaded, but 04 has no connections yet. Add links or read the config from Keenetic.',
  hintOne:'Connection: {0}. It will be written to 05_routing. You can leave the left dot as is.',
  hintMany:'{0} connections: {1}. Pick one active — it will be written to 05_routing.',
  copiedBuf:'copied to clipboard',
  emptyLst:'// no file — drop .lst / xkeen here\n',
  tabTip:'single click opens, double-click copies',
  mergeBody:'The router now has {0} {1}; the links make {2}. Nothing is written to Keenetic — preview only.',
  conn1:'connection',connN:'connections',
  emptyLink:'empty link',noParser:'XkeenXray parser missing',noAddr:'no server address',
  badPort:'invalid port',badUuid:'broken UUID',noPbk:'Reality without publicKey (pbk)',
  noOutbound:'no outbound',proxyMissing:'proxy tag is not among outbounds',
  emptyJson:'empty JSON',jsonArray:'need a tab object { … }, not an array. Not putting it in files.',
  jsonStart:'JSON must start with {. Not putting it in files.',
  jsonObj:'JSON must be an object { … }. Not putting it in files.',
  jsonBrace:' curly braces { {0} ≠ } {1}.',jsonSquare:' square brackets [ {0} ≠ ] {1}.',
  jsonBroken:'Broken JSON:{0} {1}. Not putting it in files.',
  notXkeen:'does not look like an XKeen 01–06 file. Not putting it in files.',
  multiSection:'this is several sections at once ({0}). Need one tab file, not the whole Xray config. Not putting it in files.',
  noOutbounds:'04 has no outbounds array. Not putting it in files.',
  noProtocol:'outbound {0}: no protocol. Not putting it in files.',
  noTag:'outbound {0}: no tag. Not putting it in files.',
  noRules:'05 has no routing.rules. Not putting it in files.',
  noInbounds:'03 has no inbounds array. Not putting it in files.',
  noLog:'01 has no log. Not putting it in files.',
  noPolicy:'06 has no policy. Not putting it in files.',
  linkN:'link {0}: {1}',
  httpNotShare:'the text has http(s):// — that is not a share link. Need vless:// / hy2:// lines (not the panel subscription).',
  linksRejected:'links rejected, nothing written to files:\n{0}',
  noShare:'no vless:// / hy2:// in the box — leaving section 2 alone',
  notImage:'not an image: {0}',qrFail:'QR not read: {0}',
  oneFile:'only one file at a time. Pick one JSON or .lst',
  oneFileShort:'only one file at a time',
  needAuth:'set up login first: save and probe SSH',
  applyAllTitle:'Write all to Keenetic',applyOneTitle:'Apply on Keenetic',
  applyAllDo:'Write all',applyOneDo:'Apply',
  applyAllMsg:'These files will go to the router. Backup first, then write and xkeen -restart.',
  applyOneMsg:'One file will go to the router. Backup first, then write and xkeen -restart.',
  applyNote04:'Routing (05) does not change. If you switched the active connection, apply 05_routing too.',
  applyNoteVpn:'VPN will blink for a second. Roll back from the router backup.',
  needAuthFiles:'set up login first and have files in preview',
  nothingWrite:'nothing to write',writing:'writing to Keenetic…',
  notHome:'not at home — open from the home network',
  written:'written: {0}',writtenRestart:' · XKeen restarted',
  writeFail:'write failed: {0}',
  newConn:'new connection',
  titleAway:'open from the home network',
  titleNeedAuth:'set up login first: save and probe SSH',
  titleRead:'read 01–06 and lists from the router (no write)',
  whereNeedSave:'save login — SSH probe',
  whereOk:'login “{0}” probed',
  needFields:'need name, address, port and login',
  probing:'probing SSH…',
  sshDenied:'SSH refused — check address, port, login and password',
  probeFail:'could not probe login',
  readNo04file:'read ok, but the router has no 04_outbounds.json — section 2 is empty',
  readNo04conn:'read ok, 04 has no connections — section 2 is empty',
  readMissing:'read ok, missing on router: {0}',
  readFail:'could not read from Keenetic: {0}'
 }
};
function kgT(k){
 var d=KG_I18N[window.__kgLang]||KG_I18N.ru;
 var s=d[k]; if(s==null) s=(KG_I18N.ru[k]||k);
 var args=Array.prototype.slice.call(arguments,1);
 return String(s).replace(/\{(\d+)\}/g,function(_,i){return args[i]==null?'':args[i];});
}
function kgLocale(){return window.__kgLang==='en'?'en-GB':'ru-RU';}
function kgApplyLang(){
 document.documentElement.lang=window.__kgLang;
 document.title=kgT('pageTitle');
 document.querySelectorAll('[data-i18n]').forEach(function(el){
  var k=el.getAttribute('data-i18n');if(k)el.textContent=kgT(k);});
 document.querySelectorAll('[data-i18n-title]').forEach(function(el){
  var k=el.getAttribute('data-i18n-title');if(k)el.title=kgT(k);});
 document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
  var k=el.getAttribute('data-i18n-placeholder');if(k)el.placeholder=kgT(k);});
 var lb=document.getElementById('langBtn');
 if(lb){lb.textContent=window.__kgLang==='en'?'🌐 EN':'🌐 RU';lb.title=kgT('langTitle');}
 docFillMenu();docApplyTheme(true);
 document.dispatchEvent(new CustomEvent('kg-lang'));
}
function kgToggleLang(){
 window.__kgLang=window.__kgLang==='en'?'ru':'en';
 try{localStorage.setItem('keengen.lang',window.__kgLang)}catch(e){}
 kgApplyLang();
}
var __last=null;
function docLabel(){
 var L=window.__kgLang==='en'
  ?{auto:'🌗 auto',light:'☀️ light',dark:'🌙 dark',ocean:'🌊 ocean',forest:'🌲 forest',
    purple:'💜 amethyst',sepia:'📜 sepia',sunset:'🌅 sunset',mono:'🖤 mono',neon:'🍬 neon'}
  :{auto:'🌗 авто д/н',light:'☀️ светлая',dark:'🌙 тёмная',ocean:'🌊 океан',forest:'🌲 лес',
    purple:'💜 аметист',sepia:'📜 сепия',sunset:'🌅 закат',mono:'🖤 моно',neon:'🍬 неон'};
 return L[window.__docMode]||(window.__kgLang==='en'?'🎨 theme':'🎨 тема');
}
function docThemeItems(){
 return window.__kgLang==='en'
  ?[['auto','🌗 auto','07–20 light, night dark'],['light','☀️ light','default glass'],
    ['dark','🌙 dark','deep night'],['ocean','🌊 ocean','deep blue'],['forest','🌲 forest','dark pine'],
    ['purple','💜 amethyst','violet dusk'],['sepia','📜 sepia','warm paper'],['sunset','🌅 sunset','warm dark'],
    ['mono','🖤 mono','black and white'],['neon','🍬 neon','bright on dark']]
  :[['auto','🌗 авто д/н','07-20 светлая, ночью тёмная'],['light','☀️ светлая','стекло по умолчанию'],
    ['dark','🌙 тёмная','глубокая ночная'],['ocean','🌊 океан','глубокая синева'],['forest','🌲 лес','тёмная хвоя'],
    ['purple','💜 аметист','фиолетовые сумерки'],['sepia','📜 сепия','тёплая бумага'],['sunset','🌅 закат','тёплый тёмный'],
    ['mono','🖤 моно','чёрно-белый контраст'],['neon','🍬 неон','яркие акценты на тёмном']];
}
function docFillMenu(){
 var menu=document.getElementById('tmenu');if(!menu)return;
 var L=docThemeItems(),map={};
 L.forEach(function(x){map[x[0]]=x;});
 menu.querySelectorAll('.titem').forEach(function(i){
  var row=map[i.dataset.t];if(!row)return;
  i.innerHTML='<span class=tk></span>'+row[1]+'<span class=td>'+row[2]+'</span>';
  i.classList.toggle('on',i.dataset.t===window.__docMode);
 });
}
function docApplyTheme(force){var t=window.__docEff();
 if(!force&&__last===t)return;__last=t;
 document.documentElement.dataset.theme=t;
 document.dispatchEvent(new CustomEvent('doc-theme'));
 var b=document.getElementById('themeBtn');
 if(b){b.textContent=kgT('themeChip');b.title=docLabel();}
 var menu=document.getElementById('tmenu');
 if(menu)menu.querySelectorAll('.titem').forEach(function(i){
  i.classList.toggle('on',i.dataset.t===window.__docMode);});}
function toggleTheme(){var m=document.getElementById('tmenu');
 if(m){m.classList.toggle('open');if(m.classList.contains('open'))docApplyTheme(true);}}
function docSetTheme(t){window.__docMode=t;
 try{localStorage.setItem('doc-theme',t)}catch(e){}
 __last=null;docApplyTheme(true);
 var m=document.getElementById('tmenu');if(m)m.classList.remove('open');}
(function(){document.addEventListener('DOMContentLoaded',function(){
 var tb=document.getElementById('themeBtn');
 if(tb)tb.addEventListener('click',function(){toggleTheme();});
 if(document.getElementById('themeBtn')&&!document.getElementById('tmenu')){
  var L=docThemeItems();
  var d=document.createElement('div');d.id='tmenu';d.className='tmenu';
  d.innerHTML=L.map(function(x){return '<button type=button class="titem'
   +(x[0]===window.__docMode?' on':'')+'" data-t="'+x[0]+'"><span class=tk></span>'
   +x[1]+'<span class=td>'+x[2]+'</span></button>';}).join('');
  document.body.appendChild(d);
  d.addEventListener('click',function(e){
   var b=e.target.closest('.titem');if(b)docSetTheme(b.dataset.t);});
 }
 var lb=document.getElementById('langBtn');
 if(lb)lb.addEventListener('click',function(){kgToggleLang();});
 kgApplyLang();
 startClock();
});})();
document.addEventListener('click',function(e){
 var m=document.getElementById('tmenu');
 if(m&&m.classList.contains('open')&&!m.contains(e.target)&&e.target.id!=='themeBtn')
  m.classList.remove('open');});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){
 var m=document.getElementById('tmenu');if(m)m.classList.remove('open');}});
setInterval(function(){if(window.__docMode==='auto')docApplyTheme(false)},60000);

function startClock(){
 var svg=document.getElementById('ticks');if(!svg)return;
 for(var i=0;i<12;i++){var a=i*30*Math.PI/180,r1=i%3===0?33:36,r2=39;
  var l=document.createElementNS('http://www.w3.org/2000/svg','line');
  l.setAttribute('x1',50+r1*Math.sin(a));l.setAttribute('y1',50-r1*Math.cos(a));
  l.setAttribute('x2',50+r2*Math.sin(a));l.setAttribute('y2',50-r2*Math.cos(a));
  l.setAttribute('class','tick');svg.appendChild(l);}
 var HH=document.getElementById('hh'),MM=document.getElementById('mm');
 var SS=document.getElementById('ss'),R=document.getElementById('secring'),C=276.46;
 function tick(){var n=new Date();
  var s=n.getSeconds()+n.getMilliseconds()/1000;
  var m=n.getMinutes()+s/60,h=(n.getHours()%12)+m/60;
  HH.setAttribute('transform','rotate('+(h*30)+' 50 50)');
  MM.setAttribute('transform','rotate('+(m*6)+' 50 50)');
  SS.setAttribute('transform','rotate('+(s*6)+' 50 50)');
  R.setAttribute('stroke-dashoffset',(C*(1-s/60)).toFixed(2));
  var ct=document.getElementById('ct'),cd=document.getElementById('cd');
  var loc=kgLocale();
  if(ct)ct.textContent=n.toLocaleTimeString(loc);
  if(cd)cd.textContent=n.toLocaleDateString(loc,{weekday:'long',day:'numeric',month:'long'});}
 tick();setInterval(tick,50);
}
