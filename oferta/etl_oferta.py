"""Prepara los datos del tablero de oferta de cupos y docentes ocasionales, Sede Medellín.

Uso: python3 etl_oferta.py carpeta_con_tablas datos
Tablas de entrada (pickle) en la carpeta:
  cup2.pkl    cupos, inscritos iniciales y cancelaciones por periodo y asignatura, con tipología (también alimenta la evolución por asignatura)
  G.pkl       grupos por periodo (cupo, inscritos, docente principal ocasional)
  doca.pkl    vinculaciones DOCA 2022-1S a 2026-2S
  R_tip.pkl   valor de cada vinculación repartido entre las asignaturas, con su tipología
  Wall.pkl    asignaturas de servicio (programas que las ven como obligatorias)
  lda3.pkl    calificaciones por grupo, para la tasa de pérdida
  X26.pkl     oferta de 2026-2S al 19 de agosto y al 12 de septiembre, con inscritos al 29 de agosto
Genera datos/oferta_datos.js. No se exporta cédula, nombre ni correo.
"""
import sys, os, json, re
import pandas as pd, numpy as np

ent, sal = sys.argv[1], sys.argv[2]
os.makedirs(sal, exist_ok=True)
rd = lambda n: pd.read_pickle(os.path.join(ent, n))
PER = ['2022-1S', '2022-2S', '2023-1S', '2023-2S', '2024-1S', '2024-2S', '2025-1S', '2025-2S', '2026-1S', '2026-2S']
MAT = [13306, 13216, 12895, 12352, 12405, 12296, 12078, 11948, 12257, None]

# ---------------------------------------------------------------- nombres de UAB y facultad
REN = {'ESCUELA DE ESTADISTICA': 'DEPARTAMENTO DE ESTADÍSTICA - FAC CIENCIAS', 'ESCUELA DE MATEMATICAS': 'DEPARTAMENTO DE MATEMÁTICAS - FAC CIENCIAS',
       'ESCUELA DE QUIMICA': 'DEPARTAMENTO DE QUÍMICA - FAC CIENCIAS', 'ESCUELA DE FISICA': 'DEPARTAMENTO DE FÍSICA - FAC CIENCIAS',
       'ESCUELA DE BIOCIENCIAS': 'DEPARTAMENTO DE BIOCIENCIAS - FAC CIENCIAS', 'ESCUELA DE GEOCIENCIAS': 'DEPARTAMENTO DE GEOCIENCIAS - FAC CIENCIAS'}
ESP = {'VICEDECANATURA FACULTAD DE CIENCIAS': 'Vicedecanatura Académica FC', 'VICEDECANATURA FACULTAD DE MINAS': 'Vicedecanatura Académica FM',
       'DIRECCION ACADEMICA': 'Dirección Académica', 'DIRECCIÓN DE INVESTIGACIÓN Y EXTENSIÓN': 'Dirección de Investigación y Extensión'}
PEQ = {'de', 'la', 'el', 'y', 'en', 'del', 'los', 'las'}
ACC = {'construccion': 'construcción', 'representacion': 'representación', 'planeacion': 'planeación', 'habitat': 'hábitat', 'educacion': 'educación',
       'ingenieria': 'ingeniería', 'estadistica': 'estadística', 'matematicas': 'matemáticas', 'quimica': 'química', 'fisica': 'física', 'bogota': 'Bogotá'}
def uab(s):
    if not isinstance(s, str): return 'Sin dato'
    s = REN.get(s.strip(), s.strip())
    if s in ESP: return ESP[s]
    s = re.sub(r'\s*-\s*FAC CIENCIAS', '', s)
    s = re.sub(r'^DEPARTAMENTO DE ', '', s)
    w = s.lower().split()
    w = [ACC.get(x, x) for x in w]
    out = [w[0].capitalize()] + [x if x in PEQ else x.capitalize() for x in w[1:]]
    return ' '.join(out).replace(' - ', ' ').replace('Escuela del hábitat', 'Escuela del Hábitat')
FAC = {'AGRARIAS': 'Facultad de Ciencias Agrarias', 'ARQUITECTURA': 'Facultad de Arquitectura', 'CIENCIAS': 'Facultad de Ciencias',
       'HUMANAS': 'Facultad de Ciencias Humanas y Económicas', 'MINAS': 'Facultad de Minas', 'VICERRECTORIA': 'Sede Medellín',
       'VIDA': 'Facultad de Ciencias de la Vida'}
