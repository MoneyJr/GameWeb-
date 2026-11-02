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
  ['hud.crime', 'Crime: {0}% · Police coverage {1}% · Fire coverage {2}%', 'Преступность: {0}% · Покрытие полиции: {1}% · Пожарных: {2}%', 'Kriminalität: {0}% · Polizeiabdeckung {1}% · Feuerwehrabdeckung {2}%', 'Criminalité : {0}% · couverture police {1}% · pompiers {2}%'],
  ['hud.pause', 'Pause', 'Пауза', 'Pause', 'Pause'],
  ['hud.resume', 'Resume', 'Продолжить', 'Fortsetzen', 'Reprendre'],
  ['hud.speed', 'Speed {0}x', 'Скорость {0}x', 'Geschwindigkeit {0}x', 'Vitesse {0}x'],
  ['hud.materials', 'Materials', 'Материалы', 'Materialien', 'Matériaux'],
  ['ghost.available', 'Available to build', 'Доступно для постройки', 'Baubar', 'Disponible pour la construction'],
  ['ghost.occupied', 'Space is occupied', 'Место занято', 'Platz belegt', 'Emplacement occupé'],
  ['ghost.road', 'Road access required', 'Нужна дорога', 'Straßenanschluss erforderlich', 'Accès routier requis'],
  ['ghost.outOfBounds', 'Outside the map', 'За пределами карты', 'Außerhalb der Karte', 'Hors de la carte'],
  ['ghost.confirm', 'Build', 'Построить', 'Bauen', 'Construire'],
  ['ghost.cancel', 'Cancel build', 'Отменить постройку', 'Bau abbrechen', 'Annuler la construction'],
  ['ghost.rotate', 'Rotate 90° · R', 'Повернуть на 90° · R', '90° drehen · R', 'Tourner de 90° · R'],
  ['ghost.noMoney', 'Not enough funds', 'Недостаточно средств', 'Nicht genügend Geld', 'Fonds insuffisants'],
  ['ghost.material.concrete', 'Not enough concrete (Have: {0} / Need: {1})', 'Недостаточно бетона (Имеется: {0} / Требуется: {1})', 'Nicht genug Beton (Vorhanden: {0} / Benötigt: {1})', 'Béton insuffisant (Disponible : {0} / Requis : {1})'],
  ['ghost.material.bricks', 'Not enough bricks (Have: {0} / Need: {1})', 'Недостаточно кирпича (Имеется: {0} / Требуется: {1})', 'Nicht genug Ziegel (Vorhanden: {0} / Benötigt: {1})', 'Briques insuffisantes (Disponibles : {0} / Requises : {1})'],
  ['ghost.material.steel', 'Not enough steel (Have: {0} / Need: {1})', 'Недостаточно стали (Имеется: {0} / Требуется: {1})', 'Nicht genug Stahl (Vorhanden: {0} / Benötigt: {1})', 'Acier insuffisant (Disponible : {0} / Requis : {1})'],
  ['warehouse.title', 'Central Distribution Warehouse', 'Центральный распределительный склад', 'Zentrallager', 'Entrepôt central de distribution'],
  ['warehouse.bricks', 'Bricks', 'Кирпич', 'Ziegel', 'Briques'],
  ['warehouse.concrete', 'Concrete & glass', 'Бетон и стекло', 'Beton & Glas', 'Béton et verre'],
  ['warehouse.steel', 'Steel beams', 'Стальные балки', 'Stahlträger', 'Poutres en acier'],
  ['warehouse.expand', 'Expand warehouse · $500 (+50 each)', 'Расширить склад · $500 (+50 к каждому лимиту)', 'Lager erweitern · $500 (+50 je Material)', 'Agrandir l’entrepôt · $500 (+50 chacun)'],
  ['warehouse.close', 'Close', 'Закрыть', 'Schließen', 'Fermer'],
  ['warehouse.inflow', '+{0} / tick', '+{0} / такт', '+{0} / Takt', '+{0} / cycle'],
  ['warehouse.button', 'Warehouse', 'Склад', 'Lager', 'Dépôt'],
  ['warehouse.popoverTitle', 'City Building Materials Warehouse', 'Городской Склад Стройматериалов', 'Städtisches Baustofflager', 'Entrepôt municipal de matériaux'],
  ['warehouse.capacity', 'Storage capacity', 'Вместимость склада', 'Lagerkapazität', 'Capacité de stockage'],
  ['warehouse.upgrade', 'Upgrade warehouse', 'Улучшить склад (+50 к каждому лимиту)', 'Lager erweitern (+50 je Material)', 'Agrandir le dépôt (+50 chacun)'],
  ['hud.fairTooltip', 'Autumn Wine Festival (bakery & grocery income +20%, happiness +15)', 'Осенний винный фестиваль (доход пекарен и гастрономов +20%, счастье +15)', 'Herbstliches Weinfest (Bäckerei- & Lebensmitteleinnahmen +20 %, Zufriedenheit +15)', 'Fête des vendanges (revenus boulangeries et épiceries +20 %, bonheur +15)'],
  ['camera.rotateLeft', 'Rotate view left · Q', 'Повернуть влево · Q', 'Nach links drehen · Q', 'Tourner à gauche · Q'],
  ['camera.rotateRight', 'Rotate view right · E', 'Повернуть вправо · E', 'Nach rechts drehen · E', 'Tourner à droite · E'],
  ['overlay.title', 'Map layers', 'Слои карты', 'Kartenebenen', 'Calques'],
  ['overlay.off', 'Hide layer', 'Скрыть слой', 'Ebene ausblenden', 'Masquer le calque'],
  ['overlay.water', 'Water', 'Вода', 'Wasser', 'Eau'],
  ['overlay.power', 'Electricity', 'Электричество', 'Strom', 'Électricité'],
  ['overlay.smog', 'Pollution', 'Загрязнение', 'Verschmutzung', 'Pollution'],
  ['overlay.police', 'Police', 'Полиция', 'Polizei', 'Police'],
  ['overlay.fire', 'Fire safety', 'Пожарные', 'Feuerwehr', 'Pompiers'],
  ['overlay.education', 'Schools', 'Школы', 'Schulen', 'Écoles'],
  ['overlay.health', 'Hospitals', 'Больницы', 'Krankenhäuser', 'Hôpitaux'],
  ['overlay.landValue', 'Land value', 'Стоимость земли', 'Bodenwert', 'Valeur foncière'],
  ['overlay.legend.water', 'green connected, red no water', 'зелёный — есть, красный — нет', 'grün versorgt, rot ohne', 'vert raccordé, rouge sans eau'],
  ['overlay.legend.power', 'green connected, red no power', 'зелёный — есть, красный — нет', 'grün versorgt, rot ohne', 'vert raccordé, rouge sans courant'],
  ['overlay.legend.smog', 'brown smog, green clean air by parks', 'коричневый — смог, зелёный — парки', 'braun Smog, grün Parks', 'marron smog, vert parcs'],
  ['overlay.legend.police', 'coloured area covered, red unprotected', 'цвет — зона действия, красный — без защиты', 'farbig abgedeckt, rot ungeschützt', 'couleur couvert, rouge non protégé'],
  ['overlay.legend.fire', 'coloured area covered, red at risk', 'цвет — зона действия, красный — риск пожара', 'farbig abgedeckt, rot Brandgefahr', 'couleur couvert, rouge risque'],
  ['overlay.legend.education', 'coloured area covered, red no school', 'цвет — зона действия, красный — нет школы', 'farbig abgedeckt, rot ohne Schule', 'couleur couvert, rouge sans école'],
  ['overlay.legend.health', 'coloured area covered, red no hospital', 'цвет — зона действия, красный — нет больницы', 'farbig abgedeckt, rot ohne Klinik', 'couleur couvert, rouge sans hôpital'],
  ['overlay.legend.landValue', 'red cheap → green expensive', 'красный — дёшево, зелёный — дорого', 'rot günstig → grün teuer', 'rouge bon marché → vert cher'],
  ['finance.title', 'Budget per game day', 'Бюджет за игровой день', 'Budget pro Spieltag', 'Budget par jour de jeu'],
  ['finance.other', 'Fields & other', 'Поля и прочее', 'Felder & Sonstiges', 'Champs et autres'],
  ['finance.maintenance', 'Upkeep of services', 'Содержание служб', 'Unterhalt', 'Entretien des services'],
  ['finance.loan', 'Loan payment', 'Платёж по кредиту', 'Kreditrate', 'Remboursement du prêt'],
  ['finance.perDay', 'Net per day', 'Итого за день', 'Netto pro Tag', 'Net par jour'],
  ['finance.bankrupt', 'The treasury is empty! You cannot build, and residents are unhappy. Raise taxes or demolish loss-making buildings.', 'Казна пуста! Строить нельзя, жители недовольны. Поднимите налоги или снесите убыточные здания.', 'Die Kasse ist leer! Kein Bauen möglich, Bürger sind unzufrieden. Erhöhe Steuern oder reiße Verlustbringer ab.', 'Caisse vide ! Construction impossible, habitants mécontents. Augmentez les impôts ou démolissez.'],
  ['action.undo', 'Undo · Ctrl+Z', 'Отменить · Ctrl+Z', 'Rückgängig · Strg+Z', 'Annuler · Ctrl+Z'],
  ['settings.title', 'Settings', 'Настройки', 'Einstellungen', 'Paramètres'],
  ['settings.sound', 'Sound', 'Звук', 'Ton', 'Son'],
  ['settings.on', 'On', 'Вкл', 'An', 'Activé'],
  ['settings.off', 'Off', 'Выкл', 'Aus', 'Désactivé'],
  ['settings.music', 'Music', 'Музыка', 'Musik', 'Musique'],
  ['settings.effects', 'Effects', 'Эффекты', 'Effekte', 'Effets'],
  ['settings.graphics', 'Graphics quality', 'Качество графики', 'Grafikqualität', 'Qualité graphique'],
  ['settings.graphicsHint', 'Low turns off shadows — the best choice for older phones.', 'Низкое отключает тени — лучший выбор для старых телефонов.', 'Niedrig schaltet Schatten aus — ideal für ältere Handys.', 'Basse désactive les ombres — idéal pour les anciens téléphones.'],
  ['settings.quality.auto', 'Auto', 'Авто', 'Auto', 'Auto'],
  ['settings.quality.low', 'Low', 'Низкое', 'Niedrig', 'Basse'],
  ['settings.quality.medium', 'Medium', 'Среднее', 'Mittel', 'Moyenne'],
  ['settings.quality.high', 'High', 'Высокое', 'Hoch', 'Haute'],
  ['settings.install', 'Play like an app', 'Играть как в приложении', 'Wie eine App spielen', 'Jouer comme une appli'],
  ['settings.installed', 'Installed — Inkville runs full screen.', 'Установлено — Inkville открывается на весь экран.', 'Installiert — Inkville läuft im Vollbild.', 'Installé — Inkville s’ouvre en plein écran.'],
  ['settings.installButton', 'Install Inkville', 'Установить Inkville', 'Inkville installieren', 'Installer Inkville'],
  ['settings.installIos', 'Open the game in Safari, tap Share ⬆️ and choose “Add to Home Screen”. The game will open full screen, without browser bars.', 'Откройте игру в Safari, нажмите «Поделиться» ⬆️ и выберите «На экран „Домой“». Игра будет открываться на весь экран, без панелей браузера.', 'Öffne das Spiel in Safari, tippe auf Teilen ⬆️ und wähle „Zum Home-Bildschirm“.', 'Ouvrez le jeu dans Safari, touchez Partager ⬆️ puis « Sur l’écran d’accueil ».'],
  ['settings.installOther', 'Open the browser menu and choose “Install app” or “Add to Home screen”.', 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».', 'Öffne das Browsermenü und wähle „App installieren“.', 'Ouvrez le menu du navigateur et choisissez « Installer l’application ».'],
  ['photo.open', 'Photo mode', 'Фото-режим', 'Fotomodus', 'Mode photo'],
  ['photo.exit', 'Exit photo mode', 'Выйти из фото-режима', 'Fotomodus verlassen', 'Quitter le mode photo'],
  ['photo.shoot', 'Take photo', 'Сделать снимок', 'Foto aufnehmen', 'Prendre une photo'],
  ['photo.hint', 'Pick a view: drag, zoom and rotate ⟲⟳ — then press the shutter', 'Выберите ракурс: двигайте, приближайте и поворачивайте ⟲⟳ — затем нажмите затвор', 'Wähle einen Blickwinkel und drücke den Auslöser', 'Choisissez un angle puis appuyez sur le déclencheur'],
  ['photo.share', 'Share', 'Поделиться', 'Teilen', 'Partager'],
  ['photo.save', 'Save', 'Сохранить', 'Speichern', 'Enregistrer'],
  ['photo.again', 'Another one', 'Ещё снимок', 'Noch eins', 'Une autre'],
  ['photo.day', 'Day {0} · {1} residents', 'День {0} · жителей: {1}', 'Tag {0} · {1} Einwohner', 'Jour {0} · {1} habitants'],
  ['hud.winter', '❄️ Winter Holidays', '❄️ Зимние праздники', '❄️ Winterfest', '❄️ Fêtes d’hiver'],
  ['hud.winterTooltip', 'Winter Holidays: heating +25% energy use, shops & cafés +15% income, happiness +5', 'Зимние праздники: отопление +25% к расходу энергии, кафе и лавки +15% дохода, счастье +5', 'Winterfest: Heizung +25 % Energieverbrauch, Läden & Cafés +15 % Einnahmen, Zufriedenheit +5', 'Fêtes d’hiver : chauffage +25 % d’énergie, boutiques et cafés +15 % de revenus, bonheur +5'],
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
  ['title.handInk', 'A TOWN DRAWN IN INK', 'ГОРОД, НАРИСОВАННЫЙ ТУШЬЮ', 'EINE STADT IN TINTE GEZEICHNET', 'UNE VILLE DESSINÉE À L’ENCRE'],
  ['title.settings', 'Settings', 'Настройки', 'Einstellungen', 'Paramètres'],
  ['title.sound', 'Sound preference', 'Звук', 'Toneinstellung', 'Son'],
  ['title.soundNote', 'Sound preferences are saved for this device.', 'Настройка звука сохранена на этом устройстве.', 'Toneinstellung wird auf diesem Gerät gespeichert.', 'Le réglage du son est enregistré sur cet appareil.'],
  ['settings.close', 'Close settings', 'Закрыть настройки', 'Einstellungen schließen', 'Fermer les paramètres'],
  ['settings.audio', 'Audio and sound', 'Аудио и звук', 'Audio und Klang', 'Audio et son'],
  ['settings.master', 'Master volume', 'Общая громкость', 'Gesamtlautstärke', 'Volume général'],
  ['settings.sfx', 'Sound effects (SFX)', 'Звуки эффектов (SFX)', 'Soundeffekte (SFX)', 'Effets sonores (SFX)'],
  ['settings.mute', 'Mute music', 'Выключить музыку', 'Musik stummschalten', 'Couper la musique'],
  ['settings.unmute', 'Unmute music', 'Включить музыку', 'Musik einschalten', 'Réactiver la musique'],
  ['settings.account', 'Account / Mayor', 'Учётная запись / Мэр', 'Konto / Bürgermeister', 'Compte / Maire'],
  ['settings.mayor', 'Mayor name', 'Имя Мэра', 'Name des Bürgermeisters', 'Nom du maire'],
  ['settings.founded', 'Cities founded', 'Основано городов', 'Gegründete Städte', 'Villes fondées'],
  ['settings.playtime', 'Total play time', 'Общее время в игре', 'Gesamte Spielzeit', 'Temps de jeu total'],
  ['settings.hours', 'h', 'ч', 'Std.', 'h'],
  ['settings.reset', 'Switch profile / reset save', 'Сменить профиль / сбросить сохранение', 'Profil wechseln / Spielstand zurücksetzen', 'Changer de profil / réinitialiser la sauvegarde'],
  ['settings.confirm', 'Confirm reset', 'Подтвердить сброс', 'Zurücksetzen bestätigen', 'Confirmer la réinitialisation'],
  ['settings.saveClose', 'Save and close', 'Сохранить и закрыть', 'Speichern und schließen', 'Enregistrer et fermer'],
  ['title.resetProgress', 'Reset progress', 'Сбросить прогресс', 'Fortschritt zurücksetzen', 'Réinitialiser la progression'],
  ['title.resetConfirm', 'Delete this city save and start fresh?', 'Удалить сохранение города и начать заново?', 'Stadtspeicher löschen und neu beginnen?', 'Supprimer cette sauvegarde et recommencer ?'],
  ['title.cancel', 'Cancel', 'Отмена', 'Abbrechen', 'Annuler'],
  ['title.cityModal', 'Found a new settlement', 'Основание нового поселения', 'Eine neue Siedlung gründen', 'Fonder une nouvelle colonie'],
  ['title.cityName', 'City name', 'Название города', 'Stadtname', 'Nom de la ville'],
  ['title.mayorName', 'Mayor name', 'Имя мэра', 'Name des Bürgermeisters', 'Nom du maire'],
  ['title.cityPlaceholder', 'Autumn Vale, Oak Grove, Amber Falls…', 'Осенний Дол, Дубовая Роща, Медовый Холм…', 'Herbsttal, Eichengrund, Amber Falls…', 'Val d’Automne, Bois de Chêne, Amber Falls…'],
  ['title.mayorPlaceholder', 'Mayor', 'Мэр', 'Bürgermeister', 'Maire'],
  ['title.randomName', 'Random name', 'Случайное название', 'Zufälliger Name', 'Nom aléatoire'],
  ['title.startBuilding', 'Start building', 'Начать строительство', 'Mit dem Bau beginnen', 'Commencer à bâtir'],
  ['welcome.new1', 'Welcome to {0}, Mayor. The town is ready for its first street.', 'Добро пожаловать в город {0}, господин мэр. Жители ждут первую улицу.', 'Willkommen in {0}, Bürgermeister. Die Stadt wartet auf ihre erste Straße.', 'Bienvenue à {0}, Monsieur le Maire. La ville attend sa première rue.'],
  ['welcome.new2', 'A fresh page for {0}. What shall we build first?', 'Новая страница для города {0}. Что построим первым?', 'Ein neues Kapitel für {0}. Was bauen wir zuerst?', 'Une nouvelle page pour {0}. Que bâtirons-nous en premier ?'],
  ['welcome.back1', 'Welcome back, Mayor! The weather is lovely in {0} today.', 'С возвращением, господин мэр! Сегодня в городе {0} отличная погода.', 'Willkommen zurück, Bürgermeister! Heute ist das Wetter in {0} herrlich.', 'Heureux de vous revoir, Monsieur le Maire ! Il fait beau à {0} aujourd’hui.'],
  ['welcome.back2', 'The Mayor is back! Residents are gathering in the square at {0}.', 'Мэр вернулся! Жители города {0} уже собираются на площади.', 'Der Bürgermeister ist zurück! Die Bewohner von {0} versammeln sich auf dem Platz.', 'Le maire est de retour ! Les habitants de {0} se retrouvent sur la place.'],
  ['welcome.back3', 'Good to see you again in {0}. The treasury is ready for a new district.', 'Рады видеть вас снова в городе {0}! Казна готова к новому кварталу.', 'Schön, Sie wieder in {0} zu sehen. Die Stadtkasse ist bereit für ein neues Viertel.', 'Ravi de vous revoir à {0}. Le trésor est prêt pour un nouveau quartier.'],
  ['modal.cityHall', 'Town Hall', 'Мэрия', 'Rathaus', 'Hôtel de ville'],
  ['modal.taxAndTreasury', 'Taxes and city treasury', 'Налоги и городская казна', 'Steuern und Stadtkasse', 'Taxes et trésorerie municipale'],
  ['modal.taxRates', 'Tax rates', 'Налоговые ставки', 'Steuersätze', 'Taux d’imposition'],
  ['modal.residents', 'Residents', 'Жители', 'Einwohner', 'Habitants'],
  ['modal.trade', 'Commerce', 'Торговля', 'Handel', 'Commerce'],
  ['modal.factories', 'Industry', 'Заводы', 'Fabriken', 'Usines'],
  ['modal.close', 'Close', 'Закрыть', 'Schließen', 'Fermer'],
  ['modal.bank', 'City bank', 'Городской банк', 'Stadtbank', 'Banque municipale'],
  ['modal.repay', 'Repay early (${0})', 'Погасить досрочно (${0})', 'Vorzeitig zurückzahlen (${0})', 'Rembourser par anticipation (${0})'],
  ['modal.startLoan', 'Initial loan: $1,000 · Payment: $50/day', 'Стартовый заём: $1,000 · Выплата: $50/день', 'Startkredit: 1.000 $ · Rate: 10 $/Tag', 'Prêt initial : 1 000 $ · Remboursement : 10 $/jour'],
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
  ['res_megapolis_complex','Megapolis tower complex','Мега-комплекс «Мегаполис»','Megapolis-Turmkomplex','Complexe de tours Megapolis','Three linked glass towers above a marked parking court','Три соединённые стеклянные башни над размеченной парковкой','Drei verbundene Glastürme über einem markierten Parkplatz','Trois tours de verre reliées au-dessus d’un parking'],
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
  ['ind_brickworks','Brickworks','Кирпичный завод','Ziegelwerk','Briqueterie','Dark brick kiln, stepped chimney and yard pallets','Тёмная кирпичная печь, ступенчатая труба и штабели кирпича','Dunkler Ziegelofen, gestufter Schornstein und Paletten','Four à briques sombre, cheminée étagée et palettes'],
  ['ind_concrete_plant','Concrete plant','Бетонный комбинат','Betonwerk','Centrale à béton','Twin silos, sloped conveyor and mixer truck','Два силоса, наклонный конвейер и бетономешалка','Zwei Silos, Förderband und Betonmischer','Deux silos, convoyeur incliné et bétonnière'],
  ['ind_steel_foundry','Steel foundry','Стальной литейный цех','Stahlgießerei','Fonderie d’acier','Sawtooth foundry with a warm furnace glow','Литейный цех с пилообразной крышей и жаром печи','Gießerei mit Shed-Dach und warmem Ofenschein','Fonderie à sheds avec lueur chaude du four'],
  ['civ_fire','Fire station','Пожарное депо','Feuerwache','Caserne de pompiers','Fire service with red garage doors','Депо с красными воротами','Feuerwache mit roten Toren','Caserne aux portes rouges'],
  ['civ_school','School with sports court','Школа с кортом','Schule mit Sportplatz','École avec terrain de sport','School and outdoor playing court','Школа со спортивной площадкой','Schule mit Sportplatz','École et terrain de sport'],
  ['civ_hospital','City hospital','Городская больница','Stadtkrankenhaus','Hôpital municipal','Healthcare and happiness services','Медицина и поддержка счастья','Gesundheitsversorgung und Wohlbefinden','Soins et bien-être'],
  ['civ_stadium','Sports stadium','Спортивный стадион','Sportstadion','Stade sportif','Baseball field, stands and floodlights','Поле, трибуны и прожекторы','Spielfeld, Tribünen und Flutlicht','Terrain, gradins et projecteurs'],
  ['lnd_park','Fountain square','Сквер с фонтаном','Platz mit Brunnen','Square avec fontaine','Green square with fountain and benches','Зелёный сквер с фонтаном и лавочками','Grüner Platz mit Brunnen und Bänken','Square vert avec fontaine et bancs'],
  ['lnd_church','Old church','Церковь со шпилем','Alte Kirche','Église ancienne','Church with slate spire','Церковь со сланцевым шпилем','Kirche mit Schieferspitze','Église au clocher d’ardoise'],
  ['lnd_cathedral','White-stone cathedral','Белокаменный собор','Weißsteinkathedrale','Cathédrale de pierre blanche','Cathedral with colourful domes','Собор с цветными куполами','Kathedrale mit farbigen Kuppeln','Cathédrale aux dômes colorés'],
  ['res_brick_loft','Brick loft','Кирпичный лофт','Backstein-Loft','Loft en brique','Fire escape, water tank and rooftop pergola','Пожарная лестница, бак для воды и пергола на крыше','Feuertreppe, Wassertank, Dachpergola','Escalier de secours, réservoir, pergola'],
  ['res_modern_block','Modern apartment block','Современный жилой дом','Modernes Wohnhaus','Immeuble moderne','Bright facade, balconies and solar roof','Светлый фасад, балконы, солнечные панели','Helle Fassade, Balkone, Solardach','Façade claire, balcons, toit solaire'],
  ['com_office_tower','Office tower','Офисная башня','Büroturm','Tour de bureaux','Glass tower on a shopping podium','Стеклянная башня на торговом подиуме','Glasturm auf Ladensockel','Tour vitrée sur socle commercial'],
  ['com_glass_skyscraper','Glass skyscraper','Стеклянный небоскрёб','Glaswolkenkratzer','Gratte-ciel de verre','The skyline landmark of a metropolis','Символ мегаполиса на горизонте','Wahrzeichen der Skyline','Emblème de la métropole'],
  ['park_plaza','Stone plaza','Площадь с брусчаткой','Gepflasterter Platz','Place pavée','Flagstones, benches and potted trees','Брусчатка, скамейки и деревья в кадках','Pflaster, Bänke, Kübelbäume','Pavés, bancs, arbres en bac'],
  ['park_town_square','Town square','Городская площадь с беседкой','Stadtplatz','Place de la ville','Gazebo, lawns and lanterns','Беседка, газоны и фонари','Pavillon, Rasen, Laternen','Kiosque, pelouses, lanternes'],
  ['lnd_parking','Parking lot','Парковка','Parkplatz','Parking','Marked bays for cars, small fee income','Размеченные места, небольшой доход','Markierte Stellplätze, kleine Einnahmen','Places marquées, petit revenu'],
  ['civ_university','University','Университет','Universität','Université','Campus with clock tower; education for the whole city','Кампус с часовой башней; образование почти для всего города','Campus mit Uhrturm; Bildung für die Stadt','Campus avec tour; éducation pour la ville'],
  ['park_winter_tree','City Christmas tree','Главная городская ёлка','Städtischer Weihnachtsbaum','Sapin de Noël de la ville','Winter only · lights twinkle at night','Только зимой · ночью мерцают гирлянды','Nur im Winter · nachts funkeln Lichter','Seulement en hiver · guirlandes la nuit'],
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
