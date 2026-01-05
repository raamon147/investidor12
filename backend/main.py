import os
import shutil
import tempfile
import certifi
import requests
import yfinance as yf
import pandas as pd
import math
from concurrent.futures import ThreadPoolExecutor # Essencial para velocidade
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import date, datetime, timedelta
from typing import List

# --- FIX SSL ---
try:
    original_ca = certifi.where()
    temp_dir = tempfile.gettempdir()
    safe_ca_path = os.path.join(temp_dir, "cacert_fix.pem")
    shutil.copy(original_ca, safe_ca_path)
    os.environ["REQUESTS_CA_BUNDLE"] = safe_ca_path
    os.environ["SSL_CERT_FILE"] = safe_ca_path
except Exception:
    requests.packages.urllib3.disable_warnings()

def safe_float(val):
    try:
        if val is None: return 0.0
        if isinstance(val, (pd.Series, pd.DataFrame)):
            if val.empty: return 0.0
            val = val.iloc[0]
        if hasattr(val, 'item'): val = val.item()
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0.0
        return f
    except: return 0.0

# DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./meu_patrimonio_v2.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TransactionDB(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    date = Column(Date)
    quantity = Column(Float)
    price = Column(Float)
    type = Column(String)

Base.metadata.create_all(bind=engine)

class TransactionCreate(BaseModel):
    ticker: str
    date: date
    quantity: float
    price: float
    type: str

app = FastAPI(title="Investidor12 Local")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- HELPERS OTIMIZADOS ---

def get_realtime_price_worker(ticker):
    """Pega preço individualmente de forma segura"""
    try:
        t = yf.Ticker(ticker)
        # Tenta fast_info (Leve e rápido)
        p = t.fast_info.get('last_price')
        if p and not math.isnan(p): return ticker, safe_float(p)
        
        # Tenta fallback history
        h = t.history(period="1d")
        if not h.empty: return ticker, safe_float(h['Close'].iloc[-1])
        
        return ticker, 0.0
    except: return ticker, 0.0

def get_divs_worker(ticker):
    try: return ticker, yf.Ticker(ticker).dividends
    except: return ticker, None

# --- ROTAS ---

@app.post("/transactions/")
def create_transaction(trans: TransactionCreate, db: Session = Depends(get_db)):
    db.add(TransactionDB(ticker=trans.ticker.upper(), date=trans.date, quantity=trans.quantity, price=trans.price, type=trans.type))
    db.commit()
    return {"message": "OK"}

@app.post("/transactions/bulk")
def create_bulk(transactions: List[TransactionCreate], db: Session = Depends(get_db)):
    for t in transactions:
        db.add(TransactionDB(ticker=t.ticker.upper(), date=t.date, quantity=t.quantity, price=t.price, type=t.type))
    db.commit()
    return {"message": "OK"}

@app.delete("/transactions/clear_all")
def clear_all(db: Session = Depends(get_db)):
    db.query(TransactionDB).delete()
    db.commit()
    return {"message": "Limpo"}

@app.get("/transactions/")
def list_transactions(db: Session = Depends(get_db)):
    res = db.query(TransactionDB).order_by(TransactionDB.date.desc()).all()
    # Garante retorno de lista vazia se não houver dados, para não quebrar o front
    return res if res else []

@app.delete("/transactions/{id}")
def delete_trans(id: int, db: Session = Depends(get_db)):
    db.query(TransactionDB).filter(TransactionDB.id == id).delete()
    db.commit()
    return {"message": "OK"}

@app.put("/transactions/{id}")
def update_trans(id: int, trans: TransactionCreate, db: Session = Depends(get_db)):
    t = db.query(TransactionDB).filter(TransactionDB.id == id).first()
    if t:
        t.ticker, t.date, t.quantity, t.price, t.type = trans.ticker.upper(), trans.date, trans.quantity, trans.price, trans.type
        db.commit()
    return {"message": "OK"}

@app.get("/get-price")
def price_check(ticker: str, date: str):
    t, p = get_realtime_price_worker(ticker.upper())
    return {"price": round(p, 2)}

