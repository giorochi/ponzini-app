import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, query, limit, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  Plus, Book, LogOut, Search, 
  Users, LayoutDashboard, BookOpen, 
  ArrowDownCircle, History, RefreshCw,
  Info, AlertCircle, CheckCircle2, ChevronRight
} from 'lucide-react';

// --- CONFIGURAZIONE ---
// ==========================================
// CONFIGURAZIONE FIREBASE
// Incolla qui i tuoi dati che trovi nella console di Firebase
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBI5kT8mlor8YI8E0DnVNW946MPsWxIhNc",
  authDomain: "lilla-5145b.firebaseapp.com",
  projectId: "lilla-5145b",
  storageBucket: "lilla-5145b.firebasestorage.app",
  messagingSenderId: "748836692117",
  appId: "1:748836692117:web:ffb5a7f5df36ffdb5afb9c"
};

const APP_ID = 'ponzini-lilla-v5';
const ADMIN_EMAILS = ["rochiragiovanni87@gmail.com", "admin@iisslilla.it"]; // Aggiungi la tua mail qui
const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState(null); // 'dona', 'scambia'
  const [selectedBook, setSelectedBook] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', classe: '' });

  // 1. Auth & Profile Management
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const isAdmin = ADMIN_EMAILS.includes(u.email);
        
        if (isAdmin) {
          setUserData({ nome: "Amministrazione", classe: "Gestore" });
          setIsRegistering(false);
        } else {
          const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setUserData(snap.data());
            setIsRegistering(false);
          } else {
            setIsRegistering(true);
          }
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // 2. Real-time Data Listeners
  useEffect(() => {
    if (!user || isRegistering) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Books listen error:", err));

    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(lRef, (snap) => {
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(allLogs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
    }, (err) => console.error("Logs listen error:", err));

    return () => { unsubBooks(); unsubLogs(); };
  }, [user, isRegistering]);

  // Actions
  const createLog = async (tipo, dettaglio, libro) => {
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      tipo,
      dettaglio,
      libro,
      utente: userData?.nome || user.displayName,
      classe: userData?.classe || "N/A",
      timestamp: serverTimestamp()
    });
  };

  const handleAction = async (e) => {
    e.preventDefault();
    if (!form.titolo) return;

    const newBook = {
      titolo: form.titolo,
      autore: form.autore,
      donatore: userData.nome,
      classe: userData.classe,
      timestamp: serverTimestamp()
    };

    if (modalType === 'dona') {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
      await createLog('DONAZIONE', 'Ha regalato un nuovo volume', form.titolo);
    } else if (modalType === 'scambia' && selectedBook) {
      // Elimina il vecchio, aggiungi il nuovo
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', selectedBook.id));
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
      await createLog('SCAMBIO', `Ha scambiato "${selectedBook.titolo}" con un nuovo libro`, form.titolo);
    }

    setModalType(null);
    setSelectedBook(null);
    setForm({ titolo: '', autore: '', classe: '' });
  };

  const handlePrendi = async (book) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id));
    await createLog('RITIRO', 'Ha prelevato il libro dal catalogo', book.titolo);
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <img src={SCHOOL_LOGO} className="h-24 animate-bounce mb-6" alt="Logo" />
      <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 animate-progress"></div>
      </div>
      <style>{`.animate-progress { animation: progress 2s ease-in-out infinite; width: 30%; } @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600"></div>
        <img src={SCHOOL_LOGO} className="h-32 mx-auto mb-8 object-contain" alt="Logo Lilla" />
        <h1 className="text-3xl font-black text-slate-900 mb-2">Ponzini Hub</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-10">I.I.S. "Vincenzo Lilla"</p>
        
        <button 
          onClick={loginWithGoogle}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-100"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white p-1 rounded-full" alt="" />
          Accedi con Google
        </button>
        <p className="mt-8 text-xs text-slate-400 font-medium">Usa l'email istituzionale per accedere</p>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl p-10">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Quasi pronto!</h2>
        <p className="text-slate-500 mb-8 font-medium">Inserisci la tua classe per iniziare lo scambio.</p>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Classe e Sezione</label>
            <input 
              placeholder="es. 3A LING" 
              className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 outline-none transition-all font-bold"
              onChange={e => setForm({...form, classe: e.target.value})}
            />
          </div>
          <button 
            onClick={async () => {
              if (!form.classe) return;
              const p = { nome: user.displayName, email: user.email, classe: form.classe.toUpperCase(), uid: user.uid };
              await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), p);
              setUserData(p);
              setIsRegistering(false);
            }}
            className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-lg"
          >
            Completa Registrazione
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] flex flex-col font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-100 px-6 lg:px-12 py-5 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <img src={SCHOOL_LOGO} className="h-14" alt="Logo" />
          <div className="hidden sm:block">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Ponzini Hub</h1>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">Biblioteca Aperta</p>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8 hidden lg:block">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              placeholder="Cerca un libro o un autore..."
              className="w-full bg-slate-50 rounded-2xl py-3 pl-12 pr-4 border-none text-sm focus:ring-2 ring-indigo-100"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <p className="text-sm font-black text-slate-900 leading-none">{userData?.nome}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* SIDEBAR */}
        <nav className="w-20 lg:w-72 bg-white border-r border-slate-100 p-4 space-y-2">
          <SidebarBtn active={view === 'catalog'} icon={<LayoutDashboard/>} label="Esplora Catalogo" onClick={() => setView('catalog')} color="indigo" />
          <SidebarBtn active={view === 'logs'} icon={<History/>} label="Movimenti Recenti" onClick={() => setView('logs')} color="emerald" />
          <div className="pt-8 px-4 hidden lg:block">
            <div className="bg-indigo-50 rounded-3xl p-6 relative overflow-hidden">
              <BookOpen className="text-indigo-200 absolute -right-4 -bottom-4 rotate-12" size={80} />
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">Suggerimento</p>
              <p className="text-xs font-bold text-indigo-900 leading-relaxed relative z-10">Porta un libro che non leggi più e scambialo con una nuova avventura!</p>
            </div>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
          {view === 'catalog' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Catalogo</h2>
                  <p className="text-slate-500 font-medium mt-1">Scegli la tua prossima lettura tra i {books.length} volumi disponibili.</p>
                </div>
                <button 
                  onClick={() => {setModalType('dona'); setForm({titolo:'', autore:'', classe:''});}}
                  className="bg-indigo-600 text-white px-8 py-5 rounded-[1.5rem] font-bold flex items-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={20}/> Dona Libro
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="group bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 group-hover:w-full group-hover:opacity-[0.03] transition-all"></div>
                    
                    <div className="mb-8">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-6 group-hover:scale-110 transition-transform">
                        <Book size={24} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 line-clamp-2">{book.titolo}</h3>
                      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{book.autore || 'Autore Sconosciuto'}</p>
                    </div>

                    <div className="mt-auto space-y-3 pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                        <Users size={12}/> {book.donatore} ({book.classe})
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button 
                          onClick={() => handlePrendi(book)}
                          className="py-3 bg-slate-50 hover:bg-emerald-500 hover:text-white rounded-xl text-slate-600 font-black text-[10px] uppercase tracking-wider transition-all"
                        >
                          Prendi
                        </button>
                        <button 
                          onClick={() => {setSelectedBook(book); setModalType('scambia');}}
                          className="py-3 bg-slate-50 hover:bg-amber-500 hover:text-white rounded-xl text-slate-600 font-black text-[10px] uppercase tracking-wider transition-all"
                        >
                          Scambia
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">Registro Movimenti</h2>
              <div className="space-y-4">
                {logs.map((log, i) => (
                  <div key={log.id} className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex items-center gap-6 animate-in slide-in-from-bottom-2" style={{animationDelay: `${i*50}ms`}}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      log.tipo === 'DONAZIONE' ? 'bg-emerald-50 text-emerald-600' : 
                      log.tipo === 'SCAMBIO' ? 'bg-amber-50 text-amber-600' : 
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {log.tipo === 'DONAZIONE' ? <CheckCircle2 size={24}/> : 
                       log.tipo === 'SCAMBIO' ? <RefreshCw size={24}/> : 
                       <ArrowDownCircle size={24}/>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          log.tipo === 'DONAZIONE' ? 'bg-emerald-100 text-emerald-700' : 
                          log.tipo === 'SCAMBIO' ? 'bg-amber-100 text-amber-700' : 
                          'bg-indigo-100 text-indigo-700'
                        }`}>{log.tipo}</span>
                        <p className="text-[10px] font-bold text-slate-400">{log.timestamp?.toDate().toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        <span className="text-indigo-600">{log.utente} ({log.classe})</span> {log.dettaglio.toLowerCase()} <span className="italic font-black">"{log.libro}"</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL SYSTEM */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-10 text-white ${modalType === 'dona' ? 'bg-indigo-600' : 'bg-amber-500'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black mb-2 flex items-center gap-3">
                    {modalType === 'dona' ? <Plus size={32}/> : <RefreshCw size={32}/>}
                    {modalType === 'dona' ? 'Dona Libro' : 'Scambia Libro'}
                  </h3>
                  <p className="text-white/80 font-medium">
                    {modalType === 'dona' ? 'Regala un nuovo volume alla biblioteca.' : `Lascia un libro nuovo per prendere "${selectedBook?.titolo}"`}
                  </p>
                </div>
                <button onClick={() => setModalType(null)} className="text-white/60 hover:text-white transition-colors text-4xl">&times;</button>
              </div>
            </div>
            
            <form onSubmit={handleAction} className="p-10 space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Titolo del Libro da lasciare</label>
                  <input 
                    required 
                    placeholder="Titolo completo..." 
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100 transition-all"
                    value={form.titolo} 
                    onChange={e => setForm({...form, titolo: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Autore</label>
                  <input 
                    required 
                    placeholder="Nome dell'autore..." 
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100 transition-all"
                    value={form.autore} 
                    onChange={e => setForm({...form, autore: e.target.value})} 
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-5 bg-slate-100 font-black rounded-2xl text-slate-500 uppercase text-xs tracking-widest">Annulla</button>
                <button type="submit" className={`flex-[2] py-5 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-xl transition-all ${modalType === 'dona' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                  Conferma Operazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarBtn({ active, icon, label, onClick, color }) {
  const colors = {
    indigo: active ? 'bg-indigo-600 text-white shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50',
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
  };

  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${colors[color]} ${active ? 'shadow-xl translate-x-1' : ''}`}>
      {React.cloneElement(icon, { size: 22 })}
      <span className="hidden lg:block text-sm tracking-tight">{label}</span>
      {active && <ChevronRight className="hidden lg:block ml-auto" size={16} />}
    </button>
  );
}
