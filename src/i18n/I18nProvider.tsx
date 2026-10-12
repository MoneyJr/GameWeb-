import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'ru' | 'de' | 'fr'
const LANGUAGES: Language[] = ['en', 'ru', 'de', 'fr']
const STORAGE_KEY = 'inkville-language'

type Row = [string, string, string, string, string]
const uiRows: Row[] = [
  ['category.roads', 'Roads', 'Дороги', 'Straßen', 'Routes'],
  ['category.utilities', 'Utilities', 'Сети', 'Netze', 'Réseaux'],
  ['category.residential', 'Residential', 'Жильё', 'Wohnen', 'Résidentiel'],
  ['category.commercial', 'Commercial', 'Коммерция', 'Gewerbe', 'Commerce'],
  ['category.industrial', 'Industry', 'Промзона', 'Industrie', 'Industrie'],
  ['category.services', 'Services', 'Службы', 'Dienste', 'Services'],
  ['category.parks', 'Parks', 'Парки', 'Parks', 'Parcs'],
  ['category.demolish', 'Demolish', 'Снос', 'Abriss', 'Démolir'],
  ['category.construction', 'Construction', 'Строительство', 'Bauen', 'Construction'],
  ['item.road', 'Asphalt road', 'Асфальтовая дорога', 'Asphaltstraße', 'Route asphaltée'],
  ['item.police', 'Police station', 'Полицейский участок', 'Polizeiwache', 'Commissariat'],
  ['item.demolish', 'Demolish object', 'Снести объект', 'Gebäude abreißen', 'Démolir le bâtiment'],
  ['hud.population', 'Population', 'Население', 'Einwohner', 'Population'],
  ['hud.budget', 'Budget and net income per tick', 'Бюджет и чистый доход за такт', 'Budget und Nettogewinn pro Takt', 'Budget et revenu net par cycle'],
  ['hud.energy', 'Energy: consumption {0}, production {1}', 'Энергия: потребление {0}, выработка {1}', 'Energie: Verbrauch {0}, Erzeugung {1}', 'Énergie : consommation {0}, production {1}'],
  ['hud.energyDeficit', 'Energy shortage!', 'Дефицит энергии!', 'Energiemangel!', 'Pénurie d’énergie !'],
  ['hud.water', 'Water: consumption {0}, supply {1}', 'Вода: потребление {0}, подача {1}', 'Wasser: Verbrauch {0}, Versorgung {1}', 'Eau : consommation {0}, approvisionnement {1}'],
  ['hud.happiness', 'Citizen happiness', 'Счастье жителей', 'Zufriedenheit', 'Bonheur des habitants'],
  ['hud.prestige', 'City prestige', 'Престиж города', 'Stadtprestige', 'Prestige de la ville'],
  ['hud.prestigeValue', 'Prestige: {0}', 'Престиж: {0}', 'Prestige: {0}', 'Prestige : {0}'],
  ['hud.fair', '🍷 Autumn Wine Festival', '🍷 Осенний винный фестиваль', '🍷 Herbstliches Weinfest', '🍷 Fête des vendanges'],
  ['hud.time', 'Time', 'Время', 'Zeit', 'Heure'],
  ['hud.day', 'Day {0}', 'День {0}', 'Tag {0}', 'Jour {0}'],
  ['hud.demands', 'Demand: homes {0}, shops {1}, industry {2}', 'Спрос: жильё {0}, торговля {1}, промышленность {2}', 'Nachfrage: Wohnen {0}, Handel {1}, Industrie {2}', 'Demande : logements {0}, commerces {1}, industrie {2}'],
  ['hud.crime', 'Crime: {0}% · Police capacity {1} · Fire capacity {2}', 'Преступность: {0}% · Полиция: {1} · Пожарные: {2}', 'Kriminalität: {0}% · Polizeikapazität {1} · Feuerwehrkapazität {2}', 'Criminalité : {0}% · capacité police {1} · pompiers {2}'],
  ['hud.pause', 'Pause', 'Пауза', 'Pause', 'Pause'],
  ['hud.resume', 'Resume', 'Продолжить', 'Fortsetzen', 'Reprendre'],
  ['hud.speed', 'Speed {0}x', 'Скорость {0}x', 'Geschwindigkeit {0}x', 'Vitesse {0}x'],
  ['ghost.available', 'Available to build', 'Доступно для постройки', 'Baubar', 'Disponible pour la construction'],
  ['ghost.occupied', 'Space is occupied', 'Место занято', 'Platz belegt', 'Emplacement occupé'],
  ['ghost.road', 'Road access required', 'Нужна дорога', 'Straßenanschluss erforderlich', 'Accès routier requis'],
  ['ghost.outOfBounds', 'Outside the map', 'За пределами карты', 'Außerhalb der Karte', 'Hors de la carte'],
  ['ghost.confirm', 'Build', 'Построить', 'Bauen', 'Construire'],
  ['ghost.cancel', 'Cancel build', 'Отменить постройку', 'Bau abbrechen', 'Annuler la construction'],
  ['ghost.noMoney', 'Not enough funds', 'Недостаточно средств', 'Nicht genügend Geld', 'Fonds insuffisants'],
  ['language.label', 'Language', 'Язык', 'Sprache', 'Langue'],
  ['title.tagline', 'A Hand-Drawn City Builder', 'Градостроительная игра, нарисованная тушью', 'Ein handgezeichneter Städtebau', 'Un jeu de construction dessiné à la main'],
  ['title.eyebrow', 'A city drawn by hand', 'Город, нарисованный вручную', 'Eine handgezeichnete Stadt', 'Une ville dessinée à la main'],
  ['title.footer', 'Inkville · Since the first brick', 'Inkville · С первого кирпича', 'Inkville · Seit dem ersten Stein', 'Inkville · Depuis la première brique'],
  ['title.newCity', 'New City', 'Новый город', 'Neue Stadt', 'Nouvelle ville'],
  ['title.continue', 'Continue', 'Продолжить', 'Fortsetzen', 'Continuer'],
  ['title.sandbox', 'Sandbox', 'Песочница', 'Sandbox', 'Bac à sable'],
  ['title.loading1', 'Sharpening pencils…', 'Затачиваем карандаши…', 'Bleistifte spitzen…', 'Taille des crayons…'],
  ['title.loading2', 'Laying cobblestones…', 'Укладываем брусчатку…', 'Pflastersteine verlegen…', 'Pose des pavés…'],
  ['title.loading3', 'Pouring the ink…', 'Заливаем чернила…', 'Tinte wird aufgetragen…', 'L’encre se répand…'],
  ['modal.cityHall', 'Town Hall', 'Мэрия', 'Rathaus', 'Hôtel de ville'],
  ['modal.taxAndTreasury', 'Taxes and city treasury', 'Налоги и городская казна', 'Steuern und Stadtkasse', 'Taxes et trésorerie municipale'],
  ['modal.taxRates', 'Tax rates', 'Налоговые ставки', 'Steuersätze', 'Taux d’imposition'],
  ['modal.residents', 'Residents', 'Жители', 'Einwohner', 'Habitants'],
  ['modal.trade', 'Commerce', 'Торговля', 'Handel', 'Commerce'],
  ['modal.factories', 'Industry', 'Заводы', 'Fabriken', 'Usines'],
  ['modal.close', 'Close', 'Закрыть', 'Schließen', 'Fermer'],
  ['modal.bank', 'City bank', 'Городской банк', 'Stadtbank', 'Banque municipale'],
  ['modal.repay', 'Repay early (${0})', 'Погасить досрочно (${0})', 'Vorzeitig zurückzahlen (${0})', 'Rembourser par anticipation (${0})'],
  ['modal.startLoan', 'Initial loan: $1,000 · Payment: $10/day', 'Стартовый заём: $1,000 · Выплата: $10/день', 'Startkredit: 1.000 $ · Rate: 10 $/Tag', 'Prêt initial : 1 000 $ · Remboursement : 10 $/jour'],
  ['modal.newLoan', 'Take a new $2,000 loan', 'Оформить новый заём $2,000', 'Neuen Kredit über 2.000 $ aufnehmen', 'Contracter un nouveau prêt de 2 000 $'],
  ['modal.water', 'Water supply', 'Водоснабжение', 'Wasserversorgung', 'Approvisionnement en eau'],
  ['modal.happiness', 'Happiness', 'Счастье', 'Zufriedenheit', 'Bonheur'],
  ['modal.netTick', 'Net income per 10 minutes', 'Чистый доход за 10 минут', 'Nettogewinn pro 10 Minuten', 'Revenu net par 10 minutes'],
]

