import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wallet, TrendingUp, DollarSign, PlusCircle, LayoutDashboard, List, Trash2, Edit2, Activity, Upload, Briefcase, ChevronDown, ChevronRight, AlertTriangle, Search, CheckCircle, XCircle, AlertCircle, ArrowUp, ArrowDown, Filter } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

const AssetLogo = ({ ticker }) => {
  const [imgError, setImgError] = useState(false);
  
  // Limpa o ticker (remove .SA e espaços)
  const cleanTicker = ticker ? ticker.replace('.SA', '').trim().toUpperCase() : '';
  
  // URL do Logo (GitHub)
  const logoUrl = `https://raw.githubusercontent.com/filippofilip95/brazilian-stock-logos/main/logos/${cleanTicker}.png`;
  
  // Função para gerar cor consistente baseada no nome (para o fallback)
  const stringToColor = (str) => { 
      let hash = 0; 
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); 
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase(); 
      return '#' + '00000'.substring(0, 6 - c.length) + c; 
  };

  // Se não tiver ticker ou se a imagem falhou ao carregar
  if (!cleanTicker || imgError) {
      return (
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-slate-600 shadow-sm shrink-0 select-none" 
            style={{ 
                backgroundColor: stringToColor(cleanTicker || 'XX'),
                textShadow: '0px 1px 2px rgba(0,0,0,0.3)' 
            }}
            title={cleanTicker} // Mostra nome ao passar o mouse
          >
              {cleanTicker.substring(0, 2)}
          </div>
      );
  }

  return (
      <img 
        src={logoUrl} 
        alt={cleanTicker} 
        className="w-9 h-9 rounded-full object-contain bg-white border border-slate-600 shrink-0" 
        // Se der erro (404), ativa o estado de erro para mostrar a bolinha
        onError={(e) => {
            e.target.style.display = 'none'; // Esconde imagem quebrada imediatamente
            setImgError(true);
        }} 
      />
  );
};

