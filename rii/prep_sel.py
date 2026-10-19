"""Prepara las asignaturas declaradas en el RII (una fila por estudiante y asignatura).

Uso: python3 prep_sel.py carpeta_con_tablas ruta_json_diligenciamiento
Entradas en la carpeta: rii_sel.pkl (selecciones del RII), ini.pkl (inscripciones al cierre del calendario
regular) y las inscripciones al cierre de adiciones y cancelaciones (ins_06_SEPTIEMBRE_* e ins_13_SEPTIEMBRE_*).
Genera sel_ext.pkl con: login, plan, asig, nombre, tip, prio, r (inscrita al cierre regular: 1 sí, 0 no,
-1 sin registro de inscripción) y f (igual, al cierre final). No incluye documento, usuario ni correo en la salida
del tablero, solo se usa para cruzar.
"""
import sys, os, json
import pandas as pd

ent, jfile = sys.argv[1], sys.argv[2]
S = pd.read_pickle(os.path.join(ent, 'rii_sel.pkl'))
ini = pd.read_pickle(os.path.join(ent, 'ini.pkl'))
fin = pd.concat([pd.read_pickle(os.path.join(ent, f)) for f in [
    'ins_13_SEPTIEMBRE_1101.pkl', 'ins_13_SEPTIEMBRE_1102.pkl',
    'ins_06_SEPTIEMBRE_1103_1104.pkl', 'ins_06_SEPTIEMBRE_9933_Y_SPN.pkl']])
fin = fin[fin.TIPO_NIVEL == 'PREGRADO']
for t in (ini, fin):
    for c in ['DOCUMENTO', 'COD_PLAN', 'COD_ASIGNATURA']:
        t[c] = t[c].astype(str).str.strip()

def marcas(t):
    reg = set(zip(t.DOCUMENTO, t.COD_PLAN))
    k3 = set(zip(t.DOCUMENTO, t.COD_PLAN, t.COD_ASIGNATURA))
    return reg, k3

reg_i, k3_i = marcas(ini)
reg_f, k3_f = marcas(fin)
S['asig'] = S.asig.astype(str).str.strip()
S['doc'] = S.doc.astype(str).str.strip()
S['plan'] = S.plan.astype(str).str.strip()
S['r'] = [(-1 if (d, p) not in reg_i else int((d, p, a) in k3_i)) for d, p, a in zip(S.doc, S.plan, S.asig)]
S['f'] = [(-1 if (d, p) not in reg_f else int((d, p, a) in k3_f)) for d, p, a in zip(S.doc, S.plan, S.asig)]

nombres = {}
for x in json.load(open(jfile, encoding='utf-8')):
    for q in (x.get('selecciones') or []):
        a = str(q['IdAsignatura']).strip()
        if a not in nombres and q.get('NombreAsignatura'):
            nombres[a] = q['NombreAsignatura']
S['nombre'] = S.asig.map(nombres)
S[['login', 'plan', 'asig', 'nombre', 'tip', 'prio', 'r', 'f']].to_pickle(os.path.join(ent, 'sel_ext.pkl'))
print(len(S), S.nombre.isna().sum(), S.r.value_counts().to_dict(), S.f.value_counts().to_dict())
