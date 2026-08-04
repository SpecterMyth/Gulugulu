// Hand-authored names for built-in species. Creature names are brand copy, not
// sentence fragments: keep them punchy, locally pronounceable, and at most two
// written words. The order is shared so reviewers can compare languages row by
// row without wading through 1,596 repeated object keys.

import type { Language } from "./core";

export const DEFAULT_SPECIES_CODES = [
  "guluduck", "emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng",
  "guluswan", "infernofox", "thunderking", "tidefrog", "mycobeast", "glacierpeng",
  "blazeduck", "sparkduck", "rippleduck", "mossduck", "frostduck", "plasmatanuki",
  "steamander", "cinderleaf", "thermowolf", "stormeel", "vinevolt", "auroramink",
  "lotusturtle", "floeseal", "frostbunny", "weldbug", "voltquill", "aurowl",
  "zapbun", "voltmare", "chilizard", "onsenmonk", "waxlamb", "steamalotl",
  "pinefawn", "potturtle", "lilyfrog", "snowcub", "icejelly", "sudsotter",
  "pyrepeacock", "stormdrake", "rockrooster", "boilshrimp", "glowhum", "windmole",
  "glowfly", "waddleskate", "frostangler", "maildove", "seasonleon", "toastybara",
  "bobamingo", "lattegolem", "saunapuff", "ramencoon", "yarncat", "terrasnail",
  "scaresprout", "bowlrus", "lanternloong", "discobloom", "juicepitcher", "mochipop",
  "meteoropus", "grillgator", "chimebell", "frostclione", "mistyox", "subhermit",
  "teapir", "brewbat", "porkchef", "spadolphin", "snowbonsai", "liondance",
  "manacorn", "queenbuzz", "gargoylite", "crystalwing", "claypango", "prismkirin",
] as const;

export type DefaultSpeciesCode = (typeof DEFAULT_SPECIES_CODES)[number];

function names(language: string, source: string): Record<DefaultSpeciesCode, string> {
  const values = source.split("|").map((value) => value.trim());
  if (values.length !== DEFAULT_SPECIES_CODES.length || values.some((value) => !value)) {
    throw new Error(`${language}: expected ${DEFAULT_SPECIES_CODES.length} curated species names, got ${values.length}`);
  }
  return Object.fromEntries(DEFAULT_SPECIES_CODES.map((code, index) => [code, values[index]])) as Record<DefaultSpeciesCode, string>;
}

const zhHant = names("zh-Hant", `
  咕嚕鴨|炎尾狐|啾雷鼠|氣泡鯨|嫩芽菇|霜雪怪|咕嚕天鵝|炎獄狐|雷霆鼠皇|浪濤鯨|菇林獸|極冰雪帝|
  焰羽鴨|閃光鴨|漣漪鴨|苔羽鴨|霜羽鴨|電漿狐|蒸汽鯨|餘燼菇|熔霜狼|雷雨鯨|藤電鼠|極光貂|
  蓮葉鯨|浮冰雪怪|雪兔菇|焊花蟲|電葉蝟|極光鴞|靜電兔|雷海馬|火辣蜥|溫泉猴|燭焰羊|汽霧螈|
  雪松鹿|花盆龜|荷葉蛙|雪球熊|冰晶水母|泡澡獺|煙花雀|風暴龍|搖滾雞|沸騰蝦|光蜂鳥|風車鼴|
  流螢蟲|滑冰鵝|霜燈魚|信使鴿|四季龍|暖包豚|啵茶鳥|拿鐵雪人|桑拿豚|拉麵熊|毛線貓|苔殼蝸|
  稻草人|冰海象|舞龍燈|搖擺葵|蜜壺草|爆漿糬|雲章魚|燒烤鱷|風鈴草|海天使|穀雨牛|潛艇蟹|
  抹茶貘|煉藥蝠|掌勺豬|泡湯豚|雪盆栽|醒獅|靈角獸|女王蜂|石像咕|琉璃蜓|赤陶甲|晶麒麟
`);

