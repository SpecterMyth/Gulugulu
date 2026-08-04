const CARD_NUMBER_RE = /(?:[+−-]|×|≥)?\d+(?:,\d{3})*(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?(?:%|x|×)?/gu;

const n = (values, index, fallback = "") => values[index] ?? fallback;

const ja = {
  "fire.wildfire": ({ values }) => `初回の計分後、隣接する火属性グルを最大${n(values, 0)}体まで点火。1体につき作業実績を${n(values, 1)}回追加。`,
  "water.same": ({ values }) => `水属性グルの計分チームに同種グルが1体いるごとに、本カードの効果${n(values, 0)}（最大${n(values, 1)}体）。`,
  "normal.temp": ({ values }) => `1色職の賃金上昇率を${n(values, 1)}にする。`,
  "normal.emperor": ({ values }) => `チーム実績の計算後、サイズ最大のノーマル属性グルはサイズ${n(values, 0)}。その後、真下に完全に隠れたグルをすべて吸収。`,
  "normal.overlap": () => "暴食へ移行済み。",
  "attr.pure": ({ values }) => `${n(values, 0)}色グル全員：ボーナス${n(values, 1)}。`,
  "attr.dual": ({ values }) => `${n(values, 0)}色グル全員：ボーナス${n(values, 1)}。`,
  "attr.slash": ({ values }) => `${n(values, 0)}色グル全員：ボーナス${n(values, 1)}。`,
  "attr.balance": ({ values }) => `${n(values, 0)}色職が全種類そろうと、全員にボーナス${n(values, 1)}。`,
  "syn.permafrost": ({ values, level }) => `氷属性グルと草属性グルが連結すると、両者間のリンク1本につきボーナス${n(values, 0)}（最大${n(values, 1)}本）${level === 4 ? "。Lv.5では連結グループ全体を数える" : ""}。`,
  "staff.fire3": ({ values }) => `1回限り。グルを${n(values, 0)}体解雇し、雇用費を全額返金。塔は安全に崩れ、ストライキも退出費も発生しない。`,
  "staff.loan": ({ values }) => `今すぐKPIを${n(values, 0)}受け取る。以後${n(values, 2)}シフト、借入額の${n(values, 1)}ずつ返済（合計${n(values, 3)}）。`,
};

const ko = {
  "fire.wildfire": ({ values }) => `첫 점수 후 인접한 불 속성 Gulu를 최대 ${n(values, 0)}마리 점화. 각 Gulu의 작업 실적을 ${n(values, 1)}회 추가 계산.`,
  "normal.emperor": ({ values }) => `팀 실적 계산 후 크기가 가장 큰 일반 속성 Gulu의 크기 ${n(values, 0)}. 이어서 바로 아래에 완전히 가려진 모든 Gulu를 흡수.`,
  "normal.overlap": () => "폭식 효과로 전환됨.",
  "syn.permafrost": ({ values, level }) => `얼음 속성 Gulu와 풀 속성 Gulu가 연결되면 둘 사이 연결 1개당 보너스 ${n(values, 0)}(최대 ${n(values, 1)}개)${level === 4 ? ". Lv.5에서는 연결된 무리 전체를 계산" : ""}.`,
  "staff.fire3": ({ values }) => `1회용. Gulu ${n(values, 0)}마리를 해고하고 고용비를 전액 환불. 탑은 안전하게 무너지며 파업과 퇴사 비용이 없다.`,
  "staff.loan": ({ values }) => `즉시 KPI ${n(values, 0)}를 받는다. 이후 ${n(values, 2)}개 근무조 동안 대출금의 ${n(values, 1)}씩 상환(총 ${n(values, 3)}).`,
  "staff.severance": ({ values }) => `Gulu가 파업이나 해고로 떠나면 고용비의 ${n(values, 0)}를 환불.`,
};

const ru = {
  "water.convert": ({ values }) => `Водный Gulu после подсчёта: Ассимиляция для ${n(values, 0)} самых результативных эксплуатируемых Gulu, кроме водных.`,
  "normal.overlap": () => "Заменено эффектом «Обжорство».",
  "syn.bionet": ({ values, level }) => `Электрический Gulu: Созданный Gulu проводит его Цепь. Каждый подключённый Созданный Gulu даёт бонус ${n(values, 0)}, максимум ${n(values, 1)}${level === 4 ? "; на Lv.5 каждый считается за 2×" : ""}.`,
  "syn.short": ({ values }) => `Электрический Gulu — Цепь: Личная эффективность для каждого «Водный Gulu» с пометкой «Тот же вид» умножается на ${n(values, 0)}.`,
};

const uk = {
  "attr.pure": ({ values }) => `Усі ${n(values, 0)}-колірні Gulu отримують бонус ${n(values, 1)}.`,
  "attr.dual": ({ values }) => `Усі ${n(values, 0)}-колірні Gulu отримують бонус ${n(values, 1)}.`,
  "attr.slash": ({ values }) => `Усі ${n(values, 0)}-колірні Gulu отримують бонус ${n(values, 1)}.`,
};

const ar = {
  "fire.chain": ({ values }) => `عند نشر Gulu ناري، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "electric.overload": ({ values }) => `يحصل Gulu كهربائي على مكافأة ${n(values, 0)} لكل Gulu يتم استغلاله.`,
  "electric.wire": ({ values }) => `عند نشر Gulu كهربائي، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "electric.parallel": ({ values }) => `يحصل Gulu كهربائي على مكافأة ${n(values, 0)} لكل مكتب مرتبط بعد الأول.`,
  "ice.freezeprice": ({ values }) => `يتضاعف سعر توظيف كل Gulu جليدي بمقدار ${n(values, 0)}.`,
  "ice.overstaff": ({ values }) => `يحصل Gulu جليدي على مكافأة ${n(values, 0)} لكل Gulu مصنّف عمالة زائدة في الميدان.`,
  "ice.prism": ({ values }) => `عندما يكون Gulu جليدي على مكتب، يُحتسب ${n(values, 0)} مكتب مرتبط إضافي ويحصل على مكافأة ${n(values, 1)}.`,
  "ice.chain": ({ values }) => `عند نشر Gulu جليدي، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "water.convert": ({ values }) => `بعد تسجيل Gulu مائي، طبّق استيعاب على أعلى ${n(values, 0)} من وحدات Gulu المستغلة غير المائية.`,
  "water.chain": ({ values }) => `عند نشر Gulu مائي، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "grass.symbiosis": ({ values }) => `يحصل Gulu عشبي على مكافأة استغلال ${n(values, 0)} لكل جار غير عشبي.`,
  "grass.chain": ({ values }) => `عند نشر Gulu عشبي، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "normal.jack": ({ level }) => level >= 1
    ? "يمكن لـGulu عادي استخدام التصاق مع أي Gulu وتمرير مسار المكتب لأي عنصر."
    : "عند استخدام التصاق، يُعد Gulu عادي وكأنه يشترك في عنصر مع كل Gulu.",
  "normal.chain": ({ values }) => `عند نشر Gulu عادي، يزداد مدى الاستغلال بمقدار ${n(values, 0)}.`,
  "normal.absorb": ({ values }) => {
    const chance = n(values, 0);
    const targets = n(values, 1, "1");
    return `بعد التسجيل، توجد فرصة ${chance} لتطبيق امتصاص على أقرب ${targets} من Gulu. يفوز الأكبر في الحجم؛ وعند التعادل يفوز Gulu الذي سجّل.`;
  },
  "normal.gluttony": ({ values }) => `كل نقطة من الحجم فوق ${n(values, 0)} تمنح Gulu عادي مكافأة ${n(values, 1)}.`,
  "normal.emperor": ({ values }) => `بعد حساب أداء الفريق، يحصل أكبر Gulu عادي على ${n(values, 0)} الحجم، ثم يستخدم امتصاص على كل Gulu تحته بالكامل.`,
  "syn.arcIgnite": ({ values }) => `يحصل Gulu ناري المرتبط بمكتب كهربائي على مكافأة ${n(values, 0)} لكل مكتب مرتبط إضافي.`,
  "syn.thermalShock": ({ values }) => `لكل Gulu مجمّد يستغله Gulu ناري، أضف أداء العمل لذلك الهدف بمقدار ${n(values, 0)}.`,
  "syn.fireDispatch": ({ values }) => `عند جمع Gulu ناري مع Gulu عادي، تمنح كل نقطة من الحجم فوق ${n(values, 0)} مكافأة ${n(values, 1)}.`,
  "syn.superconduct": ({ values }) => `يحصل Gulu كهربائي على مكافأة ${n(values, 0)} لكل Gulu مجمّد يتم استغلاله.`,
  "syn.bionet": ({ values, level }) => `يمرّر Gulu مُنشأ الدائرة الخاصة بـGulu كهربائي. يمنح كل Gulu مُنشأ متصل مكافأة ${n(values, 0)}، بحد أقصى ${n(values, 1)}${level === 4 ? "؛ في Lv.5 يُحتسب كل واحد 2×" : ""}.`,
  "syn.multiSeed": ({ values }) => `يرث Gulu مُنشأ من Gulu عادي وGulu عشبي مقدار ${n(values, 0)} من الحجم لدى الأصل.`,
  "attr.hex": ({ values }) => `تحصل وحدات Gulu ذات ${n(values, 0)} ألوان على مكافأة ${n(values, 1)} لكل عنصر.`,
  "syn.short": ({ values }) => `في الدائرة الخاصة بـGulu كهربائي، يتضاعف أداء العمل لكل Gulu مائي من النوع نفسه بمقدار ${n(values, 0)}.`,
  "syn.greenhouse": ({ values, level }) => `عندما يستغل Gulu ناري وحدة Gulu عشبي، تزيد فرصة النمو بمقدار ${n(values, 0)}${level === 4 ? `؛ في Lv.5 تُنشأ ${n(values, 2, "2")} نسخ` : ""}.`,
  "syn.permafrost": ({ values, level }) => `عندما يستخدم Gulu جليدي وGulu عشبي التصاق، تمنح كل وصلة بينهما مكافأة ${n(values, 0)}، حتى ${n(values, 1)} وصلة${level === 4 ? "؛ في Lv.5 تُحسب المجموعة المتصلة كلها" : ""}.`,
  "syn.lightningrod": ({ values }) => `يمرّر Gulu عادي الدائرة الكهربائية. تمنح كل نقطة من الحجم على مساراته مكافأة ${n(values, 0)}.`,
  "staff.loan": ({ values }) => `احصل فورًا على ${n(values, 0)} KPI. سدّد ${n(values, 1)} من المبلغ المقترض لمدة ${n(values, 2)} ورديات عمل (الإجمالي ${n(values, 3)}).`,
};

export const REVIEWED_FACTORY_CARD_DESCRIPTION_RENDERERS = { ja, ko, ru, uk, ar };

export function applyReviewedFactoryCardDescriptions(locale, localizedCards, sourceCards) {
  const renderers = REVIEWED_FACTORY_CARD_DESCRIPTION_RENDERERS[locale];
  if (renderers == null || localizedCards == null) return;
  for (const [cardId, render] of Object.entries(renderers)) {
    const localized = localizedCards[cardId];
    const source = sourceCards[cardId];
    if (localized == null || source == null) continue;
    localized.descriptions = source.descriptions.map((description, level) => render({
      level,
      source: description,
      values: description.match(CARD_NUMBER_RE) ?? [],
    }));
  }
}
