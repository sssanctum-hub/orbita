use chrono::{DateTime, Datelike, Local, NaiveDate, TimeZone, Utc};
use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};

pub type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub area: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub done: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Birthday {
    pub month: u32,
    pub day: u32,
    #[serde(default)]
    pub created_at: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskImage {
 pub id: String, pub name: String, pub thumbnail: String, pub width: u32, pub height: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskLink { pub id: String, pub label: String, pub url: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Task {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub handwriting: Vec<String>,
    pub id: String,
    pub title: String,
    pub area: String,
    pub project_id: Option<String>,
    pub status: String,
    pub start: String,
    pub due: String,
    #[serde(default)]
    pub due_time: String,
    // "event" = interval "from–to" (start/start_time .. due/due_time); empty for ordinary tasks.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub kind: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub start_time: String,
    pub reminder: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub birthday: Option<Birthday>,
    pub notes: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<TaskImage>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<TaskLink>,
    pub priority: u8,
    pub minutes: u32,
    pub subtasks: Vec<Subtask>,
    #[serde(default)]
    pub repeat: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_interval: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_weekdays: Option<Vec<u32>>,
    #[serde(default)]
    pub repeat_until: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_count: Option<u32>,
    #[serde(default)]
    pub repeat_anchor: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_day: Option<u32>,
    #[serde(default)]
    pub repeat_completed: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_id: Option<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub project_id: Option<String>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Data {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub character: Option<serde_json::Value>,
    pub revision: i64,
    #[serde(default)]
    pub custom_areas: Vec<String>,
    #[serde(default)]
    pub deleted_areas: Vec<String>,
    #[serde(default)]
    pub area_icons: std::collections::HashMap<String, String>,
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub notes: Vec<Note>,
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub fn open(path: &Path) -> Result<Connection> {
    let mut db = Connection::open(path).map_err(err)?;
    db.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(err)?;
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")
        .map_err(err)?;
    let version: i64 = db
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(err)?;
    if version > 3 {
        return Err("База создана более новой версией приложения. Необходимо обновление.".into());
    }
    if version == 0 {
        let tables: i64 = db.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], |r| r.get(0)).map_err(err)?;
        if tables > 0 {
            return Err(
                "Обнаружена неизвестная схема базы. Автоматическое изменение отменено.".into(),
            );
        }
        let tx = db.transaction().map_err(err)?;
        tx.execute_batch(include_str!("../../migrations/001_initial.sql"))
            .map_err(err)?;
        tx.commit().map_err(err)?;
    }
    if version < 2 {
        if version == 1 {
            let backup =
                path.with_extension(format!("v1-{}.sqlite.bak", Utc::now().timestamp_millis()));
            db.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
                .map_err(err)?;
        }
        let tx = db.transaction().map_err(err)?;
        tx.execute_batch(include_str!("../../migrations/002_custom_areas.sql"))
            .map_err(err)?;
        tx.commit().map_err(err)?;
    }
    if version < 3 {
        if version == 2 {
            let backup =
                path.with_extension(format!("v2-{}.sqlite.bak", Utc::now().timestamp_millis()));
            db.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
                .map_err(err)?;
        }
        let tx = db.transaction().map_err(err)?;
        tx.execute_batch(include_str!("../../migrations/003_area_preferences.sql"))
            .map_err(err)?;
        tx.commit().map_err(err)?;
    }
    Ok(db)
}
pub fn load(db: &Connection) -> Result<Data> {
    fn rows<T: serde::de::DeserializeOwned>(db: &Connection, sql: &str) -> Result<Vec<T>> {
        let mut stmt = db.prepare(sql).map_err(err)?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
        rows.map(|r| serde_json::from_str(&r.map_err(err)?).map_err(err))
            .collect()
    }
    let preferences: String = db
        .query_row("SELECT payload FROM area_preferences WHERE id=1", [], |r| {
            r.get(0)
        })
        .map_err(err)?;
    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct Preferences {
        #[serde(default)]
        character: Option<serde_json::Value>,
        #[serde(default)]
        deleted_areas: Vec<String>,
        #[serde(default)]
        area_icons: std::collections::HashMap<String, String>,
    }
    let preferences: Preferences = serde_json::from_str(&preferences).map_err(err)?;
    Ok(Data {
        character: preferences.character,
        deleted_areas: preferences.deleted_areas,
        area_icons: preferences.area_icons,
        revision: db
            .query_row("SELECT revision FROM metadata WHERE id=1", [], |r| r.get(0))
            .map_err(err)?,
        custom_areas: {
            let mut stmt = db
                .prepare("SELECT name FROM custom_areas ORDER BY position")
                .map_err(err)?;
            let values = stmt
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(err)?
                .collect::<std::result::Result<Vec<_>, _>>()
                .map_err(err)?;
            values
        },
        projects: rows(db, "SELECT payload FROM projects ORDER BY position")?,
        tasks: rows(db, "SELECT payload FROM tasks ORDER BY position")?,
        notes: rows(db, "SELECT payload FROM notes ORDER BY position")?,
    })
}
const BUILTIN_AREAS: &[&str] = &[
    "Работа",
    "Фриланс",
    "Квартира",
    "Еда",
    "Любовь",
    "Спорт",
    "Родные",
    "Здоровье",
    "Покупки",
    "Финансы",
    "Учёба",
    "Преподавание",
    "Аспирантура",
    "Дни рождения",
    "Личное", // Existing records remain valid; never redistribute them implicitly.
];
fn area_valid(a: &str) -> bool {
    BUILTIN_AREAS.contains(&a)
}
fn id_valid(id: &str) -> bool {
    !id.is_empty() && id.len() <= 100
}
fn text_valid(text: &str, max: usize) -> bool {
    !text.trim().is_empty() && text.chars().count() <= max
}
fn time_valid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 5
        && bytes[2] == b':'
        && [bytes[0], bytes[1], bytes[3], bytes[4]]
            .iter()
            .all(u8::is_ascii_digit)
        && &value[0..2] <= "23"
        && &value[3..5] <= "59"
}
fn clock_minutes(value: &str) -> i64 {
    value[0..2].parse::<i64>().unwrap_or(0) * 60 + value[3..5].parse::<i64>().unwrap_or(0)
}
fn validate_event(t: &Task) -> Result<()> {
    if t.kind == "fact" && (!t.start.is_empty() || !t.due.is_empty() || !t.due_time.is_empty() || !t.start_time.is_empty() || !t.reminder.is_empty() || t.birthday.is_some() || !t.repeat.is_empty() || !t.repeat_until.is_empty() || !t.repeat_anchor.is_empty() || !t.repeat_completed.is_empty() || t.status != "todo" || t.minutes != 0 || !t.subtasks.is_empty() || !t.depends_on.is_empty()) { return Err("У факта нет даты, напоминания и выполнения.".into()); }
    if t.images.len() > 10 || t.links.len() > 30 {return Err("Слишком много вложений.".into());}
    let mut images=HashSet::new();
    for image in &t.images {
      if uuid::Uuid::parse_str(&image.id).is_err() || !images.insert(&image.id) || image.name.chars().count()>200 || !image.thumbnail.starts_with("data:image/jpeg;base64,") || image.thumbnail.len()>60000 || image.width==0 || image.height==0 || image.width>1200 || image.height>1200 {return Err("Некорректное изображение.".into());}
    }
    for link in &t.links {
      let url=tauri::Url::parse(&link.url).map_err(|_| "Некорректная ссылка.")?;
      if !id_valid(&link.id) || link.label.chars().count()>200 || link.url.len()>2048 || !["http","https"].contains(&url.scheme()) || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {return Err("Некорректная ссылка.".into());}
    }
    if !["", "event", "fact"].contains(&t.kind.as_str()) {
        return Err("Неизвестный вид дела.".into());
    }
    if !t.start_time.is_empty() && (t.kind != "event" || !time_valid(&t.start_time)) {
        return Err("Некорректное время начала.".into());
    }
    if t.kind != "event" {
        return Ok(());
    }
    if t.birthday.is_some()
        || t.start.is_empty()
        || t.due.is_empty()
        || t.start_time.is_empty() != t.due_time.is_empty()
    {
        return Err("Некорректное событие.".into());
    }
    let (Ok(from), Ok(to)) = (
        NaiveDate::parse_from_str(&t.start, "%Y-%m-%d"),
        NaiveDate::parse_from_str(&t.due, "%Y-%m-%d"),
    ) else {
        return Err("Некорректная дата.".into());
    };
    let days = (to - from).num_days();
    if !(0..366).contains(&days) {
        return Err("Событие не может длиться больше 365 дней.".into());
    }
    if !t.start_time.is_empty()
        && days * 1440 + clock_minutes(&t.due_time) - clock_minutes(&t.start_time) <= 0
    {
        return Err("Окончание события должно быть позже начала.".into());
    }
    Ok(())
}
pub fn validate(data: &Data) -> Result<()> {
    if !(0..9_007_199_254_740_991i64).contains(&data.revision) {
        return Err("Некорректная версия данных.".into());
    }
    if data.tasks.len() > 20000 || data.notes.len() > 20000 || data.projects.len() > 2000 {
        return Err("Слишком много записей для этой версии.".into());
    }
    let mut custom = HashSet::new();
    if data.custom_areas.len() > 100 {
        return Err("Слишком много сфер.".into());
    }
    for name in &data.custom_areas {
        let key = name.to_lowercase().replace('ё', "е");
        if !text_valid(name, 40)
            || name.trim() != name
            || BUILTIN_AREAS
                .iter()
                .any(|a| a.to_lowercase().replace('ё', "е") == key)
            || !custom.insert(key)
        {
            return Err("Некорректная или повторяющаяся сфера.".into());
        }
    }
    if data.deleted_areas.len() > 200
        || data.deleted_areas.iter().any(|a| !text_valid(a, 40))
        || data.area_icons.len() > 300
        || data.area_icons.iter().any(|(a, i)| {
            !text_valid(a, 40)
                || ![
                    "circle", "work", "laptop", "home", "food", "heart", "sport", "family",
                    "health", "shopping", "money", "book", "teaching", "study", "travel", "music",
                    "art", "nature", "photo", "car", "pet", "star", "coffee", "games", "flower",
                ]
                .contains(&i.as_str())
        })
    {
        return Err("Некорректные настройки сфер.".into());
    }
    let valid_area = |a: &str| {
        !data.deleted_areas.iter().any(|name| name == a)
            && (area_valid(a) || data.custom_areas.iter().any(|name| name == a))
    };
    let mut projects = HashSet::new();
    for p in &data.projects {
        if !id_valid(&p.id)
            || !text_valid(&p.name, 120)
            || !valid_area(&p.area)
            || !projects.insert(p.id.as_str())
        {
            return Err("Некорректный или повторяющийся проект.".into());
        }
    }
    let mut tasks = HashSet::new();
    for t in &data.tasks {
        if t.handwriting.len() > 200 || t.handwriting.iter().any(|stroke| stroke.len() > 8010 || !stroke.bytes().all(|b| b.is_ascii_digit() || matches!(b, b'M' | b'L' | b' '))) {
            return Err("Некорректная рукописная заметка.".into());
        }
        if let Some(birthday) = &t.birthday {
            if NaiveDate::from_ymd_opt(2000, birthday.month, birthday.day).is_none()
                || !t.repeat.is_empty()
                || !t.reminder.is_empty()
                || birthday
                    .created_at
                    .as_ref()
                    .is_some_and(|date| DateTime::parse_from_rfc3339(date).is_err())
            {
                return Err("Некорректный день рождения.".into());
            }
        }
        if !["", "daily", "weekly", "monthly"].contains(&t.repeat.as_str())
            || (!t.repeat.is_empty() && t.due.is_empty())
            || t.repeat_day.is_some_and(|day| !(1..=31).contains(&day))
            || t.previous_id
                .as_ref()
                .is_some_and(|id| !id_valid(id) || id == &t.id)
        {
            return Err("Некорректное правило повторения.".into());
        }
        if !id_valid(&t.id)
            || !tasks.insert(t.id.as_str())
            || !text_valid(&t.title, 200)
            || !valid_area(&t.area)
            || !["todo", "doing", "done"].contains(&t.status.as_str())
            || t.minutes > 1440
            || t.priority > 2
            || t.notes.len() > 1_000_000
        {
            return Err("Некорректные данные задачи.".into());
        }
        if t.project_id
            .as_ref()
            .is_some_and(|id| !projects.contains(id.as_str()))
        {
            return Err("Проект задачи не найден.".into());
        }
        for date in [&t.start, &t.due, &t.repeat_until, &t.repeat_anchor]
            .into_iter()
            .chain(t.repeat_completed.iter())
        {
            if !date.is_empty()
                && (date.len() != 10 || NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err())
            {
                return Err("Некорректная дата.".into());
            }
        }
        if t.repeat_count.is_some_and(|n| !(1..=999).contains(&n) || t.repeat.is_empty() || t.repeat_until.is_empty()) {
            return Err("Некорректное количество повторений.".into());
        }
        if t.repeat_interval.is_some_and(|n| !(1..=365).contains(&n))
            || t.repeat_weekdays.as_ref().is_some_and(|days| {
                days.iter().any(|d| *d > 6)
                    || days.iter().collect::<HashSet<_>>().len() != days.len()
                    || (t.repeat == "weekly" && days.is_empty())
            })
            || (!t.repeat.is_empty()
                && ((!t.repeat_until.is_empty() && t.repeat_until < t.due)
                    || (!t.repeat_anchor.is_empty() && t.repeat_anchor > t.due)))
        {
            return Err("Некорректный сценарий повторения.".into());
        }
        if !t.due_time.is_empty() {
            let bytes = t.due_time.as_bytes();
            if t.due.is_empty()
                || bytes.len() != 5
                || bytes[2] != b':'
                || ![bytes[0], bytes[1], bytes[3], bytes[4]]
                    .iter()
                    .all(u8::is_ascii_digit)
                || &t.due_time[0..2] > "23"
                || &t.due_time[3..5] > "59"
            {
                return Err("Некорректное время дела.".into());
            }
        }
        if !t.start.is_empty() && !t.due.is_empty() && t.start > t.due {
            return Err("Окончание раньше начала.".into());
        }
        validate_event(t)?;
        if !t.reminder.is_empty() && DateTime::parse_from_rfc3339(&t.reminder).is_err() {
            return Err("Некорректное время напоминания.".into());
        }
        let mut subtasks = HashSet::new();
        if t.subtasks.len() > 1000
            || t.subtasks.iter().any(|s| {
                !id_valid(&s.id) || !subtasks.insert(&s.id) || s.title.chars().count() > 500
            })
        {
            return Err("Некорректные подзадачи.".into());
        }
    }
    let mut indegrees = std::collections::HashMap::new();
    let mut outgoing: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();
    let mut occurrences = HashSet::new();
    for t in &data.tasks {
        let mut unique = HashSet::new();
        for dep in &t.depends_on {
            if !tasks.contains(dep.as_str()) || !unique.insert(dep) {
                return Err("Некорректная зависимость задачи.".into());
            }
            outgoing
                .entry(dep.as_str())
                .or_default()
                .push(t.id.as_str());
        }
        if t.previous_id
            .as_ref()
            .is_some_and(|id| !occurrences.insert(id))
        {
            return Err("Следующее повторение уже существует.".into());
        }
        indegrees.insert(t.id.as_str(), t.depends_on.len());
    }
    let mut queue: Vec<&str> = indegrees
        .iter()
        .filter(|(_, n)| **n == 0)
        .map(|(id, _)| *id)
        .collect();
    let mut visited = 0;
    while let Some(id) = queue.pop() {
        visited += 1;
        if let Some(children) = outgoing.get(id) {
            for child in children {
                let n = indegrees.get_mut(child).unwrap();
                *n -= 1;
                if *n == 0 {
                    queue.push(child);
                }
            }
        }
    }
    if visited != data.tasks.len() {
        return Err("Получился круг зависимостей. Уберите одну из связей.".into());
    }
    let mut notes = HashSet::new();
    for n in &data.notes {
        if !id_valid(&n.id)
            || !notes.insert(&n.id)
            || !text_valid(&n.title, 200)
            || n.body.len() > 1_000_000
            || n.project_id
                .as_ref()
                .is_some_and(|id| !projects.contains(id.as_str()))
        {
            return Err("Некорректная заметка.".into());
        }
    }
    Ok(())
}
pub fn save(db: &mut Connection, mut data: Data) -> Result<Data> {
    validate(&data)?;
    let tx = db
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(err)?;
    let revision: i64 = tx
        .query_row("SELECT revision FROM metadata WHERE id=1", [], |r| r.get(0))
        .map_err(err)?;
    if revision != data.revision {
        return Err(
            "Данные уже изменились. Перезапустите приложение перед повторным сохранением.".into(),
        );
    }
    tx.execute_batch("DELETE FROM notes; DELETE FROM tasks; DELETE FROM projects;")
        .map_err(err)?;
    tx.execute("DELETE FROM custom_areas", []).map_err(err)?;
    for (i, name) in data.custom_areas.iter().enumerate() {
        tx.execute(
            "INSERT INTO custom_areas VALUES (?1,?2)",
            params![name, i as i64],
        )
        .map_err(err)?;
    }
    for (i, p) in data.projects.iter().enumerate() {
        tx.execute(
            "INSERT INTO projects VALUES (?1,?2,?3)",
            params![p.id, i as i64, serde_json::to_string(p).map_err(err)?],
        )
        .map_err(err)?;
    }
    for (i, t) in data.tasks.iter().enumerate() {
        tx.execute(
            "INSERT INTO tasks VALUES (?1,?2,?3,?4)",
            params![
                t.id,
                t.project_id,
                i as i64,
                serde_json::to_string(t).map_err(err)?
            ],
        )
        .map_err(err)?;
    }
    for (i, n) in data.notes.iter().enumerate() {
        tx.execute(
            "INSERT INTO notes VALUES (?1,?2,?3,?4)",
            params![
                n.id,
                n.project_id,
                i as i64,
                serde_json::to_string(n).map_err(err)?
            ],
        )
        .map_err(err)?;
    }
    let preferences =
        serde_json::json!({"deletedAreas":data.deleted_areas,"areaIcons":data.area_icons,"character":data.character});
    tx.execute(
        "UPDATE area_preferences SET payload=?1 WHERE id=1",
        [preferences.to_string()],
    )
    .map_err(err)?;
    data.revision = revision
        .checked_add(1)
        .ok_or("Исчерпан счётчик изменений")?;
    tx.execute(
        "UPDATE metadata SET revision=?1 WHERE id=1",
        [data.revision],
    )
    .map_err(err)?;
    tx.commit().map_err(err)?;
    Ok(data)
}
pub fn delivery_key(t: &Task) -> String {
    format!("{}@{}", t.id, t.reminder)
}
pub fn due(tasks: &[Task], delivered: &HashSet<String>, now: DateTime<Utc>) -> Vec<Task> {
    tasks
        .iter()
        .filter(|t| t.status != "done")
        .flat_map(|task| {
            if !task.repeat.is_empty() && task.birthday.is_none() {
                return android_plan(&[task.clone()], now)
                    .into_iter()
                    .filter(|t| {
                        DateTime::parse_from_rfc3339(&t.reminder).is_ok_and(|at| at <= now)
                            && !delivered.contains(&delivery_key(t))
                    })
                    .collect::<Vec<_>>();
            }
            if let Some(birthday) = &task.birthday {
                let year = now.with_timezone(&Local).year();
                let created = birthday
                    .created_at
                    .as_ref()
                    .and_then(|date| DateTime::parse_from_rfc3339(date).ok())
                    .map(|date| date.with_timezone(&Utc));
                let mut result = Vec::new();
                for y in year - 1..=year + 1 {
                    let mut day = birthday.day;
                    while day > 0 && NaiveDate::from_ymd_opt(y, birthday.month, day).is_none() {
                        day -= 1;
                    }
                    if let Some(date) = NaiveDate::from_ymd_opt(y, birthday.month, day) {
                        for (offset, label) in [
                            (7, "день рождения через неделю"),
                            (1, "день рождения завтра"),
                            (0, "день рождения сегодня"),
                        ] {
                            if let Some(date) =
                                date.checked_sub_signed(chrono::Duration::days(offset))
                            {
                                if let Some(local) = Local
                                    .from_local_datetime(&date.and_hms_opt(9, 0, 0).unwrap())
                                    .earliest()
                                {
                                    let at = local.with_timezone(&Utc);
                                    if at <= now
                                        && at >= now - chrono::Duration::days(14)
                                        && created.is_none_or(|created| at >= created)
                                    {
                                        let mut occurrence = task.clone();
                                        occurrence.reminder =
                                            at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                                        occurrence.title = format!("{} · {}", task.title, label);
                                        if !delivered.contains(&delivery_key(&occurrence)) {
                                            result.push(occurrence);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                result
            } else if !delivered.contains(&delivery_key(task))
                && DateTime::parse_from_rfc3339(&task.reminder).is_ok_and(|date| date <= now)
            {
                vec![task.clone()]
            } else {
                vec![]
            }
        })
        .collect()
}
pub fn pending(db: &Connection, now: DateTime<Utc>) -> Result<Vec<Task>> {
    let mut stmt = db
        .prepare("SELECT delivery_key FROM deliveries")
        .map_err(err)?;
    let delivered = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(err)?
        .collect::<std::result::Result<HashSet<_>, _>>()
        .map_err(err)?;
    Ok(due(&load(db)?.tasks, &delivered, now))
}
pub fn mark_delivered(db: &mut Connection, tasks: &[Task], now: DateTime<Utc>) -> Result<()> {
    let tx = db.transaction().map_err(err)?;
    for t in tasks {
        tx.execute(
            "INSERT OR IGNORE INTO deliveries VALUES (?1,?2)",
            params![delivery_key(t), now.to_rfc3339()],
        )
        .map_err(err)?;
    }
    tx.commit().map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn task() -> Task {
        Task {
            handwriting: Vec::new(),
            id: "t".into(),
            title: "Курсовая".into(),
            area: "Учёба".into(),
            project_id: None,
            status: "todo".into(),
            start: String::new(),
            due: String::new(),
            due_time: String::new(),
            kind: String::new(),
            start_time: String::new(),
            reminder: "2026-10-12T12:00:00+03:00".into(),
            birthday: None,
            notes: String::new(),
            images: vec![],
            links: vec![],
            priority: 1,
            minutes: 60,
            subtasks: vec![],
            repeat: String::new(),
            repeat_interval: None,
            repeat_weekdays: None,
            repeat_until: String::new(),
            repeat_count: None,
            repeat_anchor: String::new(),
            repeat_day: None,
            repeat_completed: vec![],
            previous_id: None,
            depends_on: vec![],
        }
    }
    fn event(start: &str, start_time: &str, due: &str, due_time: &str) -> Task {
        let mut value = task();
        value.kind = "event".into();
        value.start = start.into();
        value.start_time = start_time.into();
        value.due = due.into();
        value.due_time = due_time.into();
        value.minutes = 0;
        value
    }
    fn valid(value: Task) -> bool {
        validate(&Data {
            tasks: vec![value],
            ..Data::default()
        })
        .is_ok()
    }
    #[test]
    fn facts_and_attachments_survive_reopen() {
      let mut value=task();value.kind="fact".into();value.reminder.clear();value.minutes=0;
      value.images.push(TaskImage{id:uuid::Uuid::new_v4().to_string(),name:"photo.jpg".into(),thumbnail:"data:image/jpeg;base64,/9j/2Q==".into(),width:100,height:100});
      value.links.push(TaskLink{id:"link".into(),label:"Сайт".into(),url:"https://example.com/".into()});
      assert!(valid(value.clone()));
      let mut bad=value.clone();bad.status="done".into();assert!(!valid(bad));
      let mut bad=value.clone();bad.due="2026-10-27".into();assert!(!valid(bad));
      let mut bad=value.clone();bad.links[0].url="javascript:alert(1)".into();assert!(!valid(bad));
      let mut bad=value.clone();bad.images=(0..11).map(|_|{let mut image=value.images[0].clone();image.id=uuid::Uuid::new_v4().to_string();image}).collect();assert!(!valid(bad));
      let dir=tempfile::tempdir().unwrap();let path=dir.path().join("facts.sqlite");
      {let mut db=open(&path).unwrap();save(&mut db,Data{tasks:vec![value],..Data::default()}).unwrap();}
      let data=load(&open(&path).unwrap()).unwrap();assert_eq!(data.tasks[0].kind,"fact");assert_eq!(data.tasks[0].images.len(),1);assert_eq!(data.tasks[0].links[0].url,"https://example.com/");
    }
    #[test]
    fn events_validate_and_survive_reopen() {
        // Same day, overnight, multi-day, and all-day (no times) events are valid.
        assert!(valid(event("2026-11-03", "14:00", "2026-11-03", "16:30")));
        assert!(valid(event("2026-11-03", "22:00", "2026-11-04", "02:00")));
        assert!(valid(event("2026-11-03", "09:00", "2026-11-07", "18:00")));
        assert!(valid(event("2026-11-03", "", "2026-11-07", "")));
        // Equal or reversed ends, half-set times and missing dates are rejected.
        assert!(!valid(event("2026-11-03", "14:00", "2026-11-03", "14:00")));
        assert!(!valid(event("2026-11-03", "16:00", "2026-11-03", "14:00")));
        assert!(!valid(event("2026-11-03", "14:00", "2026-11-03", "")));
        assert!(!valid(event("", "14:00", "2026-11-03", "15:00")));
        assert!(!valid(event("2026-11-03", "25:00", "2026-11-03", "26:00")));
        assert!(!valid(event("2026-11-03", "", "2027-11-04", "")));
        // A start time without the event kind is not allowed; unknown kinds neither.
        let mut plain = task();
        plain.start_time = "10:00".into();
        assert!(!valid(plain));
        let mut unknown = task();
        unknown.kind = "meeting".into();
        assert!(!valid(unknown));
        // Events round-trip through SQLite and old tasks stay without the new keys.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("event.sqlite");
        {
            let mut db = open(&path).unwrap();
            save(
                &mut db,
                Data {
                    tasks: vec![event("2026-11-03", "22:00", "2026-11-04", "02:00"), {
                        let mut other = task();
                        other.id = "plain".into();
                        other
                    }],
                    ..Data::default()
                },
            )
            .unwrap();
        }
        let db = open(&path).unwrap();
        let data = load(&db).unwrap();
        let saved = data.tasks.iter().find(|t| t.kind == "event").unwrap();
        assert_eq!(saved.start_time, "22:00");
        assert_eq!(saved.due_time, "02:00");
        let plain = data.tasks.iter().find(|t| t.id == "plain").unwrap();
        let json = serde_json::to_string(plain).unwrap();
        assert!(!json.contains("startTime") && !json.contains("\"kind\""));
    }
    #[test]
    fn custom_areas_survive_migration_and_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("custom.sqlite");
        {
            let db = Connection::open(&path).unwrap();
            db.execute_batch(include_str!("../../migrations/001_initial.sql"))
                .unwrap();
        }
        {
            let mut db = open(&path).unwrap();
            let mut data = load(&db).unwrap();
            data.custom_areas = vec!["Путешествия".into(), "Пустая сфера".into()];
            data.deleted_areas = vec!["Спорт".into()];
            data.area_icons
                .insert("Путешествия".into(), "travel".into());
            let mut value = task();
            value.area = "Путешествия".into();
            data.tasks.push(value);
            save(&mut db, data).unwrap();
        }
        let db = open(&path).unwrap();
        let data = load(&db).unwrap();
        assert_eq!(data.custom_areas.len(), 2);
        assert_eq!(data.tasks[0].area, "Путешествия");
        assert_eq!(data.deleted_areas, vec!["Спорт"]);
        assert_eq!(data.area_icons.get("Путешествия").unwrap(), "travel");
        assert!(std::fs::read_dir(dir.path()).unwrap().any(|entry| entry
            .unwrap()
            .path()
            .extension()
            .is_some_and(|ext| ext == "bak")));
        let mut invalid = data;
        invalid.custom_areas.push("работа".into());
        assert!(validate(&invalid).is_err());
    }
    #[test]
    fn all_life_areas_survive_reopen() {
        let areas = [
            "Работа",
            "Фриланс",
            "Квартира",
            "Еда",
            "Любовь",
            "Спорт",
            "Родные",
            "Здоровье",
            "Покупки",
            "Финансы",
            "Учёба",
            "Преподавание",
            "Аспирантура",
            "Личное",
        ];
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("areas.sqlite");
        {
            let mut db = open(&path).unwrap();
            let tasks = areas
                .iter()
                .enumerate()
                .map(|(i, area)| {
                    let mut value = task();
                    value.id = format!("area-{i}");
                    value.area = (*area).into();
                    value
                })
                .collect();
            save(
                &mut db,
                Data {
                    tasks,
                    ..Data::default()
                },
            )
            .unwrap();
        }
        let db = open(&path).unwrap();
        let loaded = load(&db).unwrap();
        assert_eq!(
            loaded
                .tasks
                .iter()
                .map(|t| t.area.as_str())
                .collect::<Vec<_>>(),
            areas
        );
        assert!(!area_valid("Неизвестная"));
    }
    #[test]
    fn persists_reopen_and_migration_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.sqlite");
        {
            let mut db = open(&path).unwrap();
            save(
                &mut db,
                Data {
                    tasks: vec![task()],
                    ..Data::default()
                },
            )
            .unwrap();
        }
        let db = open(&path).unwrap();
        let d = load(&db).unwrap();
        assert_eq!(d.revision, 1);
        assert_eq!(d.tasks[0].title, "Курсовая");
    }
    #[test]
    fn rejects_stale_revision_and_invalid_data_without_loss() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = open(&dir.path().join("data.sqlite")).unwrap();
        let saved = save(
            &mut db,
            Data {
                tasks: vec![task()],
                ..Data::default()
            },
        )
        .unwrap();
        assert!(save(&mut db, Data::default()).is_err());
        let mut invalid = saved.clone();
        invalid.tasks[0].project_id = Some("missing".into());
        assert!(save(&mut db, invalid).is_err());
        assert_eq!(load(&db).unwrap().tasks.len(), 1);
        let mut invalid = saved;
        invalid.tasks[0].due = "2026-02-30".into();
        assert!(save(&mut db, invalid).is_err());
    }
    #[test]
    fn missed_reminders_deduplicate_after_restart_and_snooze() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.sqlite");
        let now = DateTime::parse_from_rfc3339("2026-10-12T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        {
            let mut db = open(&path).unwrap();
            save(
                &mut db,
                Data {
                    tasks: vec![task()],
                    ..Data::default()
                },
            )
            .unwrap();
            let tasks = pending(&db, now).unwrap();
            assert_eq!(tasks.len(), 1);
            mark_delivered(&mut db, &tasks, now).unwrap();
        }
        let mut db = open(&path).unwrap();
        assert!(pending(&db, now).unwrap().is_empty());
        let mut data = load(&db).unwrap();
        data.tasks[0].reminder = "2026-10-12T10:15:00Z".into();
        save(&mut db, data).unwrap();
        assert!(pending(&db, now).unwrap().is_empty());
        assert_eq!(
            pending(&db, now + chrono::Duration::minutes(16))
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn birthday_reminders_are_annual_distinct_and_deduplicated() {
        let mut t = task();
        t.reminder = String::new();
        t.birthday = Some(Birthday {
            month: 1,
            day: 5,
            created_at: None,
        });
        let local = Local
            .with_ymd_and_hms(2027, 1, 5, 10, 0, 0)
            .earliest()
            .unwrap();
        let now = local.with_timezone(&Utc);
        let reminders = due(&[t.clone()], &HashSet::new(), now);
        assert_eq!(reminders.len(), 3);
        let delivered = reminders.iter().map(delivery_key).collect::<HashSet<_>>();
        assert!(due(&[t.clone()], &delivered, now).is_empty());
        assert_eq!(
            due(
                &[t.clone()],
                &delivered,
                Local
                    .with_ymd_and_hms(2028, 1, 5, 10, 0, 0)
                    .earliest()
                    .unwrap()
                    .with_timezone(&Utc)
            )
            .len(),
            3
        );
        t.birthday.as_mut().unwrap().created_at = Some(now.to_rfc3339());
        assert!(due(&[t], &HashSet::new(), now).is_empty());
    }
    #[test]
    fn completed_and_future_reminders_are_excluded() {
        let now = DateTime::parse_from_rfc3339("2026-10-12T08:59:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(due(&[task()], &HashSet::new(), now).is_empty());
        let mut t = task();
        t.status = "done".into();
        assert!(due(&[t], &HashSet::new(), now + chrono::Duration::hours(2)).is_empty());
    }
}

fn repeats_on(task: &Task, date: NaiveDate) -> bool {
    let Ok(due) = NaiveDate::parse_from_str(&task.due, "%Y-%m-%d") else {
        return false;
    };
    let base = NaiveDate::parse_from_str(&task.repeat_anchor, "%Y-%m-%d").unwrap_or(due);
    if date < due
        || date < base
        || (!task.repeat_until.is_empty() && date.to_string() > task.repeat_until)
    {
        return false;
    }
    let interval = i64::from(task.repeat_interval.unwrap_or(1).max(1));
    let delta = (date - base).num_days();
    match task.repeat.as_str() {
        "daily" => delta % interval == 0,
        "weekly" => {
            let monday =
                base - chrono::Duration::days(i64::from(base.weekday().num_days_from_monday()));
            let days = task
                .repeat_weekdays
                .clone()
                .unwrap_or(vec![due.weekday().num_days_from_monday()]);
            ((date - monday).num_days() / 7) % interval == 0
                && days.contains(&date.weekday().num_days_from_monday())
        }
        "monthly" => {
            let months = i64::from(date.year() - base.year()) * 12 + i64::from(date.month())
                - i64::from(base.month());
            let (year, month) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            let last = NaiveDate::from_ymd_opt(year, month, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
                .day();
            months >= 0
                && months % interval == 0
                && date.day() == task.repeat_day.unwrap_or(base.day()).min(last)
        }
        _ => false,
    }
}
pub fn android_plan(tasks: &[Task], now: DateTime<Utc>) -> Vec<Task> {
    let mut result = Vec::new();
    let parents: HashSet<_> = tasks
        .iter()
        .filter_map(|t| t.previous_id.as_deref())
        .collect();
    for task in tasks
        .iter()
        .filter(|task| task.kind != "fact" && task.status != "done" && !parents.contains(task.id.as_str()))
    {
        if let Some(birthday) = &task.birthday {
            let created = birthday
                .created_at
                .as_ref()
                .and_then(|date| DateTime::parse_from_rfc3339(date).ok())
                .map(|d| d.with_timezone(&Utc));
            let year = now.with_timezone(&Local).year();
            for y in year - 1..=year + 5 {
                let mut day = birthday.day;
                while day > 0 && NaiveDate::from_ymd_opt(y, birthday.month, day).is_none() {
                    day -= 1;
                }
                if let Some(date) = NaiveDate::from_ymd_opt(y, birthday.month, day) {
                    for (offset, label) in [
                        (7, "день рождения через неделю"),
                        (1, "день рождения завтра"),
                        (0, "день рождения сегодня"),
                    ] {
                        if let Some(date) = date.checked_sub_signed(chrono::Duration::days(offset))
                        {
                            if let Some(local) = Local
                                .from_local_datetime(&date.and_hms_opt(9, 0, 0).unwrap())
                                .earliest()
                            {
                                let at = local.with_timezone(&Utc);
                                if at >= now - chrono::Duration::days(14)
                                    && created.is_none_or(|start| at >= start)
                                {
                                    let mut item = task.clone();
                                    item.reminder =
                                        at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                                    item.title = format!("{} · {}", task.title, label);
                                    result.push(item);
                                }
                            }
                        }
                    }
                }
            }
        } else if !task.repeat.is_empty() && !task.reminder.is_empty() {
            if let (Ok(due), Ok(reminder)) = (
                NaiveDate::parse_from_str(&task.due, "%Y-%m-%d"),
                DateTime::parse_from_rfc3339(&task.reminder),
            ) {
                let local = reminder.with_timezone(&Local).naive_local();
                let offset = (local.date() - due).num_days();
                let today = now.with_timezone(&Local).date_naive();
                for day in -14..=366 {
                    let date = today + chrono::Duration::days(day - offset);
                    if !repeats_on(task, date) || task.repeat_completed.contains(&date.to_string())
                    {
                        continue;
                    }
                    let target = local + chrono::Duration::days((date - due).num_days());
                    if let Some(at) = Local.from_local_datetime(&target).earliest() {
                        let at = at.with_timezone(&Utc);
                        if at < now - chrono::Duration::days(14) {
                            continue;
                        }
                        let mut item = task.clone();
                        item.due = date.to_string();
                        item.reminder = at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                        result.push(item);
                    }
                }
            }
        } else if DateTime::parse_from_rfc3339(&task.reminder)
            .is_ok_and(|at| at >= now - chrono::Duration::days(14))
        {
            result.push(task.clone());
        }
    }
    result.sort_by_key(delivery_key);
    result
}
pub fn was_registered(db: &Connection, key: &str) -> Result<bool> {
    db.query_row(
        "SELECT EXISTS(SELECT 1 FROM deliveries WHERE delivery_key=?1)",
        [key],
        |row| row.get(0),
    )
    .map_err(err)
}