const ja = names("ja", `
  グルダック|ホムラギツネ|ビリリネズミ|アワクジラ|メブキノコ|シモケモノ|グルスワン|ゴクエンギツネ|イカズチネズミオウ|シオクジラ|キノモリケモノ|ヒョウガオウ|
  ホノハダック|スパークダック|サザナミダック|コケハダック|シモハダック|プラズマギツネ|ユゲクジラ|オキビノコ|ネツシモオオカミ|アラシクジラ|デンヅルネズミ|オーロラミンク|
  ハスクジラ|リュウヒョウケモノ|シモウサノコ|ヨウセツムシ|デンパリハリネズミ|オーロラフクロウ|ビリウサ|ライカイバ|カラトカゲ|オンセンザル|ロウソクヒツジ|ユゲウーパー|
  ユキマツジカ|ハチウエガメ|ハスガエル|ユキダマグマ|ヒョウショウクラゲ|アワブロカワウソ|ハナビクジャク|アラシリュウ|ロックドリ|グツグツエビ|ヒカリハチドリ|カザグルマモグラ|
  ヒカリボタル|スケートペンギン|シモアカリウオ|デンショバト|シキリュウ|ポカポカピバラ|タピオカミンゴ|ラテユキダルマ|サウナフグ|ラーメンアライグマ|ケイトネコ|コケガラマイマイ|
  チビカカシ|アイスセイウチ|チョウチンリュウ|ディスコヒマワリ|ハニーツボクサ|ハジケモチ|クモダコ|ヤキワニ|フウリンバナ|ウミテンシ|コクウアメウシ|センカイヤドカリ|
  マッチャバク|クスリコウモリ|シェフブタ|オンセンドルフィン|ユキボンサイ|シシマイ|セイレイコーン|ジョオウバチ|チビガーゴイル|クリスタルトンボ|トウキセンザンコウ|プリズムキリン
`);

const ko = names("ko", `
  굴루오리|불씨여우|찌릿쥐|거품고래|새싹버섯|서리짐승|굴루백조|지옥불여우|천둥쥐왕|파도고래|버섯숲짐승|빙하짐승왕|
  불깃오리|불티오리|물결오리|이끼깃오리|서리깃오리|플라즈마여우|김고래|잉걸버섯|열서리늑대|폭풍고래|전기덩굴쥐|오로라밍크|
  연잎고래|유빙짐승|서리토끼버섯|용접벌레|전기잎고슴도치|오로라부엉이|정전기토끼|천둥해마|고추도마뱀|온천원숭이|촛불양|김우파루파|
  눈소나무사슴|화분거북|연잎개구리|눈덩이곰|얼음수정해파리|거품목욕수달|불꽃놀이공작|폭풍용|록수탉|팔팔새우|빛벌새|풍차두더지|
  빛반딧불이|스케이트펭귄|서리등불물고기|전서구|사계절용|후끈카피바라|버블티플라밍고|라떼눈사람|사우나복어|라면너구리|털실고양이|이끼집달팽이|
  꼬마허수아비|얼음바다코끼리|등불행렬용|디스코해바라기|꿀항아리풀|팡모치|구름문어|바비큐악어|풍경꽃|바다천사|곡우소|잠수함소라게|
  말차맥|물약박쥐|요리사돼지|온천돌고래|눈분재|사자춤|정령유니콘|여왕벌|꼬마가고일|수정잠자리|도자기천산갑|프리즘기린
`);

const fr = names("fr", `
  Canard Gulu|Renardbraise|Sourifoudre|Baleinbulle|Champipousse|Bêtegivre|Cygne Gulu|Renardenfer|Roi-souris|Baleinmarée|Bêtefongus|Roi-glacier|
  Canardflamme|Canardétincelle|Canardonde|Canardmousse|Canardgivre|Renardplasma|Baleinvapeur|Champibraise|Loupgivre|Baleinorage|Sourisliane|Visonaurore|
  Baleinlotus|Bêtebanquise|Lapinchampi|Insectosoudeur|Hérissonvolt|Chouetteaurore|Lapinstatique|Hippofoudre|Lézardpiment|Singeonsen|Agneaubougie|Axovapeur|
  Cerfneige|Tortuepot|Grenouillotus|Oursboule|Médusegivre|Loutrebain|Paonfeu|Dragonorage|Coqrock|Crevettebouillie|Colibrilueur|Taupemoulin|
  Luciolelueur|Pingoupatin|Poissonlanterne|Pigeonposte|Dragonquatre-saisons|Capychaud|Flamantboba|Neigelatte|Poissonsauna|Ratonramen|Chatlaine|Escargomousse|
  Épouvantail|Morseglace|Dragonlanterne|Tournesolboogie|Plantemiel|Mochipop|Poulpenuage|Crocodilegrill|Fleurcarillon|Ange marin|Bœufpluie|Bernard-sous-marin|
  Tapirmatcha|Pipistrellepotion|Cochonchef|Dauphinonsen|Bonsaïgivre|Danse-lion|Licornesprit|Reineabeille|Gargouillot|Libellulecristal|Pangolinterre|Kirinprisme
`);

