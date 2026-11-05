import {
  Box,
  Cone,
  Cylinder,
  Dome,
  MergedParts,
  ROAD_ASPHALT_WIDTH,
  ROAD_CURB_OFFSET,
  ROAD_CURB_WIDTH,
  Window,
  cinemaSignMaterial,
  getFacadeMaterial,
  getFlagstoneMaterial,
  getGlassMaterial,
  getPaverMaterial,
  hash01,
  nightSignMaterial,
  townHallClockMaterial,
  type PartSpec,
  type Vec3,
} from './primitives'
import { BlobTree } from './ModernMeshes'

/* -------------------------------------------------------------------------- */
/*  Водоёмы, мосты и железные дороги в рисованном стиле CityRT                */
/* -------------------------------------------------------------------------- */

const WATER_COLOR_DEEP = '#5a9ec8'
const BANK_EARTH = '#b8aa90'
const BANK_GRASS = '#7ea35a'

export interface TileNeighborFlags {
  north?: boolean
  south?: boolean
  east?: boolean
  west?: boolean
}

/**
 * Клетка реки / водоёма (TileType.WATER):
 * чистая рисованная голубая гладь в стиле CityRT с аккуратной береговой кромкой на границе с сушей.
 */
export function WaterTileMesh({
  north = false,
  south = false,
  east = false,
  west = false,
  variant = 0,
}: TileNeighborFlags & { variant?: number }) {
  const seed = hash01(variant * 19.3 + (north ? 1 : 0) * 3 + (east ? 1 : 0) * 7)
  const hasBorderLand = !north || !south || !east || !west

  return (
    <group>
      {/* Единая бесшовная водная гладь */}
      <Box
        size={[1.01, 0.034, 1.01]}
        position={[0, 0.014, 0]}
        color={WATER_COLOR_DEEP}
        outline={false}
        castShadow={false}
      />

      {/* Аккуратная береговая кромка только там, где вода граничит с сушей */}
      {!north && (
        <group>
          <Box size={[1.01, 0.044, 0.065]} position={[0, 0.022, -0.47]} color={BANK_EARTH} />
          <Box size={[1.01, 0.018, 0.04]} position={[0, 0.046, -0.482]} color={BANK_GRASS} outline={false} />
        </group>
      )}
      {!south && (
        <group>
          <Box size={[1.01, 0.044, 0.065]} position={[0, 0.022, 0.47]} color={BANK_EARTH} />
          <Box size={[1.01, 0.018, 0.04]} position={[0, 0.046, 0.482]} color={BANK_GRASS} outline={false} />
        </group>
      )}
      {!east && (
        <group>
          <Box size={[0.065, 0.044, 1.01]} position={[0.47, 0.022, 0]} color={BANK_EARTH} />
          <Box size={[0.04, 0.018, 1.01]} position={[0.482, 0.046, 0]} color={BANK_GRASS} outline={false} />
        </group>
      )}
      {!west && (
        <group>
          <Box size={[0.065, 0.044, 1.01]} position={[-0.47, 0.022, 0]} color={BANK_EARTH} />
          <Box size={[0.04, 0.018, 1.01]} position={[-0.482, 0.046, 0]} color={BANK_GRASS} outline={false} />
        </group>
      )}

      {/* Редкие прибрежные валуны у кромки берега */}
      {hasBorderLand && seed > 0.72 && (
        <group position={[!west ? -0.37 : !east ? 0.37 : 0.26, 0.026, !north ? -0.37 : !south ? 0.37 : -0.26]}>
          <Cylinder radius={0.04} radiusTop={0.028} height={0.04} segments={6} position={[0, 0.018, 0]} color="#8f887c" />
        </group>
      )}
    </group>
  )
}

/**
 * Автодорожный мост через воду (TileType.BRIDGE):
 * 'bridge_stone' — каменный арочный мост с фонарями;
 * 'bridge_suspension' — ярко-красный вантовый/подвесной мост как на референсе CityRT (#2).
 */
export function BridgeTileMesh({
  catalogId = 'bridge_stone',
  north = false,
  south = false,
  east = false,
  west = false,
}: TileNeighborFlags & { catalogId?: string }) {
  const alongZ = (north || south) && !(east || west)
  const alongX = (east || west) && !(north || south)
  const orientZ = alongZ || (!alongX && (north || south || (!east && !west)))
  const rotationY = orientZ ? 0 : Math.PI / 2
  const isSuspension = catalogId === 'bridge_suspension'

  return (
    <group>
      {/* Вода под мостом */}
      <Box
        size={[1.01, 0.034, 1.01]}
        position={[0, 0.014, 0]}
        color={WATER_COLOR_DEEP}
        outline={false}
        castShadow={false}
      />

      <group rotation={[0, rotationY, 0]}>
        {/* Каменные опоры в воде */}
        <Box size={[ROAD_ASPHALT_WIDTH + 0.18, 0.16, 0.16]} position={[0, 0.08, -0.36]} color="#9d9689" />
        <Box size={[ROAD_ASPHALT_WIDTH + 0.18, 0.16, 0.16]} position={[0, 0.08, 0.36]} color="#9d9689" />

        {/* Пролёт моста и асфальтовое полотно */}
        <Box
          size={[ROAD_ASPHALT_WIDTH + 0.18, 0.07, 1.01]}
          position={[0, 0.16, 0]}
          color={isSuspension ? '#b83c32' : '#cfc7b6'}
        />
        <Box
          size={[ROAD_ASPHALT_WIDTH, 0.025, 1.01]}
          position={[0, 0.2, 0]}
          color="#464a4f"
          outline={false}
        />

        {/* Разметка полос */}
        {[-0.32, 0, 0.32].map((z) => (
          <Box
            key={z}
            size={[0.026, 0.005, 0.16]}
            position={[0, 0.215, z]}
            color="#f5ecd4"
            outline={false}
            castShadow={false}
          />
        ))}

        {/* Бордюры и парапеты по бокам */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * ROAD_CURB_OFFSET, 0, 0]}>
            <Box
              size={[ROAD_CURB_WIDTH, 0.09, 1.01]}
              position={[0, 0.23, 0]}
              color={isSuspension ? '#c93b2f' : '#d8d0bf'}
            />
            {/* Стойки перил */}
            {[-0.4, -0.14, 0.14, 0.4].map((z) => (
              <Box
                key={z}
                size={[0.045, 0.08, 0.045]}
                position={[0, 0.29, z]}
                color={isSuspension ? '#a52d23' : '#b7ae9c'}
              />
            ))}
          </group>
        ))}

        {/* Красный подвесной пилон и ванты (референс #2 CityRT) */}
        {isSuspension && (
          <group>
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.41, 0, 0]}>
                <Box size={[0.08, 1.28, 0.1]} position={[0, 0.82, 0]} color="#c9362b" />
                {/* Диагональные ванты к полотну */}
                <Box
                  size={[0.022, 0.68, 0.022]}
                  position={[0, 0.56, -0.22]}
                  rotation={[0.52, 0, 0]}
                  color="#9e2820"
                />
                <Box
                  size={[0.022, 0.68, 0.022]}
                  position={[0, 0.56, 0.22]}
                  rotation={[-0.52, 0, 0]}
                  color="#9e2820"
                />
                <Box
                  size={[0.02, 0.54, 0.02]}
                  position={[0, 0.48, -0.34]}
                  rotation={[0.72, 0, 0]}
                  color="#b8342a"
                />
                <Box
                  size={[0.02, 0.54, 0.02]}
                  position={[0, 0.48, 0.34]}
                  rotation={[-0.72, 0, 0]}
                  color="#b8342a"
                />
              </group>
            ))}
            {/* Поперечные балки красного пилона */}
            <Box size={[0.88, 0.07, 0.08]} position={[0, 1.05, 0]} color="#c9362b" />
            <Box size={[0.88, 0.07, 0.08]} position={[0, 1.38, 0]} color="#c9362b" />
          </group>
        )}
      </group>
    </group>
  )
}

