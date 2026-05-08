import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, query, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken
} from 'firebase/auth';
import { 
  Plus, LogOut, Search, 
  Users, LayoutDashboard, History, 
  ArrowRightLeft, Download, Trash2, 
  BarChart3, UserCog, ShieldCheck, 
  BookOpen, RotateCcw
} from 'lucide-react';

// ==========================================
// CONFIGURAZIONE FIREBASE INTEGRATA
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

const ADMIN_EMAILS = ["rochiragiovanni87@gmail.com"]; 
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

  // 1. Gestione Autenticazione
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

  // 2. Ascoltatori Firestore (Tempo Reale)
  useEffect(() => {
    if (!user) return;

    // Listener Libri
    const booksRef = collection(db, 'artifacts', appId, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(booksRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Errore libri:", err));

    // Listener Movimenti (Logs)
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordiniamo per data decrescente in memoria (Rule 2)
      setLogs(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, (err) => console.error("Errore logs:", err));

    // Listener Utenti per Admin
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

  // Helper per scrivere nel registro
  const logAction = async (tipo, dettaglio, libroTitolo) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        tipo,
        dettaglio,
        libro: libroTitolo,
        utente: userData?.nome || "Utente",
        classe: userData?.classe || "N/A",
        timestamp: serverTimestamp()
      });
    } catch (e) { console.error("Log error:", e); }
  };

  // 3. Gestione Transazioni (Dona / Scambia)
  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user || !form.titolo || !form.autore) return;

    const newBookData = {
      titolo: form.titolo,
      autore: form.autore,
      donatore: userData?.nome || "Studente",
      classe: userData?.classe || "N/A",
      timestamp: serverTimestamp()
    };

    try {
      if (modalType === 'dona') {
        // Aggiungi libro
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('DONAZIONE', 'ha donato il libro', form.titolo);
      } 
      else if (modalType === 'scambia' && selectedBook) {
        // Rimuovi vecchio, aggiungi nuovo
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', selectedBook.id));
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await logAction('SCAMBIO', `ha scambiato "${selectedBook.titolo}" con`, form.titolo);
      }

      // RESET E CHIUSURA MODAL
      setModalType(null);
      setSelectedBook(null);
      setForm({ titolo: '', autore: '', classe: '' });
    } catch (err) {
      console.error("Errore transazione:", err);
    }
  };

  const handlePrendi = async (book) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', book.id));
      await logAction('PRESA', 'ha ritirato il libro', book.titolo);
    } catch (err) {
      console.error("Errore presa:", err);
    }
  };

  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      if (log.tipo === 'PRESA') acc.prelievi++;
      if (log.tipo === 'DONAZIONE') acc.donazioni++;
      if (log.tipo === 'SCAMBIO') acc.scambi++;
      return acc;
    }, { prelievi: 0, donazioni: 0, scambi: 0 });
  }, [logs]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <img src={SCHOOL_LOGO} className="h-16 animate-bounce mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-900">Caricamento Hub...</p>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border-b-8 border-blue-600">
        <img src={SCHOOL_LOGO} className="h-12 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase text-center tracking-tighter">Profilo Studente</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Inserisci i tuoi dati per partecipare allo scambio libri.</p>
        <div className="space-y-4">
          <input 
            placeholder="Nome e Cognome" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold"
            onChange={e => setForm({...form, titolo: e.target.value})} 
          />
          <input 
            placeholder="Classe (es. 3BS)" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold uppercase"
            onChange={e => setForm({...form, classe: e.target.value.toUpperCase()})}
          />
          <button 
            onClick={async () => {
              if (!form.titolo || !form.classe) return;
              const p = { nome: form.titolo, email: user.email || 'anonimo', classe: form.classe, uid: user.uid };
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), p);
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registered_users', user.uid), p);
              setUserData(p);
              setIsRegistering(false);
              setForm({ titolo: '', autore: '', classe: '' });
            }}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            Configura Accesso
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <img src={SCHOOL_LOGO} className="h-12" alt="Logo" />
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black tracking-tighter text-blue-950 leading-none">PONZINI HUB</h1>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em]">I.I.S. "Vincenzo Lilla"</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-xs font-black leading-none text-blue-900 uppercase tracking-tight">{userData?.nome}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-full transition-colors border border-slate-100">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* SIDEBAR */}
        <nav className="w-20 lg:w-72 bg-white border-r border-slate-200 p-4 space-y-3">
          <NavItem active={view === 'catalog'} icon={<LayoutDashboard/>} label="Biblioteca" onClick={() => setView('catalog')} color="blue" />
          <NavItem active={view === 'logs'} icon={<History/>} label="Cronologia" onClick={() => setView('logs')} color="emerald" />
          {isAdmin && (
            <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
              <p className="hidden lg:block text-[10px] font-black text-slate-300 uppercase px-3 mb-2">Amministrazione</p>
              <NavItem active={view === 'admin'} icon={<BarChart3/>} label="Dashboard" onClick={() => setView('admin')} color="orange" />
              <NavItem active={view === 'users'} icon={<UserCog/>} label="Utenti" onClick={() => setView('users')} color="orange" />
            </div>
          )}
        </nav>

        {/* MAIN AREA */}
        <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
          {view === 'catalog' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Catalogo Libri</h2>
                  <p className="text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">Scegli, ritira o scambia</p>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      placeholder="Cerca per titolo o autore..." 
                      className="pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm w-full outline-none focus:border-blue-600 shadow-sm font-medium"
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setModalType('dona')}
                    className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg hover:scale-105 active:scale-95"
                  >
                    <Plus size={20}/> DONA
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase()) || b.autore.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-100 rounded-3xl p-7 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><BookOpen size={24} /></div>
                      <span className="text-[10px] font-black bg-blue-900 text-white px-3 py-1.5 rounded-full uppercase tracking-tighter">{book.classe}</span>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-900 mb-1 leading-tight group-hover:text-blue-600 transition-colors">{book.titolo}</h3>
                    <p className="text-slate-400 text-xs font-black mb-6 uppercase tracking-widest">{book.autore}</p>
                    
                    <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{book.donatore?.[0]}</div>
                        <p className="text-[10px] font-bold text-slate-400">Donato da <span className="text-slate-700">{book.donatore}</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-8">
                      <button 
                        onClick={() => handlePrendi(book)}
                        className="py-3 bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        Prendi
                      </button>
                      <button 
                        onClick={() => {setSelectedBook(book); setModalType('scambia');}}
                        className="py-3 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all"
                      >
                        Scambia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {books.length === 0 && (
                <div className="py-20 text-center opacity-30">
                  <BookOpen size={64} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest">Nessun libro disponibile</p>
                </div>
              )}
            </div>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-black mb-8 flex items-center gap-3"><History className="text-emerald-500" size={32}/> Cronologia Movimenti</h2>
              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                {logs.length > 0 ? logs.map((log, i) => (
                  <div key={log.id} className="p-5 flex items-center gap-5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      log.tipo === 'PRESA' ? 'bg-blue-50 text-blue-600' :
                      log.tipo === 'DONAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {log.tipo === 'SCAMBIO' ? <ArrowRightLeft size={20}/> : log.tipo === 'PRESA' ? <Download size={20}/> : <Plus size={20}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-relaxed">
                        <span className="font-black text-slate-900">{log.utente}</span> <span className="text-slate-400 text-xs">({log.classe})</span> {log.dettaglio} <span className="text-blue-600 font-black">"{log.libro}"</span>
                      </p>
                      <p className="text-[10px] font-black text-slate-300 uppercase mt-1 tracking-tighter">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-20 text-center text-slate-300 uppercase font-black tracking-widest">Nessun movimento registrato</div>
                )}
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-black mb-10 flex items-center gap-3"><ShieldCheck className="text-orange-500" size={32}/> Statistiche Sistema</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <StatBox label="Libri Prelevati" val={stats.prelievi} color="blue" />
                <StatBox label="Libri Donati" val={stats.donazioni} color="emerald" />
                <StatBox label="Scambi Effettuati" val={stats.scambi} color="orange" />
              </div>
              <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.3em] mb-12">Andamento Attività</h3>
                <div className="flex items-end gap-16 h-72 border-b border-slate-100 pb-4 px-10">
                  <Bar val={stats.prelievi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-blue-500" label="Ritiri" />
                  <Bar val={stats.donazioni} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-emerald-500" label="Doni" />
                  <Bar val={stats.scambi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-orange-500" label="Scambi" />
                </div>
              </div>
            </div>
          )}

          {view === 'users' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-black mb-10 flex items-center gap-3"><UserCog className="text-orange-500" size={32}/> Elenco Iscritti</h2>
              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Studente</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-900 text-sm">{u.nome}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-tight">{u.email}</p>
                        </td>
                        <td className="px-8 py-5"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">{u.classe}</span></td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registered_users', u.id))} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
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

      {/* MODAL TRANSAZIONE */}
      {modalType && (
        <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`px-8 py-7 flex justify-between items-center text-white ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>
              <div>
                <h3 className="font-black uppercase tracking-widest text-xl">{modalType === 'dona' ? 'Regala un libro' : 'Effettua uno scambio'}</h3>
                <p className="text-[10px] font-bold text-white/70 uppercase mt-0.5 tracking-tighter">I.I.S. VINCENZO LILLA - HUB</p>
              </div>
              <button onClick={() => setModalType(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all text-2xl font-light">&times;</button>
            </div>
            <form onSubmit={handleTransaction} className="p-8 space-y-6">
              {modalType === 'scambia' && (
                <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 flex items-start gap-4">
                  <div className="p-3 bg-white rounded-xl text-orange-500 shadow-sm"><RotateCcw size={20}/></div>
                  <div>
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none">Stai restituendo:</p>
                    <p className="text-sm font-black text-slate-800 mt-1 italic">"{selectedBook?.titolo}"</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nuovo Titolo</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" placeholder="Esempio: Divina Commedia" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Autore</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" placeholder="Esempio: Dante Alighieri" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 font-black rounded-xl text-slate-500 uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors">Annulla</button>
                <button type="submit" className={`flex-1 py-4 text-white font-black rounded-xl uppercase text-xs tracking-widest shadow-lg transition-all ${modalType === 'dona' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'}`}>Conferma</button>
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
    blue: active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50',
    emerald: active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50',
    orange: active ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'
  };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black transition-all ${themes[color]}`}>
      {React.cloneElement(icon, { size: 22 })}
      <span className="hidden lg:block text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatBox({ label, val, color }) {
  const styles = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600" };
  return (
    <div className="bg-white p-8 border border-slate-100 rounded-[2.5rem] shadow-sm">
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{label}</p>
      <p className={`text-5xl font-black mt-2 tracking-tighter ${styles[color].split(' ')[1]}`}>{val}</p>
    </div>
  );
}

function Bar({ val, max, color, label }) {
  const h = (val / max) * 100;
  return (
    <div className="flex-1 flex flex-col items-center h-full">
      <div className="w-full bg-slate-50 rounded-t-2xl flex flex-col justify-end h-full relative group">
        <div className={`${color} w-full rounded-t-2xl transition-all duration-1000 ease-out`} style={{ height: `${h}%` }}></div>
        <div className="absolute -top-10 w-full text-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1">{val}</div>
      </div>
      <span className="text-[9px] font-black text-slate-400 uppercase mt-6 tracking-widest">{label}</span>
    </div>
  );
}