const de = names("de", `
  Guluente|Glutfuchs|Donnermaus|Blasenwal|Sprosspilz|Frostvieh|Guluschwan|Höllenfuchs|Mäusekönig|Gezeitenwal|Pilzwaldtier|Gletscherkönig|
  Flammenente|Funkenente|Wellenente|Moosente|Reifente|Plasmafuchs|Dampfwal|Glutpilz|Hitzefrostwolf|Sturmwal|Rankenmaus|Polarlichtnerz|
  Lotuswal|Schollentier|Frosthasenpilz|Schweißkäfer|Voltigel|Polarlichteule|Statikhase|Donnerseepferd|Chiliechse|Thermenaffe|Kerzenlamm|Dampfaxolotl|
  Schneekitz|Topfschildkröte|Lotusfrosch|Schneebär|Kristallqualle|Badeotter|Feuerwerkpfau|Sturmdrache|Rockhahn|Kochgarnele|Leuchtkolibri|Windmühlenmaulwurf|
  Glühwürmchen|Eislaufpinguin|Frostlaternenfisch|Posttaube|Jahreszeitendrache|Kuschelcapybara|Bobaflamingo|Latte-Schneemann|Saunakugelfisch|Ramenwaschbär|Wollkatze|Mooshausschnecke|
  Vogelscheuche|Eiswalross|Laternendrache|Diskosonnenblume|Honigkanne|Knallmochi|Wolkenkrake|Grilligator|Windklangblume|Meeresengel|Regenochse|U-Boot-Einsiedler|
  Teekannen-Tapir|Trankfledermaus|Kochschwein|Thermendelfin|Schneebonsai|Löwentanz|Geisteinhorn|Bienenkönigin|Kleingargoyle|Kristalllibelle|Terrakottapangolin|Prismakirin
`);

const esEs = names("es-ES", `
  Pato Gulu|Zorrascua|Ratóntrueno|Ballenburbuja|Champibrote|Bestiescarcha|Cisne Gulu|Zorrafierno|Ratónrey|Ballenamarea|Bestihongo|Reyglaciar|
  Patoignio|Patochispa|Patoonda|Patomusgo|Patoescarcha|Zorraplasma|Ballenavapor|Champibrasa|Lobohielo|Ballenatormenta|Ratónenredadera|Visónaurora|
  Ballenaloto|Bestiámpano|Conejongo|Bichosoldador|Erizovolt|Búhoaurora|Conejoestático|Hipocamporayo|Guindillarto|Mono termal|Corderovela|Ajolotevapor|
  Ciervonieve|Tortumaceta|Ranaloto|Osobola|Medusacristal|Nutriabaño|Pavofuego|Dragontormenta|Gallorock|Gambahirviente|Colibríluz|Topomolino|
  Luciérnaga|Pingüinopatín|Pezfarol|Palomamensaje|Dragónestaciones|Capibaratibia|Flamencoboba|Nievelatte|Pezsauna|Mapacheramen|Gatolana|Caracolmusgo|
  Espantapájaros|Morsahielo|Dragónfarol|Girasoldisco|Planta miel|Mochipop|Pulponube|Parrilligarto|Florcarillón|Ángel marino|Bueylluvia|Cangrejosubmarino|
  Tapirmatcha|Murciélagopoción|Cerdochef|Delfíntermal|Bonsáinieve|Danza león|Unicorniospíritu|Abeja reina|Gárgolín|Libélulacristal|Pangolínbarro|Kirinprisma
`);

