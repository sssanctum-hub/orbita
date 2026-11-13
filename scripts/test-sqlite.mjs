import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const migration=readFileSync(new URL('../src-tauri/migrations/001_initial.sql',import.meta.url),'utf8');
test('production migration: persistent records, foreign keys, rollback, delivery deduplication',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'orbit-sqlite-test-')); const file=path.join(dir,'test.sqlite');
 let db;
 try {
  db=new DatabaseSync(file);db.exec(migration);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);
  db.prepare('INSERT INTO projects VALUES(?,?,?)').run('p',0,JSON.stringify({name:'Учёба'}));
  db.prepare('INSERT INTO tasks VALUES(?,?,?,?)').run('t','p',0,JSON.stringify({title:'Курсовая',dueTime:'14:35',repeatCompleted:['2026-10-12'],repeat:'weekly',repeatInterval:2,repeatWeekdays:[0,4],repeatUntil:'2027-12-31'}));
  assert.throws(()=>db.prepare('INSERT INTO tasks VALUES(?,?,?,?)').run('bad','missing',1,'{}'),/FOREIGN KEY/);
  db.exec('BEGIN; DELETE FROM tasks;');
  assert.throws(()=>db.prepare('INSERT INTO projects VALUES(?,?,?)').run('p',1,'{}'),/UNIQUE/);
  db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT count(*) AS n FROM tasks').get().n,1);
  db.prepare('INSERT OR IGNORE INTO deliveries VALUES(?,?)').run('t@2026-10-12T09:00:00Z','2026-10-12T10:00:00Z');
  db.exec(readFileSync(new URL('../src-tauri/migrations/002_custom_areas.sql',import.meta.url),'utf8'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
  db.prepare('INSERT INTO custom_areas VALUES(?,?)').run('Путешествия',0);
  db.exec(readFileSync(new URL('../src-tauri/migrations/003_area_preferences.sql',import.meta.url),'utf8'));
  db.prepare('UPDATE area_preferences SET payload=? WHERE id=1').run(JSON.stringify({deletedAreas:['Работа'],areaIcons:{'Путешествия':'travel'}}));
  db.close();db=new DatabaseSync(file);
  assert.deepEqual(JSON.parse(db.prepare('SELECT payload FROM area_preferences WHERE id=1').get().payload),{deletedAreas:['Работа'],areaIcons:{'Путешествия':'travel'}});
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);

  assert.equal(db.prepare('SELECT name FROM custom_areas').get().name,'Путешествия');

  assert.deepEqual(JSON.parse(db.prepare('SELECT payload FROM tasks WHERE id=?').get('t').payload),{title:'Курсовая',dueTime:'14:35',repeatCompleted:['2026-10-12'],repeat:'weekly',repeatInterval:2,repeatWeekdays:[0,4],repeatUntil:'2027-12-31'});
  db.prepare('INSERT INTO tasks VALUES(?,?,?,?)').run('birthday',null,1,JSON.stringify({title:'Анна',birthday:{month:1,day:5,createdAt:'2026-10-15T09:00:00Z'}}));
  db.close();db=new DatabaseSync(file);
  assert.deepEqual(JSON.parse(db.prepare('SELECT payload FROM tasks WHERE id=?').get('birthday').payload).birthday,{month:1,day:5,createdAt:'2026-10-15T09:00:00Z'});
  db.prepare('INSERT OR IGNORE INTO deliveries VALUES(?,?)').run('t@2026-10-12T09:00:00Z','2026-10-12T11:00:00Z');
  assert.equal(db.prepare('SELECT count(*) AS n FROM deliveries').get().n,1);
 }finally{db?.close();const resolved=realpathSync(dir);const temp=realpathSync(tmpdir());if(path.dirname(resolved)!==temp||!path.basename(resolved).startsWith('orbit-sqlite-test-'))throw Error('Unsafe temporary path');rmSync(resolved,{recursive:true,force:true})}
});