def fac_g(s):
    s = re.sub(r'\s+', ' ', str(s)).strip().upper().replace('FACULTAD DE ', '')
    return {'CIENCIAS AGRARIAS': FAC['AGRARIAS'], 'ARQUITECTURA': FAC['ARQUITECTURA'], 'CIENCIAS': FAC['CIENCIAS'], 'CIENCIAS HUMANAS Y ECONÓMICAS': FAC['HUMANAS'],
            'MINAS': FAC['MINAS'], 'SEDE MEDELLÍN': FAC['VICERRECTORIA'], 'CIENCIAS DE LA VIDA': FAC['VIDA']}.get(s, 'Sin dato')

# ---------------------------------------------------------------- cupos y cancelación (cup2)
c = rd('cup2.pkl')
for x in ['NRO_INSCRITOS_INICIALES', 'CAN_DES_APERTURA']: c[x] = pd.to_numeric(c[x], errors='coerce').fillna(0)
# UAB que ofrece la asignatura: la última registrada, incluidas las filas del catálogo sin periodo
last = c.sort_values('PERIODO').groupby('asig').UAB.last().str.strip()
c = c[c.PERIODO.notna()].copy()
c['U'] = c.asig.map(last).map(uab)
npg = rd('Wall.pkl').npg
c['serv'] = c.asig.map(npg).fillna(0) >= 2
c['obl'] = c.obl.fillna(False).astype(bool)

# facultad de cada UAB, según la facultad que reporta cada asignatura
G = rd('G.pkl').rename(columns={'PERIODO_ASS': 'per'})
G['U'] = G.asig.map(last).fillna(G.uab).map(uab)
facU = G.assign(f=G.fac.map(fac_g)).groupby('U').f.agg(lambda s: s.value_counts().index[0]).to_dict()
facU['Dirección Académica'] = 'Sede Medellín'

# ---------------------------------------------------------------- grupos
G['obl'] = G.asig.map(c.drop_duplicates('asig').set_index('asig').obl).fillna(False).astype(bool)
G['serv'] = G.asig.map(npg).fillna(0) >= 2
G5 = G.copy()
G5['g5'] = (G5.cupo >= 5).astype(int)
G5['peq'] = ((G5.ins < 10) & (G5.g5 == 1)).astype(int)
G5['oc'] = G5.oc_ppal.astype(bool)
G5['cupo5'] = G5.cupo * G5.g5
G5['ins5'] = G5.ins.fillna(0) * G5.g5

# ---------------------------------------------------------------- docentes ocasionales
D = rd('doca.pkl'); D['PER'] = D.ARCHIVO.str.extract(r'(\d{4}-\dS)')[0]
D = D[D['CATEGORÍA'] != 'AD-HONOREM'].copy()
D['F'] = D.FACULTAD.str.strip().str.upper().map(lambda s: FAC.get(s, 'Sin dato'))
R = rd('R_tip.pkl')
R['F'] = R.row.map(D.F)
order = ['Obligatorias', 'Optativas', 'Nivelación', 'Libre elección', 'Otras', 'Sin asignatura identificada']
def dm(s):
    vc = s.value_counts(); top = vc[vc == vc.max()].index
    return sorted(top, key=order.index)[0]
dg = R.groupby(['PER', 'CED']).agg(g=('g', dm), F=('F', 'first')).reset_index()
rename_tip = {'Otras': 'Sin tipología identificada', 'Sin asignatura identificada': 'Sin tipología identificada'}
dg['g'] = dg.g.replace(rename_tip); R['g'] = R.g.replace(rename_tip)
TIPS = ['Obligatorias', 'Optativas', 'Nivelación', 'Libre elección', 'Sin tipología identificada']

# ---------------------------------------------------------------- pérdida
L = rd('lda3.pkl')
L = L[(L.TIPO == 'INS') & L.CALIFICACION_ALFABETICA.isin(['AP', 'RE', 'PF']) & L.PERIODO.str.endswith('S') & (L.TIPO_NIVEL == 'PREGRADO')].copy()
L['asig'] = L.COD_ASIGNATURA.str.strip(); L['grp'] = L.GRUPO_ASIGNATURA.astype(str).str.strip()
L = L.merge(G[['per', 'asig', 'grp', 'oc_ppal']], left_on=['PERIODO', 'asig', 'grp'], right_on=['per', 'asig', 'grp'], how='left')
L = L[L.oc_ppal.notna()].copy()
L['oc'] = L.oc_ppal.astype(bool); L['perd'] = (L.CALIFICACION_ALFABETICA != 'AP').astype(int)
both = L.groupby(['PERIODO', 'asig']).oc.nunique(); both = set(both[both == 2].index)
L['mism'] = [(p, a) in both for p, a in zip(L.PERIODO, L.asig)]
L['U'] = L.asig.map(last).map(uab); L['obl'] = L.asig.map(c.drop_duplicates('asig').set_index('asig').obl).fillna(False).astype(bool)
L['serv'] = L.asig.map(npg).fillna(0) >= 2