const es419 = names("es-419", `
  Pato Gulu|Zorrascua|Ratóntrueno|Ballenburbuja|Champibrote|Bestiescarcha|Cisne Gulu|Zorrafierno|Ratónrey|Ballenamarea|Bestihongo|Reyglaciar|
  Patoignio|Patochispa|Patoonda|Patomusgo|Patoescarcha|Zorraplasma|Ballenavapor|Champibrasa|Lobohielo|Ballenatormenta|Ratónenredadera|Visónaurora|
  Ballenaloto|Bestiámpano|Conejongo|Bichosoldador|Erizovolt|Búhoaurora|Conejoestático|Hipocamporayo|Ajilagarto|Mono termal|Corderovela|Ajolotevapor|
  Ciervonieve|Tortumaceta|Ranaloto|Osobola|Medusacristal|Nutriabaño|Pavofuego|Dragontormenta|Gallorock|Camarónhervido|Colibríluz|Topomolino|
  Luciérnaga|Pingüinopatín|Pezfarol|Palomamensaje|Dragónestaciones|Capibaratibia|Flamencoboba|Nievelatte|Pezsauna|Mapacheramen|Gatolana|Caracolmusgo|
  Espantapájaros|Morsahielo|Dragónfarol|Girasoldisco|Planta miel|Mochipop|Pulponube|Asadolagarto|Florcarillón|Ángel marino|Bueylluvia|Cangrejosubmarino|
  Tapirmatcha|Murciélagopoción|Cerdochef|Delfíntermal|Bonsáinieve|Danza león|Unicorniospíritu|Abeja reina|Gárgolín|Libélulacristal|Pangolínbarro|Kirinprisma
`);

const pt = names("pt", `
  Pato Gulu|Raposa-brasa|Rato-trovão|Baleiabolha|Cogubroto|Fera-geada|Cisne Gulu|Raposa-inferno|Rato-rei|Baleiamaré|Ferafungo|Rei-glacial|
  Patochama|Pato-faísca|Pato-onda|Pato-musgo|Pato-geada|Raposaplasma|Baleiavapor|Cogubrasa|Lobogelo|Baleiatempestade|Rato-cipó|Vison-aurora|
  Baleialótus|Fera-iceberg|Coelhocogumelo|Besourosolda|Ouriçovolt|Coruja-aurora|Coelhoestático|Cavalo-trovão|Lagartopimenta|Macaco-termal|Cordeirovela|Axolotevapor|
  Cervo-neve|Tartarugavaso|Rã-lótus|Urso-neve|Medusacristal|Lontrabanho|Pavãofogos|Dragãotempestade|Galo-rock|Camarãofervido|Beija-luz|Toupeiramoinho|
  Vaga-lume|Pinguimpatim|Peixe-lanterna|Pombo-correio|Dragãoestações|Capibaraquente|Flamingoboba|Nevelatte|Baiacusauna|Guaxinimramen|Gatonovelo|Caracolmusgo|
  Espantalho|Morsagelo|Dragãolanterna|Girassoldisco|Planta-mel|Mochipop|Polvonuvem|Churrascodilo|Flor-sino|Anjo-marinho|Boi-chuva|Ermitãosubmarino|
  Tapirmatcha|Morcegopoção|Porcochef|Golfinhotermal|Bonsaineve|Dança-leão|Unicórnioespírito|Abelha-rainha|Gárgulazinha|Libélulacristal|Pangolincerâmica|Kirinprisma
`);

const ru = names("ru", `
  Гулу-утка|Лисожар|Громомышь|Китопузырь|Грибочек|Иней-зверь|Гулу-лебедь|Адолис|Мышекороль|Приливокит|Грибозверь|Ледокороль|
  Огнеутка|Искроутка|Рябь-утка|Мохоутка|Иней-утка|Плазмолис|Парокит|Углегриб|Жаромороз|Грозокит|Лозомышь|Авроранорка|
  Лотосокит|Льдинозверь|Зайцегриб|Жукосвар|Вольтоёж|Аврорасова|Статикролик|Громоконёк|Перцоящер|Онсэн-макака|Свечеягнёнок|Пароаксолотль|
  Снежноолень|Горшкочереп|Лотосолягушка|Снежкомедведь|Кристалломедуза|Баньковыдра|Фейерпавлин|Буредракон|Рок-петух|Кипень-креветка|Светоколибри|Мельницекрот|
  Светляк|Конькопингвин|Фонарь-рыба|Почтоголубь|Сезонодракон|Тёплокапи|Боба-фламинго|Латте-снеговик|Саунофугу|Рамен-енот|Клубкокот|Мохоулитка|
  Пугашка|Ледоморж|Фонарь-дракон|Дискоцвет|Медоцвет|Мотипоп|Облакопод|Грилькрок|Ветрецвет|Морской ангел|Дождебык|Субмаринкраб|
  Матча-тапир|Зельемышь|Шефосвин|Онсэн-дельфин|Снегобонсай|Львиный танец|Духорог|Пчелокоролева|Гаргульчик|Кристаллострекоза|Терракотопанголин|Призмокирин
`);

