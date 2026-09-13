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
  homeChip:'🏠 На главную',tipHome:'На главную',
  howtoTitle:'Как пользоваться',
  howtoLead:'Два режима: keengen на ПК и keengen на Keenetic. Полный текст — в README репозитория.',
  howtoPageTitle:'Как пользоваться · keengen',
  h1:'1. Ссылки и файлы',
  infoTip:'Подсказка',
  note1:'«Прочитать с Keenetic» сразу показывает подключения в секции 2. Активное в таблице пишется в 05_routing. «Залить» / правый клик по вкладке — запись на роутер после входа. «Прочитать ссылки» — только поле ниже.',
  authBtn:'Настройка входа',readBtn:'Прочитать с Keenetic',whereWait:'Проверяю, дома ли вы…',
  ipkTitle:'Установить / обновить keengen на Keenetic (Entware)',
  ipkHint:'В keengen на ПК нужен SSH root в «Настройка входа». В keengen на Keenetic (:1001) кнопка ставит сама. Всегда качается latest с GitHub. XKeen-UI на :1000 не трогается.',
  ipkBtn:'Установить IPK на роутер',
  ipkBtnUpdate:'Обновить IPK до {0}',
  ipkConfirm:'Установить/обновить keengen IPK с GitHub latest? Будет бэкап, затем opkg. Конфиги XKeen не изменятся.',
  ipkNeedRoot:'для установки с ПК укажите логин root в «Настройка входа»',
  ipkBusy:'ставлю / обновляю IPK…',
  ipkOk:'IPK {0} установлен · UI {1}',
  ipkOkOpen:'IPK {0} установлен · открыл UI',
  ipkOpenUi:'Открыть UI на :1001',
  ipkFail:'установка не удалась: {0}',
  ipkFailLog:'установка не удалась — см. лог выше',
  ipkFailStep:'сбой на шаге {0}{1}',
  ipkVer:'локально {0} · GitHub {1}{2}',
  ipkVerRouter:' · на роутере {0}',
  ipkAppUpdate:' · есть новая версия keengen на ПК — обновите папку standalone / git',
  ipkUpToDate:'IPK актуален ({0})',
  bakTitle:'Локальные бэкапы (на ПК)',
  bakHint:'Бэкап конфигов всегда при «Прочитать» и при установке IPK (папка backups/ на этом ПК). Restore — с ПК под root SSH. «Удалить IPK» только в keengen на ПК, не в keengen на Keenetic (:1001).',
  bakPick:'Слепок',
  bakRefresh:'Обновить список бэкапов',
  bakRestoreCfg:'Restore конфиги',
  bakRestoreIpk:'Restore IPK',
  bakRemoveIpk:'Удалить IPK',
  bakEmpty:'бэкапов пока нет — появятся после «Прочитать» или установки IPK',
  bakNeedRoot:'нужен root в «Настройка входа»',
  bakNeedPkg:'на роутере нет пакета keengen',
  bakNeedSnap:'выберите слепок бэкапа',
  bakNeedSnapCfg:'в выбранном слепке нет конфигов',
  bakNeedSnapIpk:'в выбранном слепке нет IPK',
  bakConfirmCfg:'Восстановить конфиги XKeen из слепка {0} на роутер?',
  bakConfirmIpk:'Откатить IPK из слепка {0}? Пакет на роутере будет заменён.',
  bakConfirmRemove:'Удалить пакет keengen с роутера (opkg remove)? Сначала будет бэкап конфигов. keengen на Keenetic (:1001) исчезнет.',
  bakBusy:'выполняю…',
  bakOk:'готово',
  bakFail:'не удалось: {0}',
  bakMade:'резервная копия: {0}',
  bakMadeShort:'✓ бэкап {0}',
  linksLbl:'Вставьте ссылки или JSON вкладки, затем «Прочитать ссылки». Встроенная проверка ссылок и JSON: битое не попадает; живые 03/04/05 не затираются целиком. 01, 02, 06 и .lst от «Прочитать ссылки» сами не меняются.',
  drop:'Нажмите или перетащите файл / QR',
  dropHint:'Одна настройка за раз: QR, .txt, JSON со ссылками или текст JSON 01–06 / .lst (ip_exclude / port_exclude / port_proxying / xkeen). Формат распознаётся автоматически.',
  clearBtn:'Очистить поле',parseBtn:'Прочитать ссылки',
  h2:'2. Outbound и routing',hintEmpty:'Пока пусто. Вставьте ссылки или QR.',
  thActive:'активное',thName:'имя',thServer:'сервер',thProto:'протокол',
  hPreview:'Превью файлов',backupBtn:'Скачать все файлы разом',applyAllBtn:'Залить всё на Keenetic',
  previewHint:'Это итоговые файлы, не черновик. Двойной щелчок копирует. Правая кнопка — скачать или залить этот файл. Правка — в поле сверху, затем «Прочитать ссылки»: проверка и замена только этой вкладки, остальные не трогаются.',
  footer:'keengen · конфиги для XKeen-UI · SSH только через keengen на ПК',
  tabCopy:'Скопировать в буфер',tabSave:'Скачать этот файл',tabApply:'Применить на Keenetic',
  applyTitle:'Применить на Keenetic',applyCancel:'Отмена',applyDo:'Применить',
  mergeTitle:'Что сделать с 04?',mergeMsg:'Есть файл с роутера и новые ссылки.',
  doMerge:'Смержить',doReplace:'Заменить',doCancel:'Отмена',
  authTitle:'Вход на Keenetic',
  authIntro:'Название, адрес LAN, порт, логин и пароль Entware SSH. «Сохранить» проверяет вход. Пока вход не сохранён, «Прочитать с Keenetic» выключена. Пароль не уходит на сайт и не пишется в логи. Нужен keengen на ПК (python keengen.py).',
  authPick:'Подключение',authName:'Название',authHost:'Адрес',authPort:'Порт',authUser:'Логин',authPass:'Пароль',
  phName:'router',phPass:'пароль Entware (или пусто + KEENGEN_SSH_KEY — см. howto)',
  authAdd:'Добавить',authDel:'Удалить',authCancel:'Отмена',authSave:'Сохранить',
  needSsh:'сначала вход и проверка SSH',
  writeRestart:'записать файлы на роутер и перезапустить XKeen',
  downloaded:'скачан {0}',copiedOk:'✓ скопировано',downloadedOk:'✓ скачано',
  copyFail:'не удалось скопировать: {0}',
  hintNone:'Пока пусто. Вставьте ссылки, QR или файлы из XKeen-UI.',
  hintNo04:'Файлы загружены, подключений в 04 ещё нет. Добавьте ссылки или прочитайте конфиг с Keenetic.',
  hintOne:'Одно подключение — оно запишется в routing.',
  hintMany:'Подключений больше одного — выберите активное: оно запишется в routing.',
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
  tipNeedFiles:'сначала нужны файлы в превью',
  tipAuthPcOnly:'только в keengen на ПК (вход по SSH с компьютера)',
  tipOnlyPc:'только в keengen на ПК',
  tipOnlyEntware:'только в keengen на Keenetic (:1001)',
  tipBakRefresh:'Перечитать папку backups/ на этом ПК и обновить выпадающий список слепков',
  tipBakRestoreCfg:'Восстановить конфиги XKeen из выбранного слепка на роутер',
  tipBakRestoreIpk:'Откатить IPK keengen из выбранного слепка на роутер',
  tipBakRemoveIpk:'Удалить пакет keengen с роутера (opkg remove; сначала бэкап)',
  tipAuthBtn:'Сохранить адрес, порт и пароль Entware SSH для этого браузера',
  tipReadBtn:'прочитать 01–06 и списки с роутера (запись не делается)',
  tipInstallIpk:'Скачать latest IPK с GitHub, сделать бэкап и установить/обновить keengen на роутере',
  tipClearBtn:'Очистить поле ссылок',
  tipParseBtn:'Разобрать поле: проверка ссылок/JSON; обновить 03/04/05; 01, 02, 06 и .lst сами не меняются',
  tipBackupBtn:'Скачать ZIP со всеми файлами превью',
  tipApplyAllBtn:'записать файлы на роутер и перезапустить XKeen',
  tipTheme:'Сменить тему оформления',
  tipHowto:'Краткая инструкция по работе с keengen',
  whereNeedSave:'вход не настроен — сохраните',
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
  homeChip:'🏠 Home',tipHome:'Home',
  howtoTitle:'How to use',
  howtoLead:'Two modes: keengen on PC and keengen on Keenetic. Full text is in the repository README.',
  howtoPageTitle:'How to use · keengen',
  h1:'1. Links and files',
  infoTip:'Info',
  note1:'“Read from Keenetic” fills connections in section 2. The active row is written to 05_routing. “Write” / right-click a tab uploads after login. “Read links” only fills the box below.',
  authBtn:'Login settings',readBtn:'Read from Keenetic',whereWait:'Checking if you are at home…',
  ipkTitle:'Install / update keengen on Keenetic (Entware)',
  ipkHint:'In keengen on PC you need SSH root in Login settings. In keengen on Keenetic (:1001) the button installs locally. Always downloads GitHub latest. XKeen-UI on :1000 is untouched.',
  ipkBtn:'Install IPK on router',
  ipkBtnUpdate:'Update IPK to {0}',
  ipkConfirm:'Install/update keengen IPK from GitHub latest? Will backup, then opkg. XKeen configs stay unchanged.',
  ipkNeedRoot:'for PC install set login to root in Login settings',
  ipkBusy:'installing / updating IPK…',
  ipkOk:'IPK {0} installed · UI {1}',
  ipkOkOpen:'IPK {0} installed · opened UI',
  ipkOpenUi:'Open UI on :1001',
  ipkFail:'install failed: {0}',
  ipkFailLog:'install failed — see log above',
  ipkFailStep:'failed at step {0}{1}',
  ipkVer:'local {0} · GitHub {1}{2}',
  ipkVerRouter:' · on router {0}',
  ipkAppUpdate:' · newer keengen on PC available — refresh standalone / git',
  ipkUpToDate:'IPK up to date ({0})',
  bakTitle:'Local backups (on PC)',
  bakHint:'Config backup always runs on Read and on IPK install (backups/ on this PC). Restore needs root SSH from keengen on PC. “Remove IPK” only in keengen on PC — not in keengen on Keenetic (:1001).',
  bakPick:'Snapshot',
  bakRefresh:'Refresh backup list',
  bakRestoreCfg:'Restore configs',
  bakRestoreIpk:'Restore IPK',
  bakRemoveIpk:'Remove IPK',
  bakEmpty:'no backups yet — appear after Read or IPK install',
  bakNeedRoot:'need root in Login settings',
  bakNeedPkg:'keengen package not on router',
  bakNeedSnap:'select a backup snapshot',
  bakNeedSnapCfg:'selected snapshot has no configs',
  bakNeedSnapIpk:'selected snapshot has no IPK',
  bakConfirmCfg:'Restore XKeen configs from snapshot {0} to the router?',
  bakConfirmIpk:'Roll back IPK from snapshot {0}? Package on the router will be replaced.',
  bakConfirmRemove:'Remove keengen package from the router (opkg remove)? Configs are backed up first. keengen on Keenetic (:1001) will go away.',
  bakBusy:'working…',
  bakOk:'done',
  bakFail:'failed: {0}',
  bakMade:'backup saved: {0}',
  bakMadeShort:'✓ backup {0}',
  linksLbl:'Paste share links or a tab JSON, then “Read links”. Built-in link and JSON check: broken input is rejected; live 03/04/05 are not wiped wholesale. 01, 02, 06 and .lst are not changed by “Read links” themselves.',
  drop:'Click or drop a file / QR',
  dropHint:'One setting at a time: QR, .txt, JSON with links, or paste JSON 01–06 / .lst (ip_exclude / port_exclude / port_proxying / xkeen). Format is detected automatically.',
  clearBtn:'Clear box',parseBtn:'Read links',
  h2:'2. Outbound and routing',hintEmpty:'Empty for now. Paste links or a QR.',
  thActive:'active',thName:'name',thServer:'server',thProto:'protocol',
  hPreview:'File preview',backupBtn:'Download all files',applyAllBtn:'Write all to Keenetic',
  previewHint:'These are the final files, not a draft. Double-click copies. Right-click downloads or writes that file. Edit in the box above, then “Read links”: only this tab is checked and replaced.',
  footer:'keengen · configs for XKeen-UI · SSH only via keengen on PC',
  tabCopy:'Copy to clipboard',tabSave:'Download this file',tabApply:'Apply on Keenetic',
  applyTitle:'Apply on Keenetic',applyCancel:'Cancel',applyDo:'Apply',
  mergeTitle:'What to do with 04?',mergeMsg:'There is a router file and new links.',
  doMerge:'Merge',doReplace:'Replace',doCancel:'Cancel',
  authTitle:'Keenetic login',
  authIntro:'Name, LAN address, port, login and Entware SSH password. “Save” probes SSH. Until it is saved, “Read from Keenetic” stays off. The password never goes to a website or into logs. You need keengen on PC (python keengen.py).',
  authPick:'Connection',authName:'Name',authHost:'Address',authPort:'Port',authUser:'Login',authPass:'Password',
  phName:'router',phPass:'Entware password (or empty + KEENGEN_SSH_KEY — see howto)',
  authAdd:'Add',authDel:'Delete',authCancel:'Cancel',authSave:'Save',
  needSsh:'log in and probe SSH first',
  writeRestart:'write files to the router and restart XKeen',
  downloaded:'downloaded {0}',copiedOk:'✓ copied',downloadedOk:'✓ downloaded',
  copyFail:'could not copy: {0}',
  hintNone:'Empty for now. Paste links, a QR, or XKeen-UI files.',
  hintNo04:'Files loaded, but 04 has no connections yet. Add links or read the config from Keenetic.',
  hintOne:'One connection — it will be written to routing.',
  hintMany:'More than one connection — pick the active one; it will be written to routing.',
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
  tipNeedFiles:'need files in the preview first',
  tipAuthPcOnly:'only in keengen on PC (SSH login from the computer)',
  tipOnlyPc:'only in keengen on PC',
  tipOnlyEntware:'only in keengen on Keenetic (:1001)',
  tipBakRefresh:'Re-read the backups/ folder on this PC and refresh the snapshot dropdown',
  tipBakRestoreCfg:'Restore XKeen configs from the selected snapshot to the router',
  tipBakRestoreIpk:'Roll back the keengen IPK from the selected snapshot to the router',
  tipBakRemoveIpk:'Remove the keengen package from the router (opkg remove; backup first)',
  tipAuthBtn:'Save address, port and Entware SSH password for this browser',
  tipReadBtn:'read 01–06 and lists from the router (no write)',
  tipInstallIpk:'Download the latest IPK from GitHub, back up, then install/update keengen on the router',
  tipClearBtn:'Clear the links box',
  tipParseBtn:'Parse the box: check links/JSON; update 03/04/05; 01, 02, 06 and .lst stay unchanged on their own',
  tipBackupBtn:'Download a ZIP of all preview files',
  tipApplyAllBtn:'write files to the router and restart XKeen',
  tipTheme:'Change the UI theme',
  tipHowto:'Short guide to using keengen',
  whereNeedSave:'login not set — save first',
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
 var onHowto=!!document.body&&document.body.classList.contains('howto-page');
 document.title=kgT(onHowto?'howtoPageTitle':'pageTitle');
 document.querySelectorAll('[data-i18n]').forEach(function(el){
  var k=el.getAttribute('data-i18n');if(k)el.textContent=kgT(k);});
 document.querySelectorAll('[data-i18n-title]').forEach(function(el){
  var k=el.getAttribute('data-i18n-title');if(k)el.title=kgT(k);});
 document.querySelectorAll('[data-i18n-aria]').forEach(function(el){
  var k=el.getAttribute('data-i18n-aria');if(k)el.setAttribute('aria-label',kgT(k));});
 document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
  var k=el.getAttribute('data-i18n-placeholder');if(k)el.placeholder=kgT(k);});
 document.querySelectorAll('[data-lang]').forEach(function(el){
  el.hidden=el.getAttribute('data-lang')!==window.__kgLang;});
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
  var host=tb.closest('.chips')||document.body;
  host.appendChild(d);
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