# ---------------------------------------------------------------- oferta 2026-2S
X = rd('X26.pkl')
X['U'] = X.UAB.map(lambda s: uab(s) if isinstance(s, str) else 'Sin dato')
X['est'] = np.select([X.cap12.isna(), X.cap12 < 5, X.disp12 <= 0, X.mat12 < 10], ['Cerrado', 'Menos de 5 cupos', 'Lleno', 'Menos de 10'], 'Con cupos')

# ---------------------------------------------------------------- catálogos y tablas
ESTADOS = ['Lleno', 'Con cupos', 'Menos de 10', 'Menos de 5 cupos', 'Cerrado']
allU = sorted(set(c.U) | set(G5.U) | set(L.U) | set(X.U))
allU = [u for u in allU if u != 'Sin dato'] + (['Sin dato'] if 'Sin dato' in allU else [])
for u in allU: facU.setdefault(u, 'Sin dato')
FACS = sorted(set(facU.values()) | set(FAC.values()))
CAT = {'periodo': PER, 'facultad': FACS, 'uab': allU,
       'obligatoria': ['Obligatoria', 'No obligatoria'], 'servicio': ['De servicio', 'Otras'],
       'docente': ['Docente ocasional', 'Otros docentes'], 'tipologia': TIPS, 'mismaasig': ['Misma asignatura', 'Otras asignaturas']}
ix = lambda k: {v: i for i, v in enumerate(CAT[k])}
def cols(df, spec, med):
    out = {}
    for k, col in spec.items(): out[k] = df[col].map(ix(k) if k in CAT else k).astype(int).tolist()
    for m in med: out[m] = [float(round(v, 4)) if abs(v - round(v)) > 1e-9 else int(round(v)) for v in df[m]]
    return out
def tabla(df, spec, med):
    r = cols(df, spec, med); return {'campos': list(r), 'filas': list(r.values())}
def lab(df, o, s, d):
    df = df.copy()
    df['periodo'] = df[o] if o in df else None
    return df

# B: cupos y cancelación
B = c.assign(periodo=c.PERIODO, uab=c.U, facultad=c.U.map(facU), obligatoria=np.where(c.obl, 'Obligatoria', 'No obligatoria'),
             servicio=np.where(c.serv, 'De servicio', 'Otras'))
B = B.groupby(['periodo', 'facultad', 'uab', 'obligatoria', 'servicio']).agg(cupos=('CUPOS', 'sum'), ini=('NRO_INSCRITOS_INICIALES', 'sum'),
        can=('CAN_DES_APERTURA', 'sum'), asig=('asig', 'nunique')).reset_index()
# A: grupos
A = G5.assign(periodo=G5.per, uab=G5.U, facultad=G5.U.map(facU), obligatoria=np.where(G5.obl, 'Obligatoria', 'No obligatoria'),
              servicio=np.where(G5.serv, 'De servicio', 'Otras'), docente=np.where(G5.oc, 'Docente ocasional', 'Otros docentes'))
A = A.groupby(['periodo', 'facultad', 'uab', 'obligatoria', 'servicio', 'docente']).agg(grupos=('g5', 'sum'), cupos=('cupo5', 'sum'), ins=('ins5', 'sum'),
        peq=('peq', 'sum'), cupos_t=('cupo', 'sum')).reset_index()
# C: docentes y valor
Cd = dg.assign(periodo=dg.PER, facultad=dg.F, tipologia=dg.g).groupby(['periodo', 'facultad', 'tipologia']).size().rename('docentes').reset_index()
Cv = R.assign(periodo=R.PER, facultad=R.F, tipologia=R.g).groupby(['periodo', 'facultad', 'tipologia']).val.sum().rename('valor').reset_index()
Cv['valor'] = Cv.valor / 1e6
Cdv = Cd.merge(Cv, on=['periodo', 'facultad', 'tipologia'], how='outer').fillna(0)
# E: pérdida
E = L.assign(periodo=L.PERIODO, uab=L.U, facultad=L.U.map(facU), obligatoria=np.where(L.obl, 'Obligatoria', 'No obligatoria'),
             servicio=np.where(L.serv, 'De servicio', 'Otras'), docente=np.where(L.oc, 'Docente ocasional', 'Otros docentes'),
             mismaasig=np.where(L.mism, 'Misma asignatura', 'Otras asignaturas'))