const it = names("it", `
  Papera Gulu|Volpebrace|Topotuono|Balenabolla|Fungermoglio|Bestiabrina|Cigno Gulu|Volpeinferno|Topore|Balenamarea|Bestifungo|Reghiacciaio|
  AnatraFiamma|Anatrascintilla|Anatraonda|Anatramuschio|Anatrabrina|Volpeplasma|Balenavapore|Fungobrace|Lupogelo|Balenatempesta|Topovite|Visoneaurora|
  Balenaloto|Bestiaghiaccio|Conigliofungo|Insettosaldatore|Ricciovolt|Gufoaurora|Conigliostatico|Ippocampotuono|Lucertolapeperoncino|Scimmiatermale|Agnellocandela|Axolotlvapore|
  Cervoneve|Tartarugavaso|Ranaloto|Orsopalla|Medusacristallo|Lontrabagno|Pavonefuoco|Dragotempesta|Gallorock|Gamberobollito|Colibrìluce|Talpamolino|
  Lucciola|Pinguinopattino|Pesce-lanterna|Piccioneposta|Dragostagioni|Capibaracalda|Fenicotteroboba|Nevelatte|Pescesauna|Procione ramen|Gattolana|Lumacamuschio|
  Spaventapasseri|Trichecoghiaccio|Dragolanterna|Girasoledisco|Piantamiele|Mochipop|Polponuvola|Croccogrill|Fiorecarillon|Angelo marino|Buepioggia|Paguro-sottomarino|
  Tapiromatcha|Pipistrellopozione|Maialechef|Delfinotermale|Bonsaineve|Danza-leone|Unicorniospirito|Ape-regina|Gargollino|Libellulacristallo|Pangolinargilla|Kirinprisma
`);

const pl = names("pl", `
  Kaczka Gulu|Lisopłomyk|Gromysz|Bąbloryb|Kiełkogrzib|Mrozostwór|Łabędź Gulu|Piekłolis|Myszokról|Pływoryb|Grzybostwór|Lodokról|
  Płomykaczka|Iskrokaczka|Falokaczka|Mchokaczka|Szronokaczka|Plazmolis|Paroryb|Żarogrzyb|Ciepłomróz|Burzoryb|Pnączomysz|Zorzynorka|
  Lotosoryb|Krystwór|Królikogrzyb|Spawaczek|Woltojeż|Zorzosowa|Statyczkrólik|Gromikonik|Paprykojaszczur|Termomałpa|Świecobaranek|Paroaksolotl|
  Śniegojeleń|Donicożółw|Lotosożaba|Śniegomiś|Kryształomeduza|Kąpielowydra|Fajeropaw|Burzosmok|Rockokogut|Wrzątokrewetka|Świetlikoliber|Wiatrakokret|
  Świetlik|Łyżwopingwin|Latarnioryba|Pocztogołąb|Porysmok|Ciepłokapibara|Bobaflaming|Latte-bałwan|Saunorozdymka|Ramenoszop|Włóczkokot|Mchoślimak|
  Straszek|Lodomors|Latarniosmok|Dyskosłonecznik|Miododzban|Mochipop|Chmurośmiornica|Grillokrok|Wietrzny kwiat|Morski anioł|Deszczowół|Łódź-pustelnik|
  Herbaciany tapir|Eliksirownietoperz|Szefoproś|Termodelfin|Śniegobonsai|Lwitaniec|Duchorożec|Pszczołokrólowa|Gargulecik|Kryształowa ważka|Terakotopangolin|Pryzmatokirin
`);

const tr = names("tr", `
  Gulu Ördeği|Kor Tilki|Gökfaresi|Köpükbalina|Filizmantar|Ayazcanavar|Gulu Kuğusu|Cehennemtilki|Farehan|Gelgitbalina|Mantarcanavar|Buzulhan|
  Alevördek|Kıvılcımördek|Dalgaördek|Yosunördek|Ayazördek|Plazmatilki|Buharbalina|Kormantar|Termobuzkurt|Fırtınabalina|Sarmaşıkfare|Kutupvizon|
  Nilüferbalina|Buzcanavar|Tavşanmantar|Kaynakböcek|Voltkirpi|Kutupbaykuş|Statiktavşan|Gökdenizatı|Acıkertenkele|Kaplıcamaymunu|Mumkuzu|Buharaksolotl|
  Karçamgeyik|Saksıkaplumbağa|Nilüferkurbağa|Kartopayı|Kristaldenizanası|Sabunsamur|Havai tavus|Fırtınaejderi|Rockhoroz|Kaynamışkarides|Işıkkolibri|Yeldeğirmenköstebeği|
  Ateşböceği|Patencipenguen|Ayazfenerbalığı|Postagüvercini|Mevsimejderi|Sıcakkapibara|Bobaflamingo|Lattekardanadam|Saunabalonbalığı|Ramenrakunu|Yumakkedi|Yosunkabuksalyangoz|
  Korkuluk|Buzmorsu|Fenerhejder|Diskoayçiçeği|Balibrik|Mochipop|Bulutahtapot|Mangaligator|Rüzgârçanıçiçeği|Denizmeleği|Yağmuröküzü|Denizaltıkeşiş|
  Maçatapiri|İksiryarasa|Şefdomuz|Kaplıcayunusu|Karbonsai|Aslandansı|Ruhtekboynuz|Kraliçearı|Minikgargoyle|Kristalyusufçuk|Terrakotapangolin|Prizmakirin
`);