function App() {
  const [view, setView] = useState('dashboard');
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalRentability, setTotalRentability] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [novoAporte, setNovoAporte] = useState({ ticker: '', date: new Date().toISOString().split('T')[0], quantity: '', price: '', type: 'Acao' });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedGroups, setExpandedGroups] = useState({ 'Acao': true, 'FII': true, 'ETF': true, 'BDR': true, 'Stock': true, 'Outros': true });
  
  const [searchTicker, setSearchTicker] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isMamuteRotated, setIsMamuteRotated] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'total', direction: 'desc' });
  const [provFilter, setProvFilter] = useState({ start: '', end: '' });

  // --- CONFIG IP ---
  const API_URL = 'http://127.0.0.1:8000'; 

  const fetchData = async () => {
    try {
      const [dashRes, transRes, earnRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard`),
        axios.get(`${API_URL}/transactions/`),
        axios.get(`${API_URL}/earnings`)
      ]);
      setData(dashRes.data || {});
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setEarnings(earnRes.data || {});
      
      if (dashRes.data && dashRes.data.total_investido > 0) {
        const lucroTotalComDiv = dashRes.data.lucro + (earnRes.data?.total_acumulado || 0);
        setTotalRentability((lucroTotalComDiv / dashRes.data.total_investido) * 100);
      } else setTotalRentability(0);
      setLoading(false);
    } catch (error) { 
        console.error(error); 
        setLoading(false); 
        setData({}); setTransactions([]); setEarnings({});
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (analysisResult) {
      setIsMamuteRotated(false);
      if (analysisResult.verdict === 'Mamute Vermelho') {
        const timer = setTimeout(() => setIsMamuteRotated(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [analysisResult]);

  const filteredEarnings = useMemo(() => {
      if (!earnings || !earnings.detalhes) return null;
      const filtered = earnings.detalhes.filter(item => {
          if (provFilter.start && item.date < provFilter.start) return false;
          if (provFilter.end && item.date > provFilter.end) return false;
          return true;
      });
      let total = 0;
      const byClass = {};
      const byTicker = {};
      const monthly = {};
      filtered.forEach(item => {
          total += item.val;
          byClass[item.type] = (byClass[item.type] || 0) + item.val;
          byTicker[item.ticker] = (byTicker[item.ticker] || 0) + item.val;
          const [y, m] = item.date.split('-');
          const mKey = `${y}-${m}`;
          if (!monthly[mKey]) monthly[mKey] = { mes: mKey, total: 0 };
          monthly[mKey].total += item.val;
          monthly[mKey][item.type] = (monthly[mKey][item.type] || 0) + item.val;
      });
      const sortedMonths = Object.keys(monthly).sort();
      const chartHistory = sortedMonths.map(key => {
          const [y, m] = key.split('-');
          const dateObj = new Date(parseInt(y), parseInt(m)-1, 1);
          const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          return { ...monthly[key], mes: monthName };
      });
      const pieTicker = Object.entries(byTicker).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      const pieClass = Object.entries(byClass).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      return { total_acumulado: total, historico_mensal: chartHistory, por_ativo: pieTicker, por_classe: pieClass };
  }, [earnings, provFilter]);

  const normalizeTickerToSend = (rawTicker) => { if (!rawTicker) return ""; const t = rawTicker.toUpperCase().trim(); if (t.includes('.')) return t; if (/[0-9]$/.test(t)) return t + ".SA"; return t; };
  const detectAssetType = (ticker) => { const t = ticker.toUpperCase().trim(); if (t.endsWith('34') || t.endsWith('39') || t.endsWith('33') || t.endsWith('32')) return 'BDR'; if (t.endsWith('11')) return 'FII'; if (/[3456]$/.test(t)) return 'Acao'; return 'Acao'; };
  const handleAutoPrice = async () => { if (!novoAporte.date || !novoAporte.ticker || novoAporte.ticker.length < 3) return; const detectedType = detectAssetType(novoAporte.ticker); setNovoAporte(prev => ({ ...prev, type: detectedType })); const tickerSmart = normalizeTickerToSend(novoAporte.ticker); try { const response = await axios.get(`${API_URL}/get-price`, { params: { ticker: tickerSmart, date: novoAporte.date } }); if (response.data.price > 0) setNovoAporte(prev => ({ ...prev, price: response.data.price, type: detectedType })); } catch (error) { console.error(error); } };
  const handleSubmit = async (e) => { e.preventDefault(); if(!novoAporte.ticker || !novoAporte.quantity || !novoAporte.price) return; const tickerSmart = normalizeTickerToSend(novoAporte.ticker); const payload = { ...novoAporte, ticker: tickerSmart, quantity: Number(novoAporte.quantity), price: Number(novoAporte.price) }; if (editingId) { await axios.put(`${API_URL}/transactions/${editingId}`, payload); setEditingId(null); } else { await axios.post(`${API_URL}/transactions/`, payload); } setNovoAporte({ ...novoAporte, ticker: '', quantity: '', price: '' }); fetchData(); };
  const handleBulkImport = async () => { if (!importText) return; const lines = importText.split('\n'); const bulkData = []; lines.forEach(line => { const parts = line.split(/[\t; ]+/); if (parts.length >= 3) { let ticker = parts[0].trim().toUpperCase(); let qtd = parts[1].replace(',', '.'); let price = parts[2].replace('R$', '').replace(',', '.').trim(); if (ticker && !isNaN(qtd) && !isNaN(price)) { if (!ticker.includes('.') && /[0-9]$/.test(ticker)) ticker += ".SA"; bulkData.push({ ticker: ticker, date: importDate, quantity: Number(qtd), price: Number(price), type: detectAssetType(ticker) }); } } }); if (bulkData.length > 0) { await axios.post(`${API_URL}/transactions/bulk`, bulkData); setImportText(""); setShowImport(false); fetchData(); alert(`${bulkData.length} ativos importados!`); } else { alert("Nenhum dado válido."); } };
  const handleClearWallet = async () => { if (window.confirm("Apagar TUDO?")) { await axios.delete(`${API_URL}/transactions/clear_all`); fetchData(); } };
  const handleDelete = async (id) => { if (window.confirm("Excluir?")) { await axios.delete(`${API_URL}/transactions/${id}`); fetchData(); } };
  const handleEdit = (trans) => { setEditingId(trans.id); setNovoAporte({ ticker: trans.ticker.replace('.SA',''), date: trans.date, quantity: trans.quantity, price: trans.price, type: trans.type }); setView('dashboard'); };
  const toggleGroup = (type) => { setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] })); };
  const handleAnalyze = async (e) => { e.preventDefault(); if (!searchTicker) return; setAnalyzing(true); setAnalysisResult(null); try { const res = await axios.get(`${API_URL}/analyze/${searchTicker}`); setAnalysisResult(res.data); } catch (err) { alert("Erro ao analisar."); } setAnalyzing(false); };
  const getStatusIcon = (status) => { if (status === 'GREEN') return <CheckCircle className="text-emerald-500" size={24} />; if (status === 'YELLOW') return <AlertCircle className="text-yellow-500" size={24} />; if (status === 'RED') return <XCircle className="text-red-500" size={24} />; return <div className="w-6 h-6 rounded-full bg-slate-600"></div>; };
  const handleSort = (key) => { let direction = 'desc'; if (sortConfig.key === key && sortConfig.direction === 'desc') { direction = 'asc'; } setSortConfig({ key, direction }); };
  const groupedAssets = () => { if (!data || !data.ativos) return []; const groups = {}; const types = ['Acao', 'FII', 'ETF', 'BDR', 'Stock', 'Outros']; types.forEach(t => groups[t] = { type: t, total: 0, cost: 0, items: [] }); data.ativos.forEach(asset => { const type = asset.type || 'Outros'; const groupKey = types.includes(type) ? type : 'Outros'; groups[groupKey].items.push(asset); groups[groupKey].total += asset.total; groups[groupKey].cost += (asset.pm * asset.qtd); }); const sortedGroups = Object.values(groups).map(group => { const sortedItems = [...group.items].sort((a, b) => { if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); return { ...group, items: sortedItems }; }); return sortedGroups.filter(g => g.items.length > 0); };
  const SortIcon = ({ columnKey }) => { if (sortConfig.key !== columnKey) return <div className="w-4 h-4 ml-1 inline-block opacity-0 group-hover:opacity-30"></div>; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 inline-block text-emerald-400" /> : <ArrowDown size={14} className="ml-1 inline-block text-emerald-400" />; };
  const TableHeader = ({ label, sortKey, align = "left" }) => ( <th className={`px-6 py-2 cursor-pointer hover:text-white transition-colors group select-none text-${align}`} onClick={() => handleSort(sortKey)} > <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}> {label} <SortIcon columnKey={sortKey} /> </div> </th> );

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-500">Carregando Investidor12...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex overflow-hidden">
      <nav className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 fixed h-full z-20">
        <div className="mb-8 p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><Wallet size={28} /></div>
        <div className="space-y-6 flex flex-col w-full px-2">
          <NavButton icon={<LayoutDashboard size={24} />} active={view === 'dashboard'} onClick={() => setView('dashboard')} title="Dashboard" />
          <NavButton icon={<List size={24} />} active={view === 'lancamentos'} onClick={() => setView('lancamentos')} title="Lançamentos" />
          <NavButton icon={<DollarSign size={24} />} active={view === 'proventos'} onClick={() => setView('proventos')} title="Proventos" />
          <NavButton icon={<Search size={24} />} active={view === 'analysis'} onClick={() => setView('analysis')} title="Raio-X Mamute" />
        </div>
      </nav>

      <main className="flex-1 ml-20 p-6 md:p-8 w-full min-h-screen overflow-y-auto bg-slate-900">
        <div className="max-w-[1920px] mx-auto w-full space-y-8">
          <header className="flex justify-between items-center w-full">
            <div><h1 className="text-3xl font-bold text-white mb-1">Investidor12</h1><p className="text-slate-400 capitalize">{view === 'analysis' ? 'Raio-X do Mamute' : (view === 'dashboard' ? 'Visão Geral' : view)}</p></div>
            {view === 'dashboard' && (<div className="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 flex flex-col items-end shadow-md"><span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Rentabilidade Total</span><span className={`text-2xl font-bold ${totalRentability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalRentability.toFixed(2)}%</span></div>)}
          </header>

          {view === 'analysis' && (
              <div className="max-w-4xl mx-auto">
                  <form onSubmit={handleAnalyze} className="flex gap-4 mb-8">
                      <input type="text" placeholder="Digite o Ticker (Ex: VALE3)" className="input-field flex-1 text-lg uppercase" value={searchTicker} onChange={e => setSearchTicker(e.target.value)} />
                      <button type="submit" disabled={analyzing} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50">{analyzing ? 'Analisando...' : 'Analisar'}</button>
                  </form>
                  {analysisResult && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className={`p-8 rounded-2xl border-2 mb-8 text-center relative overflow-hidden ${analysisResult.verdict === 'Mamute Azul' ? 'bg-blue-900/40 border-blue-500' : analysisResult.verdict === 'Mamute Amarelo' ? 'bg-yellow-900/20 border-yellow-500' : 'bg-red-900/20 border-red-500'}`}>
                              <h2 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Veredito Final</h2>
                              <h1 className={`text-5xl font-black mb-2 ${analysisResult.verdict === 'Mamute Azul' ? 'text-blue-400' : analysisResult.verdict === 'Mamute Amarelo' ? 'text-yellow-400' : 'text-red-500'}`}>{analysisResult.verdict.toUpperCase()}</h1>
                              <div className={`mt-4 text-6xl transition-all duration-1000 transform-gpu ${analysisResult.verdict === 'Mamute Vermelho' ? `grayscale hue-rotate-90 opacity-60 ${isMamuteRotated ? 'rotate-180' : ''}` : 'animate-bounce ' + (analysisResult.verdict === 'Mamute Amarelo' ? 'sepia' : '')}`}>🦣</div>
                              <p className="mt-4 text-slate-300 font-medium">Pontuação: <span className="font-bold text-white text-xl">{analysisResult.score}/8</span></p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="flex justify-between items-start mb-4"><h3 className="font-bold text-white text-lg">Lucratividade</h3>{getStatusIcon(analysisResult.criteria.profit.status)}</div><p className="text-slate-400 text-sm">Anos Analisados: <span className="text-white">{analysisResult.criteria.profit.years}</span></p></div>
                              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="flex justify-between items-start mb-4"><h3 className="font-bold text-white text-lg">Dívida</h3>{getStatusIcon(analysisResult.criteria.debt.status)}</div><p className="text-slate-400 text-sm">Status: <span className="text-white">{analysisResult.criteria.debt.status === 'GREEN' ? 'Controlada' : analysisResult.criteria.debt.status === 'RED' ? 'Alta' : '-'}</span></p></div>
                              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="flex justify-between items-start mb-4"><h3 className="font-bold text-white text-lg">Governança</h3>{getStatusIcon(analysisResult.criteria.governance.status)}</div><p className="text-slate-400 text-sm">Tipo: <span className="text-white">{analysisResult.criteria.governance.type}</span></p></div>
                              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="flex justify-between items-start mb-4"><h3 className="font-bold text-white text-lg">Tempo de Bolsa</h3>{getStatusIcon(analysisResult.criteria.ipo.status)}</div><p className="text-slate-400 text-sm">Anos IPO: <span className="text-white">{analysisResult.criteria.ipo.years}</span></p></div>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {view === 'dashboard' && data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all"><div className="relative z-10"><p className="text-slate-400 text-sm font-medium mb-2">Patrimônio Total</p><div className="flex items-baseline gap-3"><h2 className="text-3xl font-bold text-white">R$ {data.patrimonio_atual.toLocaleString()}</h2><span className={`text-sm px-2 py-0.5 rounded font-bold ${data.rentabilidade_pct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{data.rentabilidade_pct.toFixed(1)}%</span></div><p className="text-slate-500 text-sm mt-3 font-medium">Investido: <span className="text-slate-300">R$ {data.total_investido.toLocaleString()}</span></p></div><div className="absolute right-4 top-6 text-slate-700/20 group-hover:scale-110 transition-transform"><Wallet size={64} /></div></div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-center relative group hover:border-blue-500/30 transition-all"><p className="text-slate-400 text-sm font-medium mb-2">Performance Hoje</p><div className="flex items-center gap-2 mb-1"><h2 className={`text-3xl font-bold ${data.daily_variation == 0 ? 'text-slate-200' : (data.daily_variation > 0 ? 'text-emerald-400' : 'text-red-400')}`}>{data.daily_variation > 0 ? '+' : ''}{typeof data.daily_variation === 'number' ? data.daily_variation.toFixed(2) : data.daily_variation}%</h2>{data.daily_variation !== 0 && <Activity size={24} className={data.daily_variation > 0 ? 'text-emerald-400' : 'text-red-400'} />}</div><p className="text-slate-400 text-sm mt-2">Hoje sua carteira está rendendo:</p></div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative group hover:border-yellow-500/30 transition-all"><p className="text-slate-400 text-sm font-medium mb-2">Lucro (Cotação)</p><h2 className={`text-3xl font-bold ${data.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {data.lucro.toLocaleString()}</h2><p className="text-slate-500 text-sm mt-3">Valorização dos ativos</p><div className="absolute right-6 top-8 text-slate-700/20 group-hover:scale-110 transition-transform"><TrendingUp size={56} /></div></div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full">
                <div className="xl:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl h-[500px] flex flex-col"><h3 className="text-lg font-semibold mb-4 text-slate-200">Evolução Patrimonial</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.grafico}><defs><linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize:12}} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(val)=>`R$ ${val.toLocaleString()}`} /><Area type="monotone" dataKey="patrimonio" stroke="#10b981" fill="url(#colorPat)" strokeWidth={2} /><Area type="monotone" dataKey="investido" stroke="#3b82f6" fill="transparent" strokeDasharray="5 5" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-[500px] flex flex-col justify-center shadow-lg"><h3 className="text-lg font-semibold mb-6 text-white flex items-center gap-2">{editingId ? <Edit2 className="text-yellow-400"/> : <PlusCircle className="text-emerald-400"/>} {editingId ? 'Editar Lançamento' : 'Novo Aporte'}</h3><form onSubmit={handleSubmit} className="space-y-5"><div><label className="text-xs text-slate-400 font-bold mb-1 block">DATA</label><input type="date" required className="input-field" value={novoAporte.date} onChange={e=>setNovoAporte({...novoAporte, date:e.target.value})} onBlur={handleAutoPrice} /></div><div><label className="text-xs text-slate-400 font-bold mb-1 block">TICKER</label><input type="text" required placeholder="Ex: VALE3" className="input-field uppercase" value={novoAporte.ticker} onChange={e=>setNovoAporte({...novoAporte, ticker:e.target.value})} onBlur={handleAutoPrice} /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 font-bold mb-1 block">TIPO</label><select className="input-field" value={novoAporte.type} onChange={e=>setNovoAporte({...novoAporte, type:e.target.value})}><option value="Acao">Ação</option><option value="FII">FII</option><option value="ETF">ETF</option><option value="BDR">BDR</option><option value="Stock">Stock</option></select></div><div><label className="text-xs text-slate-400 font-bold mb-1 block">QTD</label><input type="number" required className="input-field" value={novoAporte.quantity} onChange={e=>setNovoAporte({...novoAporte, quantity:e.target.value})} /></div></div><div><label className="text-xs text-slate-400 font-bold mb-1 block">PREÇO (R$)</label><input type="number" step="0.01" required className="input-field" value={novoAporte.price} onChange={e=>setNovoAporte({...novoAporte, price:e.target.value})} /></div><button type="submit" className={`w-full font-bold py-3.5 rounded-lg mt-2 ${editingId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white transition-colors`}>{editingId ? 'Salvar Alterações' : 'Adicionar Ativo'}</button>{editingId && <button onClick={()=>{setEditingId(null); setNovoAporte({ticker:'', date:'', quantity:'', price:''})}} className="w-full text-slate-400 text-sm mt-2 hover:text-white">Cancelar</button>}</form></div>
              </div>
              <div className="space-y-6 w-full">
                 <h3 className="font-bold text-xl text-white">Meus Ativos ({data.ativos.length})</h3>
                 {groupedAssets().map((group) => (
                    <div key={group.type} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg transition-all">
                       <div className="px-6 py-4 bg-slate-900/60 flex items-center justify-between border-b border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => toggleGroup(group.type)}>
                          <div className="flex items-center gap-4"><div className="text-slate-400">{expandedGroups[group.type] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div><div className="p-2 rounded bg-slate-800 border border-slate-600">{group.type === 'Acao' ? <DollarSign size={18} className="text-emerald-400"/> : group.type === 'FII' ? <Briefcase size={18} className="text-blue-400"/> : <Activity size={18} className="text-yellow-400"/>}</div><div><h4 className="text-lg font-bold text-white">{group.type === 'Acao' ? 'Ações' : group.type + 's'}</h4><p className="text-xs text-slate-400">{group.items.length} ativos</p></div></div><div className="text-right"><p className="text-xs text-slate-400">Valor Total</p><p className="text-lg font-bold text-white">R$ {group.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div><div className="hidden md:block text-right"><p className="text-xs text-slate-400">Rentabilidade</p>{(() => { const rent = group.cost > 0 ? ((group.total - group.cost) / group.cost) * 100 : 0; return (<p className={`text-lg font-bold ${rent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{rent.toFixed(2)}%</p>) })()}</div>
                       </div>
                       {expandedGroups[group.type] && (
                           <div className="overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-300">
                             <table className="w-full text-left text-slate-400">
                               <thead className="bg-slate-900/30 text-xs uppercase font-bold text-slate-500">
                                  <tr>
                                    <TableHeader label="Ativo" sortKey="ticker" />
                                    <TableHeader label="Qtd" sortKey="qtd" />
                                    <TableHeader label="PM" sortKey="pm" />
                                    <TableHeader label="Atual" sortKey="atual" />
                                    <TableHeader label="Hoje" sortKey="variacao_diaria" />
                                    <TableHeader label="Total" sortKey="total" />
                                    <TableHeader label="Rentab." sortKey="rentabilidade" align="right" />
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-700 text-sm">
                                  {group.items.map(a=>(
                                    <tr key={a.ticker} className="hover:bg-slate-700/30 transition-colors">
                                      <td className="px-6 py-4 font-bold text-white flex gap-3 items-center"><AssetLogo ticker={a.ticker}/><span>{a.ticker.replace('.SA','')}</span></td>
                                      <td className="px-6 py-4">{a.qtd}</td>
                                      <td className="px-6 py-4">R$ {a.pm.toFixed(2)}</td>
                                      <td className="px-6 py-4 text-white">R$ {a.atual.toFixed(2)}</td>
                                      <td className={`px-6 py-4 font-bold ${a.variacao_diaria == 0 ? 'text-slate-500' : (a.variacao_diaria > 0 ? 'text-emerald-400' : 'text-red-400')}`}>{a.variacao_diaria == 0 ? '-' : (a.variacao_diaria > 0 ? '+' : '') + a.variacao_diaria.toFixed(2) + '%'}</td>
                                      <td className="px-6 py-4 text-white font-medium">R$ {a.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                      <td className={`px-6 py-4 font-bold text-right ${a.rentabilidade>=0?'text-emerald-400':'text-red-400'}`}>{a.rentabilidade.toFixed(2)}%</td>
                                    </tr>
                                  ))}
                               </tbody>
                             </table>
                           </div>
                       )}
                    </div>
                 ))}
              </div>
            </>
          )}

          {view === 'lancamentos' && (
            <div className="w-full">
               <div className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold text-white mb-1">Lançamentos</h1><p className="text-slate-400">Histórico de operações</p></div><div className="flex gap-4"><button onClick={handleClearWallet} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"><Trash2 size={20} /> Limpar Carteira</button><button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"><Upload size={20} /> {showImport ? 'Fechar Importação' : 'Importar em Massa'}</button></div></div>
               {showImport && (<div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-8 animate-in fade-in slide-in-from-top-4"><h3 className="text-white font-bold mb-4">Importação em Lote</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4"><div><label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Data dos Aportes</label><input type="date" className="input-field w-full" value={importDate} onChange={e => setImportDate(e.target.value)} /><p className="text-xs text-slate-500 mt-2">Esta data será aplicada a todos os ativos abaixo.</p></div><div><label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Instruções</label><p className="text-slate-400 text-sm">Cole sua lista no formato: <code>TICKER  QUANTIDADE  PREÇO</code>.</p><p className="text-slate-500 text-xs mt-1">Exemplo: VALE3  100  50,20</p></div></div><textarea className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-4 text-white font-mono text-sm focus:border-blue-500 outline-none" placeholder={`PETR4  100  35,50\nVALE3  50   60,20`} value={importText} onChange={e => setImportText(e.target.value)} /><div className="mt-4 flex justify-end"><button onClick={handleBulkImport} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Processar Importação</button></div></div>)}
               <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg w-full"><table className="w-full text-left text-slate-400"><thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Ativo</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Qtd</th><th className="px-6 py-4">Preço</th><th className="px-6 py-4">Total</th><th className="px-6 py-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-700 text-sm">
               {/* AQUI ESTÁ A CORREÇÃO: TROCADO 'DIV' POR 'ASSETLOGO' */}
               {transactions && transactions.length > 0 ? transactions.map(t=><tr key={t.id} className="hover:bg-slate-700/30 transition-colors"><td className="px-6 py-4">{new Date(t.date).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td><td className="px-6 py-4 font-bold text-white flex gap-2 items-center"><AssetLogo ticker={t.ticker}/>{t.ticker ? t.ticker.replace('.SA','') : ''}</td><td className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t.type}</td><td className="px-6 py-4">{t.quantity}</td><td className="px-6 py-4">R$ {t.price.toFixed(2)}</td><td className="px-6 py-4 text-white font-medium">R$ {(t.quantity*t.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-4 flex justify-center gap-3"><button onClick={()=>{handleEdit(t)}} className="p-2 bg-slate-700 rounded hover:text-yellow-400 transition-colors"><Edit2 size={16}/></button><button onClick={()=>handleDelete(t.id)} className="p-2 bg-slate-700 rounded hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td></tr>) : <tr><td colSpan="7" className="px-6 py-4 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>}
               </tbody></table></div>
            </div>
          )}

          {view === 'proventos' && (
            <>
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                   <h2 className="text-2xl font-bold text-white flex items-center gap-2"><DollarSign className="text-emerald-400"/> Proventos</h2>
                   <div className="flex gap-2 items-center bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-lg">
                       <Filter size={16} className="text-slate-400 ml-2" />
                       <div className="flex flex-col"><label className="text-[10px] text-slate-500 font-bold uppercase">De</label><input type="date" className="bg-transparent text-white text-sm outline-none" value={provFilter.start} onChange={e => setProvFilter({...provFilter, start: e.target.value})} /></div><div className="w-px h-8 bg-slate-700 mx-2"></div><div className="flex flex-col"><label className="text-[10px] text-slate-500 font-bold uppercase">Até</label><input type="date" className="bg-transparent text-white text-sm outline-none" value={provFilter.end} onChange={e => setProvFilter({...provFilter, end: e.target.value})} /></div>{(provFilter.start || provFilter.end) && (<button onClick={() => setProvFilter({start:'', end:''})} className="ml-2 text-xs text-red-400 hover:text-red-300 font-bold">Limpar</button>)}
                   </div>
               </div>

               {(!filteredEarnings || filteredEarnings.total_acumulado === 0) ? (
                   <div className="flex flex-col items-center justify-center h-96 text-slate-500"><AlertTriangle size={64} className="mb-4 text-yellow-500/50" /><h2 className="text-xl font-bold text-slate-300">Nenhum provento neste período</h2><p>Tente mudar o filtro de datas.</p></div>
               ) : (
                   <>
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 w-full h-80">
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col justify-center items-center h-full relative overflow-hidden group"><div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-400"></div><div className="p-4 bg-emerald-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300"><DollarSign size={40} className="text-emerald-400" /></div><p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Total Recebido</p><h2 className="text-4xl font-bold text-white tracking-tight">R$ {filteredEarnings.total_acumulado.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2><div className="mt-4 text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full">No período selecionado</div></div>
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full"><h3 className="text-slate-200 font-bold text-sm uppercase tracking-wide mb-2 pl-2 border-l-4 border-blue-500">Por Classe</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filteredEarnings.por_classe} innerRadius="60%" outerRadius="85%" paddingAngle={5} dataKey="value" stroke="none">{filteredEarnings.por_classe.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(value) => `R$ ${value.toFixed(2)}`} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/></PieChart></ResponsiveContainer></div></div>
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full"><h3 className="text-slate-200 font-bold text-sm uppercase tracking-wide mb-2 pl-2 border-l-4 border-emerald-500">Top Pagadores</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filteredEarnings.por_ativo.slice(0, 5)} innerRadius="60%" outerRadius="85%" paddingAngle={5} dataKey="value" stroke="none">{filteredEarnings.por_ativo.slice(0, 5).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(value) => `R$ ${value.toFixed(2)}`} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/></PieChart></ResponsiveContainer></div></div>
                       </div>
                       <div className="grid grid-cols-1 lg:grid-cols-6 gap-8 w-full h-[500px]">
                          <div className="lg:col-span-4 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full">
                            <h3 className="text-lg font-bold mb-6 text-slate-200 pl-2 border-l-4 border-yellow-500">Evolução Mensal</h3>
                            <div className="flex-1 w-full min-h-0"><ResponsiveContainer><BarChart data={filteredEarnings.historico_mensal} margin={{top: 20, right: 30, left: 20, bottom: 5}}><CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /><XAxis dataKey="mes" stroke="#94a3b8" tick={{fontSize: 14}} /><YAxis stroke="#94a3b8" tick={{fontSize: 14}} tickFormatter={(val) => `R$${val}`} /><Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(val)=>`R$ ${val.toFixed(2)}`} />
                                <Bar dataKey="Acao" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="FII" stackId="a" fill="#10b981" />
                                <Bar dataKey="ETF" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="BDR" stackId="a" fill="#8b5cf6" />
                                <Bar dataKey="Stock" stackId="a" fill="#ec4899" />
                            </BarChart></ResponsiveContainer></div>
                          </div>
                          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg h-full flex flex-col"><div className="px-6 py-5 border-b border-slate-700 bg-slate-800/50 flex-none"><h3 className="font-bold text-lg text-slate-200">Ranking Completo</h3></div><div className="overflow-y-auto flex-1 p-0 custom-scrollbar"><table className="w-full text-left text-slate-400"><thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500 sticky top-0 z-10"><tr><th className="px-6 py-4 bg-slate-900/90">Ativo</th><th className="px-6 py-4 text-right bg-slate-900/90">Total Pago</th></tr></thead><tbody className="divide-y divide-slate-700 text-sm">{filteredEarnings.por_ativo.map((item, idx) => (<tr key={idx} className="hover:bg-slate-700/30 transition-colors"><td className="px-6 py-4 font-bold text-white flex gap-3 items-center"><AssetLogo ticker={item.name + '.SA'}/><span>{item.name}</span></td><td className="px-6 py-4 text-right text-yellow-400 font-bold">R$ {item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>))}</tbody></table></div></div>
                       </div>
                   </>
               )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ icon, active, onClick, title }) { return <button onClick={onClick} className={`p-3 rounded-xl transition-all flex justify-center mb-4 ${active ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`} title={title}>{icon}</button>; }

export default App;