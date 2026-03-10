import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Target, 
  MessageSquare, 
  LogOut, 
  Plus, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Users,
  Settings,
  Bell,
  Zap,
  Sparkles,
  Edit2,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { categorizeTransaction, getFinancialAdvice, getSpendingAnalysis } from './services/gemini';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("permission-denied")) {
          errorMessage = "No tienes permisos para realizar esta acción o ver estos datos.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Profile {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'business';
  ownerUid: string;
  members: string[];
}

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: any;
  profileId: string;
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  month: string;
  profileId: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: any;
  profileId: string;
}

interface Investment {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  profileId: string;
}

// --- Constants ---
const IBEX35_STOCKS = [
  { symbol: 'SAN', name: 'Banco Santander', price: 3.85 },
  { symbol: 'BBVA', name: 'BBVA', price: 9.20 },
  { symbol: 'TEF', name: 'Telefónica', price: 4.10 },
  { symbol: 'ITX', name: 'Inditex', price: 45.30 },
  { symbol: 'IBE', name: 'Iberdrola', price: 11.50 },
  { symbol: 'REP', name: 'Repsol', price: 14.80 },
  { symbol: 'AMS', name: 'Amadeus', price: 62.40 },
  { symbol: 'FER', name: 'Ferrovial', price: 35.20 },
  { symbol: 'GRF', name: 'Grifols', price: 8.50 },
  { symbol: 'CABK', name: 'CaixaBank', price: 4.60 },
];

// --- Components ---