const uk = names("uk", `
  Гулу-качка|Лисожар|Громомиша|Китобулька|Грибочок|Іній-звір|Гулу-лебідь|Пеклолис|Мишокороль|Припливокит|Грибозвір|Льодокороль|
  Вогнекачка|Іскрокачка|Хвильокачка|Мохокачка|Іній-качка|Плазмолис|Парокит|Жарогриб|Жаромороз|Грозокит|Лозомиша|Авроранорка|
  Лотосокит|Крижозвір|Зайцегриб|Жукозвар|Вольтоїжак|Аврорасова|Статиккролик|Громоконик|Перцеящір|Онсен-мавпа|Свічкоягня|Пароаксолотль|
  Снігоолень|Горщикочереп|Лотосожаба|Сніжкомедвідь|Кристаломедуза|Баньковидра|Феєрпавич|Буредракон|Рок-півень|Окріп-креветка|Світлоколібрі|Млиновий кріт|
  Світляк|Ковзанопінгвін|Ліхтар-риба|Поштоголуб|Сезонодракон|Теплокапі|Боба-фламінго|Лате-сніговик|Саунофугу|Рамен-єнот|Клубкокіт|Мохослимак|
  Лякачка|Льодоморж|Ліхтар-дракон|Дискоквіт|Медоквіт|Мотіпоп|Хмаровосьминіг|Грилькрок|Вітроквіт|Морський ангел|Дощобик|Субмаринкраб|
  Матча-тапір|Зіллемиша|Шефосвин|Онсен-дельфін|Снігобонсай|Левиний танець|Духоріг|Бджолокоролева|Гаргульчик|Кришталобабка|Теракотопанголін|Призмокірін
`);

const ar = names("ar", `
  بطة غولو|ثعلب الجمر|فأر الرعد|حوت الفقاعات|فطر البرعم|وحش الصقيع|بجعة غولو|ثعلب الجحيم|ملك الفئران|حوت المد|وحش الفطر|ملك الجليد|
  بطة اللهب|بطة الشرر|بطة الموج|بطة الطحلب|بطة الصقيع|ثعلب البلازما|حوت البخار|فطر الجمر|ذئب الصقيع|حوت العاصفة|فأر الكرمة|منك الشفق|
  حوت اللوتس|وحش الطوف|فطر الأرنب|خنفساء اللحام|قنفذ البرق|بومة الشفق|أرنب ساكن|فرس الرعد|سحلية الفلفل|قرد الينبوع|حمل الشمعة|سمندر بخاري|
  غزال الصنوبر|سلحفاة الأصيص|ضفدع اللوتس|دب الثلج|قنديل بلوري|قضاعة الفقاقيع|طاووس الألعاب|تنين العاصفة|ديك الروك|روبيان مغلي|طنان مضيء|خلد الطاحونة|
  يراعة مضيئة|بطريق متزلج|سمكة المصباح|حمام ساعي|تنين الفصول|كابيبارا دافئة|نحام البوبا|رجل لاتيه|سمكة الساونا|راكون الرامن|قط الصوف|حلزون الطحلب|
  فزاعة صغيرة|فظ الجليد|تنين الفانوس|زهرة راقصة|نبات العسل|موتشي فرقوع|أخطبوط السحاب|تمساح الشواء|زهرة الرنين|ملاك البحر|ثور المطر|سلطعون الغواصة|
  تابير الماتشا|خفاش الجرعة|خنزير الطاهي|دلفين الينبوع|بونساي الثلج|رقصة الأسد|وحيد الروح|ملكة النحل|غرغول صغير|يعسوب بلوري|بانغولين فخاري|كيرين بلوري
`);