E = E.groupby(['periodo', 'facultad', 'uab', 'obligatoria', 'servicio', 'docente', 'mismaasig']).agg(n=('perd', 'size'), perd=('perd', 'sum')).reset_index()
# F: oferta 2026-2S
Xo = X.assign(obl=np.where(X.obl, 'Obligatoria', 'No obligatoria'), docente=np.where(X.oc, 'Docente ocasional', 'Otros docentes'),
              facultad=X.U.map(facU).fillna('Sin dato'),
              nuevo=X.nuevo.astype(int), cerrado=X.cerrado.astype(int))
Xo['uab'] = Xo.U; Xo['obligatoria'] = Xo.obl; Xo['servicio'] = 'Otras'
Xo = Xo.rename(columns={'est': 'estado'})
for k in ['cap19', 'cap12', 'mat12', 'ins29', 'disp12']: Xo[k] = Xo[k].fillna(0)
Xo['ng19'] = Xo.cap19.gt(0).astype(int); Xo['ng12'] = Xo.cap12.gt(0).astype(int)
Xo['ampl'] = np.where((Xo.ng19 == 1) & (Xo.ng12 == 1), (Xo.cap12 - Xo.cap19).clip(lower=0), 0)
Xo['redu'] = np.where((Xo.ng19 == 1) & (Xo.ng12 == 1), (Xo.cap19 - Xo.cap12).clip(lower=0), 0)
Xo['cnue'] = np.where(Xo.nuevo == 1, Xo.cap12, 0); Xo['ccer'] = np.where(Xo.cerrado == 1, Xo.cap19, 0)
Xo['ins29e'] = np.where(Xo.ng19 == 1, Xo.ins29, 0)  # inscritos al 29 de agosto en grupos que ya existían el 19 de agosto
CAT['estado'] = ESTADOS
Xo = Xo.groupby(['facultad', 'uab', 'obligatoria', 'docente', 'estado']).agg(
    g19=('ng19', 'sum'), g12=('ng12', 'sum'), cap19=('cap19', 'sum'), cap12=('cap12', 'sum'), mat12=('mat12', 'sum'), ins29=('ins29', 'sum'),
    disp=('disp12', 'sum'), nue=('nuevo', 'sum'), cer=('cerrado', 'sum'), cnue=('cnue', 'sum'), ccer=('ccer', 'sum'),
    ampl=('ampl', 'sum'), redu=('redu', 'sum'), ins29e=('ins29e', 'sum')).reset_index()

# H: evolución por asignatura (2022-1S a 2026-1S): inscritos iniciales y cancelaciones después de la apertura del acta
ROM = {'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'}
def nom_asig(t):
    t = re.sub(r'\s+', ' ', str(t).strip().lower())
    t = t[:1].upper() + t[1:]
    return ' '.join(w.upper() if (w in ROM and k > 0) else w for k, w in enumerate(t.split(' ')))
NP = 9
H = c[c.PERIODO.isin(PER[:NP])].copy()
H['p'] = H.PERIODO.map({p: i for i, p in enumerate(PER)})
nombre_por_asig = H.sort_values('PERIODO').groupby('asig').ASIGNATURA.last().map(nom_asig)
ficha = H.sort_values('PERIODO').groupby('asig').agg(U=('U', 'last'), obl=('obl', 'last'), serv=('serv', 'last')).reset_index()
ficha['nombre'] = ficha.asig.map(nombre_por_asig)
ficha['etq'] = ficha.nombre + ', ' + ficha.asig
ficha = ficha.sort_values('etq').reset_index(drop=True)
CAT['asignatura'] = ficha.etq.tolist()
ficha['facultad'] = ficha.U.map(facU).fillna('Sin dato')
ficha['uab'] = ficha.U
ficha['obligatoria'] = np.where(ficha.obl, 'Obligatoria', 'No obligatoria')
ficha['servicio'] = np.where(ficha.serv, 'De servicio', 'Otras')
ficha['asignatura'] = ficha.etq
for medida, col in [('ini', 'NRO_INSCRITOS_INICIALES'), ('can', 'CAN_DES_APERTURA')]:
    m = H.pivot_table(index='asig', columns='p', values=col, aggfunc='sum').reindex(index=ficha.asig, columns=range(NP))
    for k in range(NP): ficha[f'{medida}{k}'] = m[k].values
