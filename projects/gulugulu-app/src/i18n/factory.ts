// 工厂域词表:工厂玩法场景(FactoryScene)的全部 UI 词条。
// zh 为基准文案;en 走轻松/打工梗调性,按钮词条保持短(布局宽度受限)。
// 占位符用 fmt() 插值。

import { migrateLegacyLanguageMap, type Language } from "./core";

export interface FactoryStrings {
  /** 场景标题(顶部木牌)。 */
  title: string;
  /** 左上返回木牌。 */
  backBtn: string;
  backTitle: string;
  /** 首次进入的操作提示(第一次空投后淡出)。 */
  hint: string;
  /** 操作提示副行:属性配对规则(同属性粘住/异属性弹开)。 */
  hintMatch: string;
  /** 操作提示副行:解雇/罢工规则(点宠解雇;三只同种连一起罢工跑路)。 */
  hintFire: string;
  /** 罢工者头顶举的小牌子文案。 */
  strikeSign: string;
  /** 属性打工桌的无障碍标签({name}=元素名)。 */
  deskAria: string;
  /** 没有任何宠物时的空态提示。 */
  empty: string;
  /** 打工山已满(达到上限)时点击的提示。 */
  full: string;
  /** 右上角计数(打工中 ×{n})。 */
  working: string;
  /** 运输机的无障碍标签。 */
  planeAria: string;
}