const th = names("th", `
  เป็ดกูลู|จิ้งจอกถ่าน|หนูสายฟ้า|วาฬฟอง|เห็ดหน่อ|อสูรน้ำค้าง|หงส์กูลู|จิ้งจอกนรก|ราชาหนู|วาฬน้ำขึ้น|อสูรเห็ด|ราชาธารน้ำแข็ง|
  เป็ดเพลิง|เป็ดประกาย|เป็ดระลอก|เป็ดมอส|เป็ดน้ำค้าง|จิ้งจอกพลาสมา|วาฬไอน้ำ|เห็ดถ่าน|หมาป่าน้ำแข็ง|วาฬพายุ|หนูเถาวัลย์|มิงค์ออโรรา|
  วาฬบัว|อสูรน้ำแข็ง|เห็ดกระต่าย|แมลงช่างเชื่อม|เม่นโวลต์|นกฮูกออโรรา|กระต่ายไฟฟ้าสถิต|ม้าน้ำสายฟ้า|กิ้งก่าพริก|ลิงออนเซ็น|แกะเทียน|แอกโซลอเติลไอน้ำ|
  กวางสนหิมะ|เต่ากระถาง|กบบัว|หมีหิมะ|แมงกะพรุนผลึก|นากอ่างฟอง|นกยูงพลุ|มังกรพายุ|ไก่ร็อก|กุ้งเดือด|ฮัมมิงเบิร์ดเรืองแสง|ตุ่นกังหัน|
  หิ่งห้อยเรืองแสง|เพนกวินสเก็ต|ปลาโคมน้ำแข็ง|พิราบส่งสาร|มังกรสี่ฤดู|คาปิบาราอุ่น|ฟลามิงโกโบบา|มนุษย์หิมะลาเต้|ปลาปักเป้าซาวน่า|แรคคูนราเมง|แมวไหมพรม|หอยทากมอส|
  หุ่นไล่กา|วอลรัสน้ำแข็ง|มังกรโคม|ทานตะวันดิสโก้|หม้อข้าวหม้อแกงลิงน้ำผึ้ง|โมจิป๊อบ|หมึกเมฆ|จระเข้บาร์บีคิว|ดอกกระดิ่งลม|เทวทูตทะเล|วัวฝนธัญพืช|ปูเสฉวนเรือดำน้ำ|
  สมเสร็จมัทฉะ|ค้างคาวยา|หมูเชฟ|โลมาออนเซ็น|บอนไซหิมะ|เชิดสิงโต|ยูนิคอร์นวิญญาณ|นางพญาผึ้ง|การ์กอยล์จิ๋ว|แมลงปอคริสตัล|ตัวนิ่มดินเผา|กิเลนคริสตัล
`);

const vi = names("vi", `
  Vịt Gulu|Cáo Than|Chuột Sét|Kình Bongbóng|Nấm Mầm|Thú Sương|Thiênnga Gulu|Cáo Ngục|Vua Chuột|Kình Triều|Thú Nấm|Vua Băng|
  Vịt Lửa|Vịt Tia|Vịt Sóng|Vịt Rêu|Vịt Sương|Cáo Plasma|Kình Hơi|Nấm Than|Sói Nhiệtbăng|Kình Bão|Chuột Dâyleo|Chồn Cựcquang|
  Kình Sen|Thú Băngtrôi|Nấm Thỏ|Bọ Hàn|Nhím Điện|Cú Cựcquang|Thỏ Tĩnhđiện|Cángựa Sấm|Thằnlằn Ớt|Khỉ Suốiấm|Cừu Nến|Kỳgiông Hơi|
  Nai Thôngtuyết|Rùa Chậu|Ếch Sen|Gấu Tuyết|Sứa Phalê|Ráicá Tắmbọt|Công Pháohoa|Rồng Bão|Gà Rock|Tôm Sôi|Chimruồi Sáng|Chuộtchũi Cốigió|
  Đomđóm Sáng|Cánhcụt Trượt|Cá Đènbăng|Bồcâu Thư|Rồng Bốnmùa|Capybara Ấm|Hồnghạc Boba|Ngườituyết Latte|Cánóc Sauna|Gấumèo Ramen|Mèo Len|Ốcsên Rêu|
  Bùnhìn Nhí|Hảimã Băng|Rồng Đèn|Hướngdương Disco|Nắpấm Mật|Mochipop|Bạchtuộc Mây|Cásấu Nướng|Hoa Chuônggió|Thiênthần Biển|Bò Mưangũcốc|Cua Tàungầm|
  Lợnvòi Matcha|Dơi Thuốc|Heo Bếp|Cáheo Suốiấm|Bonsai Tuyết|Múa Lân|Kỳlân Hồn|Ong Chúa|Gargoyle Con|Chuồnchuồn Phalê|Têtê Đấtnung|Kirin Phalê
`);