@app.get("/earnings")
def get_earnings(db: Session = Depends(get_db)):
    trans = db.query(TransactionDB).all()
    if not trans: 
        return {"total_acumulado": 0, "historico_mensal": [], "por_ativo": [], "por_classe": [], "detalhes": []}

    holdings = {}
    for t in trans:
        if t.ticker not in holdings: holdings[t.ticker] = []
        holdings[t.ticker].append(t)

    # Download paralelo de dividendos (limite 4 threads para evitar bloqueio)
    div_data = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = ex.map(get_divs_worker, list(holdings.keys()))
        for t, d in results: 
            if d is not None: div_data[t] = d

    total_recebido = 0
    monthly = {}
    by_ticker = {}
    by_class = {}
    detalhes = []

    for ticker, t_list in holdings.items():
        if ticker not in div_data or div_data[ticker].empty: continue
        
        divs = div_data[ticker]
        # Correção de timezone
        if divs.index.tz is not None: divs.index = divs.index.tz_localize(None)
        
        first_buy_date = min(t.date for t in t_list)
        first_buy_ts = pd.Timestamp(first_buy_date)
        try: divs = divs[divs.index >= first_buy_ts]
        except: pass

        asset_type = t_list[0].type
        tick_val = 0
        
        for dt, val in divs.items():
            qty = sum(t.quantity for t in t_list if t.date < dt.date())
            if qty > 0:
                payment = qty * val
                tick_val += payment
                total_recebido += payment
                
                m = dt.strftime("%Y-%m")
                if m not in monthly: monthly[m] = {"total":0}
                monthly[m]["total"] += payment
                if asset_type not in monthly[m]: monthly[m][asset_type] = 0
                monthly[m][asset_type] += payment
                
                detalhes.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "ticker": ticker.replace('.SA', ''),
                    "type": asset_type,
                    "val": safe_float(payment)
                })
        
        if tick_val > 0:
            by_ticker[ticker] = tick_val
            by_class[asset_type] = by_class.get(asset_type, 0) + tick_val

    detalhes.sort(key=lambda x: x['date'])
    hist = []
    for m in sorted(monthly.keys()):
        y, mo = m.split('-')
        obj = {"mes": date(int(y), int(mo), 1).strftime("%b/%y"), "total": safe_float(monthly[m]["total"])}
        for k, v in monthly[m].items(): 
            if k != "total": obj[k] = safe_float(v)
        hist.append(obj)

    t_list = [{"name": k.replace('.SA',''), "value": safe_float(v)} for k,v in by_ticker.items()]
    t_list.sort(key=lambda x:x["value"], reverse=True)
    c_list = [{"name": k, "value": safe_float(v)} for k,v in by_class.items()]
    c_list.sort(key=lambda x:x["value"], reverse=True)

    return {"total_acumulado": safe_float(total_recebido), "historico_mensal": hist, "por_ativo": t_list, "por_classe": c_list, "detalhes": detalhes}

