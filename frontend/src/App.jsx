import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wallet, TrendingUp, DollarSign, PlusCircle, LayoutDashboard, List, Trash2, Edit2, Activity, Upload, Briefcase, ChevronDown, ChevronRight, AlertTriangle, Search, CheckCircle, XCircle, AlertCircle, ArrowUp, ArrowDown, Filter, Calendar, Clock, Plus, X } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

const AssetLogo = ({ ticker }) => {
  const [error, setError] = useState(false);
  const cleanTicker = ticker ? ticker.replace('.SA', '').trim().toUpperCase() : '';
  const logoUrl = `https://raw.githubusercontent.com/filippofilip95/brazilian-stock-logos/main/logos/${cleanTicker}.png?v=${new Date().getDate()}`; 
  const stringToColor = (str) => { let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); const c = (hash & 0x00FFFFFF).toString(16).toUpperCase(); return '#' + '00000'.substring(0, 6 - c.length) + c; };

  if (error || !cleanTicker) {
      return (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-slate-600 shadow-sm shrink-0 select-none" 
            style={{ backgroundColor: stringToColor(cleanTicker || 'XX') }}>
              {cleanTicker.substring(0, 2)}
          </div>
      );
  }
  return <img src={logoUrl} alt={cleanTicker} className="w-9 h-9 rounded-full object-contain bg-white border border-slate-600 shrink-0" onError={() => setError(true)} />;
};

