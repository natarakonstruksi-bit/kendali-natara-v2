import sqlite3, pathlib, json, sys
root=pathlib.Path(__file__).resolve().parents[1]
migs=sorted((root/'migrations').glob('*.sql'))

def apply(con):
    for m in migs:
        try: con.executescript(m.read_text())
        except Exception as e:
            raise RuntimeError(f'{m.name}: {e}')

fresh=sqlite3.connect(':memory:'); apply(fresh)
meta=dict(fresh.execute('select key,value from schema_meta').fetchall())
print('Fresh migration OK:', len(migs), 'files')
print('Schema:', meta.get('schema_version'), '| Project control:', meta.get('project_control_version'))

up=sqlite3.connect(':memory:')
up.executescript('''
CREATE TABLE app_records (collection TEXT NOT NULL,id TEXT NOT NULL,data_json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id));
CREATE TABLE app_sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE app_login_attempts (key TEXT PRIMARY KEY,fail_count INTEGER NOT NULL DEFAULT 0,window_started_at TEXT NOT NULL,locked_until TEXT);
''')
up.execute("insert into app_records values(?,?,?,datetime('now'))",('users','qa-user',json.dumps({'name':'QA Existing','username':'qa','role':'Head Operational','status':'Aktif'})))
up.execute("insert into app_records values(?,?,?,datetime('now'))",('users','qa-pel',json.dumps({'name':'QA Pelaksana','username':'qapel','role':'Pelaksana Lapangan','status':'Aktif'})))
up.execute("insert into app_records values(?,?,?,datetime('now'))",('projects','qa-project',json.dumps({'name':'QA Existing Project','pmUserId':'qa-user','pelaksanaUserId':'qa-pel','qcUserId':'legacy-qc'})))
up.execute("insert into app_records values(?,?,?,datetime('now'))",('defects','qa-defect',json.dumps({'projectId':'qa-project','picUserId':'qa-pel','status':'OPEN','description':'Legacy finding'})))
apply(up)
assert up.execute("select count(*) from app_records where collection='users' and id='qa-user'").fetchone()[0]==1
assert up.execute("select count(*) from app_records where collection='projects' and id='qa-project'").fetchone()[0]==1
row=up.execute("select json_extract(data_json,'$.picUserId') from app_records where collection='defects' and id='qa-defect'").fetchone()
assert row and row[0]=='qa-user', f'0020 harus memindahkan PIC temuan existing ke PM, got {row}'
print('Upgrade preservation OK: existing user/project preserved; legacy defect PIC migrated to PM')