const AuthScreen = () => {
  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-black/5"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Wallet className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">SmartBudget Pro</h1>
          <p className="text-gray-500 mt-2 italic font-serif">Gestión financiera inteligente para todos.</p>
        </div>
        
        <button 
          onClick={handleLogin}
          className="w-full bg-black text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-md active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continuar con Google
        </button>
        
        <p className="text-xs text-center text-gray-400 mt-8 uppercase tracking-widest">
          Seguro • Potenciado por IA • Tiempo real
        </p>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const hasBudgetAlert = React.useMemo(() => {
    return budgets.some(b => {
      if (b.month !== currentMonth) return false;
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === b.category && format(new Date(t.date.seconds * 1000), 'yyyy-MM') === b.month)
        .reduce((acc, t) => acc + t.amount, 0);
      return spent / b.amount > 0.8;
    });
  }, [budgets, transactions, currentMonth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Sync user to Firestore
        const userRef = doc(db, 'users', u.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            role: 'user',
            createdAt: Timestamp.now()
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch Profiles
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'profiles'), where('members', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setProfiles(p);
      if (p.length > 0 && !activeProfile) {
        setActiveProfile(p[0]);
      } else if (p.length === 0) {
        // Create default personal profile if none exists
        const newProfile = {
          name: 'Personal',
          type: 'personal' as const,
          ownerUid: user.uid,
          members: [user.uid],
          roles: { [user.uid]: 'owner' }
        };
        addDoc(collection(db, 'profiles'), newProfile).catch(e => handleFirestoreError(e, OperationType.CREATE, 'profiles'));
      }
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'profiles'));
    return unsub;
  }, [user]);

  // Fetch Data for Active Profile
  useEffect(() => {
    if (!activeProfile) return;

    const unsubTransactions = onSnapshot(
      query(collection(db, `profiles/${activeProfile.id}/transactions`), orderBy('date', 'desc')),
      (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${activeProfile.id}/transactions`)
    );

    const unsubBudgets = onSnapshot(
      collection(db, `profiles/${activeProfile.id}/budgets`),
      (s) => setBudgets(s.docs.map(d => ({ id: d.id, ...d.data() } as Budget))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${activeProfile.id}/budgets`)
    );

    const unsubGoals = onSnapshot(
      collection(db, `profiles/${activeProfile.id}/goals`),
      (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() } as Goal))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${activeProfile.id}/goals`)
    );

    const unsubInvestments = onSnapshot(
      collection(db, `profiles/${activeProfile.id}/investments`),
      (s) => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() } as Investment))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${activeProfile.id}/investments`)
    );

    return () => {
      unsubTransactions();
      unsubBudgets();
      unsubGoals();
      unsubInvestments();
    };
  }, [activeProfile]);

  if (loading) return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
    </div>
  );

  if (!user) return <AuthScreen />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-black/5 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
            <Wallet className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">SmartBudget</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Panel de Control' },
            { id: 'transactions', icon: Receipt, label: 'Transacciones' },
            { id: 'budgets', icon: PieChart, label: 'Presupuestos', alert: hasBudgetAlert },
            { id: 'goals', icon: Target, label: 'Ahorros' },
            { id: 'investments', icon: TrendingUp, label: 'Inversiones' },
            { id: 'ai', icon: MessageSquare, label: 'Asistente IA' },
          ].map((item: any) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                activeTab === item.id 
                ? 'bg-black text-white shadow-lg' 
                : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.alert && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-black/5 flex flex-col gap-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-black/10" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">Perfil {activeProfile?.name}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 capitalize">
              {activeTab === 'dashboard' ? 'Panel de Control' : 
               activeTab === 'transactions' ? 'Transacciones' :
               activeTab === 'budgets' ? 'Presupuestos' :
               activeTab === 'goals' ? 'Ahorros' : 
               activeTab === 'investments' ? 'Inversiones IBEX 35' : 'Asistente IA'}
            </h2>
            <p className="text-gray-500 font-serif italic">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select 
              value={activeProfile?.id}
              onChange={(e) => setActiveProfile(profiles.find(p => p.id === e.target.value) || null)}
              className="bg-white border border-black/10 rounded-2xl px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
            <button className="p-2 bg-white rounded-xl border border-black/10 shadow-sm hover:bg-gray-50 transition-all">
              <Bell size={20} className="text-gray-600" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" transactions={transactions} budgets={budgets} goals={goals} investments={investments} />}
          {activeTab === 'transactions' && <Transactions key="transactions" profileId={activeProfile?.id || ''} transactions={transactions} />}
          {activeTab === 'budgets' && <Budgets key="budgets" profileId={activeProfile?.id || ''} budgets={budgets} transactions={transactions} />}
          {activeTab === 'goals' && <Goals key="goals" profileId={activeProfile?.id || ''} goals={goals} />}
          {activeTab === 'investments' && <Investments key="investments" profileId={activeProfile?.id || ''} investments={investments} />}
          {activeTab === 'ai' && <AIChat key="ai" transactions={transactions} budgets={budgets} investments={investments} />}
        </AnimatePresence>
      </main>
    </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

const Dashboard = ({ transactions, budgets, goals, investments }: { transactions: Transaction[], budgets: Budget[], goals: Goal[], investments: Investment[] }) => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthTransactions = transactions.filter(t => format(new Date(t.date.seconds * 1000), 'yyyy-MM') === currentMonth);
  
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const totalInvestmentValue = investments.reduce((acc, inv) => acc + (inv.shares * inv.currentPrice), 0);
  const totalInvestmentCost = investments.reduce((acc, inv) => acc + (inv.shares * inv.purchasePrice), 0);
  const investmentGain = totalInvestmentValue - totalInvestmentCost;
  const investmentGainPercent = totalInvestmentCost > 0 ? (investmentGain / totalInvestmentCost) * 100 : 0;

  const chartData = [
    { name: 'Ingresos', value: totalIncome, color: '#10B981' },
    { name: 'Gastos', value: totalExpense, color: '#EF4444' },
  ];

  const expensesByCategory = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc: { [key: string]: number }, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value
  }));

  const PIE_COLORS = ['#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 md:grid-cols-4 gap-6"
    >
      {/* Stats */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Saldo Efectivo</span>
          <Wallet className="text-gray-300" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter">{balance.toLocaleString()}€</div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-emerald-500 font-bold flex items-center"><TrendingUp size={14} /> +12%</span>
          <span className="text-gray-400">mes</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Inversiones</span>
          <TrendingUp className="text-indigo-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-indigo-600">{totalInvestmentValue.toLocaleString()}€</div>
        <div className={`mt-4 text-sm font-bold ${investmentGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {investmentGain >= 0 ? '+' : ''}{investmentGainPercent.toFixed(1)}% rendimiento
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Ingresos</span>
          <TrendingUp className="text-emerald-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-emerald-600">{totalIncome.toLocaleString()}€</div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Gastos</span>
          <TrendingDown className="text-red-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-red-600">{totalExpense.toLocaleString()}€</div>
      </div>

      {/* Charts */}
      <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-black/5 h-[400px]">
        <h3 className="font-bold mb-6 flex items-center gap-2">
          <TrendingUp size={18} /> Resumen de Flujo
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#f8f8f8' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-black/5 h-[400px]">
        <h3 className="font-bold mb-6 flex items-center gap-2">
          <PieChart size={18} /> Gastos por Categoría
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </RePieChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      <div className="md:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-black/5">
        <h3 className="font-bold mb-6 flex items-center justify-between">
          Actividad Reciente
          <button className="text-xs text-gray-400 uppercase tracking-widest hover:text-black">Ver Todo</button>
        </h3>
        <div className="flex flex-col gap-4">
          {transactions.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{t.description}</p>
                <p className="text-xs text-gray-400">{t.category}</p>
              </div>
              <div className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                {t.type === 'income' ? '+' : '-'}{t.amount}€
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Transactions = ({ profileId, transactions }: { profileId: string, transactions: Transaction[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', type: 'expense', category: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', category: '', type: 'expense' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;

    let category = newTx.category;
    if (!category) {
      setAiLoading(true);
      const results = await categorizeTransaction(newTx.description, parseFloat(newTx.amount));
      category = results[0];
      setAiLoading(false);
    }

    await addDoc(collection(db, `profiles/${profileId}/transactions`), {
      ...newTx,
      amount: parseFloat(newTx.amount),
      category,
      date: Timestamp.now(),
      profileId
    });
    setNewTx({ description: '', amount: '', type: 'expense', category: '' });
    setSuggestions([]);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `profiles/${profileId}/transactions`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${profileId}/transactions/${id}`);
    }
  };

  const startEditing = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ 
      description: t.description, 
      amount: t.amount.toString(), 
      category: t.category,
      type: t.type
    });
  };

  const handleUpdateTransaction = async (id: string) => {
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || !editForm.description || !editForm.category) return;
    
    await updateDoc(doc(db, `profiles/${profileId}/transactions`, id), {
      description: editForm.description,
      amount: amount,
      category: editForm.category,
      type: editForm.type
    });
    setEditingId(null);
  };

  const fetchSuggestions = async () => {
    if (!newTx.description || !newTx.amount) return;
    setAiLoading(true);
    const results = await categorizeTransaction(newTx.description, parseFloat(newTx.amount));
    setSuggestions(results);
    if (results.length > 0) setNewTx(prev => ({ ...prev, category: results[0] }));
    setAiLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="relative flex-1 max-w-md">
          <input 
            type="text" 
            placeholder="Buscar transacciones..." 
            className="w-full bg-white border border-black/10 rounded-2xl px-12 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5"
          />
          <Receipt className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus size={20} /> Añadir Transacción
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-3xl shadow-xl border border-black/5 mb-8 overflow-hidden"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Descripción</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newTx.description}
                    onChange={e => setNewTx({...newTx, description: e.target.value})}
                    placeholder="ej: Compra en el súper" 
                    className="flex-1 bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                    required
                  />
                  <button
                    type="button"
                    onClick={fetchSuggestions}
                    disabled={aiLoading || !newTx.description || !newTx.amount}
                    className="bg-indigo-50 text-indigo-600 px-4 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {aiLoading ? <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <Sparkles size={14} />}
                    IA
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Monto</label>
                <input 
                  type="number" 
                  value={newTx.amount}
                  onChange={e => setNewTx({...newTx, amount: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Tipo</label>
                <select 
                  value={newTx.type}
                  onChange={e => setNewTx({...newTx, type: e.target.value})}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Categoría</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestions.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewTx({...newTx, category: cat})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${newTx.category === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={newTx.category}
                  onChange={e => setNewTx({...newTx, category: e.target.value})}
                  placeholder="O escribe una categoría..." 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <div className="md:col-span-4 flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setSuggestions([]);
                  }}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={aiLoading}
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {aiLoading ? 'Analizando...' : 'Guardar Transacción'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black/5">
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Descripción</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Categoría</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b border-black/5 hover:bg-gray-50 transition-all group">
                <td className="px-6 py-4 text-sm text-gray-500">
                  {format(new Date(t.date.seconds * 1000), "d 'de' MMM, yyyy", { locale: es })}
                </td>
                <td className="px-6 py-4">
                  {editingId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={editForm.description}
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                        className="w-full bg-gray-50 border border-black/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        placeholder="Descripción"
                      />
                      <select
                        value={editForm.type}
                        onChange={e => setEditForm({...editForm, type: e.target.value as 'income' | 'expense'})}
                        className="w-full bg-gray-50 border border-black/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                      >
                        <option value="expense">Gasto</option>
                        <option value="income">Ingreso</option>
                      </select>
                    </div>
                  ) : (
                    <p className="font-bold text-gray-900">{t.description}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === t.id ? (
                    <input 
                      type="text" 
                      value={editForm.category}
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      className="w-full bg-gray-50 border border-black/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                      placeholder="Categoría"
                    />
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {t.category}
                    </span>
                  )}
                </td>
                <td className={`px-6 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {editingId === t.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number" 
                        value={editForm.amount}
                        onChange={e => setEditForm({...editForm, amount: e.target.value})}
                        className="w-24 bg-gray-50 border border-black/10 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-black/5"
                        placeholder="Monto"
                      />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleUpdateTransaction(t.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded-lg">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3 group/amount">
                      <span>{t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}€</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEditing(t)}
                          className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

const Budgets = ({ profileId, budgets, transactions }: { profileId: string, budgets: Budget[], transactions: Transaction[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: '', amount: '' });
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.amount) return;
    await addDoc(collection(db, `profiles/${profileId}/budgets`), {
      ...newBudget,
      amount: parseFloat(newBudget.amount),
      month: currentMonth,
      profileId
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, `profiles/${profileId}/budgets`));
    setNewBudget({ category: '', amount: '' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `profiles/${profileId}/budgets`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${profileId}/budgets/${id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold">Presupuestos Mensuales - {format(new Date(), 'MMMM yyyy', { locale: es })}</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus size={20} /> Establecer Presupuesto
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-3xl shadow-xl border border-black/5 mb-8"
          >
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Categoría</label>
                <input 
                  type="text" 
                  value={newBudget.category}
                  onChange={e => setNewBudget({...newBudget, category: e.target.value})}
                  placeholder="ej: Comida" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Límite Mensual</label>
                <input 
                  type="number" 
                  value={newBudget.amount}
                  onChange={e => setNewBudget({...newBudget, amount: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all"
                >
                  Establecer Presupuesto
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map(b => {
          const spent = transactions
            .filter(t => t.type === 'expense' && t.category === b.category && format(new Date(t.date.seconds * 1000), 'yyyy-MM') === b.month)
            .reduce((acc, t) => acc + t.amount, 0);
          const percent = Math.min((spent / b.amount) * 100, 100);
          const isOver = spent > b.amount;

          return (
            <div key={b.id} className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg">{b.category}</h4>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`font-bold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>{spent.toLocaleString()}€</span>
                    <span className="text-gray-400 text-sm"> / {b.amount.toLocaleString()}€</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  className={`h-full rounded-full ${isOver ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-black'}`}
                />
              </div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className={isOver ? 'text-red-500' : 'text-gray-400'}>{percent.toFixed(0)}% Usado</span>
                <span className="text-gray-400">{(b.amount - spent).toLocaleString()}€ Restante</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const Goals = ({ profileId, goals }: { profileId: string, goals: Goal[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', currentAmount: '0' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) return;
    await addDoc(collection(db, `profiles/${profileId}/goals`), {
      ...newGoal,
      targetAmount: parseFloat(newGoal.targetAmount),
      currentAmount: parseFloat(newGoal.currentAmount),
      deadline: Timestamp.now(),
      profileId
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, `profiles/${profileId}/goals`));
    setNewGoal({ name: '', targetAmount: '', currentAmount: '0' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `profiles/${profileId}/goals`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${profileId}/goals/${id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold">Metas de Ahorro</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus size={20} /> Nueva Meta
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white p-6 rounded-3xl shadow-xl border border-black/5 mb-8"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Nombre de la Meta</label>
                <input 
                  type="text" 
                  value={newGoal.name}
                  onChange={e => setNewGoal({...newGoal, name: e.target.value})}
                  placeholder="ej: Coche Nuevo" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Monto Objetivo</label>
                <input 
                  type="number" 
                  value={newGoal.targetAmount}
                  onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Ahorros Iniciales</label>
                <input 
                  type="number" 
                  value={newGoal.currentAmount}
                  onChange={e => setNewGoal({...newGoal, currentAmount: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all"
                >
                  Crear Meta
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(g => {
          const percent = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
          return (
            <div key={g.id} className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-bold text-2xl tracking-tight mb-1">{g.name}</h4>
                    <p className="text-gray-400 text-sm font-serif italic">Objetivo: {g.targetAmount.toLocaleString()}€</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-all">
                      <Target size={24} />
                    </div>
                    <button 
                      onClick={() => handleDelete(g.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold tracking-tighter">{g.currentAmount.toLocaleString()}€</span>
                  <span className="text-gray-400 text-sm mb-1">ahorrado</span>
                </div>

                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className="h-full bg-black rounded-full"
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{percent.toFixed(1)}% Completado</span>
                  <button 
                    onClick={async () => {
                      const amount = prompt('¿Cuánto te gustaría añadir?');
                      if (amount) {
                        await updateDoc(doc(db, `profiles/${profileId}/goals`, g.id), {
                          currentAmount: g.currentAmount + parseFloat(amount)
                        });
                      }
                    }}
                    className="text-xs font-bold uppercase tracking-widest bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-all"
                  >
                    Añadir Fondos
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const AIChat = ({ transactions, budgets, investments }: { transactions: Transaction[], budgets: Budget[], investments: Investment[] }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: '¡Hola! Soy **Smarty**, tu asistente financiero personal. 👋\n\nPuedo analizar tus gastos, ayudarte con tus presupuestos o darte consejos sobre tus inversiones en el IBEX 35.\n\n¿Qué te gustaría revisar hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "¿Cómo voy con mis presupuestos este mes?",
    "¿En qué categoría estoy gastando más?",
    "¿Qué tal rinden mis inversiones?",
    "Identifica mis patrones de gasto y sugiere ahorros",
    "Dame 3 consejos para ahorrar este mes"
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent, text?: string) => {
    if (e) e.preventDefault();
    const messageToSend = text || input;
    if (!messageToSend.trim() || loading) return;

    const userMsg = messageToSend;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    let advice;
    if (userMsg.toLowerCase().includes('patrones') || userMsg.toLowerCase().includes('analiza mis gastos')) {
      advice = await getSpendingAnalysis({ 
        transactions: transactions.slice(0, 50), 
        budgets 
      });
    } else {
      advice = await getFinancialAdvice(userMsg, { 
        transactions: transactions.slice(0, 20), 
        budgets,
        investments 
      });
    }
    
    setMessages(prev => [...prev, { role: 'ai', text: advice }]);
    setLoading(false);
  };

  const handleDeepAnalysis = async () => {
    if (loading) return;
    setMessages(prev => [...prev, { role: 'user', text: "Realiza un análisis profundo de mis patrones de gasto." }]);
    setLoading(true);

    const analysis = await getSpendingAnalysis({ 
      transactions: transactions.slice(0, 50), 
      budgets 
    });
    setMessages(prev => [...prev, { role: 'ai', text: analysis }]);
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto h-[600px] flex flex-col bg-white rounded-3xl shadow-xl border border-black/5 overflow-hidden"
    >
      <div className="p-6 border-b border-black/5 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
            <MessageSquare className="text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold">Asistente Financiero IA</h3>
            <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest">En línea • Potenciado por Gemini</p>
          </div>
        </div>
        <button 
          onClick={handleDeepAnalysis}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
        >
          <Zap size={14} /> Análisis Profundo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
              m.role === 'user' 
              ? 'bg-black text-white rounded-tr-none' 
              : 'bg-gray-100 text-gray-800 rounded-tl-none border border-black/5'
            }`}>
              {m.role === 'user' ? (
                m.text
              ) : (
                <div className="markdown-body leading-relaxed">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-black/5">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        {!loading && messages.length < 5 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(undefined, q)}
                className="text-xs bg-white border border-black/10 px-3 py-2 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-6 border-t border-black/5 flex gap-3 bg-gray-50">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pregunta sobre tus hábitos de gasto..." 
          className="flex-1 bg-white border border-black/10 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 shadow-sm"
        />
        <button 
          type="submit"
          disabled={loading}
          className="bg-black text-white p-3 rounded-2xl shadow-lg hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
        >
          <ChevronRight size={24} />
        </button>
      </form>
    </motion.div>
  );
};

const Investments = ({ profileId, investments }: { profileId: string, investments: Investment[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newInvestment, setNewInvestment] = useState({ symbol: 'SAN', shares: '', purchasePrice: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvestment.shares || !newInvestment.purchasePrice) return;
    
    const stock = IBEX35_STOCKS.find(s => s.symbol === newInvestment.symbol);
    if (!stock) return;

    await addDoc(collection(db, `profiles/${profileId}/investments`), {
      symbol: stock.symbol,
      name: stock.name,
      shares: parseFloat(newInvestment.shares),
      purchasePrice: parseFloat(newInvestment.purchasePrice),
      currentPrice: stock.price,
      profileId
    });

    setNewInvestment({ symbol: 'SAN', shares: '', purchasePrice: '' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `profiles/${profileId}/investments`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${profileId}/investments/${id}`);
    }
  };

  const totalValue = investments.reduce((acc, inv) => acc + (inv.shares * inv.currentPrice), 0);
  const totalCost = investments.reduce((acc, inv) => acc + (inv.shares * inv.purchasePrice), 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const allocationData = investments.map(inv => ({
    name: inv.symbol,
    value: inv.shares * inv.currentPrice
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto pb-20"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-black text-white p-6 rounded-3xl shadow-2xl flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-2">Valor de Cartera</p>
            <h4 className="text-3xl font-bold tracking-tighter">{totalValue.toLocaleString()}€</h4>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-emerald-400 font-bold flex items-center"><TrendingUp size={14} /> +5.4%</span>
            <span className="opacity-50">hoy</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Plusvalía Total</p>
            <h4 className={`text-3xl font-bold tracking-tighter ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()}€
            </h4>
          </div>
          <p className={`text-sm font-bold ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {totalGainPercent.toFixed(2)}% total
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Activos</p>
            <h4 className="text-3xl font-bold tracking-tighter">{investments.length}</h4>
          </div>
          <p className="text-sm text-gray-400 font-bold">Diversificación</p>
        </div>
        <div className="flex items-center justify-end">
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-gray-800 transition-all active:scale-95 flex items-center gap-3"
          >
            <Plus size={20} /> Nueva Inversión
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-black/5">
              <h4 className="text-xl font-bold mb-6">Añadir Inversión al Portafolio</h4>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Valor IBEX 35</label>
                  <select 
                    value={newInvestment.symbol}
                    onChange={e => setNewInvestment({...newInvestment, symbol: e.target.value})}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium"
                  >
                    {IBEX35_STOCKS.map(s => (
                      <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Acciones</label>
                  <input 
                    type="number" 
                    value={newInvestment.shares}
                    onChange={e => setNewInvestment({...newInvestment, shares: e.target.value})}
                    placeholder="0" 
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Precio Compra (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newInvestment.purchasePrice}
                    onChange={e => setNewInvestment({...newInvestment, purchasePrice: e.target.value})}
                    placeholder="0.00" 
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all"
                  >
                    Añadir
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-black/5 bg-gray-50/50 flex justify-between items-center">
            <h4 className="font-bold text-lg">Tus Posiciones</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Precio Compra</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Precio Actual</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">G/P</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {investments.map(inv => {
                  const currentValue = inv.shares * inv.currentPrice;
                  const cost = inv.shares * inv.purchasePrice;
                  const gain = currentValue - cost;
                  const gainPercent = (gain / cost) * 100;

                  return (
                    <tr key={inv.id} className="border-t border-black/5 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{inv.name}</p>
                        <p className="text-xs text-gray-400 font-mono tracking-tighter">{inv.symbol}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">{inv.shares}</td>
                      <td className="px-6 py-4 font-medium text-gray-600">{inv.purchasePrice.toLocaleString()}€</td>
                      <td className="px-6 py-4 font-medium text-gray-600">{inv.currentPrice.toLocaleString()}€</td>
                      <td className={`px-6 py-4 text-right font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <div className="flex flex-col items-end">
                          <span>{gain >= 0 ? '+' : ''}{gain.toLocaleString()}€</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${gain >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {gainPercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {investments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic font-serif text-lg">
                      No tienes inversiones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
          <h4 className="font-bold text-lg mb-6">Distribución de Cartera</h4>
          <div className="h-[300px]">
            {investments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `${value.toLocaleString()}€`}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                Sin datos para mostrar
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {allocationData.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="font-medium text-gray-600">{item.name}</span>
                </div>
                <span className="font-bold text-gray-900">{((item.value / totalValue) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-indigo-600 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Zap className="text-white w-8 h-8" />
            </div>
            <div>
              <h4 className="text-xl font-bold mb-1">Análisis de Cartera con IA</h4>
              <p className="text-indigo-100 text-sm max-w-md">Nuestro motor de IA puede analizar tu diversificación y sugerir ajustes basados en el mercado actual del IBEX 35.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              // This would ideally navigate to AI tab and trigger a specific query
              console.log('Esta funcionalidad enviará tu cartera al asistente IA para un análisis detallado.');
            }}
            className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-lg whitespace-nowrap"
          >
            Obtener Análisis IA
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
        <div className="flex items-center justify-between mb-8">
          <h4 className="font-bold text-xl">Mercado IBEX 35 - Resumen</h4>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Mercado Abierto
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {IBEX35_STOCKS.slice(0, 5).map(stock => (
            <div key={stock.symbol} className="p-4 rounded-2xl bg-gray-50 border border-black/5 hover:border-black/10 transition-all cursor-default">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{stock.symbol}</p>
              <p className="font-bold text-gray-900 mb-2">{stock.name}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm">{stock.price.toLocaleString()}€</span>
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+1.2%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