function App() {
  const [view, setView] = useState('dashboard');
  
  // ESTADOS DE CARTEIRA
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");

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
  
  // FILTROS
  const [chartRange, setChartRange] = useState('ALL'); 
  const [earningsRange, setEarningsRange] = useState('1M'); 
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' }); // Filtro Personalizado

  const API_URL = 'http://127.0.0.1:8000'; 

  // --- CARREGA CARTEIRAS NO INÍCIO ---
  useEffect(() => { fetchWallets(); }, []);

  const fetchWallets = async () => {
      try {
          const res = await axios.get(`${API_URL}/wallets/`);
          setWallets(res.data);
          if (res.data.length > 0 && !selectedWallet) setSelectedWallet(res.data[0].id);
      } catch (err) { console.error(err); }
  };

  const handleCreateWallet = async (e) => {
      e.preventDefault();
      if (!newWalletName) return;
      try {
          await axios.post(`${API_URL}/wallets/`, { name: newWalletName });
          setNewWalletName(""); setShowCreateWallet(false); fetchWallets();
      } catch (err) { alert("Erro ao criar carteira"); }
  };

  // --- CARREGA DADOS ---
  const fetchData = async () => {
    if (!selectedWallet) return;
    setLoading(true);
    try {
      const [dashRes, transRes, earnRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard`, { params: { wallet_id: selectedWallet } }),
        axios.get(`${API_URL}/transactions/`, { params: { wallet_id: selectedWallet } }),
        axios.get(`${API_URL}/earnings`, { params: { wallet_id: selectedWallet } })
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
        console.error(error); setLoading(false); setData({}); setTransactions([]); setEarnings({});
    }
  };

  useEffect(() => { if (selectedWallet) fetchData(); }, [selectedWallet]);

  useEffect(() => {
    if (analysisResult) {
      setIsMamuteRotated(false);
      if (analysisResult.verdict === 'Mamute Vermelho') {
        const timer = setTimeout(() => setIsMamuteRotated(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [analysisResult]);

  // --- LÓGICA DO GRÁFICO DASHBOARD ---
  const processedChartData = useMemo(() => {
    if (!data || !data.grafico || data.grafico.length === 0) return [];
    const fullData = data.grafico;
    let slicedData = fullData;
    const now = new Date();

    if (chartRange === '1M') {
        const cutoff = new Date(now.getFullYear(), now.getMonth(), 1); 
        slicedData = fullData.filter(d => { const [day, month, year] = d.name.split('/'); return new Date(`20${year}-${month}-${day}`) >= cutoff; });
    } else if (chartRange === '6M') {
        const cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 6);
        slicedData = fullData.filter(d => { const [day, month, year] = d.name.split('/'); return new Date(`20${year}-${month}-${day}`) >= cutoff; });
    } else if (chartRange === '1Y') {
        const cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1);
        slicedData = fullData.filter(d => { const [day, month, year] = d.name.split('/'); return new Date(`20${year}-${month}-${day}`) >= cutoff; });
    }

    if (slicedData.length === 0) return [];
    const base = slicedData[0];
    return slicedData.map(item => ({
        name: item.name,
        carteira: ((1 + item.carteira/100) / (1 + base.carteira/100) - 1) * 100,
        ibov: ((1 + item.ibov/100) / (1 + base.ibov/100) - 1) * 100,
        cdi: ((1 + item.cdi/100) / (1 + base.cdi/100) - 1) * 100,
        ipca: ((1 + item.ipca/100) / (1 + base.ipca/100) - 1) * 100,
    }));
  }, [data, chartRange]);

  // --- LÓGICA DE PROVENTOS (COM FILTRO PERSONALIZADO) ---
  const earningsStats = useMemo(() => {
      const emptyStats = { total: 0, history: [], list: [], ranking: [], classes: [] };
      if (!earnings) return emptyStats;

      const allItems = [
          ...(earnings.detalhes || []).map(i => ({...i, status: 'RECEBIDO'})),
          ...(earnings.provisionados || []).map(i => ({...i, status: 'A RECEBER'}))
      ];

      const now = new Date();
      let startCutoff = null;
      let endCutoff = null;
      
      if (earningsRange === '1M') { 
          startCutoff = new Date(now.getFullYear(), now.getMonth(), 1); 
      }
      else if (earningsRange === '6M') { 
          startCutoff = new Date(now); startCutoff.setMonth(now.getMonth() - 6); 
      }
      else if (earningsRange === '1Y') { 
          startCutoff = new Date(now); startCutoff.setFullYear(now.getFullYear() - 1); 
      }
      else if (earningsRange === 'CUSTOM' && customDateRange.start) {
          // Filtro Personalizado
          startCutoff = new Date(customDateRange.start);
          if (customDateRange.end) {
              endCutoff = new Date(customDateRange.end);
              endCutoff.setHours(23, 59, 59); // Fim do dia
          }
      }
      
      // Aplicando Filtro
      const filteredItems = allItems.filter(i => {
          const d = new Date(i.date);
          if (startCutoff && d < startCutoff) return false;
          if (endCutoff && d > endCutoff) return false;
          return true;
      });

      let total = 0;
      const monthly = {};
      const byTicker = {};
      const byClass = {};

      filteredItems.forEach(item => {
          if (item.status === 'RECEBIDO') total += item.val; 
          const [y, m] = item.date.split('-');
          const mKey = `${y}-${m}`;
          if (!monthly[mKey]) monthly[mKey] = { mesKey: mKey, total: 0 };
          monthly[mKey].total += item.val;
          if (!monthly[mKey][item.type]) monthly[mKey][item.type] = 0;
          monthly[mKey][item.type] += item.val;

          if (!byTicker[item.ticker]) byTicker[item.ticker] = 0;
          byTicker[item.ticker] += item.val;

          if (!byClass[item.type]) byClass[item.type] = 0;
          byClass[item.type] += item.val;
      });

      const history = Object.values(monthly).sort((a,b) => a.mesKey.localeCompare(b.mesKey)).map(m => {
          const [y, mo] = m.mesKey.split('-');
          const dateObj = new Date(parseInt(y), parseInt(mo)-1, 1);
          return { ...m, mes: dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) };
      });

      const ranking = Object.entries(byTicker).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      const classes = Object.entries(byClass).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      const list = filteredItems.sort((a, b) => new Date(b.date) - new Date(a.date));

      return { total, history, list, ranking, classes };
  }, [earnings, earningsRange, customDateRange]);


  const normalizeTickerToSend = (rawTicker) => { if (!rawTicker) return ""; const t = rawTicker.toUpperCase().trim(); if (t.includes('.')) return t; if (/[0-9]$/.test(t)) return t + ".SA"; return t; };
  const detectAssetType = (ticker) => { const t = ticker.toUpperCase().trim(); if (t.endsWith('34') || t.endsWith('39') || t.endsWith('33') || t.endsWith('32')) return 'BDR'; if (t.endsWith('11')) return 'FII'; if (/[3456]$/.test(t)) return 'Acao'; return 'Acao'; };
  const handleAutoPrice = async () => { if (!novoAporte.date || !novoAporte.ticker || novoAporte.ticker.length < 3) return; const detectedType = detectAssetType(novoAporte.ticker); setNovoAporte(prev => ({ ...prev, type: detectedType })); const tickerSmart = normalizeTickerToSend(novoAporte.ticker); try { const response = await axios.get(`${API_URL}/get-price`, { params: { ticker: tickerSmart, date: novoAporte.date } }); if (response.data.price > 0) setNovoAporte(prev => ({ ...prev, price: response.data.price, type: detectedType })); } catch (error) { console.error(error); } };
  const handleSubmit = async (e) => { e.preventDefault(); if(!novoAporte.ticker || !novoAporte.quantity || !novoAporte.price || !selectedWallet) return; const tickerSmart = normalizeTickerToSend(novoAporte.ticker); const payload = { ...novoAporte, wallet_id: selectedWallet, ticker: tickerSmart, quantity: Number(novoAporte.quantity), price: Number(novoAporte.price) }; if (editingId) { await axios.put(`${API_URL}/transactions/${editingId}`, payload); setEditingId(null); } else { await axios.post(`${API_URL}/transactions/`, payload); } setNovoAporte({ ...novoAporte, ticker: '', quantity: '', price: '' }); fetchData(); };
  const handleBulkImport = async () => { if (!importText || !selectedWallet) return; const lines = importText.split('\n'); const bulkData = []; lines.forEach(line => { const parts = line.split(/[\t; ]+/); if (parts.length >= 3) { let ticker = parts[0].trim().toUpperCase(); let qtd = parts[1].replace(',', '.'); let price = parts[2].replace('R$', '').replace(',', '.').trim(); if (ticker && !isNaN(qtd) && !isNaN(price)) { if (!ticker.includes('.') && /[0-9]$/.test(ticker)) ticker += ".SA"; bulkData.push({ wallet_id: selectedWallet, ticker: ticker, date: importDate, quantity: Number(qtd), price: Number(price), type: detectAssetType(ticker) }); } } }); if (bulkData.length > 0) { await axios.post(`${API_URL}/transactions/bulk`, bulkData); setImportText(""); setShowImport(false); fetchData(); alert(`${bulkData.length} ativos importados!`); } else { alert("Nenhum dado válido."); } };
  const handleClearWallet = async () => { if (window.confirm("Apagar TUDO desta carteira?")) { await axios.delete(`${API_URL}/transactions/clear_all`, { params: { wallet_id: selectedWallet } }); fetchData(); } };
  const handleDelete = async (id) => { if (window.confirm("Excluir?")) { await axios.delete(`${API_URL}/transactions/${id}`); fetchData(); } };
  const handleEdit = (trans) => { setEditingId(trans.id); setNovoAporte({ ticker: trans.ticker.replace('.SA',''), date: trans.date, quantity: trans.quantity, price: trans.price, type: trans.type }); setView('dashboard'); };
  const toggleGroup = (type) => { setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] })); };
  const handleAnalyze = async (e) => { e.preventDefault(); if (!searchTicker) return; setAnalyzing(true); setAnalysisResult(null); try { const res = await axios.get(`${API_URL}/analyze/${searchTicker}`); setAnalysisResult(res.data); } catch (err) { alert("Erro ao analisar."); } setAnalyzing(false); };
  const getStatusIcon = (status) => { if (status === 'GREEN') return <CheckCircle className="text-emerald-500" size={24} />; if (status === 'YELLOW') return <AlertCircle className="text-yellow-500" size={24} />; if (status === 'RED') return <XCircle className="text-red-500" size={24} />; return <div className="w-6 h-6 rounded-full bg-slate-600"></div>; };
  const handleSort = (key) => { let direction = 'desc'; if (sortConfig.key === key && sortConfig.direction === 'desc') { direction = 'asc'; } setSortConfig({ key, direction }); };
  const groupedAssets = () => { if (!data || !data.ativos) return []; const groups = {}; const types = ['Acao', 'FII', 'ETF', 'BDR', 'Stock', 'Outros']; types.forEach(t => groups[t] = { type: t, total: 0, cost: 0, items: [] }); data.ativos.forEach(asset => { const type = asset.type || 'Outros'; const groupKey = types.includes(type) ? type : 'Outros'; groups[groupKey].items.push(asset); groups[groupKey].total += asset.total; groups[groupKey].cost += (asset.pm * asset.qtd); }); const sortedGroups = Object.values(groups).map(group => { const sortedItems = [...group.items].sort((a, b) => { if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); return { ...group, items: sortedItems }; }); return sortedGroups.filter(g => g.items.length > 0); };
  const SortIcon = ({ columnKey }) => { if (sortConfig.key !== columnKey) return <div className="w-4 h-4 ml-1 inline-block opacity-0 group-hover:opacity-30"></div>; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 inline-block text-emerald-400" /> : <ArrowDown size={14} className="ml-1 inline-block text-emerald-400" />; };
  const TableHeader = ({ label, sortKey, align = "left" }) => ( <th className={`px-6 py-2 cursor-pointer hover:text-white transition-colors group select-none text-${align}`} onClick={() => handleSort(sortKey)} > <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}> {label} <SortIcon columnKey={sortKey} /> </div> </th> );

  if (loading && !selectedWallet) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-500">Carregando Investidor12...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex overflow-hidden">
      
      {/* SIDEBAR */}
      <nav className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 fixed h-full z-20">
        <div className="mb-8 p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><Wallet size={28} /></div>
        <div className="space-y-6 flex flex-col w-full px-2">
          <NavButton icon={<LayoutDashboard size={24} />} active={view === 'dashboard'} onClick={() => setView('dashboard')} title="Dashboard" />
          <NavButton icon={<List size={24} />} active={view === 'lancamentos'} onClick={() => setView('lancamentos')} title="Lançamentos" />
          <NavButton icon={<DollarSign size={24} />} active={view === 'proventos'} onClick={() => setView('proventos')} title="Proventos" />
          <NavButton icon={<Search size={24} />} active={view === 'analysis'} onClick={() => setView('analysis')} title="Raio-X Mamute" />
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-20 p-6 md:p-8 w-full min-h-screen overflow-y-auto bg-slate-900">
        <div className="max-w-[1920px] mx-auto w-full space-y-8">
          
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4">
            <div className="flex items-center gap-6">
                <div><h1 className="text-3xl font-bold text-white mb-1">Investidor12</h1><p className="text-slate-400 capitalize">{view === 'analysis' ? 'Raio-X do Mamute' : (view === 'dashboard' ? 'Visão Geral' : view)}</p></div>
                <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-md">
                    <div className="p-2 bg-slate-700 rounded-lg text-emerald-400"><Briefcase size={20}/></div>
                    <select className="bg-transparent text-white font-bold outline-none text-sm min-w-[150px] cursor-pointer" value={selectedWallet || ""} onChange={(e) => setSelectedWallet(Number(e.target.value))}>
                        {wallets.map(w => <option key={w.id} value={w.id} className="bg-slate-800">{w.name}</option>)}
                    </select>
                    <button onClick={() => setShowCreateWallet(true)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Nova Carteira"><Plus size={18}/></button>
                </div>
            </div>
            {view === 'dashboard' && (<div className="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 flex flex-col items-end shadow-md"><span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Rentabilidade Total</span><span className={`text-2xl font-bold ${totalRentability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalRentability.toFixed(2)}%</span></div>)}
          </header>

          {/* MODAL CRIAR CARTEIRA */}
          {showCreateWallet && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
                      <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white">Nova Carteira</h3><button onClick={() => setShowCreateWallet(false)} className="text-slate-400 hover:text-white"><X size={24}/></button></div>
                      <form onSubmit={handleCreateWallet}>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Nome da Carteira</label>
                          <input type="text" autoFocus className="input-field mb-6" placeholder="Ex: Aposentadoria" value={newWalletName} onChange={e => setNewWalletName(e.target.value)} />
                          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors">Criar</button>
                      </form>
                  </div>
              </div>
          )}

          {/* ... OUTRAS VIEWS (IGUAIS) ... */}
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

          {view === 'lancamentos' && (
            <div className="w-full">
               <div className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold text-white mb-1">Lançamentos</h1><p className="text-slate-400">Histórico de operações</p></div><div className="flex gap-4"><button onClick={handleClearWallet} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"><Trash2 size={20} /> Limpar Carteira</button><button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"><Upload size={20} /> {showImport ? 'Fechar Importação' : 'Importar em Massa'}</button></div></div>
               {showImport && (<div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-8 animate-in fade-in slide-in-from-top-4"><h3 className="text-white font-bold mb-4">Importação em Lote</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4"><div><label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Data dos Aportes</label><input type="date" className="input-field w-full" value={importDate} onChange={e => setImportDate(e.target.value)} /><p className="text-xs text-slate-500 mt-2">Esta data será aplicada a todos os ativos abaixo.</p></div><div><label className="block text-slate-400 text-xs font-bold mb-2 uppercase">Instruções</label><p className="text-slate-400 text-sm">Cole sua lista no formato: <code>TICKER  QUANTIDADE  PREÇO</code>.</p><p className="text-slate-500 text-xs mt-1">Exemplo: VALE3  100  50,20</p></div></div><textarea className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-4 text-white font-mono text-sm focus:border-blue-500 outline-none" placeholder={`PETR4  100  35,50\nVALE3  50   60,20`} value={importText} onChange={e => setImportText(e.target.value)} /><div className="mt-4 flex justify-end"><button onClick={handleBulkImport} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Processar Importação</button></div></div>)}
               <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg w-full"><table className="w-full text-left text-slate-400"><thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Ativo</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Qtd</th><th className="px-6 py-4">Preço</th><th className="px-6 py-4">Total</th><th className="px-6 py-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-700 text-sm">{transactions && transactions.length > 0 ? transactions.map(t=><tr key={t.id} className="hover:bg-slate-700/30 transition-colors"><td className="px-6 py-4">{new Date(t.date).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td><td className="px-6 py-4 font-bold text-white flex gap-2 items-center"><AssetLogo ticker={t.ticker}/>{t.ticker ? t.ticker.replace('.SA','') : ''}</td><td className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t.type}</td><td className="px-6 py-4">{t.quantity}</td><td className="px-6 py-4">R$ {t.price.toFixed(2)}</td><td className="px-6 py-4 text-white font-medium">R$ {(t.quantity*t.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-4 flex justify-center gap-3"><button onClick={()=>{handleEdit(t)}} className="p-2 bg-slate-700 rounded hover:text-yellow-400 transition-colors"><Edit2 size={16}/></button><button onClick={()=>handleDelete(t.id)} className="p-2 bg-slate-700 rounded hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td></tr>) : <tr><td colSpan="7" className="px-6 py-4 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>}</tbody></table></div>
            </div>
          )}

          {view === 'proventos' && (
            <>
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                   <h2 className="text-2xl font-bold text-white flex items-center gap-2"><DollarSign className="text-emerald-400"/> Proventos</h2>
                   
                   {/* BARRA DE FILTROS COM DATA PERSONALIZADA */}
                   <div className="flex items-center gap-2">
                       {/* Inputs de Data (Só aparecem se for Personalizado) */}
                       {earningsRange === 'CUSTOM' && (
                           <div className="flex items-center gap-2 bg-slate-800 p-1 px-3 rounded-lg border border-slate-700 mr-2 animate-in fade-in slide-in-from-right-2">
                               <div className="flex flex-col">
                                   <label className="text-[9px] font-bold text-slate-500 uppercase">Início</label>
                                   <input type="date" className="bg-transparent text-white text-xs outline-none w-24" value={customDateRange.start} onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} />
                               </div>
                               <div className="w-px h-6 bg-slate-700"></div>
                               <div className="flex flex-col">
                                   <label className="text-[9px] font-bold text-slate-500 uppercase">Fim</label>
                                   <input type="date" className="bg-transparent text-white text-xs outline-none w-24" value={customDateRange.end} onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} />
                               </div>
                           </div>
                       )}

                       <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-lg">
                          <button onClick={() => setEarningsRange('1M')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${earningsRange === '1M' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Este Mês</button>
                          <button onClick={() => setEarningsRange('6M')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${earningsRange === '6M' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>6 Meses</button>
                          <button onClick={() => setEarningsRange('1Y')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${earningsRange === '1Y' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>1 Ano</button>
                          <button onClick={() => setEarningsRange('ALL')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${earningsRange === 'ALL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Tudo</button>
                          <button onClick={() => setEarningsRange('CUSTOM')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${earningsRange === 'CUSTOM' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Filter size={12}/> Personalizado</button>
                       </div>
                   </div>
               </div>

               {earnings && earnings.provisionados && earnings.provisionados.length > 0 && (
                   <div className="mb-8 p-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-emerald-500/30 rounded-xl shadow-lg animate-in fade-in">
                       <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-4"><Calendar size={20}/> Futuros (Provisionados)</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {earnings.provisionados.map((p, i) => (
                               <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-md flex items-center justify-between hover:border-emerald-500/50 transition-colors">
                                   <div className="flex items-center gap-4">
                                       <div className="bg-slate-900 p-2 rounded-lg text-center min-w-[50px]">
                                           <span className="block text-xs text-slate-500 font-bold uppercase">{new Date(p.date).toLocaleString('default', { month: 'short' })}</span>
                                           <span className="block text-xl font-bold text-white">{new Date(p.date).getDate()}</span>
                                       </div>
                                       <div>
                                           <div className="flex items-center gap-2 mb-1"><AssetLogo ticker={p.ticker} /><span className="font-bold text-white">{p.ticker}</span></div>
                                           <p className="text-xs text-slate-400">Data Com: {new Date(p.date).toLocaleDateString('pt-BR')}</p>
                                       </div>
                                   </div>
                                   <div className="text-right"><p className="text-xs text-slate-500 font-bold uppercase">Receber</p><p className="text-emerald-400 font-bold text-lg">R$ {p.val.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               {(!earningsStats || earningsStats.list.length === 0) ? (
                   <div className="flex flex-col items-center justify-center h-96 text-slate-500"><AlertTriangle size={64} className="mb-4 text-yellow-500/50" /><h2 className="text-xl font-bold text-slate-300">Nenhum provento neste período</h2><p>Tente mudar o filtro de tempo.</p></div>
               ) : (
                   <>
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 w-full h-80">
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col justify-center items-center h-full relative overflow-hidden group"><div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-400"></div><div className="p-4 bg-emerald-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300"><DollarSign size={40} className="text-emerald-400" /></div><p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Total Recebido</p><h2 className="text-4xl font-bold text-white tracking-tight">R$ {earningsStats.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2><div className="mt-4 text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full">No período selecionado</div></div>
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full"><h3 className="text-slate-200 font-bold text-sm uppercase tracking-wide mb-2 pl-2 border-l-4 border-blue-500">Por Classe</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={earningsStats.classes} innerRadius="60%" outerRadius="85%" paddingAngle={5} dataKey="value" stroke="none">{earningsStats.classes.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(value) => `R$ ${value.toFixed(2)}`} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/></PieChart></ResponsiveContainer></div></div>
                          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full"><h3 className="text-slate-200 font-bold text-sm uppercase tracking-wide mb-2 pl-2 border-l-4 border-emerald-500">Top Pagadores</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={earningsStats.ranking.slice(0, 5)} innerRadius="60%" outerRadius="85%" paddingAngle={5} dataKey="value" stroke="none">{earningsStats.ranking.slice(0, 5).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(value) => `R$ ${value.toFixed(2)}`} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/></PieChart></ResponsiveContainer></div></div>
                       </div>

                       <div className="grid grid-cols-1 lg:grid-cols-6 gap-8 w-full h-[500px]">
                          <div className="lg:col-span-4 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col h-full w-full">
                            <h3 className="text-lg font-bold mb-6 text-slate-200 pl-2 border-l-4 border-yellow-500">Evolução Mensal</h3>
                            <div className="flex-1 w-full min-h-0"><ResponsiveContainer><BarChart data={earningsStats.history} margin={{top: 20, right: 30, left: 20, bottom: 5}}><CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} /><XAxis dataKey="mes" stroke="#94a3b8" tick={{fontSize: 14}} /><YAxis stroke="#94a3b8" tick={{fontSize: 14}} tickFormatter={(val) => `R$${val}`} /><Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(val)=>`R$ ${val.toFixed(2)}`} />
                                <Bar dataKey="Acao" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="FII" stackId="a" fill="#10b981" />
                                <Bar dataKey="ETF" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="BDR" stackId="a" fill="#8b5cf6" />
                                <Bar dataKey="Stock" stackId="a" fill="#ec4899" />
                            </BarChart></ResponsiveContainer></div>
                          </div>
                          
                          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg h-full flex flex-col">
                              <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/50 flex-none"><h3 className="font-bold text-lg text-slate-200">Ranking</h3></div>
                              <div className="overflow-y-auto flex-1 p-0 custom-scrollbar"><table className="w-full text-left text-slate-400"><thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500 sticky top-0 z-10"><tr><th className="px-6 py-4 bg-slate-900/90">Ativo</th><th className="px-6 py-4 text-right bg-slate-900/90">Total Pago</th></tr></thead><tbody className="divide-y divide-slate-700 text-sm">{earningsStats.ranking.map((item, idx) => (<tr key={idx} className="hover:bg-slate-700/30 transition-colors"><td className="px-6 py-4 font-bold text-white flex gap-3 items-center"><AssetLogo ticker={item.name + '.SA'}/><span>{item.name}</span></td><td className="px-6 py-4 text-right text-yellow-400 font-bold">R$ {item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>))}</tbody></table></div>
                          </div>
                       </div>

                       <div className="mt-8 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-2">
                           <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                               <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2"><Clock size={20} className="text-slate-400"/> Histórico Detalhado</h3>
                               <span className="text-xs text-slate-500 font-bold bg-slate-900 px-3 py-1 rounded-full">{earningsStats.list.length} pagamentos</span>
                           </div>
                           <div className="overflow-x-auto">
                               <table className="w-full text-left text-slate-400 text-sm">
                                   <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500">
                                       <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Ativo</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Valor Total</th><th className="px-6 py-4 text-center">Status</th></tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-700">
                                       {earningsStats.list.map((item, idx) => (
                                           <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                               <td className="px-6 py-4">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                                               <td className="px-6 py-4 font-bold text-white flex gap-2 items-center"><AssetLogo ticker={item.ticker}/>{item.ticker}</td>
                                               <td className="px-6 py-4">{item.type}</td>
                                               <td className="px-6 py-4 font-bold text-emerald-400">R$ {item.val.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                               <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${item.status === 'RECEBIDO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{item.status}</span></td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   </>
               )}
            </>
          )}

          {view === 'dashboard' && data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all"><div className="relative z-10"><p className="text-slate-400 text-sm font-medium mb-2">Patrimônio Total</p><div className="flex items-baseline gap-3"><h2 className="text-3xl font-bold text-white">R$ {data.patrimonio_atual.toLocaleString()}</h2><span className={`text-sm px-2 py-0.5 rounded font-bold ${data.rentabilidade_pct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{data.rentabilidade_pct.toFixed(1)}%</span></div><p className="text-slate-500 text-sm mt-3 font-medium">Investido: <span className="text-slate-300">R$ {data.total_investido.toLocaleString()}</span></p></div><div className="absolute right-4 top-6 text-slate-700/20 group-hover:scale-110 transition-transform"><Wallet size={64} /></div></div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-center relative group hover:border-blue-500/30 transition-all"><p className="text-slate-400 text-sm font-medium mb-2">Performance Hoje</p><div className="flex items-center gap-2 mb-1"><h2 className={`text-3xl font-bold ${data.daily_variation == 0 ? 'text-slate-200' : (data.daily_variation > 0 ? 'text-emerald-400' : 'text-red-400')}`}>{data.daily_variation > 0 ? '+' : ''}{typeof data.daily_variation === 'number' ? data.daily_variation.toFixed(2) : data.daily_variation}%</h2>{data.daily_variation !== 0 && <Activity size={24} className={data.daily_variation > 0 ? 'text-emerald-400' : 'text-red-400'} />}</div><p className="text-slate-400 text-sm mt-2">Hoje sua carteira está rendendo:</p></div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative group hover:border-yellow-500/30 transition-all"><p className="text-slate-400 text-sm font-medium mb-2">Lucro (Cotação)</p><h2 className={`text-3xl font-bold ${data.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {data.lucro.toLocaleString()}</h2><p className="text-slate-500 text-sm mt-3">Valorização dos ativos</p><div className="absolute right-6 top-8 text-slate-700/20 group-hover:scale-110 transition-transform"><TrendingUp size={56} /></div></div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full">
                <div className="xl:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl h-[500px] flex flex-col relative">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-slate-200">Rentabilidade Comparada (%)</h3>
                      <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                          {['1M', '6M', '1Y', 'ALL'].map(range => (
                              <button key={range} onClick={() => setChartRange(range)} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartRange === range ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>{range === 'ALL' ? 'Tudo' : range}</button>
                          ))}
                      </div>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize:12}} minTickGap={30} />
                        <YAxis stroke="#94a3b8" unit="%" />
                        <Tooltip contentStyle={{backgroundColor:'#1e293b', borderColor:'#475569', color:'#f1f5f9'}} itemStyle={{color:'#f1f5f9'}} formatter={(val)=>`${val.toFixed(2)}%`} />
                        <Legend verticalAlign="top" height={36}/>
                        <Line type="monotone" dataKey="carteira" name="Minha Carteira" stroke="#10b981" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="ibov" name="IBOV" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="cdi" name="CDI" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="ipca" name="IPCA" stroke="#9ca3af" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
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
                                      
                                      <td className={`px-6 py-4 font-bold ${a.variacao_diaria == 0 ? 'text-slate-500' : (a.variacao_diaria > 0 ? 'text-emerald-400' : 'text-red-400')}`}>
                                          <div className="flex flex-col">
                                              <span>{a.variacao_diaria == 0 ? '-' : (a.variacao_diaria > 0 ? '+' : '') + a.variacao_diaria.toFixed(2) + '%'}</span>
                                              {a.variacao_diaria_valor && a.variacao_diaria_valor !== 0 && (
                                                  <span className="text-[10px] opacity-70">
                                                      R$ {a.variacao_diaria_valor.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                  </span>
                                              )}
                                          </div>
                                      </td>

                                      <td className="px-6 py-4 text-white font-medium">R$ {a.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                      
                                      <td className={`px-6 py-4 font-bold text-right ${a.rentabilidade>=0?'text-emerald-400':'text-red-400'}`}>
                                          <div className="flex flex-col items-end">
                                              <span>{a.rentabilidade.toFixed(2)}%</span>
                                              {a.lucro_valor && (
                                                  <span className="text-[10px] opacity-70">
                                                      R$ {a.lucro_valor.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                  </span>
                                              )}
                                          </div>
                                      </td>
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
        </div>
      </main>
    </div>
  );
}

function NavButton({ icon, active, onClick, title }) { return <button onClick={onClick} className={`p-3 rounded-xl transition-all flex justify-center mb-4 ${active ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`} title={title}>{icon}</button>; }

export default App;