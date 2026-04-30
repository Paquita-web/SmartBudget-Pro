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
  X,
  Smartphone,
  Calendar,
  Download,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
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
  roles: { [uid: string]: string };
  streak?: number;
  lastActive?: any;
  isPremium?: boolean;
}
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: any;
  profileId: string;
  paidBy?: string; // UID of user who paid
  splitWith?: { [uid: string]: number }; // UID -> Amount map
  isSplit?: boolean;
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

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: number; // Day of month (1-31)
  category: string;
  isPaid: boolean;
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
    <div className="min-h-screen bg-[#E4E3E0] dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl border border-black/5 dark:border-white/5 transition-colors"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-black dark:bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Wallet className="text-white dark:text-black w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">SmartBudget Pro</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2 italic font-serif">Gestión financiera inteligente para todos.</p>
        </div>
        
        <button 
          onClick={handleLogin}
          className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continuar con Google
        </button>
        
        <p className="text-xs text-center text-gray-400 dark:text-zinc-500 mt-8 uppercase tracking-widest">
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileData, setNewProfileData] = useState({ name: '', type: 'personal' as 'personal' | 'family' | 'business' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [showMobileModal, setShowMobileModal] = useState(false);

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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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

    const unsubBills = onSnapshot(
      collection(db, `profiles/${activeProfile.id}/bills`),
      (s) => setBills(s.docs.map(d => ({ id: d.id, ...d.data() } as Bill))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${activeProfile.id}/bills`)
    );

    return () => {
      unsubTransactions();
      unsubBudgets();
      unsubGoals();
      unsubInvestments();
      unsubBills();
    };
  }, [activeProfile]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProfileData.name) return;

    try {
      const newProfile = {
        name: newProfileData.name,
        type: newProfileData.type,
        ownerUid: user.uid,
        members: [user.uid],
        roles: { [user.uid]: 'owner' },
        streak: 0,
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(collection(db, 'profiles'), newProfile);
      setActiveProfile({ id: docRef.id, ...newProfile } as Profile);
      setIsCreatingProfile(false);
      setNewProfileData({ name: '', type: 'personal' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'profiles');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#E4E3E0] dark:bg-zinc-900 flex items-center justify-center transition-colors">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black dark:border-white"></div>
    </div>
  );

  if (!user) return <AuthScreen />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] dark:bg-zinc-950 flex flex-col md:flex-row transition-colors selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-zinc-900 border-r border-black/5 dark:border-white/5 p-6 flex flex-col gap-8 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black dark:bg-zinc-800 rounded-xl flex items-center justify-center shadow-md">
            <Wallet className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">SmartBudget</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
            { id: 'transactions', icon: Receipt, label: 'Gastos' },
            { id: 'budgets', icon: PieChart, label: 'Límites', alert: hasBudgetAlert },
            { id: 'bills', icon: Calendar, label: 'Suscripciones' },
            { id: 'goals', icon: Target, label: 'Ahorro' },
            { id: 'investments', icon: TrendingUp, label: 'Bolsa' },
            { id: 'ai', icon: MessageSquare, label: 'Chat IA' },
          ].map((item: any) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                activeTab === item.id 
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50'
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

        <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col gap-4">
          <button 
            onClick={() => setShowMobileModal(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-medium"
          >
            <Smartphone size={20} />
            <span className="font-medium">Instalar en Móvil</span>
          </button>
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-black/10 dark:border-white/10" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate dark:text-white">{user.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">Perfil {activeProfile?.name}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white capitalize">
              {activeTab === 'dashboard' ? 'Panel de Control' : 
               activeTab === 'transactions' ? 'Transacciones' :
               activeTab === 'budgets' ? 'Presupuestos' :
               activeTab === 'bills' ? 'Mis Suscripciones y Pagos Fijos' :
               activeTab === 'goals' ? 'Ahorros' : 
               activeTab === 'investments' ? 'Inversiones IBEX 35' : 'Asistente IA'}
            </h2>
            <p className="text-gray-500 dark:text-zinc-500 font-serif italic">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>

          <div className="flex items-center gap-3 relative group">
            <select 
              value={activeProfile?.id}
              onChange={(e) => {
                if (e.target.value === 'new') {
                  setIsCreatingProfile(true);
                } else {
                  setActiveProfile(profiles.find(p => p.id === e.target.value) || null);
                }
              }}
              className="appearance-none bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-2xl pl-4 pr-10 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white cursor-pointer transition-colors"
            >
              <optgroup label="Mis Perfiles" className="dark:bg-zinc-800">
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type === 'personal' ? 'Personal' : p.type === 'family' ? 'Familiar' : 'Negocio'})</option>
                ))}
              </optgroup>
              <optgroup label="Acciones" className="dark:bg-zinc-800">
                <option value="new">+ Crear nuevo perfil</option>
              </optgroup>
            </select>
            <div className="absolute right-20 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <Plus size={16} />
            </div>
            <button className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-black/10 dark:border-white/10 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all">
              <Bell size={20} className="text-gray-600 dark:text-zinc-400" />
            </button>
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-black/10 dark:border-white/10 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all"
              title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
            >
              {theme === 'light' ? <Moon size={20} className="text-gray-600" /> : <Sun size={20} className="text-amber-400" />}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" transactions={transactions} budgets={budgets} goals={goals} investments={investments} bills={bills} theme={theme} activeProfile={activeProfile} />}
          {activeTab === 'transactions' && <Transactions key="transactions" profileId={activeProfile?.id || ''} transactions={transactions} activeProfile={activeProfile} />}
          {activeTab === 'budgets' && <Budgets key="budgets" profileId={activeProfile?.id || ''} budgets={budgets} transactions={transactions} />}
          {activeTab === 'bills' && <Bills key="bills" profileId={activeProfile?.id || ''} />}
          {activeTab === 'goals' && <Goals key="goals" profileId={activeProfile?.id || ''} goals={goals} />}
          {activeTab === 'investments' && <Investments key="investments" profileId={activeProfile?.id || ''} investments={investments} theme={theme} />}
          {activeTab === 'ai' && <AIChat key="ai" transactions={transactions} budgets={budgets} investments={investments} />}
        </AnimatePresence>
      </main>

      {/* Mobile Installation Modal */}
      <AnimatePresence>
        {showMobileModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-black/5"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold">Instalar SmartBudget Pro</h3>
                <button onClick={() => setShowMobileModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-bold">En iPhone (Safari):</p>
                    <p className="text-gray-600 text-sm">Pulsa el botón de "Compartir" (cuadrado con flecha) y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-bold">En Android (Chrome):</p>
                    <p className="text-gray-600 text-sm">Pulsa los tres puntos verticales y selecciona <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</p>
                  </div>
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                  <p className="text-xs text-indigo-700 font-medium">
                    Esto instalará la aplicación directamente en tu teléfono sin necesidad de ir a la App Store o Play Store.
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowMobileModal(false)}
                className="w-full mt-8 bg-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Profile Modal */}
      <AnimatePresence>
        {isCreatingProfile && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-black/5"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-bold tracking-tight">Nuevo Perfil Financiero</h3>
                  <p className="text-gray-500 font-serif italic mt-1">Organiza tus finanzas por ámbitos.</p>
                </div>
                <button onClick={() => setIsCreatingProfile(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCreateProfile} className="space-y-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Nombre del Perfil</label>
                    <input 
                      type="text"
                      value={newProfileData.name}
                      onChange={(e) => setNewProfileData({...newProfileData, name: e.target.value})}
                      placeholder="ej: Inversiones, Familia, Empresa..."
                      className="w-full bg-gray-50 border border-black/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Tipo de Perfil</label>
                    <div className="grid grid-cols-3 gap-4">
                      {(['personal', 'family', 'business'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNewProfileData({...newProfileData, type})}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                            newProfileData.type === type 
                            ? 'border-black bg-black text-white shadow-lg' 
                            : 'border-black/5 bg-gray-50 text-gray-500 hover:border-black/20'
                          }`}
                        >
                          {type === 'personal' && <Wallet size={24} />}
                          {type === 'family' && <Users size={24} />}
                          {type === 'business' && <Building2 size={24} />}
                          <span className="text-xs font-bold capitalize">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-3xl border border-black/5">
                  <div className="flex gap-4 items-start">
                    <Sparkles className="text-indigo-500 flex-shrink-0 mt-1" size={20} />
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Cada perfil tiene sus propios presupuestos, transacciones y objetivos. Podrás invitar a otros miembros una vez creado el perfil.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreatingProfile(false)}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all text-lg"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all text-lg active:scale-95"
                  >
                    Crear Perfil
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

const Dashboard = ({ transactions, budgets, goals, investments, bills, theme, activeProfile }: { transactions: Transaction[], budgets: Budget[], goals: Goal[], investments: Investment[], bills: Bill[], theme: 'light' | 'dark', activeProfile?: Profile }) => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthTransactions = transactions.filter(t => format(new Date(t.date.seconds * 1000), 'yyyy-MM') === currentMonth);
  
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // --- NEW: Settlement Calculation for Shared Profiles ---
  const sharedSettlements = React.useMemo(() => {
    if (!activeProfile || activeProfile.type === 'personal') return null;
    
    const myUid = auth.currentUser?.uid;
    let iOwe = 0;
    let iAmOwed = 0;

    monthTransactions.forEach(t => {
      if (t.isSplit && t.type === 'expense') {
        const half = t.amount / 2;
        if (t.paidBy === myUid) {
          // I paid, other member owes me half
          iAmOwed += half;
        } else {
          // Someone else paid, I owe them half
          iOwe += half;
        }
      }
    });

    return { iOwe, iAmOwed, net: iAmOwed - iOwe };
  }, [monthTransactions, activeProfile]);

  const totalInvestmentValue = investments.reduce((acc, inv) => acc + (inv.shares * inv.currentPrice), 0);
  const totalInvestmentCost = investments.reduce((acc, inv) => acc + (inv.shares * inv.purchasePrice), 0);
  const investmentGain = totalInvestmentValue - totalInvestmentCost;
  const investmentGainPercent = totalInvestmentCost > 0 ? (investmentGain / totalInvestmentCost) * 100 : 0;

  const chartData = [
    { name: 'Ingresos', value: totalIncome, color: '#10B981' },
    { name: 'Gastos', value: totalExpense, color: '#EF4444' },
  ];

  // Financial Health Score Calculation
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const budgetAdherence = budgets.length > 0 ? (budgets.filter(b => {
    const spent = transactions.filter(t => t.type === 'expense' && t.category === b.category && format(new Date(t.date.seconds * 1000), 'yyyy-MM') === b.month).reduce((acc, t) => acc + t.amount, 0);
    return spent <= b.amount;
  }).length / budgets.length) * 100 : 100;
  
  const healthScore = Math.round(
    (Math.min(Math.max(savingsRate, 0), 30) / 30 * 40) + // 40% Savings Rate
    (budgetAdherence * 0.4) + // 40% Budget Adherence
    (Math.min(investments.length, 5) / 5 * 20) // 20% Diversification
  );

  // --- NEW: Financial Intelligence Functions ---
  
  // 1. Spending Distribution Data
  const categoryData = React.useMemo(() => {
    const categories: { [key: string]: number } = {};
    monthTransactions.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions]);

  // 2. Net Worth Evolution (Last 6 Months)
  const netWorthData = React.useMemo(() => {
    const data = [];
    const now = new Date();
    let cumulativeBalance = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const investmentValue = investments.reduce((acc, inv) => acc + (inv.shares * inv.currentPrice), 0);
    
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const monthStr = format(d, 'MMM');
      // Simple simulation of growth for visual purposes if historical snapshots aren't available
      data.push({
        name: monthStr,
        total: cumulativeBalance + investmentValue - (i * 200), // simulated trend
      });
    }
    return data;
  }, [transactions, investments]);

  // 3. Savings Forecast
  const monthlySavings = (totalIncome - totalExpense);
  const projectedYearEnd = (monthlySavings * (12 - new Date().getMonth())) + (totalIncome - totalExpense);

  const savingsStreak = React.useMemo(() => {
    const dailyStats: { [date: string]: number } = {};
    transactions.forEach(t => {
      const dateStr = format(new Date(t.date.seconds * 1000), 'yyyy-MM-dd');
      dailyStats[dateStr] = (dailyStats[dateStr] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    });

    let streak = 0;
    const today = new Date();
    // Start from yesterday to avoid breaking streak if user hasn't saved today yet
    for (let i = 1; i < 365; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      if ((dailyStats[dateStr] || 0) >= 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [transactions]);

  const upcomingBills = bills
    .filter(b => !b.isPaid)
    .sort((a,b) => a.dueDate - b.dueDate)
    .slice(0, 3);

  const getScoreColor = (score: number) => {
    if (score > 80) return 'text-emerald-500';
    if (score > 50) return 'text-amber-500';
    return 'text-red-500';
  };

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

  const PIE_COLORS = theme === 'light' 
    ? ['#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    : ['#FFFFFF', '#818CF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 md:grid-cols-4 gap-6"
    >
      {/* Financial Health Score Hero */}
      <div className="md:col-span-4 bg-black dark:bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mb-4 border border-white/5">
        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Activity className="text-white w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-[10px] uppercase tracking-widest text-gray-400 block">Salud Financiera</span>
                <span className="text-2xl font-bold tracking-tighter text-white">Score: <span className={getScoreColor(healthScore)}>{healthScore}</span></span>
              </div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 backdrop-blur-md rounded-xl flex items-center justify-center text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-[10px] uppercase tracking-widest text-gray-400 block">Racha de Ahorro</span>
                <span className="text-2xl font-bold tracking-tighter text-white">{savingsStreak} Días 🔥</span>
              </div>
            </div>
          </div>
          <p className="text-gray-400 max-w-md font-serif italic text-lg leading-relaxed">
            {healthScore > 80 ? 'Excelente gestión. Tu patrimonio crece a un ritmo óptimo para tu jubilación anticipada.' : 
             healthScore > 50 ? 'Estado sólido. Optimiza tus suscripciones activas para mejorar un 15% tu ahorro mensual.' : 
             'Atención requerida. Tus gastos fijos superan el 70% de tus ingresos. Revisa el apartado de Facturas.'}
          </p>
        </div>
        <div className="relative z-10 flex flex-col gap-3 min-w-[280px]">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Próximos Pagos</h4>
          {upcomingBills.map(bill => (
            <div key={bill.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Calendar size={14} />
                </div>
                <span className="text-sm font-medium">{bill.name}</span>
              </div>
              <span className="font-bold text-sm">{bill.amount}€</span>
            </div>
          ))}
          {upcomingBills.length === 0 && <p className="text-xs text-gray-500 italic px-2">No hay pagos pendientes 🎉</p>}
        </div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px]" />
      </div>

      {/* NEW: Inteligencia Financiera */}
      <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-6 gap-6 mb-4">
        <div className="md:col-span-4 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5 min-h-[350px] transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold tracking-tight dark:text-white">Evolución de Patrimonio</h3>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Saldo Total + Valor de Inversiones</p>
            </div>
            <div className="bg-black dark:bg-white dark:text-black text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg">
              Tendencia +12%
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#f0f0f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: theme === 'dark' ? '#999' : '#666'}} dy={10} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                    color: theme === 'dark' ? '#ffffff' : '#000000'
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
                  formatter={(value) => [`${Number(value).toLocaleString()}€`, 'Patrimonio']}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5 flex-1 flex flex-col justify-between overflow-hidden relative group transition-colors">
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                <Sparkles size={18} className="text-amber-500" /> Inteligencia IA
              </h3>
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Previsión Anual</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed font-medium">
                    Ahorrarás <span className="font-bold underlineDecoration">{projectedYearEnd.toLocaleString()}€</span> este año si mantienes el ritmo.
                  </p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/20">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Dato del Mes</p>
                  <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed font-medium">
                    Tu categoría más costosa es <span className="font-bold">{categoryData[0]?.name || 'N/A'}</span>. ¡Un 5% menos ahorraría {(totalExpense * 0.05).toFixed(0)}€!
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-20 transition-opacity dark:text-white text-black">
              <TrendingUp size={160} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Saldo Efectivo</span>
          <Wallet className="text-gray-300 dark:text-zinc-600" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter dark:text-white">{balance.toLocaleString()}€</div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-emerald-500 font-bold flex items-center"><TrendingUp size={14} /> +12%</span>
          <span className="text-gray-400">mes</span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Inversiones</span>
          <TrendingUp className="text-indigo-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-indigo-600 dark:text-indigo-400">{totalInvestmentValue.toLocaleString()}€</div>
        <div className={`mt-4 text-sm font-bold ${investmentGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {investmentGain >= 0 ? '+' : ''}{investmentGainPercent.toFixed(1)}% rendimiento
        </div>
      </div>

      {sharedSettlements && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Saldos Compartidos</span>
            <Users className="text-indigo-500" size={20} />
          </div>
          <div className={`text-3xl font-bold tracking-tighter ${sharedSettlements.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {sharedSettlements.net > 0 ? '+' : ''}{sharedSettlements.net.toLocaleString()}€
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>Te deben:</span>
              <span className="text-emerald-500">{sharedSettlements.iAmOwed.toLocaleString()}€</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>Debes:</span>
              <span className="text-amber-500">{sharedSettlements.iOwe.toLocaleString()}€</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Ingresos</span>
          <TrendingUp className="text-emerald-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-emerald-600 dark:text-emerald-400">{totalIncome.toLocaleString()}€</div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Gastos</span>
          <TrendingDown className="text-red-500" size={20} />
        </div>
        <div className="text-3xl font-bold tracking-tighter text-red-600 dark:text-red-400">{totalExpense.toLocaleString()}€</div>
      </div>

      {/* Charts */}
      <div className="md:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 h-[400px] transition-colors">
        <h3 className="font-bold mb-6 flex items-center gap-2 dark:text-white">
          <TrendingUp size={18} /> Resumen de Flujo
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#f0f0f0'} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#999' : '#666'}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#999' : '#666'}} />
            <Tooltip 
              cursor={{ fill: theme === 'dark' ? '#27272a' : '#f8f8f8' }}
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                color: theme === 'dark' ? '#ffffff' : '#000000'
              }}
              itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="md:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 h-[400px] transition-colors">
        <h3 className="font-bold mb-6 flex items-center gap-2 dark:text-white">
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
              stroke={theme === 'dark' ? '#18181b' : '#fff'}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                color: theme === 'dark' ? '#ffffff' : '#000000'
              }}
              itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
            />
          </RePieChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      <div className="md:col-span-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 transition-colors">
        <h3 className="font-bold mb-6 flex items-center justify-between dark:text-white">
          Actividad Reciente
          <button className="text-xs text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors">Ver Todo</button>
        </h3>
        <div className="flex flex-col gap-4">
          {transactions.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate dark:text-white">{t.description}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{t.category}</p>
              </div>
              <div className={`font-bold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{t.amount}€
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Transactions = ({ profileId, transactions, activeProfile }: { profileId: string, transactions: Transaction[], activeProfile?: Profile }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTx, setNewTx] = useState({ 
    description: '', 
    amount: '', 
    type: 'expense' as 'income' | 'expense', 
    category: '',
    paidBy: auth.currentUser?.uid || '',
    isSplit: false
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', category: '', type: 'expense' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    date: 'all',
    category: 'all',
    type: 'all',
    minAmount: '',
    maxAmount: ''
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | 'date_timestamp', direction: 'asc' | 'desc' }>({
    key: 'date_timestamp',
    direction: 'desc'
  });

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
      profileId,
      paidBy: newTx.paidBy || auth.currentUser?.uid,
      isSplit: activeProfile?.type !== 'personal' ? newTx.isSplit : false,
      splitWith: newTx.isSplit ? { 
        // For now, split 50/50 with other members if it's a simple split
        // In a real app we'd have a UI to select specific members
      } : null
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

  const filterTransactions = () => {
    let result = transactions.filter(t => 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Date filter
    const now = new Date();
    if (filters.date === 'thisMonth') {
      const start = startOfMonth(now);
      result = result.filter(t => new Date(t.date.seconds * 1000) >= start);
    } else if (filters.date === 'lastMonth') {
      const start = startOfMonth(subMonths(now, 1));
      const end = endOfMonth(subMonths(now, 1));
      result = result.filter(t => {
        const d = new Date(t.date.seconds * 1000);
        return d >= start && d <= end;
      });
    }

    // Category filter
    if (filters.category !== 'all') {
      result = result.filter(t => t.category === filters.category);
    }

    // Type filter
    if (filters.type !== 'all') {
      result = result.filter(t => t.type === filters.type);
    }

    // Amount filter
    if (filters.minAmount !== '') {
      result = result.filter(t => t.amount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount !== '') {
      result = result.filter(t => t.amount <= parseFloat(filters.maxAmount));
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any = a[sortConfig.key === 'date_timestamp' ? 'date' : sortConfig.key as keyof Transaction];
      let bVal: any = b[sortConfig.key === 'date_timestamp' ? 'date' : sortConfig.key as keyof Transaction];

      if (sortConfig.key === 'date_timestamp') {
        aVal = a.date.seconds;
        bVal = b.date.seconds;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  };

  const categories = Array.from(new Set(transactions.map(t => t.category)));

  const toggleSort = (key: keyof Transaction | 'date_timestamp') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Tipo'];
    const rows = transactions.map(t => [
      format(new Date(t.date.seconds * 1000), 'yyyy-MM-dd'),
      t.description,
      t.category,
      t.amount,
      t.type
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `smartbudget_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = filterTransactions();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input 
              type="text" 
              placeholder="Buscar transacciones..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl px-12 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white transition-colors"
            />
            <Receipt className="absolute left-4 top-3.5 text-gray-400" size={20} />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`bg-white dark:bg-zinc-900 border ${showFilters ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black' : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-zinc-400'} px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm`}
            >
              <Activity size={20} /> {showFilters ? 'Ocultar Filtros' : 'Filtros'}
            </button>
            <button 
              onClick={exportToCSV}
              className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-gray-600 dark:text-zinc-400 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
            >
              <Download size={20} /> Exportar
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all active:scale-95"
            >
              <Plus size={20} /> Nueva
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-md border border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-5 gap-4 transition-colors"
            >
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Fecha</label>
                <select 
                  value={filters.date}
                  onChange={e => setFilters({...filters, date: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white"
                >
                  <option value="all">Siempre</option>
                  <option value="thisMonth">Este Mes</option>
                  <option value="lastMonth">Mes Pasado</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Categoría</label>
                <select 
                  value={filters.category}
                  onChange={e => setFilters({...filters, category: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white"
                >
                  <option value="all">Todas</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Tipo</label>
                <select 
                  value={filters.type}
                  onChange={e => setFilters({...filters, type: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white"
                >
                  <option value="all">Todos</option>
                  <option value="income">Ingresos</option>
                  <option value="expense">Gastos</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Mínimo (€)</label>
                <input 
                  type="number" 
                  value={filters.minAmount}
                  onChange={e => setFilters({...filters, minAmount: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white placeholder:text-zinc-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Máximo (€)</label>
                <input 
                  type="number" 
                  value={filters.maxAmount}
                  onChange={e => setFilters({...filters, maxAmount: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white placeholder:text-zinc-500"
                  placeholder="∞"
                />
              </div>
              <div className="md:col-span-5 flex justify-end mt-2">
                <button 
                  onClick={() => setFilters({ date: 'all', category: 'all', type: 'all', minAmount: '', maxAmount: '' })}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Limpiar Filtros
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                  onChange={e => setNewTx({...newTx, type: e.target.value as 'income' | 'expense'})}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5"
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </div>

              {activeProfile?.type !== 'personal' && newTx.type === 'expense' && (
                <div className="md:col-span-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Pagado por:</label>
                    <select 
                      value={newTx.paidBy}
                      onChange={e => setNewTx({...newTx, paidBy: e.target.value})}
                      className="bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm focus:ring-2 focus:ring-indigo-200 dark:text-white"
                    >
                      <option value={auth.currentUser?.uid}>Mí (Tú)</option>
                      {activeProfile?.members?.filter(m => m !== auth.currentUser?.uid).map(m => (
                        <option key={m} value={m}>Miembro ({m.slice(0, 4)})</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={newTx.isSplit}
                        onChange={e => setNewTx({...newTx, isSplit: e.target.checked})}
                        className="sr-only" 
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${newTx.isSplit ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${newTx.isSplit ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Dividir 50/50</span>
                  </label>
                  {newTx.isSplit && (
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight flex items-center gap-1">
                      <Users size={12} /> Cada uno paga {(parseFloat(newTx.amount || '0') / 2).toLocaleString()}€
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Categoría</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestions.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewTx({...newTx, category: cat})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${newTx.category === cat ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
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
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white transition-colors"
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

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/5">
              <th 
                className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                onClick={() => toggleSort('date_timestamp')}
              >
                <div className="flex items-center gap-1">
                  Fecha {sortConfig.key === 'date_timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                onClick={() => toggleSort('description')}
              >
                <div className="flex items-center gap-1">
                  Descripción {sortConfig.key === 'description' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                onClick={() => toggleSort('category')}
              >
                <div className="flex items-center gap-1">
                  Categoría {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Monto {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-black/5 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all group">
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-zinc-500">
                  {format(new Date(t.date.seconds * 1000), "d 'de' MMM, yyyy", { locale: es })}
                </td>
                <td className="px-6 py-4">
                  {editingId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={editForm.description}
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                        placeholder="Descripción"
                      />
                      <select
                        value={editForm.type}
                        onChange={e => setEditForm({...editForm, type: e.target.value as 'income' | 'expense'})}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                      >
                        <option value="expense">Gasto</option>
                        <option value="income">Ingreso</option>
                      </select>
                    </div>
                  ) : (
                    <p className="font-bold text-gray-900 dark:text-white">{t.description}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === t.id ? (
                    <input 
                      type="text" 
                      value={editForm.category}
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                      placeholder="Categoría"
                    />
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider transition-colors">
                      {t.category}
                    </span>
                  )}
                </td>
                <td className={`px-6 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {editingId === t.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number" 
                        value={editForm.amount}
                        onChange={e => setEditForm({...editForm, amount: e.target.value})}
                        className="w-24 bg-gray-50 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                        placeholder="Monto"
                      />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleUpdateTransaction(t.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3 group/amount">
                      {t.isSplit && (
                        <div className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          <Users size={10} /> Split
                        </div>
                      )}
                      <span className="dark:text-zinc-100">{t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}€</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEditing(t)}
                          className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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
        <h3 className="text-xl font-bold dark:text-white">Presupuestos Mensuales - {format(new Date(), 'MMMM yyyy', { locale: es })}</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all active:scale-95"
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
            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-black/5 dark:border-white/5 mb-8 transition-colors"
          >
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2 block">Categoría</label>
                <input 
                  type="text" 
                  value={newBudget.category}
                  onChange={e => setNewBudget({...newBudget, category: e.target.value})}
                  placeholder="ej: Comida" 
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2 block">Límite Mensual</label>
                <input 
                  type="number" 
                  value={newBudget.amount}
                  onChange={e => setNewBudget({...newBudget, amount: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all"
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
            <div key={b.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg dark:text-white">{b.category}</h4>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`font-bold ${isOver ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{spent.toLocaleString()}€</span>
                    <span className="text-gray-400 dark:text-zinc-500 text-sm"> / {b.amount.toLocaleString()}€</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  className={`h-full rounded-full ${isOver ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-black dark:bg-white'}`}
                />
              </div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className={isOver ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}>{percent.toFixed(0)}% Usado</span>
                <span className="text-gray-400 dark:text-zinc-500">{(b.amount - spent).toLocaleString()}€ Restante</span>
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
        <h3 className="text-xl font-bold dark:text-white">Metas de Ahorro</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all active:scale-95"
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
            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-black/5 dark:border-white/5 mb-8 transition-colors"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Nombre de la Meta</label>
                <input 
                  type="text" 
                  value={newGoal.name}
                  onChange={e => setNewGoal({...newGoal, name: e.target.value})}
                  placeholder="ej: Coche Nuevo" 
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
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
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
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
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                />
              </div>
              <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all"
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
            <div key={g.id} className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 relative overflow-hidden group transition-colors">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-bold text-2xl tracking-tight mb-1 dark:text-white">{g.name}</h4>
                    <p className="text-gray-400 dark:text-zinc-500 text-sm font-serif italic">Objetivo: {g.targetAmount.toLocaleString()}€</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-black/5 dark:bg-white/10 rounded-2xl flex items-center justify-center text-black dark:text-white group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all">
                      <Target size={24} />
                    </div>
                    <button 
                      onClick={() => handleDelete(g.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold tracking-tighter dark:text-zinc-100">{g.currentAmount.toLocaleString()}€</span>
                  <span className="text-gray-400 dark:text-zinc-500 text-sm mb-1">ahorrado</span>
                </div>

                <div className="w-full h-4 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className="h-full bg-black dark:bg-white rounded-full"
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">{percent.toFixed(1)}% Completado</span>
                  <button 
                    onClick={async () => {
                      const amount = prompt('¿Cuánto te gustaría añadir?');
                      if (amount) {
                        await updateDoc(doc(db, `profiles/${profileId}/goals`, g.id), {
                          currentAmount: g.currentAmount + parseFloat(amount)
                        });
                      }
                    }}
                    className="text-xs font-bold uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all shadow-md"
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
      className="max-w-2xl mx-auto h-[600px] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-black/5 dark:border-white/5 overflow-hidden transition-colors"
    >
      <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-md transition-colors">
            <MessageSquare className="text-white dark:text-black w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold dark:text-white">Asistente Financiero IA</h3>
            <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest">En línea • Potenciado por Gemini</p>
          </div>
        </div>
        <button 
          onClick={handleDeepAnalysis}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all disabled:opacity-50"
        >
          <Zap size={14} /> Análisis Profundo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm transition-colors ${
              m.role === 'user' 
              ? 'bg-black dark:bg-zinc-100 text-white dark:text-black rounded-tr-none' 
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-tl-none border border-black/5 dark:border-white/5'
            }`}>
              {m.role === 'user' ? (
                m.text
              ) : (
                <div className="markdown-body leading-relaxed dark:prose-invert">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-black/5 dark:border-white/5 transition-colors">
              <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        {!loading && messages.length < 5 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(undefined, q)}
                className="text-xs bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 px-3 py-2 rounded-xl text-gray-600 dark:text-zinc-400 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-6 border-t border-black/5 dark:border-white/5 flex gap-3 bg-gray-50 dark:bg-zinc-800/50 transition-colors">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pregunta sobre tus hábitos de gasto..." 
          className="flex-1 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 shadow-sm dark:text-white transition-colors"
        />
        <button 
          type="submit"
          disabled={loading}
          className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-2xl shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </form>
    </motion.div>
  );
};

const Investments = ({ profileId, investments, theme }: { profileId: string, investments: Investment[], theme: string }) => {
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
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Plusvalía Total</p>
            <h4 className={`text-3xl font-bold tracking-tighter ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()}€
            </h4>
          </div>
          <p className={`text-sm font-bold ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {totalGainPercent.toFixed(2)}% total
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Activos</p>
            <h4 className="text-3xl font-bold tracking-tighter dark:text-white">{investments.length}</h4>
          </div>
          <p className="text-sm text-gray-400 dark:text-zinc-500 font-bold">Diversificación</p>
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
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-black/5 dark:border-white/5 transition-colors">
              <h4 className="text-xl font-bold mb-6 dark:text-white">Añadir Inversión al Portafolio</h4>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Valor IBEX 35</label>
                  <select 
                    value={newInvestment.symbol}
                    onChange={e => setNewInvestment({...newInvestment, symbol: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium dark:text-white"
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
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium dark:text-white"
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
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-medium dark:text-white"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all"
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
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden transition-colors">
          <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/50 flex justify-between items-center transition-colors">
            <h4 className="font-bold text-lg dark:text-white">Tus Posiciones</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/30 dark:bg-zinc-800/30">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Títulos</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Precio Compra</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Precio Actual</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right">G/P</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {investments.map(inv => {
                  const currentValue = inv.shares * inv.currentPrice;
                  const cost = inv.shares * inv.purchasePrice;
                  const gain = currentValue - cost;
                  const gainPercent = (gain / cost) * 100;

                  return (
                    <tr key={inv.id} className="border-t border-black/5 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 dark:text-white">{inv.name}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono tracking-tighter">{inv.symbol}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600 dark:text-zinc-400">{inv.shares}</td>
                      <td className="px-6 py-4 font-medium text-gray-600 dark:text-zinc-400">{inv.purchasePrice.toLocaleString()}€</td>
                      <td className="px-6 py-4 font-medium text-gray-600 dark:text-zinc-400">{inv.currentPrice.toLocaleString()}€</td>
                      <td className={`px-6 py-4 text-right font-bold ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        <div className="flex flex-col items-end">
                          <span>{gain >= 0 ? '+' : ''}{gain.toLocaleString()}€</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${gain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                            {gainPercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 transition-colors">
          <h4 className="font-bold text-lg mb-6 dark:text-white">Distribución de Cartera</h4>
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
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                      color: theme === 'dark' ? '#ffffff' : '#000000'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-zinc-500 italic text-sm">
                Sin datos para mostrar
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {allocationData.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="font-medium text-gray-600 dark:text-zinc-400">{item.name}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{((item.value / totalValue) * 100).toFixed(1)}%</span>
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

      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 transition-colors">
        <div className="flex items-center justify-between mb-8">
          <h4 className="font-bold text-xl dark:text-white">Mercado IBEX 35 - Resumen</h4>
          <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Mercado Abierto
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {IBEX35_STOCKS.slice(0, 5).map(stock => (
            <div key={stock.symbol} className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/20 transition-all cursor-default">
              <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{stock.symbol}</p>
              <p className="font-bold text-gray-900 dark:text-white mb-2">{stock.name}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm dark:text-zinc-300">{stock.price.toLocaleString()}€</span>
                <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md">+1.2%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Bills = ({ profileId }: { profileId: string }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newBill, setNewBill] = useState({ name: '', amount: '', dueDate: '1', category: 'Streaming' });

  useEffect(() => {
    if (!profileId) return;
    const unsub = onSnapshot(
      collection(db, `profiles/${profileId}/bills`),
      (s) => setBills(s.docs.map(d => ({ id: d.id, ...d.data() } as Bill))),
      (e) => handleFirestoreError(e, OperationType.LIST, `profiles/${profileId}/bills`)
    );
    return unsub;
  }, [profileId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBill.name || !newBill.amount) return;
    await addDoc(collection(db, `profiles/${profileId}/bills`), {
      name: newBill.name,
      amount: parseFloat(newBill.amount),
      dueDate: parseInt(newBill.dueDate),
      category: newBill.category,
      isPaid: false,
      profileId
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, `profiles/${profileId}/bills`));
    setNewBill({ name: '', amount: '', dueDate: '1', category: 'Streaming' });
    setIsAdding(false);
  };

  const togglePaid = async (bill: Bill) => {
    await updateDoc(doc(db, `profiles/${profileId}/bills`, bill.id), {
      isPaid: !bill.isPaid
    }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `profiles/${profileId}/bills/${bill.id}`));
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, `profiles/${profileId}/bills`, id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `profiles/${profileId}/bills/${id}`));
  };

  const totalFixedCost = bills.reduce((acc, bill) => acc + bill.amount, 0);
  const totalPaid = bills.filter(b => b.isPaid).reduce((acc, b) => acc + b.amount, 0);

  const getBillIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('netflix') || n.includes('disney') || n.includes('hbo') || n.includes('prime')) return <Zap size={24} />;
    if (n.includes('spotify') || n.includes('music') || n.includes('youtube')) return <TrendingUp size={24} />;
    if (n.includes('alquiler') || n.includes('rent') || n.includes('hipoteca')) return <Building2 size={24} />;
    if (n.includes('gym') || n.includes('gimnasio')) return <Activity size={24} />;
    if (n.includes('luz') || n.includes('agua') || n.includes('gas') || n.includes('internet')) return <Zap size={24} />;
    return <Calendar size={24} />;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between">
          <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-2">Coste Fijo Total</p>
          <h4 className="text-3xl font-bold tracking-tighter">{totalFixedCost.toLocaleString()}€<span className="text-sm opacity-50 font-normal">/mes</span></h4>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
          <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Pagado este mes</p>
          <h4 className="text-3xl font-bold tracking-tighter text-emerald-600 dark:text-emerald-400">{totalPaid.toLocaleString()}€</h4>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between transition-colors">
          <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Pendiente</p>
          <h4 className="text-3xl font-bold tracking-tighter text-amber-500 dark:text-amber-400">{(totalFixedCost - totalPaid).toLocaleString()}€</h4>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold dark:text-white">Mis Suscripciones</h3>
          <p className="text-gray-500 dark:text-zinc-400 font-serif italic text-sm">Gestiona tus gastos fijos y suscripciones recurrentes.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all active:scale-95"
        >
          <Plus size={20} /> Nueva Suscripción
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl border border-black/5 dark:border-white/5 mb-8 transition-colors">
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Nombre del Servicio</label>
                <input value={newBill.name} onChange={e => setNewBill({...newBill, name: e.target.value})} placeholder="ej: Alquiler, Spotify, Netflix..." className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white" required />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Categoría</label>
                <select 
                  value={newBill.category} 
                  onChange={e => setNewBill({...newBill, category: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                >
                  <option value="Streaming">Streaming</option>
                  <option value="Vivienda">Vivienda</option>
                  <option value="Servicios">Servicios (Luz/Agua)</option>
                  <option value="Salud">Salud/Gimnasio</option>
                  <option value="Seguros">Seguros</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Monto (€)</label>
                <input type="number" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} placeholder="0.00" className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white" required />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Día de Cobro</label>
                <input type="number" min="1" max="31" value={newBill.dueDate} onChange={e => setNewBill({...newBill, dueDate: e.target.value})} className="w-full bg-gray-50 dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white" required />
              </div>
              <div className="md:col-span-4 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all">Cancelar</button>
                <button type="submit" className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-all flex items-center gap-2">Guardar Suscripción</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {bills.sort((a,b) => a.dueDate - b.dueDate).map(bill => (
          <div key={bill.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex items-center justify-between group hover:border-black/20 dark:hover:border-white/20 transition-all">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-colors ${bill.isPaid ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 group-hover:text-amber-600 dark:group-hover:text-amber-400'}`}>
                {getBillIcon(bill.name)}
              </div>
              <div>
                <h4 className="font-bold text-lg dark:text-white">{bill.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md transition-colors">{bill.category}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">Día {bill.dueDate}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="font-bold text-2xl tracking-tighter dark:text-white">{bill.amount.toLocaleString()}€</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${bill.isPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 animate-pulse'}`}>
                  {bill.isPaid ? 'Pagado' : 'Pendiente'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePaid(bill)} className={`p-3 rounded-xl transition-all shadow-sm ${bill.isPaid ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black' : 'bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white'}`}>
                  <Check size={20} />
                </button>
                <button onClick={() => handleDelete(bill.id)} className="p-3 text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {bills.length === 0 && (
          <div className="bg-white/50 dark:bg-zinc-900/50 border border-dashed border-black/10 dark:border-white/10 rounded-[2.5rem] p-20 text-center transition-colors">
            <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300 dark:text-zinc-600 transition-colors">
              <Calendar size={40} />
            </div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No hay suscripciones</h4>
            <p className="text-gray-400 dark:text-zinc-500 italic font-serif max-w-sm mx-auto">Configura tus gastos recurrentes como Netflix, el gimnasio o el alquiler para tener un control total de tus finanzas.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