const id = names("id", `
  Bebek Gulu|Rubahbara|Tikushalilintar|Pausgelembung|Jamurtunas|Makhlukembun|Angsa Gulu|Rubahneraka|Rajatikus|Pauspasang|Makhlukjamur|Rajagletser|
  Bebekapi|Bebekpercik|Bebekriak|Bebeklumut|Bebekbeku|Rubahplasma|Pausuap|Jamurbara|Serigalaes|Pausbadai|Tikussulur|Cerpelai aurora|
  Pausteratai|Makhlukes|Jamurkelinci|Kumbanglas|Landakvolt|Burunghantu aurora|Kelinci statis|Kudalautpetir|Kadalcabai|Monyetonsen|Dombalilin|Axolotluap|
  Rusapinus|Kura-pot|Katakteratai|Beruangsalju|Uburkristal|Berang-berangbusa|Merakkembangapi|Nagabadai|Ayamrock|Udangrebus|Kolibribinar|Tikustanahkincir|
  Kunang-kunang|Pinguinseluncur|Ikanlentera|Merpatipos|Nagaempatmusim|Kapibarahangat|Flamingoboba|Manusiasaljulatte|Ikangembungsauna|Rakunramen|Kucingbenang|Siputlumut|
  Orang-orangan|Walruses|Nagalentera|Bungamataharidisko|Kantongsemarmadu|Mochipop|Guritaawan|Buayabakar|Bungalonclangin|Malaikatlaut|Sapihujan|Kelomangkapalselam|
  Tapirmatcha|Kelelawarramuan|Babikoki|Lumba-onsen|Bonsaisalju|Tarisinga|Unicornroh|Ratulebah|Gargoylekecil|Capungkristal|Trenggilingterakota|Kirinprisma
`);

const nl = names("nl", `
  Gulu-eend|Sintelvos|Dondermuis|Bubbelwalvis|Spruitzwam|Rijpbeest|Gulu-zwaan|Hellevos|Muizenkoning|Getijdenwalvis|Paddenbeest|Gletsjerkoning|
  Vlamveer|Vonkeend|Golfeend|Moseend|Rijpeend|Plasmavos|Stoomwalvis|Gloeizwam|Warmrijpwolf|Stormwalvis|Rankmuis|Poollichtnerts|
  Lotuswalvis|IJsschotsbeest|Rijphaaszwam|Laskever|Voltstekel|Poollichtuil|Statikhaas|Donderzeepaard|Chilihagedis|Bronaap|Kaarslam|Stoomaxolotl|
  Sneeuwdenhert|Potschildpad|Lotuskikker|Sneeuwbalbeer|Kristalkwal|Badotter|Vuurwerkpauw|Stormdraak|Rockhaan|Kookgarnaal|Gloeikolibrie|Windmolenmol|
  Gloeiworm|Schaatspinguïn|Rijplantaarnvis|Postduif|Seizoendraak|Warmcapibara|Bobaflamingo|Latte-sneeuwpop|Saunakogelvis|Ramenwasbeer|Wolkat|Moshuisjesslak|
  Vogelverschrikker|IJswalrus|Lantaarnloong|Discozonnebloem|Honingbeker|Mochipop|Wolkoctopus|Barbekrok|Windklokbloem|Zee-engel|Regenos|Duikbootkluizenaar|
  Theetapir|Drankvleermuis|Chefsvarken|Brondolfijn|Sneeuwbonsai|Leeuwendans|Geesthoorn|Bijenkoningin|Gargoeltje|Kristallibel|Terracottaschubdier|Prismakirin
`);

export const CURATED_SPECIES_NAMES: Partial<Record<Language, Record<DefaultSpeciesCode, string>>> = {
  "zh-Hant": zhHant,
  ja,
  ko,
  fr,
  de,
  "es-ES": esEs,
  "es-419": es419,
  "pt-BR": pt,
  "pt-PT": pt,
  ru,
  it,
  pl,
  tr,
  uk,
  ar,
  th,
  vi,
  id,
  nl,
};