/**
 * Железнодорожный путь (TileType.RAIL) и железнодорожный мост (TileType.RAIL_BRIDGE):
 * гравийная насыпь, деревянные шпалы и стальные рельсы, соединяющиеся с соседними клетками.
 */
export function RailTileMesh({
  north = false,
  south = false,
  east = false,
  west = false,
  isBridge = false,
}: TileNeighborFlags & { isBridge?: boolean }) {
  const hasNS = north || south || (!east && !west)
  const hasEW = east || west
  const railGauge = 0.13
  const baseY = isBridge ? 0.16 : 0.02

  return (
    <group>
      {isBridge && (
        <group>
          <Box
            size={[1.005, 0.036, 1.005]}
            position={[0, 0.014, 0]}
            color={WATER_COLOR_DEEP}
            outline={false}
            castShadow={false}
          />
          <Box size={[0.64, 0.13, 0.16]} position={[0, 0.075, -0.35]} color="#8b867c" />
          <Box size={[0.64, 0.13, 0.16]} position={[0, 0.075, 0.35]} color="#8b867c" />
          <Box size={[0.62, 0.06, 1.01]} position={[0, 0.13, 0]} color="#556068" />
          {/* Стальные фермы ж/д моста */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.28, 0.26, 0]}>
              <Box size={[0.035, 0.22, 1.0]} position={[0, 0, 0]} color="#4a555d" />
              <Box size={[0.04, 0.04, 1.0]} position={[0, 0.11, 0]} color="#3a434a" />
            </group>
          ))}
        </group>
      )}

      {/* Ветка Север-Юг */}
      {hasNS && (
        <group position={[0, baseY, 0]}>
          {!isBridge && (
            <Box size={[0.52, 0.035, 1.01]} position={[0, 0.015, 0]} color="#8e877d" outline={false} />
          )}
          {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((z) => (
            <Box key={z} size={[0.42, 0.024, 0.065]} position={[0, 0.038, z]} color="#5c422c" />
          ))}
          {[-railGauge, railGauge].map((x) => (
            <Box key={x} size={[0.032, 0.032, 1.01]} position={[x, 0.058, 0]} color="#b8c0c7" />
          ))}
        </group>
      )}

      {/* Ветка Запад-Восток */}
      {hasEW && (
        <group position={[0, baseY, 0]}>
          {!isBridge && (
            <Box size={[1.01, 0.035, 0.52]} position={[0, 0.015, 0]} color="#8e877d" outline={false} />
          )}
          {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((x) => (
            <Box key={x} size={[0.065, 0.024, 0.42]} position={[x, 0.038, 0]} color="#5c422c" />
          ))}
          {[-railGauge, railGauge].map((z) => (
            <Box key={z} size={[1.01, 0.032, 0.032]} position={[0, 0.058, z]} color="#b8c0c7" />
          ))}
        </group>
      )}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Жилая архитектура CityRT (референсы 1–4)                                  */
/* -------------------------------------------------------------------------- */

/**
 * 1×1 Белая вилла с терракотовой крышей и полукруглым зимним садом (референс #2, правый нижний угол).
 */
