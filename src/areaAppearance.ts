import {
  Cake,
  Circle,
  Plane,
  Music,
  Palette,
  Trees,
  Camera,
  Car,
  PawPrint,
  Star,
  Coffee,
  Gamepad2,
  Flower2,
  BriefcaseBusiness,
  Laptop,
  House,
  Utensils,
  Heart,
  Dumbbell,
  Users,
  HeartPulse,
  ShoppingBag,
  Wallet,
  BookOpen,
  Presentation,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import type { Area } from "./domain";

export const areaIcon: Record<Area, LucideIcon> = {
  "Дни рождения": Cake,
  Работа: BriefcaseBusiness,
  Фриланс: Laptop,
  Квартира: House,
  Еда: Utensils,
  Любовь: Heart,
  Спорт: Dumbbell,
  Родные: Users,
  Здоровье: HeartPulse,
  Покупки: ShoppingBag,
  Финансы: Wallet,
  Учёба: BookOpen,
  Преподавание: Presentation,
  Аспирантура: GraduationCap,
  Личное: Heart,
};
export const areaColor: Record<Area, string> = {
  "Дни рождения": "#ee9a97",
  Работа: "#6b9bdf",
  Фриланс: "#b08cdb",
  Квартира: "#6fc2a5",
  Еда: "#e9a16c",
  Любовь: "#d989b6",
  Спорт: "#6bbdd9",
  Родные: "#e4bd68",
  Здоровье: "#89c78e",
  Покупки: "#c69cce",
  Финансы: "#63b9b2",
  Учёба: "#8e9fe0",
  Преподавание: "#d59d83",
  Аспирантура: "#aa9bd9",
  Личное: "#edb18d",
};

export const iconForArea = (area: Area) =>
  Object.hasOwn(areaIcon, area) ? areaIcon[area]! : Circle;
export const colorForArea = (area: Area) => {
  if (Object.hasOwn(areaColor, area)) return areaColor[area]!;
  // Stable per name: reordering spheres never changes their color.
  let hash = 0;
  for (const char of area)
    hash = (Math.imul(hash, 31) + char.codePointAt(0)!) | 0;
  return `hsl(${(hash >>> 0) % 360} 54% 70%)`;
};

export const areaMiniatures = [
  { id: "circle", label: "Круг", icon: Circle },
  { id: "work", label: "Работа", icon: BriefcaseBusiness },
  { id: "laptop", label: "Компьютер", icon: Laptop },
  { id: "home", label: "Дом", icon: House },
  { id: "food", label: "Еда", icon: Utensils },
  { id: "heart", label: "Любовь", icon: Heart },
  { id: "sport", label: "Спорт", icon: Dumbbell },
  { id: "family", label: "Люди", icon: Users },
  { id: "health", label: "Здоровье", icon: HeartPulse },
  { id: "shopping", label: "Покупки", icon: ShoppingBag },
  { id: "money", label: "Финансы", icon: Wallet },
  { id: "book", label: "Книга", icon: BookOpen },
  { id: "teaching", label: "Преподавание", icon: Presentation },
  { id: "study", label: "Учёба", icon: GraduationCap },
  { id: "travel", label: "Путешествия", icon: Plane },
  { id: "music", label: "Музыка", icon: Music },
  { id: "art", label: "Творчество", icon: Palette },
  { id: "nature", label: "Природа", icon: Trees },
  { id: "photo", label: "Фото", icon: Camera },
  { id: "car", label: "Автомобиль", icon: Car },
  { id: "pet", label: "Питомцы", icon: PawPrint },
  { id: "star", label: "Мечты", icon: Star },
  { id: "coffee", label: "Отдых", icon: Coffee },
  { id: "games", label: "Игры", icon: Gamepad2 },
  { id: "flower", label: "Растения", icon: Flower2 },
] as const;
export const sphereIcon = (area: Area, choices: Record<string, string> = {}) =>
  areaMiniatures.find(
    (item) =>
      item.id === (Object.hasOwn(choices, area) ? choices[area] : undefined),
  )?.icon || iconForArea(area);
