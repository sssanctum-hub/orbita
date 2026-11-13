import { characterClasses, type CharacterClass } from "../character";
export const characterDetails:Record<CharacterClass,{image:string;description:string}>={
 "Бард":{image:"bard",description:"Творчество и вдохновение. Превращает повседневные дела в свою историю."},
 "Учёный":{image:"scientist",description:"Любопытство и знания. Двигается вперёд через открытия и обучение."},
 "Варвар":{image:"barbarian",description:"Решительность и энергия. Смело берётся за сложные дела."},
 "Воин":{image:"warrior",description:"Стойкость и порядок. Шаг за шагом доводит начатое до конца."},
 "Монах":{image:"monk",description:"Спокойствие и сосредоточенность. Ценит свой ритм и небольшие шаги."},
 "Друид":{image:"druid",description:"Баланс и рост. Заботится о себе и разных сферах жизни."},
 "Жрец":{image:"priest",description:"Забота и поддержка. Находит смысл в помощи себе и близким."},
 "Следопыт":{image:"ranger",description:"Свобода и исследование. Прокладывает свой путь к новым целям."},
};
export function CharacterPortrait({name}:{name:CharacterClass}){
 return <div className="character-portrait"><img src={"/characters/"+characterDetails[name].image+".png"} alt={"Персонаж: "+name} loading="lazy" decoding="async"/></div>;
}
export default function CharacterPicker({value,onChange}:{value:CharacterClass;onChange:(name:CharacterClass)=>void}){
 return <section className="character-picker" aria-label="Выбор персонажа"><h3>Кем отправимся в путь?</h3><p>Персонаж — ваш спутник в Орбите. Выполняйте дела, получайте опыт и повышайте его уровень.</p><div className="character-choices" role="group" aria-label="Классы персонажей">{characterClasses.map(name=><button type="button" key={name} aria-pressed={name===value} onClick={()=>onChange(name)}><CharacterPortrait name={name}/><span>{name}</span>{name===value&&<small>Выбран</small>}</button>)}</div><div className="character-description"><strong>{value}</strong><p>{characterDetails[value].description}</p></div><p className="character-rules">Разница — в образе и настроении. Все классы получают одинаковые 25 опыта за дело и не ограничивают ваши задачи. Выбирайте того, кто вам ближе.</p></section>;
}