export const FACTORY: Record<Language, FactoryStrings> = migrateLegacyLanguageMap({
  zh: {
    title: "打工工厂",
    backBtn: "← 返回",
    backTitle: "回到主界面",
    hint: "点击 / 空格：空投一只咕噜",
    hintMatch: "落在同属性咕噜身上会粘住，属性不合会被弹开",
    hintFire: "点击打工中的咕噜可以解雇；三只相同的凑一起会罢工！",
    strikeSign: "罢工!",
    deskAria: "{name}属性工位",
    empty: "还没有咕噜——先去孵一只吧",
    full: "办公室堆满啦，放不下了！",
    working: "打工咕噜 ×{n}",
    planeAria: "运输机",
  },
  en: {
    title: "Work Factory",
    backBtn: "← Back",
    backTitle: "Back to main",
    hint: "Click / Space: airdrop a Gulu",
    hintMatch: "Land on a matching Gulu to stick — no match, you bounce",
    hintFire: "Click a working Gulu to fire it — three of a kind walk out on strike!",
    strikeSign: "STRIKE!",
    deskAria: "{name} desk",
    empty: "No Gulus yet — hatch one first",
    full: "The office is packed — no room left!",
    working: "Gulus on shift ×{n}",
    planeAria: "Cargo plane",
  },
  "zh-Hant": {
    title: "打工工廠", backBtn: "← 返回", backTitle: "回到主畫面",
    hint: "點擊／空白鍵：空投一隻咕嚕", hintMatch: "落在同屬性咕嚕身上就會黏住，屬性不合會彈開",
    hintFire: "點打工中的咕嚕可以解雇；三隻同種湊在一起就會罷工！", strikeSign: "罷工！",
    deskAria: "{name}屬性工位", empty: "還沒有咕嚕——先去孵一隻吧", full: "辦公室塞爆了，真的放不下！",
    working: "當班咕嚕 ×{n}", planeAria: "運輸機",
  },
  ja: {
    title: "おしごと工場", backBtn: "← 戻る", backTitle: "メイン画面へ戻る",
    hint: "クリック／Space：グルを投下", hintMatch: "同じ属性ならピタッ。違う属性だと跳ね返ります",
    hintFire: "働くグルをクリックでクビ。同じ子が3匹つながるとストライキ！", strikeSign: "ストライキ！",
    deskAria: "{name}デスク", empty: "グルがいません。まずはふ化から！", full: "オフィス満員！ これ以上は入りません",
    working: "勤務中のグル ×{n}", planeAria: "輸送機",
  },
  ko: {
    title: "출근 공장", backBtn: "← 뒤로", backTitle: "메인 화면으로",
    hint: "클릭 / Space: 구루 공중 투하", hintMatch: "같은 속성끼리는 착! 다르면 튕겨 나가요",
    hintFire: "일하는 구루를 클릭해 해고! 같은 종 셋이 붙으면 파업합니다!", strikeSign: "파업!",
    deskAria: "{name} 책상", empty: "구루가 없어요. 먼저 부화부터!", full: "사무실 만원! 더는 못 들어가요",
    working: "근무 중인 구루 ×{n}", planeAria: "수송기",
  },
  fr: {
    title: "Usine à boulot", backBtn: "← Retour", backTitle: "Retour à l’accueil",
    hint: "Clic / Espace : larguer un Gulu", hintMatch: "Même élément : ça colle. Sinon, ça rebondit",
    hintFire: "Cliquez sur un Gulu pour le virer — trois identiques et c’est la grève !", strikeSign: "GRÈVE !",
    deskAria: "Bureau {name}", empty: "Pas encore de Gulu — faites-en éclore un", full: "Open space complet — plus une place !",
    working: "Gulus en poste ×{n}", planeAria: "Avion-cargo",
  },
  de: {
    title: "Arbeitsfabrik", backBtn: "← Zurück", backTitle: "Zurück zur Hauptansicht",
    hint: "Klick / Leertaste: Gulu abwerfen", hintMatch: "Gleiches Element hält — sonst gibt’s einen Abpraller",
    hintFire: "Arbeitendes Gulu anklicken und feuern — drei gleiche treten in den Streik!", strikeSign: "STREIK!",
    deskAria: "{name}-Schreibtisch", empty: "Noch keine Gulus — erst eins ausbrüten", full: "Büro überfüllt — hier passt nichts mehr rein!",
    working: "Gulus in der Schicht ×{n}", planeAria: "Frachtflugzeug",
  },
  "es-ES": {
    title: "Fábrica del curro", backBtn: "← Volver", backTitle: "Volver al inicio",
    hint: "Clic / Espacio: lanza un Gulu", hintMatch: "Si coincide el elemento, se pega; si no, rebota",
    hintFire: "Haz clic en un Gulu para despedirlo; ¡tres iguales montan una huelga!", strikeSign: "¡HUELGA!",
    deskAria: "Puesto de {name}", empty: "Aún no hay Gulus; incuba uno primero", full: "La oficina está a reventar. ¡No cabe nadie más!",
    working: "Gulus de turno ×{n}", planeAria: "Avión de carga",
  },
  "es-419": {
    title: "Fábrica de la chamba", backBtn: "← Volver", backTitle: "Volver al inicio",
    hint: "Clic / Espacio: suelta un Gulu", hintMatch: "Si el elemento coincide, se pega; si no, rebota",
    hintFire: "Toca un Gulu para despedirlo; ¡tres iguales se van a huelga!", strikeSign: "¡HUELGA!",
    deskAria: "Escritorio de {name}", empty: "Todavía no hay Gulus; incuba uno primero", full: "¡La oficina está llena! Ya no cabe nadie",
    working: "Gulus en turno ×{n}", planeAria: "Avión de carga",
  },
  "pt-BR": {
    title: "Fábrica do trampo", backBtn: "← Voltar", backTitle: "Voltar ao início",
    hint: "Clique / Espaço: solte um Gulu", hintMatch: "Elemento igual gruda; diferente quica longe",
    hintFire: "Clique num Gulu para demitir — três iguais juntos entram em greve!", strikeSign: "GREVE!",
    deskAria: "Mesa de {name}", empty: "Nenhum Gulu por aqui — choque um primeiro", full: "O escritório lotou. Não cabe mais ninguém!",
    working: "Gulus no turno ×{n}", planeAria: "Avião de carga",
  },
  "pt-PT": {
    title: "Fábrica do trabalho", backBtn: "← Voltar", backTitle: "Voltar ao início",
    hint: "Clique / Espaço: largar um Gulu", hintMatch: "Elemento igual cola; diferente faz ricochete",
    hintFire: "Clique num Gulu para o despedir — três iguais juntos fazem greve!", strikeSign: "GREVE!",
    deskAria: "Secretária de {name}", empty: "Ainda não há Gulus — incube um primeiro", full: "O escritório está cheio. Não cabe mais ninguém!",
    working: "Gulus de turno ×{n}", planeAria: "Avião de carga",
  },
  ru: {
    title: "Фабрика труда", backBtn: "← Назад", backTitle: "На главный экран",
    hint: "Щелчок / Пробел: сбросить Гулу", hintMatch: "Одинаковая стихия — сцепка, разная — отскок",
    hintFire: "Щёлкните по Гулу, чтобы уволить. Три одинаковых объявят забастовку!", strikeSign: "ЗАБАСТОВКА!",
    deskAria: "Стол стихии «{name}»", empty: "Гулу ещё нет — сначала кого-нибудь выведите", full: "Офис битком — мест больше нет!",
    working: "Гулу на смене: {n}", planeAria: "Грузовой самолёт",
  },
  it: {
    title: "Fabbrica del lavoro", backBtn: "← Indietro", backTitle: "Torna alla schermata principale",
    hint: "Clic / Spazio: lancia un Gulu", hintMatch: "Stesso elemento: si attacca. Diverso: rimbalza",
    hintFire: "Clicca un Gulu per licenziarlo — tre uguali e scatta lo sciopero!", strikeSign: "SCIOPERO!",
    deskAria: "Scrivania {name}", empty: "Nessun Gulu — fanne schiudere uno", full: "Ufficio al completo: non entra più nessuno!",
    working: "Gulu in turno ×{n}", planeAria: "Aereo cargo",
  },
  pl: {
    title: "Fabryka pracy", backBtn: "← Wstecz", backTitle: "Wróć do ekranu głównego",
    hint: "Klik / Spacja: zrzuć Gulu", hintMatch: "Ten sam żywioł się przyklei, inny odbije",
    hintFire: "Kliknij pracujące Gulu, by je zwolnić — trzy takie same urządzą strajk!", strikeSign: "STRAJK!",
    deskAria: "Biurko: {name}", empty: "Nie ma tu Gulu — najpierw jakieś wykluj", full: "Biuro pęka w szwach — brak miejsc!",
    working: "Gulu na zmianie ×{n}", planeAria: "Samolot transportowy",
  },
  tr: {
    title: "Mesai fabrikası", backBtn: "← Geri", backTitle: "Ana ekrana dön",
    hint: "Tıkla / Boşluk: bir Gulu bırak", hintMatch: "Aynı element tutunur, farklıysa seker",
    hintFire: "Çalışan Gulu'ya tıklayıp kov — aynı türden üçü birleşirse greve çıkar!", strikeSign: "GREV!",
    deskAria: "{name} masası", empty: "Henüz Gulu yok — önce bir tane çıkar", full: "Ofis doldu taştı, yer kalmadı!",
    working: "Mesaideki Gulu ×{n}", planeAria: "Kargo uçağı",
  },
  uk: {
    title: "Фабрика праці", backBtn: "← Назад", backTitle: "На головний екран",
    hint: "Клац / Пробіл: скинути Гулу", hintMatch: "Однакова стихія — зчеплення, інша — відскок",
    hintFire: "Клацніть Гулу, щоб звільнити. Троє однакових оголосять страйк!", strikeSign: "СТРАЙК!",
    deskAria: "Стіл стихії «{name}»", empty: "Гулу ще немає — спершу когось вилупіть", full: "Офіс переповнений — місць більше немає!",
    working: "Гулу на зміні: {n}", planeAria: "Вантажний літак",
  },
  ar: {
    title: "مصنع الدوام", backBtn: "رجوع →", backTitle: "العودة إلى الشاشة الرئيسية",
    hint: "نقرة / مسافة: أسقط Gulu", hintMatch: "العنصر المتطابق يلتصق، والمختلف يرتد",
    hintFire: "انقر Gulu العامل لفصله — ثلاثة من النوع نفسه يعلنون الإضراب!", strikeSign: "إضراب!",
    deskAria: "مكتب {name}", empty: "لا يوجد Gulu بعد — فقّس واحدًا أولًا", full: "المكتب مزدحم، لا مكان لموظف آخر!",
    working: "Gulu في الدوام ×{n}", planeAria: "طائرة شحن",
  },
  th: {
    title: "โรงงานทำงาน", backBtn: "← กลับ", backTitle: "กลับหน้าหลัก",
    hint: "คลิก / Space: ปล่อย Gulu ลงมา", hintMatch: "ธาตุตรงกันจะเกาะ ธาตุต่างกันจะเด้งออก",
    hintFire: "คลิก Gulu ที่ทำงานเพื่อไล่ออก—สามตัวพันธุ์เดียวกันจะนัดหยุดงาน!", strikeSign: "ประท้วง!",
    deskAria: "โต๊ะธาตุ{name}", empty: "ยังไม่มี Gulu—ไปฟักมาก่อนสักตัว", full: "ออฟฟิศเต็มแล้ว ไม่มีที่เหลือ!",
    working: "Gulu เข้าเวร ×{n}", planeAria: "เครื่องบินขนส่ง",
  },
  vi: {
    title: "Nhà máy đi làm", backBtn: "← Quay lại", backTitle: "Về màn hình chính",
    hint: "Nhấp / Space: thả một Gulu", hintMatch: "Cùng hệ thì dính, khác hệ thì bật ra",
    hintFire: "Nhấp Gulu đang làm để sa thải — ba con cùng loài sẽ đình công!", strikeSign: "ĐÌNH CÔNG!",
    deskAria: "Bàn hệ {name}", empty: "Chưa có Gulu — hãy ấp một con trước", full: "Văn phòng kín chỗ rồi, hết chỗ chen!",
    working: "Gulu đang trực ×{n}", planeAria: "Máy bay chở hàng",
  },
  id: {
    title: "Pabrik ngantor", backBtn: "← Kembali", backTitle: "Kembali ke layar utama",
    hint: "Klik / Spasi: jatuhkan satu Gulu", hintMatch: "Elemen sama menempel, beda elemen memantul",
    hintFire: "Klik Gulu yang bekerja untuk memecatnya — tiga jenis sama akan mogok!", strikeSign: "MOGOK!",
    deskAria: "Meja {name}", empty: "Belum ada Gulu — tetaskan satu dulu", full: "Kantor sudah penuh, tak muat lagi!",
    working: "Gulu yang bertugas ×{n}", planeAria: "Pesawat kargo",
  },
  nl: {
    title: "Werkfabriek", backBtn: "← Terug", backTitle: "Terug naar het hoofdscherm",
    hint: "Klik / Spatie: laat een Gulu vallen", hintMatch: "Hetzelfde element plakt; een ander stuitert weg",
    hintFire: "Klik op een werkende Gulu om die te ontslaan — drie dezelfde gaan staken!", strikeSign: "STAKING!",
    deskAria: "{name}-bureau", empty: "Nog geen Gulus — broed er eerst een uit", full: "Het kantoor zit propvol. Geen plek meer!",
    working: "Gulus in dienst ×{n}", planeAria: "Vrachtvliegtuig",
  },
});