Hm = ficha[[f'{m}{k}' for m in ('ini', 'can') for k in range(NP)]]
ficha[Hm.columns] = Hm.where(Hm.notna(), -1).astype(int)   # -1: la asignatura no se ofreció en ese semestre
EV = tabla(ficha, {'facultad': 'facultad', 'uab': 'uab', 'obligatoria': 'obligatoria', 'servicio': 'servicio', 'asignatura': 'asignatura'},
           list(Hm.columns))

datos = {'catalogos': CAT, 'periodos': PER, 'matriculados': MAT, 'evolucion': EV,
  'oferta': tabla(B, {'periodo': 'periodo', 'facultad': 'facultad', 'uab': 'uab', 'obligatoria': 'obligatoria', 'servicio': 'servicio'}, ['cupos', 'ini', 'can', 'asig']),
  'grupos': tabla(A, {'periodo': 'periodo', 'facultad': 'facultad', 'uab': 'uab', 'obligatoria': 'obligatoria', 'servicio': 'servicio', 'docente': 'docente'},
                  ['grupos', 'cupos', 'ins', 'peq', 'cupos_t']),
  'docentes': tabla(Cdv, {'periodo': 'periodo', 'facultad': 'facultad', 'tipologia': 'tipologia'}, ['docentes', 'valor']),
  'perdida': tabla(E, {'periodo': 'periodo', 'facultad': 'facultad', 'uab': 'uab', 'obligatoria': 'obligatoria', 'servicio': 'servicio', 'docente': 'docente',
                       'mismaasig': 'mismaasig'}, ['n', 'perd']),
  'oferta26': tabla(Xo, {'facultad': 'facultad', 'uab': 'uab', 'obligatoria': 'obligatoria', 'docente': 'docente', 'estado': 'estado'},
                    ['g19', 'g12', 'cap19', 'cap12', 'mat12', 'ins29', 'disp', 'nue', 'cer', 'cnue', 'ccer', 'ampl', 'redu', 'ins29e'])}
open(os.path.join(sal, 'oferta_datos.js'), 'w', encoding='utf-8').write('window.OFERTA = window.OFERTA || {};\nwindow.OFERTA.datos = ' + json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + ';\n')

# ---------------------------------------------------------------- control
print('Cupos por periodo', B.groupby('periodo').cupos.sum().reindex(PER).astype(int).tolist())
print('Cancelación %', (B.groupby('periodo').can.sum() / B.groupby('periodo').ini.sum() * 100).reindex(PER).round(1).tolist())
print('Docentes', Cd.groupby('periodo').docentes.sum().reindex(PER).tolist())
print('Valor millones', Cv.groupby('periodo').valor.sum().reindex(PER).round(0).tolist())
a = A.groupby(['periodo', 'docente'])[['grupos', 'cupos', 'ins', 'peq', 'cupos_t']].sum()
oc = a.xs('Docente ocasional', level=1); ot = a.xs('Otros docentes', level=1); tt = oc + ot
print('Cupos ocasionales todos los grupos', oc.cupos_t.reindex(PER).astype(int).tolist())
print('Cupos ocasionales', oc.cupos.reindex(PER).astype(int).tolist())
print('% cupos oc', (oc.cupos / tt.cupos * 100).reindex(PER).round(1).tolist(), '% grupos', (oc.grupos / tt.grupos * 100).reindex(PER).round(1).tolist())
print('cupos/grupo oc', (oc.cupos / oc.grupos).reindex(PER).round(1).tolist(), 'otros', (ot.cupos / ot.grupos).reindex(PER).round(1).tolist())
print('% peq oc', (oc.peq / oc.grupos * 100).reindex(PER).round(1).tolist(), 'otros', (ot.peq / ot.grupos * 100).reindex(PER).round(1).tolist())
e = E.groupby(['periodo', 'docente'])[['n', 'perd']].sum(); print('pérdida oc 2026-1S', (e.perd / e.n * 100).xs('2026-1S', level='periodo').round(1).to_dict())
print('ocup inicial', Xo.ins29e.sum() / Xo.cap19.sum() * 100, 'final', Xo.mat12.sum() / Xo.cap12.sum() * 100)
x = Xo[['g19', 'g12', 'cap19', 'cap12', 'mat12', 'ins29', 'disp', 'cnue', 'ccer', 'ampl', 'redu', 'nue', 'cer']].sum(); print(x.to_dict())
print({k: len(v['filas'][0]) for k, v in datos.items() if isinstance(v, dict) and 'filas' in v}, os.path.getsize(os.path.join(sal, 'oferta_datos.js')) // 1024, 'KB')