@app.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    trans = db.query(TransactionDB).all()
    if not trans:
        return {"patrimonio_atual":0,"total_investido":0,"lucro":0,"rentabilidade_pct":0,"daily_variation":0,"grafico":[],"ativos":[]}

    tickers = list(set(t.ticker for t in trans))
    
    # 1. PREÇOS ATUAIS (Correção do Preço = PM)
    # Baixa em paralelo usando fast_info (muito mais seguro)
    precos_atuais = {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        for t, p in ex.map(get_realtime_price_worker, tickers):
            precos_atuais[t] = p

    # 2. HISTÓRICO (Para o gráfico)
    # Tenta baixar, se falhar, o gráfico vai mostrar apenas a linha do "Investido"
    try:
        dados_historicos = yf.download(tickers, period="6mo", progress=False, auto_adjust=True)['Close']
    except:
        dados_historicos = pd.DataFrame()

    # --- CÁLCULO PATRIMÔNIO ---
    patrimonio_total = 0
    investido_total = 0
    daily_var_money = 0
    patrimonio_ontem = 0
    ativos_finais = []
    
    trans_map = {}
    for t in trans:
        if t.ticker not in trans_map: trans_map[t.ticker] = {"qtd":0, "custo":0, "type":t.type}
        trans_map[t.ticker]["qtd"] += t.quantity
        trans_map[t.ticker]["custo"] += (t.quantity * t.price)

    is_weekend = date.today().weekday() >= 5

    for tick, d in trans_map.items():
        if d["qtd"] > 0:
            pm = d["custo"] / d["qtd"]
            
            # Usa o preço baixado em paralelo. Se 0, usa PM (Fallback)
            p_atual = precos_atuais.get(tick, 0.0)
            if p_atual == 0: p_atual = pm 
            
            tot = d["qtd"] * p_atual
            rent = ((p_atual - pm) / pm) * 100 if pm > 0 else 0
            
            var_pct = 0.0
            # Tenta calcular variação se houver histórico e não for FDS
            if not is_weekend and not dados_historicos.empty:
                try:
                    s = dados_historicos[tick] if len(tickers) > 1 else dados_historicos
                    s = s.dropna()
                    if len(s) >= 2:
                        last = safe_float(s.iloc[-1])
                        prev = safe_float(s.iloc[-2])
                        if prev > 0: var_pct = ((last - prev) / prev) * 100
                except: pass
            
            money_var = tot - (tot / (1 + var_pct/100))
            patrimonio_total += tot
            investido_total += d["custo"]
            daily_var_money += money_var
            patrimonio_ontem += (tot - money_var)
            
            ativos_finais.append({
                "ticker": tick, "type": d["type"], 
                "qtd": safe_float(d["qtd"]), "pm": safe_float(pm),
                "atual": safe_float(p_atual), "total": safe_float(tot), 
                "rentabilidade": safe_float(rent), "variacao_diaria": safe_float(var_pct)
            })

    ativos_finais.sort(key=lambda x:x['total'], reverse=True)
    lucro = patrimonio_total - investido_total
    rent_total = (lucro / investido_total * 100) if investido_total > 0 else 0
    daily_pct = (daily_var_money / patrimonio_ontem * 100) if patrimonio_ontem > 0 else 0

    # --- GRÁFICO (Resiliente a falhas) ---
    evolucao_grafico = []
    primeira_data = trans[0].date
    hoje = date.today()
    rng = pd.date_range(start=primeira_data, end=hoje)
    
    posicao_tempo = {t:0 for t in tickers}
    custo_tempo = 0
    # Agrupa transações por dia string
    map_trans_date = {}
    for tr in trans:
        ds = tr.date.strftime("%Y-%m-%d")
        if ds not in map_trans_date: map_trans_date[ds] = []
        map_trans_date[ds].append(tr)

    for dia in rng:
        d_str = dia.strftime("%Y-%m-%d")
        # Atualiza posição
        if d_str in map_trans_date:
            for tr in map_trans_date[d_str]:
                posicao_tempo[tr.ticker] += tr.quantity
                custo_tempo += (tr.quantity * tr.price)
        
        # Só calcula pontos para o gráfico se houver custo e for (Sexta ou Hoje) para otimizar
        if custo_tempo > 0 and (dia.weekday() == 4 or dia.date() == hoje):
            val_mercado = 0
            if not dados_historicos.empty:
                try:
                    # Pega preços desse dia (ou anterior mais próximo)
                    if len(tickers) == 1: prices = dados_historicos.asof(dia)
                    else: prices = dados_historicos.iloc[dados_historicos.index.get_indexer([dia], method='pad')[0]]
                    
                    for t, q in posicao_tempo.items():
                        if q > 0:
                            p = safe_float(prices[t]) if len(tickers) > 1 else safe_float(prices)
                            if p > 0: val_mercado += q * p
                except: pass
            
            # Se não conseguiu preço de mercado, usa o custo para a linha não ir a zero
            pat = val_mercado if val_mercado > 0 else custo_tempo
            
            evolucao_grafico.append({
                "name": dia.strftime("%d/%m/%y"),
                "investido": safe_float(custo_tempo),
                "patrimonio": safe_float(pat)
            })

    return {
        "patrimonio_atual": safe_float(round(patrimonio_total, 2)),
        "total_investido": safe_float(round(investido_total, 2)),
        "lucro": safe_float(round(lucro, 2)),
        "rentabilidade_pct": safe_float(round(rent_total, 2)),
        "daily_variation": safe_float(round(daily_pct, 2)),
        "grafico": evolucao_grafico,
        "ativos": ativos_finais
    }

# --- RAIO-X BLINDADO ---
@app.get("/analyze/{ticker}")
def analyze(ticker: str):
    ticker = ticker.upper().strip()
    clean = ticker.replace('.SA', '')
    if not ticker.endswith('.SA'): ticker += '.SA'
    
    # Objeto de resposta padrão (para não dar erro 400/500)
    res = {
        "ticker": clean, "price": 0, "score": 0, "verdict": "Indisponível",
        "criteria": {
            "profit": {"status": "GRAY", "years": 0, "profitable": 0},
            "governance": {"status": "GRAY", "type": "N/A"},
            "debt": {"status": "GRAY", "current_ratio": 0},
            "ipo": {"status": "GRAY", "years": 0}
        }
    }

    try:
        t = yf.Ticker(ticker)
        # Tenta pegar info. Se falhar, retorna o objeto padrão sem crashar
        try: i = t.info
        except: return res
        
        if not i: return res

        res["price"] = i.get('currentPrice', 0)
        
        # 1. IPO
        ipo = 0
        MAMUTES = ['VALE3','PETR4','PETR3','ITUB4','BBDC4','BBDC3','BBAS3','ABEV3','WEGE3','EGIE3','ITSA4','SANB11','GGBR4','GOAU4','CMIG4','ELET3','ELET6','CSNA3','RADL3','VIVT3','TIMS3','CSMG3','SBSP3','CPLE6','TAEE11','KLBN11','VULC3','LEVE3','TUPY3','PRIO3','POMO4','SAPR11','TRPL4','FLRY3','RENT3','LREN3','JBSS3','BRFS3','MGLU3']
        if clean in MAMUTES: ipo = 20
        else:
            ts = i.get('firstTradeDateEpochUtc')
            if ts: ipo = (datetime.now() - datetime.fromtimestamp(ts)).days / 365
            else: ipo = 5
        
        s_ipo = "GREEN" if ipo > 7 else ("YELLOW" if ipo >= 5 else "RED")
        sc = 2 if s_ipo == "GREEN" else (1 if s_ipo == "YELLOW" else 0)
        
        # 2. Lucro
        prof_ok = False
        yrs = 0
        try:
            fin = t.financials
            if not fin.empty and 'Net Income' in fin.index:
                v = [x for x in fin.loc['Net Income'].values if not pd.isna(x)]
                if v:
                    yrs = len(v)
                    # Exige 100% de lucro nos anos analisados para ser verde
                    if sum(1 for x in v if x > 0) == yrs: prof_ok = True
        except: pass
        
        # Fallback
        if yrs == 0 and i.get('trailingEps', 0) > 0: prof_ok = True
        
        s_prof = "GREEN" if prof_ok else "RED"
        sc += 2 if prof_ok else 0
        
        # 3. Divida
        dr = i.get('debtToEbitda')
        s_debt = "GREEN"
        if dr and dr > 3: s_debt = "RED"
        elif dr and dr > 2: 
            s_debt = "YELLOW"
            sc += 1
        else: sc += 2
        
        # 4. Gov
        on = clean[-1] == '3'
        s_gov = "GREEN" if on else "YELLOW"
        sc += 2 if on else 1
        
        verd = "Tóxica"
        has_bad = (s_prof == "RED" or s_debt == "RED" or s_ipo == "RED")
        if has_bad: verd = "Mamute Vermelho"
        elif sc >= 8: verd = "Mamute Azul"
        else: verd = "Mamute Amarelo"
        
        res["score"] = sc
        res["verdict"] = verd
        res["criteria"] = {
            "profit": {"status": s_prof, "years": yrs, "profitable": yrs if prof_ok else 0},
            "governance": {"status": s_gov, "type": "ON" if on else "PN"},
            "debt": {"status": s_debt, "current_ratio": round(dr,2) if dr else 0},
            "ipo": {"status": s_ipo, "years": round(ipo,1)}
        }
        return res
    except:
        return res