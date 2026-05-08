import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, signOut, signInWithCustomToken
} from 'firebase/auth';
import { 
  Plus, LogOut, Search, 
  History, LayoutDashboard,
  ArrowRightLeft, Download,
  BarChart3, UserCog, ShieldCheck, 
  BookOpen
} from 'lucide-react';

// ==========================================
// CONFIGURAZIONE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBI5kT8mlor8YI8E0DnVNW946MPsWxIhNc",
  authDomain: "lilla-5145b.firebaseapp.com",
  projectId: "lilla-5145b",
  storageBucket: "lilla-5145b.firebasestorage.app",
  messagingSenderId: "748836692117",
  appId: "1:748836692117:web:ffb5a7f5df36ffdb5afb9c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ponzini-hub-lilla';

const ADMIN_EMAILS = ["tua-email@gmail.com"]; 
const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState(null); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', classe: '' });

  // 1. Inizializzazione Auth - SOLO TOKEN O AUTH REALE (NIENTE ANONIMO)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Accedi SOLO se esiste un token fornito dal sistema
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
        // Se non c'è token, l'app aspetta l'evento onAuthStateChanged
      } catch (err) {
        console.error("Errore critico Auth:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data');
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          setUserData(snap.data());
          setIsRegistering(false);
        } else {
          setIsRegistering(true);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listener Firestore (Eseguiti solo se l'utente è loggato)
  useEffect(() => {
    if (!user) return;

    // Libri
    const booksRef = collection(db, 'artifacts', appId, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(booksRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Accesso negato Libri:", err));

    // Logs
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, (err) => console.error("Accesso negato Logs:", err));

    return () => {
      unsubBooks();
      unsubLogs();
    };
  }, [user]);

  const isAdmin = useMemo(() => user?.email && ADMIN_EMAILS.includes(user.email), [user]);

  const logAction = async (tipo, dettaglio, libroTitolo) => {
    if (!user || !userData) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        tipo,
        dettaglio,
        libro: libroTitolo,
        utente: userData.nome,
        classe: userData.classe,
        timestamp: serverTimestamp()
      });
    } catch (e) { console.error("Errore log:", e); }
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user || !userData || !form.titolo || !form.autore) return;

    const newBookData = {
      titolo: form.titolo,
      autore: form.autore,
      donatore: userData.nome,
      classe: userData.classe,
      timestamp: serverTimestamp(),
      userId: user.uid
    };

    try {
      if (modalType === 'dona') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('DONAZIONE', 'ha donato', form.titolo);
      } 
      else if (modalType === 'scambia' && selectedBook) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', selectedBook.id));
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('SCAMBIO', `ha ritirato "${selectedBook.titolo}" e depositato`, form.titolo);
      }
      setModalType(null);
      setSelectedBook(null);
      setForm({ titolo: '', autore: '', classe: '' });
    } catch (err) {
      console.error("Errore transazione:", err);
    }
  };

  const handlePrendi = async (book) => {
    if (!user || !userData) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', book.id));
      await logAction('PRESA', 'ha ritirato', book.titolo);
    } catch (err) {
      console.error("Errore ritiro:", err);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <img src={SCHOOL_LOGO} className="h-16 animate-bounce mb-4" alt="Caricamento" />
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-900">Autenticazione Protetta...</p>
    </div>
  );

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
       <img src={SCHOOL_LOGO} className="h-24 mb-8" alt="Logo" />
       <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase">Accesso Limitato</h1>
       <p className="text-slate-500 max-w-xs text-sm font-medium">Devi aver effettuato l'accesso tramite il sistema scolastico per visualizzare l'Hub Ponzini.</p>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border-b-8 border-blue-600">
        <img src={SCHOOL_LOGO} className="h-12 mx-auto mb-6" alt="Logo" />
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase text-center tracking-tighter">Profilo Studente</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Configura il tuo profilo per iniziare.</p>
        <div className="space-y-4">
          <input 
            placeholder="Nome e Cognome" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold"
            onChange={e => setForm({...form, titolo: e.target.value})} 
          />
          <input 
            placeholder="Classe (es. 4AL)" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold uppercase"
            onChange={e => setForm({...form, classe: e.target.value.toUpperCase()})}
          />
          <button 
            onClick={async () => {
              if (!form.titolo || !form.classe) return;
              const p = { nome: form.titolo, classe: form.classe, uid: user.uid, createdAt: serverTimestamp() };
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), p);
              setUserData(p);
              setIsRegistering(false);
              setForm({ titolo: '', autore: '', classe: '' });
            }}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            Configura Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={SCHOOL_LOGO} className="h-10" alt="Logo" />
          <div>
            <h1 className="text-xl font-black tracking-tighter text-blue-950 leading-none">PONZINI HUB</h1>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Accesso Verificato</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-blue-900 uppercase">{userData?.nome}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-16 lg:w-64 bg-white border-r border-slate-200 p-3 space-y-2">
          <SidebarItem active={view === 'catalog'} icon={<LayoutDashboard/>} label="Biblioteca" onClick={() => setView('catalog')} />
          <SidebarItem active={view === 'logs'} icon={<History/>} label="Movimenti" onClick={() => setView('logs')} />
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <SidebarItem active={view === 'admin'} icon={<BarChart3/>} label="Dashboard" onClick={() => setView('admin')} />
              <SidebarItem active={view === 'users'} icon={<UserCog/>} label="Gestione" onClick={() => setView('users')} />
            </div>
          )}
        </nav>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {view === 'catalog' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col lg:flex-row justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Catalogo</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Scambio libri autorizzato</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      placeholder="Cerca libro o autore..." 
                      className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm w-full lg:w-64 outline-none focus:border-blue-600 font-medium"
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button onClick={() => setModalType('dona')} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all text-xs uppercase">
                    <Plus size={16}/> Dona Libro
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {books.filter(b => b.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || b.autore?.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BookOpen size={20} /></div>
                      <span className="text-[10px] font-black bg-blue-900 text-white px-2 py-1 rounded-md uppercase">{book.classe}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-1 leading-tight">{book.titolo}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase mb-4 tracking-wider">{book.autore}</p>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">{book.donatore?.[0]}</div>
                      <p className="text-[9px] font-bold text-slate-400 italic">Inserito da {book.donatore}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-6">
                      <button onClick={() => handlePrendi(book)} className="py-2.5 border border-emerald-500 text-emerald-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all">Prendi</button>
                      <button onClick={() => {setSelectedBook(book); setModalType('scambia');}} className="py-2.5 bg-orange-500 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all">Scambia</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-black mb-6 flex items-center gap-2"><History className="text-emerald-500" /> Registro Movimenti</h2>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                {logs.length > 0 ? logs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center gap-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      log.tipo === 'PRESA' ? 'bg-blue-50 text-blue-600' :
                      log.tipo === 'DONAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {log.tipo === 'SCAMBIO' ? <ArrowRightLeft size={16}/> : log.tipo === 'PRESA' ? <Download size={16}/> : <Plus size={16}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-black text-slate-900">{log.utente}</span> {log.dettaglio} <span className="text-blue-600 font-black">"{log.libro}"</span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-slate-300 uppercase font-black text-xs tracking-widest">Nessun movimento registrato.</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className={`p-6 text-white ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>
              <h3 className="font-black uppercase text-lg">{modalType === 'dona' ? 'Nuova Donazione' : 'Scambio Libro'}</h3>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Identità: {userData?.nome}</p>
            </div>
            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              {modalType === 'scambia' && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-[10px] font-bold text-orange-700">
                  RITIRI: <span className="italic">"{selectedBook?.titolo}"</span>
                </div>
              )}
              <div className="space-y-4">
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold outline-none focus:border-blue-600 text-sm" placeholder="Titolo del libro che depositi" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold outline-none focus:border-blue-600 text-sm" placeholder="Autore" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Esci</button>
                <button type="submit" className={`flex-1 py-3 text-white font-black rounded-xl uppercase text-[10px] tracking-widest ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>Registra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
      {React.cloneElement(icon, { size: 20 })}
      <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
