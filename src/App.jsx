import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, query, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken
} from 'firebase/auth';
import { 
  Plus, Book, LogOut, Search, 
  Users, LayoutDashboard, History, 
  ArrowRightLeft, Download, Trash2, 
  BarChart3, UserCog, ShieldCheck, 
  BookOpen
} from 'lucide-react';

// --- INIZIALIZZAZIONE FIREBASE ---// ==========================================
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ponzini-hub-v1';

// Configurazione Admin
const ADMIN_EMAILS = ["tua-email@gmail.com"]; 
const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState(null); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', classe: '' });

  // 1. Gestione Autenticazione (RULE 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Errore Auth:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Cerchiamo il profilo privato dell'utente (RULE 1)
        const userRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data');
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          setUserData(snap.data());
          setIsRegistering(false);
        } else if (!u.isAnonymous || ADMIN_EMAILS.includes(u.email)) {
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

  // 2. Ascoltatori Firestore (RULE 1 & 2)
  useEffect(() => {
    if (!user) return;

    // Libri Pubblici
    const booksRef = collection(db, 'artifacts', appId, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(booksRef, 
      (snap) => {
        setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Errore libri:", err)
    );

    // Registro Movimenti
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsRef, 
      (snap) => {
        const sortedLogs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setLogs(sortedLogs);
      },
      (err) => console.error("Errore logs:", err)
    );

    // Se admin, carichiamo tutti gli utenti
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'registered_users');
      onSnapshot(usersRef, (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => {
      unsubBooks();
      unsubLogs();
    };
  }, [user]);

  const isAdmin = useMemo(() => user && ADMIN_EMAILS.includes(user.email), [user]);

  // Azioni Database
  const logAction = async (tipo, dettaglio, libroTitolo) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
      tipo,
      dettaglio,
      libro: libroTitolo,
      utente: userData?.nome || user.displayName || "Utente Anonimo",
      classe: userData?.classe || "N/A",
      timestamp: serverTimestamp()
    });
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;

    const newBookData = {
      titolo: form.titolo,
      autore: form.autore,
      donatore: userData?.nome || user.displayName || "Anonimo",
      classe: userData?.classe || "N/A",
      timestamp: serverTimestamp()
    };

    try {
      if (modalType === 'dona') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('DONAZIONE', 'ha donato', form.titolo);
      } else if (modalType === 'scambia' && selectedBook) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', selectedBook.id));
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('SCAMBIO', `ha scambiato "${selectedBook.titolo}" con`, form.titolo);
      }
      setModalType(null);
      setForm({ titolo: '', autore: '', classe: '' });
    } catch (err) {
      console.error("Errore transazione:", err);
    }
  };

  const handlePrendi = async (book) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', book.id));
      await logAction('PRESA', 'ha prelevato', book.titolo);
    } catch (err) {
      console.error("Errore presa:", err);
    }
  };

  const deleteUser = async (uId) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registered_users', uId));
    } catch (err) {
      console.error(err);
    }
  };

  // Statistiche
  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      if (log.tipo === 'PRESA') acc.prelievi++;
      if (log.tipo === 'DONAZIONE') acc.donazioni++;
      if (log.tipo === 'SCAMBIO') acc.scambi++;
      return acc;
    }, { prelievi: 0, donazioni: 0, scambi: 0 });
  }, [logs]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><img src={SCHOOL_LOGO} className="h-16 animate-pulse" /></div>;

  // Schermata Registrazione Profilo
  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 border-t-4 border-blue-600">
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase">Configurazione Profilo</h2>
        <p className="text-slate-500 text-sm mb-6">Inserisci i tuoi dati per interagire con l'Hub.</p>
        <div className="space-y-4">
          <input 
            placeholder="Nome Completo" 
            className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 outline-none focus:border-blue-600 font-bold"
            onChange={e => setForm({...form, titolo: e.target.value})} 
          />
          <input 
            placeholder="Classe (es. 4BS)" 
            className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 outline-none focus:border-blue-600 font-bold uppercase"
            onChange={e => setForm({...form, classe: e.target.value.toUpperCase()})}
          />
          <button 
            onClick={async () => {
              if (!form.titolo || !form.classe) return;
              const p = { nome: form.titolo, email: user.email || 'anonimo', classe: form.classe, uid: user.uid };
              // Salva profilo privato
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), p);
              // Salva nell'elenco pubblico utenti per l'admin
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registered_users', user.uid), p);
              setUserData(p);
              setIsRegistering(false);
            }}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-md shadow-lg hover:bg-blue-700 transition-colors"
          >
            Salva e Continua
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* NAVBAR */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={SCHOOL_LOGO} className="h-10" alt="Logo" />
          <div className="hidden sm:block">
            <h1 className="text-xl font-black tracking-tighter text-blue-900 leading-none">PONZINI HUB</h1>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Digital Library</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold leading-none">{userData?.nome || "Ospite"}</p>
            <p className="text-[10px] font-black text-blue-600 uppercase">{userData?.classe || "Visitante"}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* NAV SIDEBAR */}
        <nav className="w-16 lg:w-64 bg-white border-r border-slate-200 p-3 space-y-2">
          <NavItem active={view === 'catalog'} icon={<LayoutDashboard/>} label="Catalogo" onClick={() => setView('catalog')} color="blue" />
          <NavItem active={view === 'logs'} icon={<History/>} label="Movimenti" onClick={() => setView('logs')} color="emerald" />
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
              <NavItem active={view === 'admin'} icon={<BarChart3/>} label="Statistiche" onClick={() => setView('admin')} color="orange" />
              <NavItem active={view === 'users'} icon={<UserCog/>} label="Utenti" onClick={() => setView('users')} color="orange" />
            </div>
          )}
        </nav>

        {/* CONTENT */}
        <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {view === 'catalog' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Biblioteca</h2>
                  <p className="text-slate-500">Libri disponibili per lo scambio o il ritiro.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      placeholder="Cerca libro..." 
                      className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md text-sm w-full outline-none focus:border-blue-600 shadow-sm"
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setModalType('dona')}
                    className="bg-blue-600 text-white px-5 py-3 rounded-md font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md"
                  >
                    <Plus size={18}/> Dona
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-md"><BookOpen size={20} /></div>
                      <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{book.classe}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 leading-tight">{book.titolo}</h3>
                    <p className="text-slate-400 text-xs font-bold mb-4 uppercase">{book.autore}</p>
                    
                    <div className="text-[10px] text-slate-400 font-bold mb-6 pt-4 border-t border-slate-50 flex items-center gap-2">
                      <Users size={12}/> Donato da: <span className="text-slate-700">{book.donatore}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handlePrendi(book)}
                        className="py-2.5 border border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-md font-bold text-xs uppercase transition-colors"
                      >
                        Prendi
                      </button>
                      <button 
                        onClick={() => {setSelectedBook(book); setModalType('scambia');}}
                        className="py-2.5 bg-orange-500 text-white hover:bg-orange-600 rounded-md font-bold text-xs uppercase transition-colors"
                      >
                        Scambia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-black mb-6 flex items-center gap-2"><History className="text-emerald-500"/> Registro Operazioni</h2>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                {logs.map((log, i) => (
                  <div key={log.id} className="p-4 flex items-center gap-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                      log.tipo === 'PRESA' ? 'bg-blue-50 text-blue-600' :
                      log.tipo === 'DONAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {log.tipo === 'SCAMBIO' ? <ArrowRightLeft size={16}/> : log.tipo === 'PRESA' ? <Download size={16}/> : <Plus size={16}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-bold">{log.utente}</span> ({log.classe}) {log.dettaglio} <span className="text-blue-600 font-bold italic">"{log.libro}"</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-2"><ShieldCheck className="text-orange-500"/> Statistiche Sistema</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatBox label="Libri Prelevati" val={stats.prelievi} color="blue" />
                <StatBox label="Libri Donati" val={stats.donazioni} color="emerald" />
                <StatBox label="Scambi Totali" val={stats.scambi} color="orange" />
              </div>

              <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-10">Andamento Operazioni</h3>
                <div className="flex items-end gap-12 h-64 border-b border-slate-100 pb-2 px-6">
                  <Bar val={stats.prelievi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-blue-500" label="Ritiri" />
                  <Bar val={stats.donazioni} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-emerald-500" label="Doni" />
                  <Bar val={stats.scambi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-orange-500" label="Scambi" />
                </div>
              </div>
            </div>
          )}

          {view === 'users' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-2"><UserCog className="text-orange-500"/> Database Utenti</h2>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Utente</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Classe</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">{u.nome}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                        </td>
                        <td className="px-6 py-4"><span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">{u.classe}</span></td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL TRANSATTIVA */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`px-6 py-5 flex justify-between items-center text-white ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>
              <h3 className="font-black uppercase tracking-tighter text-lg">{modalType === 'dona' ? 'Inserisci Libro' : 'Scambio Libro'}</h3>
              <button onClick={() => setModalType(null)} className="text-xl">&times;</button>
            </div>
            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              {modalType === 'scambia' && (
                <div className="bg-orange-50 p-3 rounded border border-orange-100 mb-4">
                  <p className="text-[9px] font-black text-orange-600 uppercase">Stai prendendo:</p>
                  <p className="text-sm font-bold italic">"{selectedBook?.titolo}"</p>
                </div>
              )}
              <input required className="w-full bg-slate-50 border border-slate-200 rounded p-3 font-bold outline-none focus:border-blue-600" placeholder="Titolo del libro..." value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
              <input required className="w-full bg-slate-50 border border-slate-200 rounded p-3 font-bold outline-none focus:border-blue-600" placeholder="Autore..." value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 bg-slate-100 font-bold rounded text-slate-500 uppercase text-[10px]">Annulla</button>
                <button type="submit" className={`flex-1 py-3 text-white font-bold rounded uppercase text-[10px] ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>Conferma</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ active, icon, label, onClick, color }) {
  const themes = {
    blue: active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50',
    emerald: active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50',
    orange: active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'
  };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-md font-bold transition-all ${themes[color]}`}>
      {React.cloneElement(icon, { size: 20 })}
      <span className="hidden lg:block text-xs uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatBox({ label, val, color }) {
  const styles = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600" };
  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-4xl font-black mt-1 ${styles[color].split(' ')[1]}`}>{val}</p>
    </div>
  );
}

function Bar({ val, max, color, label }) {
  const h = (val / max) * 100;
  return (
    <div className="flex-1 flex flex-col items-center h-full">
      <div className="w-full bg-slate-50 rounded-t-sm flex flex-col justify-end h-full relative group">
        <div className={`${color} w-full rounded-t-sm transition-all duration-700`} style={{ height: `${h}%` }}></div>
        <div className="absolute -top-6 w-full text-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{val}</div>
      </div>
      <span className="text-[9px] font-black text-slate-400 uppercase mt-4">{label}</span>
    </div>
  );
}