export function VillaConservatoryMesh() {
  const facade = getFacadeMaterial({
    wall: '#f1ede4',
    glass: '#72a7c4',
    spacing: [0.22, 0.28],
    frame: [0.22, 0.24],
  })
  const greenhouseGlass = getGlassMaterial('#8cd3e8', true)

  return (
    <group>
      <Box size={[0.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#d7d1c4" />
      {/* Основной двухэтажный корпус */}
      <Box size={[0.64, 0.62, 0.62]} position={[-0.1, 0.37, -0.08]} color="#f1ede4" material={facade} />
      {/* Парапет и карниз */}
      <Box size={[0.68, 0.05, 0.66]} position={[-0.1, 0.7, -0.08]} color="#dfdbd0" />
      {/* Надстройка и терракотовый скат крыши */}
      <Box size={[0.26, 0.18, 0.26]} position={[-0.08, 0.81, -0.06]} color="#ebe6dc" />
      <Cone
        radius={0.32}
        height={0.22}
        segments={4}
        position={[-0.22, 0.82, -0.18]}
        rotation={[0, Math.PI / 4, 0]}
        color="#d15338"
      />
      {/* Полукруглый стеклянный зимний сад (оранжерея) справа спереди */}
      <Box size={[0.38, 0.24, 0.46]} position={[0.22, 0.18, 0.14]} color="#e6e1d6" />
      <Cylinder
        radius={0.18}
        height={0.44}
        segments={12}
        position={[0.22, 0.3, 0.14]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#8cd3e8"
        material={greenhouseGlass}
      />
      <BlobTree position={[-0.36, 0.06, 0.34]} scale={0.55} color="#6da653" />
    </group>
  )
}

/**
 * 1×1 5-этажный светло-бежевый дом с вертикальным рядом балконов по центру фасада (референс #2, передний план).
 */
export function BalconyBlockMesh() {
  const facade = getFacadeMaterial({
    wall: '#ebe5d9',
    glass: '#6b9ab5',
    spacing: [0.18, 0.26],
    frame: [0.22, 0.24],
  })
  const h = 1.42

  return (
    <group>
      <Box size={[0.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#cbc6ba" />
      <Box size={[0.72, h, 0.68]} position={[0, 0.06 + h / 2, -0.04]} color="#ebe5d9" material={facade} />
      <Box size={[0.76, 0.05, 0.72]} position={[0, 0.06 + h + 0.025, -0.04]} color="#d5cfc2" />
      {/* Надстройка лифтовой шахты на плоской крыше */}
      <Box size={[0.24, 0.16, 0.22]} position={[0, 0.06 + h + 0.12, -0.06]} color="#dfd9cc" />
      {/* Вертикальный ряд тёмных балкончиков по центру главного фасада */}
      {[0, 1, 2, 3, 4].map((floor) => (
        <group key={floor} position={[0, 0.26 + floor * 0.26, 0.33]}>
          <Box size={[0.2, 0.03, 0.09]} position={[0, 0, 0]} color="#c7bfb0" />
          <Box size={[0.2, 0.07, 0.02]} position={[0, 0.045, 0.035]} color="#4d4843" />
        </group>
      ))}
      <BlobTree position={[-0.38, 0.06, 0.36]} scale={0.55} color="#6ca352" />
      <BlobTree position={[0.38, 0.06, 0.36]} scale={0.5} color="#7cb35e" />
    </group>
  )
}

/**
 * 2×1 4-этажный дом из красного кирпича с белым карнизом, пожарными лестницами и солнечными батареями (референс #3, передний план).
 */
export function BrickWalkupMesh() {
  const brickFacade = getFacadeMaterial({
    wall: '#bf563b',
    glass: '#5c87a3',
    spacing: [0.22, 0.28],
    frame: [0.22, 0.24],
  })
  const h = 1.24

  return (
    <group>
      <Box size={[1.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#c9c4b8" />
      {/* Основной кирпичный корпус и боковое крыло */}
      <Box size={[1.76, h, 0.68]} position={[0, 0.06 + h / 2, 0.04]} color="#bf563b" material={brickFacade} />
      <Box size={[0.64, h + 0.24, 0.78]} position={[0.56, 0.06 + (h + 0.24) / 2, -0.04]} color="#b44d33" material={brickFacade} />
      {/* Белый карниз и плоская серая кровля */}
      <Box size={[1.82, 0.06, 0.74]} position={[0, 0.06 + h + 0.03, 0.04]} color="#ece7dc" />
      <Box size={[0.7, 0.06, 0.84]} position={[0.56, 0.06 + h + 0.27, -0.04]} color="#ece7dc" />
      <Box size={[1.7, 0.02, 0.62]} position={[0, 0.06 + h + 0.065, 0.04]} color="#7a7e82" />
      {/* Солнечные панели на крыше как на референсе #3 */}
      {[-0.55, -0.25, 0.05].map((x) => (
        <Box
          key={x}
          size={[0.22, 0.025, 0.34]}
          position={[x, 0.06 + h + 0.09, 0.04]}
          rotation={[-0.2, 0, 0]}
          color="#35557a"
        />
      ))}
      {/* Три металлические наружные лестницы/балконные секции на переднем фасаде */}
      {[-0.56, -0.06, 0.48].map((x) => (
        <group key={x} position={[x, 0, 0.42]}>
          <Box size={[0.28, h - 0.06, 0.1]} position={[0, 0.06 + (h - 0.06) / 2, 0]} color="#53585e" />
          <Box size={[0.32, 0.04, 0.14]} position={[0, 0.06 + h - 0.04, 0]} color="#3f444a" />
        </group>
      ))}
    </group>
  )
}

/**
 * 2×2 Розовый угловой сталинский дом с аркой и угловой башенкой со шпилем (референс #1 и #2).
 */
export function StalinkaPinkMesh() {
  const pinkFacade = getFacadeMaterial({
    wall: '#efc0c0',
    glass: '#6f9eb8',
    spacing: [0.22, 0.28],
    frame: [0.24, 0.25],
  })
  const h = 1.65

  return (
    <group>
      {/* Озеленённый двор с деревьями */}
      <Box size={[1.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#c9c5ba" />
      <Box size={[1.1, 0.025, 1.1]} position={[0.32, 0.065, 0.32]} color="#88b462" outline={false} />

      {/* Г-образный розовый корпус */}
      <Box size={[1.68, h, 0.68]} position={[0, 0.06 + h / 2, -0.46]} color="#efc0c0" material={pinkFacade} />
      <Box size={[0.68, h, 1.56]} position={[-0.5, 0.06 + h / 2, 0.02]} color="#efc0c0" material={pinkFacade} />

      {/* Коричнево-бордовая крыша и парапет */}
      <Box size={[1.74, 0.06, 0.74]} position={[0, 0.06 + h + 0.03, -0.46]} color="#f7dede" />
      <Box size={[0.74, 0.06, 1.62]} position={[-0.5, 0.06 + h + 0.03, 0.02]} color="#f7dede" />
      <Box size={[1.62, 0.08, 0.6]} position={[0, 0.06 + h + 0.09, -0.46]} color="#8e4e49" />
      <Box size={[0.6, 0.08, 1.5]} position={[-0.5, 0.06 + h + 0.09, 0.02]} color="#8e4e49" />

      {/* Угловая башня со шпилем */}
      <Box size={[0.48, 0.52, 0.48]} position={[-0.48, 0.06 + h + 0.32, -0.46]} color="#f3caca" />
      <Cylinder
        radius={0.18}
        height={0.28}
        segments={8}
        position={[-0.48, 0.06 + h + 0.72, -0.46]}
        color="#f7dede"
      />
      <Cone
        radius={0.2}
        height={0.46}
        segments={8}
        position={[-0.48, 0.06 + h + 1.08, -0.46]}
        color="#7c3f3a"
      />
      <Cylinder
        radius={0.015}
        radiusTop={0.004}
        height={0.34}
        segments={6}
        position={[-0.48, 0.06 + h + 1.46, -0.46]}
        color="#d9b45b"
      />

      {/* Парадная арка и розовые зонтики во дворе */}
      <Box size={[0.24, 0.34, 0.72]} position={[-0.5, 0.23, 0.38]} color="#544442" />
      <Cone radius={0.12} height={0.07} segments={8} position={[0.18, 0.16, 0.48]} color="#e65c7b" />
      <BlobTree position={[0.48, 0.06, 0.52]} scale={0.72} color="#74ac56" />
      <BlobTree position={[0.12, 0.06, 0.72]} scale={0.62} color="#82b862" />
      <BlobTree position={[0.68, 0.06, 0.12]} scale={0.58} color="#639947" />
    </group>
  )
}

/**
 * 2×2 Белый дом-«лайнер» со скруглённым фасадом, красной линией под крышей, баками и телескопами (референс #1 и #2).
 */
export function StreamlineCurveMesh() {
  const facade = getFacadeMaterial({
    wall: '#f2f4f7',
    glass: '#6999b5',
    spacing: [0.18, 0.24],
    frame: [0.18, 0.28],
  })
  const h = 2.35

  return (
    <group>
      <Box size={[1.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#c9c7be" />
      <Box size={[1.86, 0.025, 0.48]} position={[0, 0.065, 0.66]} color="#7eb05b" outline={false} />

      {/* Длинный белый корпус со скруглённым торцом */}
      <Box size={[1.38, h, 0.78]} position={[0.12, 0.06 + h / 2, -0.1]} color="#f2f4f7" material={facade} />
      <Cylinder
        radius={0.39}
        height={h}
        segments={16}
        position={[-0.56, 0.06 + h / 2, -0.1]}
        color="#f2f4f7"
        material={facade}
      />

      {/* Ярко-красная полоса под карнизом (фирменная деталь с референса #1) */}
      <Box size={[1.4, 0.08, 0.8]} position={[0.12, 0.06 + h - 0.08, -0.1]} color="#d4352d" />
      <Cylinder
        radius={0.4}
        height={0.08}
        segments={16}
        position={[-0.56, 0.06 + h - 0.08, -0.1]}
        color="#d4352d"
      />

      {/* Тёмно-серая плоская крыша и парапет */}
      <Box size={[1.42, 0.06, 0.82]} position={[0.12, 0.06 + h + 0.03, -0.1]} color="#4d5258" />
      <Cylinder
        radius={0.41}
        height={0.06}
        segments={16}
        position={[-0.56, 0.06 + h + 0.03, -0.1]}
        color="#4d5258"
      />

      {/* Два бело-красных цилиндрических бака («трубы лайнера») на крыше */}
      {[-0.36, 0.18].map((x) => (
        <group key={x} position={[x, 0.06 + h + 0.18, -0.16]}>
          <Cylinder radius={0.11} height={0.24} segments={12} position={[0, 0, 0]} color="#f5f5f5" />
          <Cylinder radius={0.114} height={0.06} segments={12} position={[0, 0.06, 0]} color="#d4352d" />
        </group>
      ))}

      {/* Треноги с телескопами/антеннами на крыше */}
      {[0.46, 0.66].map((x, idx) => (
        <group key={x} position={[x, 0.06 + h + 0.14, -0.06 + idx * 0.12]}>
          <Cylinder radius={0.015} height={0.16} segments={6} position={[0, 0, 0]} color="#26282b" />
          <Cylinder
            radius={0.02}
            height={0.2}
            segments={8}
            position={[0, 0.08, 0]}
            rotation={[0.4, 0.5, 0]}
            color="#35393e"
          />
        </group>
      ))}

      {/* Аллея зелёных деревьев у подножия */}
      {[-0.68, -0.22, 0.24, 0.68].map((x, i) => (
        <BlobTree key={x} position={[x, 0.06, 0.66]} scale={0.58 + (i % 2) * 0.08} color="#6ea851" />
      ))}
    </group>
  )
}

/**
 * 2×1 Современный белый дом с выступающими оранжевыми и бирюзовыми коробами-эркерами (референс #4, справа внизу).
 */
export function ColorBlockMesh() {
  const facade = getFacadeMaterial({
    wall: '#f2f0ea',
    glass: '#475966',
    spacing: [0.2, 0.25],
    frame: [0.24, 0.26],
  })
  const h = 2.45

  const boxes: Array<{ x: number; y: number; w: number; h: number; color: string }> = [
    { x: -0.58, y: 0.72, w: 0.22, h: 0.36, color: '#e06d44' },
    { x: -0.56, y: 1.48, w: 0.24, h: 0.42, color: '#e06d44' },
    { x: -0.14, y: 0.54, w: 0.22, h: 0.36, color: '#e06d44' },
    { x: -0.12, y: 1.02, w: 0.38, h: 0.28, color: '#df6b42' },
    { x: -0.1, y: 1.68, w: 0.24, h: 0.42, color: '#df6b42' },
    { x: 0.26, y: 0.56, w: 0.22, h: 0.38, color: '#459aa1' },
    { x: 0.48, y: 1.92, w: 0.42, h: 0.26, color: '#e06d44' },
    { x: 0.58, y: 1.38, w: 0.26, h: 0.38, color: '#459aa1' },
    { x: 0.62, y: 0.78, w: 0.24, h: 0.34, color: '#e06d44' },
  ]

  return (
    <group>
      <Box size={[1.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#cbc8bf" />
      <Box size={[1.76, h, 0.72]} position={[0, 0.06 + h / 2, 0]} color="#f2f0ea" material={facade} />
      <Box size={[1.8, 0.06, 0.76]} position={[0, 0.06 + h + 0.03, 0]} color="#595e63" />
      <Box size={[0.52, 0.24, 0.42]} position={[-0.46, 0.06 + h + 0.18, -0.05]} color="#f2f0ea" />

      {/* Выступающие цветные боксы вокруг окон */}
      {boxes.map((b, idx) => (
        <Box
          key={idx}
          size={[b.w, b.h, 0.1]}
          position={[b.x, b.y, 0.39]}
          color={b.color}
        />
      ))}
    </group>
  )
}

/**
 * 2×1 Высотная 16-этажная белая модернистская пластина (референс #1 и #2, главное высотное здание).
 */
export function HighriseSlabMesh() {
  const facade = getFacadeMaterial({
    wall: '#e6e8eb',
    glass: '#5b7f96',
    spacing: [0.16, 0.24],
    frame: [0.18, 0.24],
  })
  const sideWall = getFacadeMaterial({
    wall: '#d8dce0',
    glass: '#5b7f96',
    spacing: [0.36, 0.24],
    frame: [0.36, 0.28],
  })
  const h = 4.35

  return (
    <group>
      <Box size={[1.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#c6c4bc" />
      {/* Тёмный стилобат первого этажа */}
      <Box size={[1.78, 0.32, 0.74]} position={[0, 0.22, 0]} color="#4a5056" />
      {/* Основная высотная пластина */}
      <Box size={[1.74, h, 0.68]} position={[0, 0.38 + h / 2, 0]} color="#e6e8eb" material={facade} />
      {/* Глуховатые торцевые стены с одним рядом окон */}
      <Box size={[0.06, h, 0.7]} position={[-0.86, 0.38 + h / 2, 0]} color="#d8dce0" material={sideWall} />
      <Box size={[0.06, h, 0.7]} position={[0.86, 0.38 + h / 2, 0]} color="#d8dce0" material={sideWall} />
      {/* Карниз и технический этаж на крыше */}
      <Box size={[1.8, 0.08, 0.74]} position={[0, 0.38 + h + 0.04, 0]} color="#b8bdc2" />
      <Box size={[0.42, 0.22, 0.36]} position={[0.28, 0.38 + h + 0.19, 0]} color="#cfd4d8" />
    </group>
  )
}

/**
 * 2×2 Голубая высотка с полукруглыми стеклянными эркерами во всю высоту (референс #2, справа от лайнера).
 */
export function BayTowersMesh() {
  const towerMat = getFacadeMaterial({
    wall: '#d8e7f2',
    glass: '#6ea8c9',
    spacing: [0.18, 0.24],
    frame: [0.2, 0.22],
  })
  const bayGlass = getFacadeMaterial({
    wall: '#9ec8e0',
    glass: '#74b6db',
    spacing: [0.14, 0.22],
    curtain: true,
  })
  const h = 3.85

  return (
    <group>
      <Box size={[1.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#c9c6bc" />
      <Box size={[1.8, 0.025, 0.44]} position={[0, 0.065, 0.68]} color="#7eb05b" outline={false} />
      {/* Основной объём башни */}
      <Box size={[1.18, h, 1.08]} position={[0, 0.06 + h / 2, -0.08]} color="#d8e7f2" material={towerMat} />
      {/* Четыре полукруглые стеклянные колонны-эркера со скруглёнными завершениями */}
      {[-0.36, 0.36].map((x) =>
        [-0.58, 0.42].map((z) => (
          <group key={`${x}_${z}`} position={[x, 0, z]}>
            <Cylinder
              radius={0.18}
              height={h}
              segments={12}
              position={[0, 0.06 + h / 2, 0]}
              color="#9ec8e0"
              material={bayGlass}
            />
            <Dome radius={0.18} color="#e5eff5" position={[0, 0.06 + h, 0]} />
          </group>
        )),
      )}
      <Box size={[0.56, 0.26, 0.52]} position={[0, 0.06 + h + 0.13, -0.08]} color="#e5eff5" />
      <BlobTree position={[-0.62, 0.06, 0.68]} scale={0.62} color="#6ca650" />
      <BlobTree position={[0.62, 0.06, 0.68]} scale={0.58} color="#7cb35d" />
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Коммерческая архитектура и небоскрёбы CityRT (референсы 4–5)              */
/* -------------------------------------------------------------------------- */

/**
 * 2×1 Универмаг с горизонтальным остеклением и яркими рекламными щитами (референс #5).
 */
export function DeptStoreMesh() {
  const glassStrip = getFacadeMaterial({
    wall: '#d8dde2',
    glass: '#64a5c7',
    spacing: [0.22, 0.28],
    curtain: true,
  })

  return (
    <group>
      <Box size={[1.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#c8c5bc" />
      <Box size={[1.76, 1.12, 0.78]} position={[0, 0.62, 0]} color="#e8eaed" material={glassStrip} />
      <Box size={[1.82, 0.08, 0.84]} position={[0, 1.22, 0]} color="#f4f5f7" />
      {/* Яркие светящиеся билборды на фасаде */}
      <Box
        size={[0.52, 0.28, 0.04]}
        position={[-0.46, 0.82, 0.41]}
        color="#4fc3f7"
        material={nightSignMaterial}
      />
      <Box
        size={[0.48, 0.28, 0.04]}
        position={[0.44, 0.82, 0.41]}
        color="#f06292"
        material={cinemaSignMaterial}
      />
      {/* Козырёк над входом */}
      <Box size={[0.72, 0.05, 0.22]} position={[0, 0.34, 0.44]} color="#d9822b" />
    </group>
  )
}

/**
 * 1×1 Стройная белая рамная башня с открытым двухэтажным скай-лобби посередине (референс #4, в центре).
 */
export function GridOfficeTowerMesh() {
  const gridFacade = getFacadeMaterial({
    wall: '#eceae4',
    glass: '#4a5d6e',
    spacing: [0.22, 0.28],
    frame: [0.18, 0.2],
  })
  const lowerH = 2.52
  const skyLobbyH = 0.56
  const upperH = 2.24
  const base = 0.06

  return (
    <group>
      <Box size={[0.98, 0.06, 0.98]} position={[0, 0.03, 0]} color="#c8c5bc" />
      {/* Нижняя часть башни */}
      <Box
        size={[0.78, lowerH, 0.78]}
        position={[0, base + lowerH / 2, 0]}
        color="#eceae4"
        material={gridFacade}
      />
      {/* Чёрный козырёк над входом */}
      <Box size={[0.46, 0.05, 0.22]} position={[0, 0.32, 0.44]} color="#26292e" />

      {/* Открытая техническая/видовая терраса (скай-лобби) с угловыми колоннами */}
      <Box
        size={[0.46, skyLobbyH, 0.46]}
        position={[0, base + lowerH + skyLobbyH / 2, 0]}
        color="#9a9890"
      />
      {[-0.35, 0.35].map((x) =>
        [-0.35, 0.35].map((z) => (
          <Box
            key={`${x}_${z}`}
            size={[0.08, skyLobbyH, 0.08]}
            position={[x, base + lowerH + skyLobbyH / 2, z]}
            color="#eceae4"
          />
        )),
      )}
      {[-0.12, 0.12].map((x) =>
        [-0.35, 0.35].map((z) => (
          <Box
            key={`m_${x}_${z}`}
            size={[0.05, skyLobbyH, 0.05]}
            position={[x, base + lowerH + skyLobbyH / 2, z]}
            color="#eceae4"
          />
        )),
      )}

      {/* Верхняя часть башни */}
      <Box
        size={[0.78, upperH, 0.78]}
        position={[0, base + lowerH + skyLobbyH + upperH / 2, 0]}
        color="#eceae4"
        material={gridFacade}
      />
      <Box
        size={[0.82, 0.08, 0.82]}
        position={[0, base + lowerH + skyLobbyH + upperH + 0.04, 0]}
        color="#dedbd2"
      />
    </group>
  )
}

/**
 * 2×2 Изумрудно-бирюзовый стеклянный небоскрёб на двухэтажном подиуме с озеленённой террасой (референс #4, слева).
 */
export function GlassPodiumTowerMesh() {
  const podiumMat = getFacadeMaterial({
    wall: '#cfe0dc',
    glass: '#689f99',
    spacing: [0.24, 0.3],
    frame: [0.14, 0.18],
  })
  const curtainMat = getFacadeMaterial({
    wall: '#588b87',
    glass: '#82b8b2',
    spacing: [0.18, 0.26],
    curtain: true,
  })
  const crownMat = getFacadeMaterial({
    wall: '#e6ecea',
    glass: '#7aa8a3',
    spacing: [0.09, 0.32],
    frame: [0.28, 0.12],
  })
  const podiumH = 0.68
  const towerH = 4.5
  const crownH = 0.72

  return (
    <group>
      <Box size={[1.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#c8c6be" />
      {/* 2-этажный стеклянный стилобат с белыми поясами */}
      <Box size={[1.78, podiumH, 1.62]} position={[0, 0.06 + podiumH / 2, 0.06]} color="#cfe0dc" material={podiumMat} />
      <Box size={[1.82, 0.06, 1.66]} position={[0, 0.06 + podiumH + 0.03, 0.06]} color="#eef2f0" />
      {/* Тёмный козырёк над главным входом */}
      <Box size={[0.62, 0.05, 0.28]} position={[0, 0.34, 0.94]} color="#2b3033" />

      {/* Деревья в кадках на террасе подиума (как на референсе #4) */}
      {[-0.64, -0.22, 0.22, 0.64].map((x) => (
        <BlobTree key={x} position={[x, 0.06 + podiumH + 0.06, 0.72]} scale={0.42} color="#588e47" />
      ))}

      {/* Основная изумрудно-стеклянная башня */}
      <Box
        size={[1.42, towerH, 1.12]}
        position={[0, 0.06 + podiumH + 0.06 + towerH / 2, -0.1]}
        color="#588b87"
        material={curtainMat}
      />
      {/* Светлое реечное завершение-корона */}
      <Box
        size={[1.44, crownH, 1.14]}
        position={[0, 0.06 + podiumH + 0.06 + towerH + crownH / 2, -0.1]}
        color="#e6ecea"
        material={crownMat}
      />
      <Box
        size={[1.48, 0.07, 1.18]}
        position={[0, 0.06 + podiumH + 0.06 + towerH + crownH + 0.035, -0.1]}
        color="#f4f7f6"
      />
      <Box
        size={[0.68, 0.24, 0.52]}
        position={[0, 0.06 + podiumH + 0.06 + towerH + crownH + 0.18, -0.1]}
        color="#434a4e"
      />
    </group>
  )
}

/**
 * 2×2 Тёмно-синий небоскрёб с белым диагональным решётчатым каркасом-диагридом (референс #5, слева вверху).
 */
const DIAGRID_SPECS: PartSpec[] = (() => {
  const specs: PartSpec[] = []
  const tiers = 5
  const tierH = 1.28
  const baseY = 0.42
  const half = 0.69

  for (let t = 0; t < tiers; t++) {
    const y = baseY + t * tierH + tierH / 2
    // Горизонтальный пояс на каждом ярусе
    specs.push({ size: [1.42, 0.05, 1.42], position: [0, baseY + (t + 1) * tierH, 0] })
    // Диагональные раскосы на 4 фасадах
    for (const side of [-1, 1]) {
      for (const col of [-0.34, 0.34]) {
        specs.push({
          size: [0.045, 1.42, 0.045],
          position: [col, y, side * half],
          rotation: [0, 0, 0.46],
        })
        specs.push({
          size: [0.045, 1.42, 0.045],
          position: [col, y, side * half],
          rotation: [0, 0, -0.46],
        })
        specs.push({
          size: [0.045, 1.42, 0.045],
          position: [side * half, y, col],
          rotation: [0.46, 0, 0],
        })
        specs.push({
          size: [0.045, 1.42, 0.045],
          position: [side * half, y, col],
          rotation: [-0.46, 0, 0],
        })
      }
    }
  }
  return specs
})()

export function DiagridSkyscraperMesh() {
  const darkCurtain = getFacadeMaterial({
    wall: '#213547',
    glass: '#3b6482',
    spacing: [0.16, 0.24],
    curtain: true,
  })
  const totalH = 6.4

  return (
    <group>
      <Box size={[1.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#c6c4bc" />
      <Box size={[1.64, 0.36, 1.64]} position={[0, 0.24, 0]} color="#2c4154" />
      {/* Основное тёмно-синее стеклянное ядро */}
      <Box
        size={[1.34, totalH, 1.34]}
        position={[0, 0.42 + totalH / 2, 0]}
        color="#213547"
        material={darkCurtain}
      />
      {/* Белая диагональная сетка (diagrid) поверх фасадов */}
      <MergedParts specs={DIAGRID_SPECS} color="#e8eef2" outline />
      {/* Угловые наклонные контрфорсы у основания как на референсе #5 */}
      {[-0.68, 0.68].map((x) =>
        [-0.68, 0.68].map((z) => (
          <Box
            key={`${x}_${z}`}
            size={[0.1, 2.2, 0.1]}
            position={[x * 1.06, 1.1, z * 1.06]}
            rotation={[z > 0 ? -0.1 : 0.1, 0, x > 0 ? 0.1 : -0.1]}
            color="#e8eef2"
          />
        )),
      )}
      <Box size={[1.44, 0.12, 1.44]} position={[0, 0.42 + totalH + 0.06, 0]} color="#e8eef2" />
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Образование, достопримечательности, стадионы и вокзалы (референсы 3, 5)   */
/* -------------------------------------------------------------------------- */

/**
 * 3×2 Университетский колледж из красного кирпича с белым мансардным этажом, портиком с колоннами и куполом (референс #3).
 */
export function CollegeHallMesh() {
  const brickWall = getFacadeMaterial({
    wall: '#b84b34',
    glass: '#6896b0',
    spacing: [0.24, 0.28],
    frame: [0.22, 0.24],
  })
  const mansardWall = getFacadeMaterial({
    wall: '#ebe8e0',
    glass: '#6896b0',
    spacing: [0.24, 0.26],
    frame: [0.24, 0.26],
  })

  return (
    <group>
      {/* Campus Courtyard: газон и кирпичные дорожки */}
      <Box size={[2.96, 0.06, 1.96]} position={[0, 0.03, 0]} color="#7ea858" />
      <Box size={[0.38, 0.02, 1.4]} position={[0, 0.065, 0.22]} color="#c97d60" outline={false} />
      <Box size={[2.2, 0.02, 0.28]} position={[0, 0.065, 0.56]} color="#c97d60" outline={false} />

      {/* Главный северный корпус с белым колонным портиком и купольной башенкой */}
      <Box size={[1.76, 0.48, 0.68]} position={[0, 0.3, -0.52]} color="#b84b34" material={brickWall} />
      <Box size={[1.78, 0.38, 0.7]} position={[0, 0.73, -0.52]} color="#ebe8e0" material={mansardWall} />
      <Box size={[1.82, 0.12, 0.74]} position={[0, 0.98, -0.52]} color="#d5d2ca" />

      {/* Портик с 4 белыми колоннами и треугольным фронтоном */}
      <Box size={[0.68, 0.08, 0.24]} position={[0, 0.68, -0.08]} color="#f4f1ea" />
      <Cone
        radius={0.42}
        height={0.22}
        segments={4}
        position={[0, 0.83, -0.08]}
        rotation={[0, Math.PI / 4, 0]}
        color="#f4f1ea"
      />
      {[-0.24, -0.08, 0.08, 0.24].map((x) => (
        <Cylinder key={x} radius={0.028} height={0.56} segments={8} position={[x, 0.36, 0.0]} color="#f4f1ea" />
      ))}

      {/* Белая ротонда-купол на крыше главного корпуса */}
      <Box size={[0.26, 0.22, 0.26]} position={[0, 1.14, -0.52]} color="#f4f1ea" />
      <Dome radius={0.14} color="#cfd4d8" position={[0, 1.25, -0.52]} />

      {/* Левое и правое крылья кампуса */}
      {[-1.04, 1.04].map((x) => (
        <group key={x} position={[x, 0, 0.14]}>
          <Box size={[0.68, 0.46, 1.38]} position={[0, 0.29, 0]} color="#b84b34" material={brickWall} />
          <Box size={[0.7, 0.36, 1.4]} position={[0, 0.7, 0]} color="#ebe8e0" material={mansardWall} />
          <Box size={[0.74, 0.12, 1.44]} position={[0, 0.94, 0]} color="#d5d2ca" />
        </group>
      ))}

      {/* Деревья в студенческом сквере */}
      {[-0.48, 0.48].map((x) => (
        <BlobTree key={x} position={[x, 0.06, 0.22]} scale={0.58} color="#5e9647" />
      ))}
      {[-0.66, 0.66].map((x) => (
        <BlobTree key={`f_${x}`} position={[x, 0.06, 0.72]} scale={0.52} color="#6da652" />
      ))}
    </group>
  )
}

/**
 * 1×1 Часовая башня кампуса: кирпичное основание, белая звонница с часами и серый шпиль (референс #3, справа).
 */
export function ClockTowerMesh() {
  return (
    <group>
      <Box size={[0.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#c9c4b8" />
      {/* Краснокирпичный первый ярус с портиком */}
      <Box size={[0.56, 0.54, 0.56]} position={[0, 0.33, 0]} color="#b84b34" />
      <Box size={[0.6, 0.06, 0.6]} position={[0, 0.63, 0]} color="#ebe8e0" />
      {/* Высокий белый ствол башни с окнами и циферблатами */}
      <Box size={[0.48, 1.18, 0.48]} position={[0, 1.25, 0]} color="#f2efe8" />
      <Window position={[-0.1, 0.95, 0.245]} facing="z" width={0.07} height={0.16} />
      <Window position={[0.1, 0.95, 0.245]} facing="z" width={0.07} height={0.16} />

      {/* 4 светящихся циферблата часов */}
      {[
        { pos: [0, 1.56, 0.25] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 },
        { pos: [0, 1.56, -0.25] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 },
        { pos: [0.25, 1.56, 0] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 },
        { pos: [-0.25, 1.56, 0] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 },
      ].map((c, idx) => (
        <Cylinder
          key={idx}
          radius={0.11}
          height={0.02}
          segments={12}
          position={c.pos}
          rotation={c.rot}
          color="#fff1c2"
          material={townHallClockMaterial}
        />
      ))}

      {/* Восьмигранный бельведер и остроконечный шпиль */}
      <Box size={[0.54, 0.07, 0.54]} position={[0, 1.87, 0]} color="#dedad0" />
      <Cylinder radius={0.18} height={0.28} segments={8} position={[0, 2.04, 0]} color="#f2efe8" />
      <Cone radius={0.21} height={0.56} segments={8} position={[0, 2.46, 0]} color="#8c949c" />
      <BlobTree position={[-0.36, 0.06, 0.36]} scale={0.5} color="#6ca352" />
    </group>
  )
}

/**
 * 3×3 Гранд-Арена «Кристалл»: овальная чаша стадиона с бело-синим ромбовидным фасадом (референс #5, справа в центре).
 */
const ARENA_LATTICE_SPECS: PartSpec[] = (() => {
  const specs: PartSpec[] = []
  const count = 24
  const rx = 1.26
  const rz = 1.06
  const y = 0.56
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const x = Math.cos(a) * rx
    const z = Math.sin(a) * rz
    const yaw = -a + Math.PI / 2
    specs.push({
      size: [0.04, 0.88, 0.04],
      position: [x, y, z],
      rotation: [0, 0, 0.52],
      yaw,
    })
    specs.push({
      size: [0.04, 0.88, 0.04],
      position: [x, y, z],
      rotation: [0, 0, -0.52],
      yaw,
    })
  }
  return specs
})()

export function DiamondArenaMesh() {
  const paver = getPaverMaterial()

  return (
    <group>
      {/* Большая площадь вокруг арены */}
      <Box size={[2.96, 0.06, 2.96]} position={[0, 0.03, 0]} color="#d8d5cb" material={paver} />

      {/* Овальная синяя чаша стадиона (масштабированный цилиндр) */}
      <group scale={[1.18, 1, 1.0]}>
        <Cylinder radius={1.06} radiusTop={1.12} height={0.82} segments={28} position={[0, 0.47, 0]} color="#2979cf" />
        {/* Белый козырёк крыши по периметру трибун */}
        <Cylinder radius={1.13} radiusTop={1.04} height={0.14} segments={28} position={[0, 0.94, 0]} color="#f0f4f8" />
        {/* Внутренние синие трибуны и футбольное/спортивное поле */}
        <Cylinder radius={0.78} radiusTop={0.88} height={0.16} segments={24} position={[0, 0.88, 0]} color="#1c4f8a" />
        <Cylinder radius={0.64} height={0.05} segments={24} position={[0, 0.82, 0]} color="#4e9e48" />
        {/* Белая разметка поля */}
        <Box size={[0.78, 0.02, 0.5]} position={[0, 0.85, 0]} color="#f2f6f9" outline={false} />
        <Box size={[0.72, 0.025, 0.44]} position={[0, 0.852, 0]} color="#58ab52" outline={false} />
      </group>

      {/* Белая ромбовидная сетка-оболочка поверх синей чаши (как на референсе #5) */}
      <MergedParts specs={ARENA_LATTICE_SPECS} color="#f3f7fa" outline />

      {/* Спиральные пандусы и деревья по углам площади */}
      {[-1.18, 1.18].map((x) => (
        <Cylinder key={x} radius={0.18} height={0.28} segments={12} position={[x, 0.2, 1.06]} color="#e2e6ea" />
      ))}
      {[-1.24, 1.24].map((x) => (
        <BlobTree key={`t_${x}`} position={[x, 0.06, -1.2]} scale={0.65} color="#68a34e" />
      ))}
    </group>
  )
}

/**
 * 3×1 Пассажирский железнодорожный вокзал с часовой башней, перроном и путями (TileType.STATION / civ_train_station).
 */
export function TrainStationMesh() {
  const brickFacade = getFacadeMaterial({
    wall: '#c85a3f',
    glass: '#7ec0de',
    spacing: [0.24, 0.28],
    frame: [0.22, 0.24],
  })

  return (
    <group>
      <Box size={[2.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#cfc9bc" />
      {/* Железнодорожная колея вдоль южного перрона */}
      <Box size={[2.96, 0.03, 0.34]} position={[0, 0.065, 0.28]} color="#8a8379" outline={false} />
      {[-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2].map((x) => (
        <Box key={x} size={[0.07, 0.025, 0.28]} position={[x, 0.082, 0.28]} color="#5c422c" />
      ))}
      {[-0.1, 0.1].map((dz) => (
        <Box key={dz} size={[2.96, 0.03, 0.03]} position={[0, 0.1, 0.28 + dz]} color="#b8c0c7" />
      ))}

      {/* Крытая пассажирская платформа */}
      <Box size={[2.76, 0.1, 0.28]} position={[0, 0.11, -0.02]} color="#ddd7ca" />
      <Box size={[2.68, 0.05, 0.36]} position={[0, 0.52, 0.04]} color="#485866" />
      {[-1.1, -0.55, 0, 0.55, 1.1].map((x) => (
        <Cylinder key={x} radius={0.022} height={0.38} segments={6} position={[x, 0.31, -0.02]} color="#3a4652" />
      ))}

      {/* Главное здание вокзала */}
      <Box size={[2.1, 0.68, 0.44]} position={[0, 0.4, -0.22]} color="#c85a3f" material={brickFacade} />
      <Box size={[2.16, 0.08, 0.48]} position={[0, 0.78, -0.22]} color="#ebe6dc" />
      {/* Сводчатый стеклянный дебаркадер и часовая башенка */}
      <Cylinder
        radius={0.22}
        height={0.76}
        segments={12}
        position={[0, 0.82, -0.22]}
        rotation={[0, 0, Math.PI / 2]}
        color="#7ec0de"
        material={getGlassMaterial('#7ec0de', true)}
      />
      <Box size={[0.38, 0.54, 0.38]} position={[0, 1.05, -0.22]} color="#ebe6dc" />
      <Cone
        radius={0.26}
        height={0.34}
        segments={4}
        position={[0, 1.49, -0.22]}
        rotation={[0, Math.PI / 4, 0]}
        color="#435361"
      />
      <Cylinder
        radius={0.09}
        height={0.02}
        segments={12}
        position={[0, 1.12, -0.02]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#fff1c2"
        material={townHallClockMaterial}
      />
    </group>
  )
}

/**
 * 3×1 Грузовой железнодорожный терминал с козловым краном, контейнерами и путями (ind_freight_station).
 */
export function FreightStationMesh() {
  return (
    <group>
      <Box size={[2.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#b9b4a8" />
      {/* Подъездной рельсовый путь */}
      <Box size={[2.96, 0.03, 0.34]} position={[0, 0.065, 0.26]} color="#857e74" outline={false} />
      {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((x) => (
        <Box key={x} size={[0.07, 0.025, 0.28]} position={[x, 0.082, 0.26]} color="#5c422c" />
      ))}
      {[-0.1, 0.1].map((dz) => (
        <Box key={dz} size={[2.96, 0.03, 0.03]} position={[0, 0.1, 0.26 + dz]} color="#b8c0c7" />
      ))}

      {/* Складской ангар слева */}
      <Box size={[1.18, 0.54, 0.48]} position={[-0.76, 0.33, -0.16]} color="#8b949c" />
      <Box size={[1.22, 0.06, 0.52]} position={[-0.76, 0.63, -0.16]} color="#545d66" />

      {/* Цветные морские/ж-д контейнеры справа */}
      <Box size={[0.52, 0.24, 0.24]} position={[0.36, 0.18, -0.2]} color="#c94a38" />
      <Box size={[0.52, 0.24, 0.24]} position={[0.36, 0.42, -0.2]} color="#3b78a8" />
      <Box size={[0.52, 0.24, 0.24]} position={[0.96, 0.18, -0.2]} color="#d99438" />

      {/* Жёлтый козловой кран над контейнерами и путями */}
      {[0.12, 1.18].map((x) => (
        <group key={x} position={[x, 0, 0.04]}>
          <Box size={[0.05, 0.78, 0.05]} position={[0, 0.45, -0.34]} color="#e09a2b" />
          <Box size={[0.05, 0.78, 0.05]} position={[0, 0.45, 0.34]} color="#e09a2b" />
          <Box size={[0.06, 0.06, 0.74]} position={[0, 0.84, 0]} color="#e09a2b" />
        </group>
      ))}
      <Box size={[1.16, 0.07, 0.08]} position={[0.65, 0.88, 0.04]} color="#e09a2b" />
    </group>
  )
}

/**
 * 1×1 Речной водозабор и станция очистки воды (utl_water_intake).
 */
export function WaterIntakeMesh() {
  return (
    <group>
      <Box size={[0.96, 0.06, 0.96]} position={[0, 0.03, 0]} color="#c5c2b8" />
      {/* Бетонный резервуар-отстойник с голубой водой */}
      <Cylinder radius={0.28} height={0.22} segments={14} position={[-0.14, 0.17, -0.12]} color="#9ea4a8" />
      <Cylinder radius={0.24} height={0.24} segments={14} position={[-0.14, 0.18, -0.12]} color="#58a5cf" />
      {/* Насосный корпус и трубы */}
      <Box size={[0.38, 0.42, 0.36]} position={[0.22, 0.27, 0.16]} color="#dce3e8" />
      <Box size={[0.42, 0.06, 0.4]} position={[0.22, 0.51, 0.16]} color="#4a7c9b" />
      <Cylinder
        radius={0.045}
        height={0.34}
        segments={8}
        position={[0.04, 0.22, 0.16]}
        rotation={[0, 0, Math.PI / 2]}
        color="#4a7c9b"
      />
    </group>
  )
}

/**
 * 1×1 Набережная-променад с каменной брусчаткой, балюстрадой, фонарём и деревьями (park_waterfront).
 */
export function WaterfrontPromenadeMesh() {
  const stone = getFlagstoneMaterial('#d4cbb8', 6)

  return (
    <group>
      <Box size={[0.98, 0.08, 0.98]} position={[0, 0.04, 0]} color="#d4cbb8" material={stone} />
      {/* Каменная набережная с балюстрадой */}
      <Box size={[0.98, 0.08, 0.1]} position={[0, 0.12, -0.42]} color="#ebe5d8" />
      {[-0.38, -0.19, 0, 0.19, 0.38].map((x) => (
        <Box key={x} size={[0.05, 0.08, 0.06]} position={[x, 0.19, -0.42]} color="#dad2c2" />
      ))}
      <Box size={[0.98, 0.04, 0.12]} position={[0, 0.24, -0.42]} color="#ebe5d8" />

      {/* Деревянная скамейка и деревья */}
      <Box size={[0.26, 0.06, 0.1]} position={[0, 0.11, 0.08]} color="#8c5838" />
      <BlobTree position={[-0.3, 0.08, 0.24]} scale={0.56} color="#d98c3a" />
      <BlobTree position={[0.3, 0.08, 0.24]} scale={0.52} color="#6ca650" />
    </group>
  )
}