const translations: Record<Language, Record<string, string>> = { en: {}, ru: {}, de: {}, fr: {} }
for (const [key, en, ru, de, fr] of uiRows) {
  translations.en[key] = en
  translations.ru[key] = ru
  translations.de[key] = de
  translations.fr[key] = fr
}

type BuildingRow = [string, string, string, string, string, string, string, string, string]
const buildingRows: BuildingRow[] = [
  ['res_cottage','Cozy cottage','Уютный коттедж','Gemütliches Landhaus','Cottage douillet','Small home with garden','Небольшой дом с садом','Kleines Haus mit Garten','Petite maison avec jardin'],
  ['res_townhouse','European townhouse','Европейский таунхаус','Europäisches Stadthaus','Maison de ville européenne','Timber-framed, two-storey home','Двухэтажный фахверковый дом','Zweistöckiges Fachwerkhaus','Maison à colombages à deux étages'],
  ['res_apartment','Apartment building','Доходный дом','Mietshaus','Immeuble résidentiel','Four-storey city residence','Четырёхэтажный городской дом','Vierstöckiges Stadthaus','Immeuble urbain de quatre étages'],
  ['res_panel_block','Panel apartment block','Панельный жилой блок','Plattenbau','Immeuble préfabriqué','Large residential block with balconies','Многоэтажный дом с балконами','Wohnblock mit Balkonen','Grand immeuble avec balcons'],
  ['res_modern_glass_tower','Glass tower','Стеклянная башня','Glasturm','Tour de verre','Park-side high-rise residence','Высотка у парка','Hochhaus am Park','Tour résidentielle près du parc'],
  ['res_half_timbered','Half-timbered house','Фахверковый дом','Fachwerkhaus','Maison à colombages','Cream plaster, timber frame and tile roof','Кремовая штукатурка, балки и черепица','Putz, Holzbalken und Ziegeldach','Enduit crème, poutres et tuiles'],
  ['res_cozy_estate','Cozy estate with garden','Уютная усадьба с садом','Gemütliches Anwesen mit Garten','Domaine chaleureux avec jardin','Stone cottage with fenced garden','Каменный коттедж с огороженным садом','Steinhaus mit umzäuntem Garten','Cottage en pierre avec jardin clos'],
  ['com_bakery','Bakery / Café','Пекарня / Кафе','Bäckerei / Café','Boulangerie / Café','Local café with striped awning','Кафе с полосатым навесом','Café mit gestreifter Markise','Café avec auvent rayé'],
  ['com_grocery','Corner grocer','Угловой гастроном','Eckladen','Épicerie de quartier','Neighbourhood shop with bright windows','Магазин с витринами','Laden mit großen Fenstern','Boutique aux vitrines lumineuses'],
  ['com_mall','Shopping centre','Торговый центр','Einkaufszentrum','Centre commercial','Large store with parking','Большой магазин с парковкой','Großes Geschäft mit Parkplatz','Grand magasin avec parking'],
  ['com_cinema_cosmos','Cosmos Cinema','Кинотеатр «Космос»','Kino Kosmos','Cinéma Cosmos','Cinema with colourful facade mosaic','Кинотеатр с цветной мозаикой','Kino mit farbigem Fassadenmosaik','Cinéma à mosaïque colorée'],
  ['com_wine_tavern','Wine tavern / Cellar','Винная таверна / Погребок','Weinstube / Weinkeller','Taverne à vin / Cave','Wine cellar tavern with casks and tables','Таверна с бочками и столиками','Weinstube mit Fässern und Tischen','Taverne avec tonneaux et tables'],
  ['com_market_hall','Covered farmers’ market','Крытый фермерский рынок','Überdachte Markthalle','Halle du marché couverte','Timber market hall with produce stalls','Рынок с деревянными фермами и прилавками','Markthalle mit Holzträgern und Ständen','Halle avec charpente et étals'],
  ['ind_workshop','Workshop','Мастерская / Цех','Werkstatt','Atelier','Small workshop with sawtooth roof','Цех с пилообразной крышей','Werkstatt mit Shed-Dach','Atelier au toit en dents de scie'],
  ['ind_factory','Brick manufactory','Кирпичная мануфактура','Ziegelmanufaktur','Manufacture de briques','Brick works with tall chimney','Кирпичный завод с высокой трубой','Ziegelwerk mit hohem Schornstein','Briqueterie avec haute cheminée'],
  ['ind_warehouse','Logistics warehouse','Логистический склад','Logistiklager','Entrepôt logistique','Freight warehouse with loading dock','Склад с погрузочной рампой','Lager mit Laderampe','Entrepôt avec quai de chargement'],
  ['ind_winery','Winery / Wine cellar','Винодельня / Винный погреб','Weingut / Weinkeller','Domaine viticole / Cave','Stone cellar, oak casks and a vineyard pickup','Каменный погреб, дубовые бочки и пикап','Steinkeller, Eichenfässer und Pickup','Cave en pierre, fûts de chêne et pick-up'],
  ['civ_fire','Fire station','Пожарное депо','Feuerwache','Caserne de pompiers','Fire service with red garage doors','Депо с красными воротами','Feuerwache mit roten Toren','Caserne aux portes rouges'],
  ['civ_school','School with sports court','Школа с кортом','Schule mit Sportplatz','École avec terrain de sport','School and outdoor playing court','Школа со спортивной площадкой','Schule mit Sportplatz','École et terrain de sport'],
  ['civ_hospital','City hospital','Городская больница','Stadtkrankenhaus','Hôpital municipal','Healthcare and happiness services','Медицина и поддержка счастья','Gesundheitsversorgung und Wohlbefinden','Soins et bien-être'],
  ['civ_stadium','Sports stadium','Спортивный стадион','Sportstadion','Stade sportif','Baseball field, stands and floodlights','Поле, трибуны и прожекторы','Spielfeld, Tribünen und Flutlicht','Terrain, gradins et projecteurs'],
  ['lnd_park','Fountain square','Сквер с фонтаном','Platz mit Brunnen','Square avec fontaine','Green square with fountain and benches','Зелёный сквер с фонтаном и лавочками','Grüner Platz mit Brunnen und Bänken','Square vert avec fontaine et bancs'],
  ['lnd_church','Old church','Церковь со шпилем','Alte Kirche','Église ancienne','Church with slate spire','Церковь со сланцевым шпилем','Kirche mit Schieferspitze','Église au clocher d’ardoise'],
  ['lnd_cathedral','White-stone cathedral','Белокаменный собор','Weißsteinkathedrale','Cathédrale de pierre blanche','Cathedral with colourful domes','Собор с цветными куполами','Kathedrale mit farbigen Kuppeln','Cathédrale aux dômes colorés'],
  ['park_rose_garden','Autumn rose garden','Осенний розарий и сквер','Herbstlicher Rosengarten','Roseraie d’automne','Hedge maze, gravel paths and white gazebo','Лабиринт из живых изгородей, дорожки и беседка','Heckenlabyrinth, Kieswege und Pavillon','Labyrinthe de haies, allées et kiosque'],
  ['lnd_townhall','Town Hall','Городская Ратуша','Rathaus','Hôtel de ville','Ochre sandstone arcade and copper clock tower','Охристая аркада и медная часовая башня','Ockerfarbene Arkaden und kupferner Uhrturm','Arcades ocre et tour d’horloge en cuivre'],
  ['utl_wind','Wind generator','Ветрогенератор','Windgenerator','Éolienne','Produces clean electricity','Вырабатывает электричество','Erzeugt Strom','Produit de l’électricité'],
  ['utl_solar','Solar station','Солнечная станция','Solarstation','Centrale solaire','Produces solar electricity','Вырабатывает солнечную энергию','Erzeugt Solarstrom','Produit de l’énergie solaire'],
  ['utl_water','Water tower','Водонапорная башня','Wasserturm','Château d’eau','Supplies the connected road network','Подаёт воду в связанную сеть','Versorgt das Straßennetz mit Wasser','Alimente le réseau routier en eau'],
  ['field_wheat','Wheat field','Пшеничное поле','Weizenfeld','Champ de blé','Golden crop with passive income','Золотистое поле с пассивным доходом','Goldenes Feld mit passivem Einkommen','Culture dorée à revenu passif'],
  ['field_plow','Ploughed field','Вспаханная пашня','Gepflügter Acker','Champ labouré','Dark earth with inked furrows','Тёмная земля с чернильными бороздами','Dunkle Erde mit Furchen','Terre sombre aux sillons dessinés'],
]
for (const [id, en, ru, de, fr, descEn, descRu, descDe, descFr] of buildingRows) {
  for (const [language, name, description] of [['en', en, descEn], ['ru', ru, descRu], ['de', de, descDe], ['fr', fr, descFr]] as const) {
    translations[language][`building.${id}`] = name
    translations[language][`description.${id}`] = description
  }
}

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, ...values: Array<string | number>) => string
}
const I18nContext = createContext<I18nContextValue | null>(null)

function initialLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.includes(value as Language) ? value as Language : 'ru'
  } catch { return 'ru' }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const setLanguage = (value: Language) => {
    setLanguageState(value)
    try { localStorage.setItem(STORAGE_KEY, value) } catch { /* Storage may be disabled. */ }
  }
  const t = (key: string, ...values: Array<string | number>) => {
    let message = translations[language][key] ?? translations.en[key] ?? key
    values.forEach((value, index) => { message = message.replace(`{${index}}`, String(value)) })
    return message
  }
  const context = useMemo(() => ({ language, setLanguage, t }), [language])
  return <I18nContext.Provider value={context}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
