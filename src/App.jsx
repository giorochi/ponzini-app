import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, query, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  Plus, Book, LogOut, Search, 
  Users, LayoutDashboard, History, 
  ArrowRightLeft, Download, Trash2, 
  BarChart3, UserCog, ShieldCheck, 
  Calendar, BookCopy, Filter
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

const APP_ID = 'ponzini-lilla-v6';
const ADMIN_EMAILS = ["rochiragiovanni87@gmail.com"]; 
const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('catalog'); // catalog, logs, admin, users
  const [books, setBooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState(null); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', classe: '' });

  const isAdmin = useMemo(() => user && ADMIN_EMAILS.includes(user.email), [user]);

  // 1. Auth & Profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        if (ADMIN_EMAILS.includes(u.email)) {
          setUserData({ nome: "Admin Sistema", classe: "STAFF", isAdmin: true });
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

  // 2. Data Listeners
  useEffect(() => {
    if (!user || isRegistering) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(lRef, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
    });

    if (isAdmin) {
      const uRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'registered_users');
      const unsubUsers = onSnapshot(uRef, (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => { unsubBooks(); unsubLogs(); unsubUsers(); };
    }

    return () => { unsubBooks(); unsubLogs(); };
  }, [user, isRegistering, isAdmin]);

  // Logica Transazioni
  const createLog = async (tipo, dettaglio, libro) => {
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      tipo, dettaglio, libro,
      utente: userData?.nome || user.displayName,
      classe: userData?.classe || "N/A",
      timestamp: serverTimestamp()
    });
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    try {
      const newBook = {
        titolo: form.titolo,
        autore: form.autore,
        donatore: userData.nome,
        classe: userData.classe,
        timestamp: serverTimestamp()
      };

      if (modalType === 'dona') {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
        await createLog('DONAZIONE', 'ha inserito', form.titolo);
      } else if (modalType === 'scambia' && selectedBook) {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', selectedBook.id));
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
        await createLog('SCAMBIO', `ha scambiato "${selectedBook.titolo}" con`, form.titolo);
      }
      
      setModalType(null);
      setForm({ titolo: '', autore: '', classe: '' });
      setSelectedBook(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrendi = async (book) => {
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id));
      await createLog('PRESA', 'ha prelevato', book.titolo);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteUserAccount = async (uId) => {
    if(confirm("Sei sicuro di voler eliminare questo utente?")) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'registered_users', uId));
      // Nota: Eliminazione Auth richiede logiche server, qui simuliamo la rimozione dal database pubblico
    }
  };

  // Calcolo Statistiche
  const stats = useMemo(() => {
    const counts = { prelievi: 0, donazioni: 0, scambi: 0 };
    logs.forEach(l => {
      if (l.tipo === 'PRESA') counts.prelievi++;
      if (l.tipo === 'DONAZIONE') counts.donazioni++;
      if (l.tipo === 'SCAMBIO') counts.scambi++;
    });
    return counts;
  }, [logs]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <img src={SCHOOL_LOGO} className="h-20 animate-pulse" alt="Logo" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl border-t-4 border-blue-600 p-12 text-center">
        <img src={SCHOOL_LOGO} className="h-28 mx-auto mb-8" alt="Logo" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Ponzini Hub</h1>
        <p className="text-slate-500 text-sm mb-10">Accedi per gestire i tuoi libri scolastici</p>
        <button 
          onClick={() => signInWithPopup(auth, googleProvider)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition-all"
        >
          Entra con Google
        </button>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-10 border-t-4 border-orange-500">
        <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-tight">Configura Profilo</h2>
        <div className="space-y-4">
          <input 
            placeholder="La tua classe (es. 4BS)" 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 outline-none focus:border-orange-500 font-bold"
            onChange={e => setForm({...form, classe: e.target.value.toUpperCase()})}
          />
          <button 
            onClick={async () => {
              if (!form.classe) return;
              const p = { nome: user.displayName, email: user.email, classe: form.classe, uid: user.uid };
              await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), p);
              await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'registered_users', user.uid), p);
              setUserData(p);
              setIsRegistering(false);
            }}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-lg shadow-lg"
          >
            Inizia Ora
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* NAVBAR */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <img src={SCHOOL_LOGO} className="h-10" alt="Logo" />
          <div className="h-8 w-[2px] bg-slate-200 mx-2 hidden sm:block"></div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-blue-900 uppercase">Ponzini Hub</h1>
            <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest leading-none">I.I.S. Lilla</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-slate-900">{userData?.nome}</p>
            <p className="text-[10px] font-black text-blue-600 uppercase">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 p-4 space-y-2">
          <NavBtn active={view === 'catalog'} icon={<LayoutDashboard/>} label="Catalogo" onClick={() => setView('catalog')} color="blue" />
          <NavBtn active={view === 'logs'} icon={<History/>} label="Movimenti" onClick={() => setView('logs')} color="emerald" />
          
          {isAdmin && (
            <div className="pt-6 mt-6 border-t border-slate-100 space-y-2">
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase mb-2">Admin Area</p>
              <NavBtn active={view === 'admin'} icon={<BarChart3/>} label="Dashboard" onClick={() => setView('admin')} color="orange" />
              <NavBtn active={view === 'users'} icon={<UserCog/>} label="Gestione Utenti" onClick={() => setView('users')} color="orange" />
            </div>
          )}
        </aside>

        {/* MAIN VIEW */}
        <main className="flex-1 p-6 lg:p-10">
          {view === 'catalog' && (
            <section>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Biblioteca Condivisa</h2>
                  <p className="text-slate-500 font-medium">Trova il materiale per le tue lezioni.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      placeholder="Cerca..."
                      className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm w-full outline-none focus:border-blue-500"
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setModalType('dona')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    <Plus size={18}/> Dona
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-xl transition-shadow group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Book size={24} />
                      </div>
                      <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{book.classe}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{book.titolo}</h3>
                    <p className="text-slate-400 text-xs font-bold mb-6 uppercase tracking-tight">{book.autore || 'Autore N/D'}</p>
                    
                    <div className="flex items-center gap-2 mb-6 text-xs text-slate-500 font-medium border-t border-slate-50 pt-4">
                      <Users size={14} className="text-slate-300"/> Donato da: <span className="font-bold text-slate-700">{book.donatore}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handlePrendi(book)}
                        className="py-3 border border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg font-bold text-xs uppercase transition-all"
                      >
                        Prendi
                      </button>
                      <button 
                        onClick={() => {setSelectedBook(book); setModalType('scambia');}}
                        className="py-3 bg-orange-500 text-white hover:bg-orange-600 rounded-lg font-bold text-xs uppercase transition-all shadow-md shadow-orange-100"
                      >
                        Scambia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === 'logs' && (
            <section className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <History className="text-emerald-500" size={32} />
                <h2 className="text-3xl font-black text-slate-900">Registro Attività</h2>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {logs.map((log, i) => (
                  <div key={log.id} className={`p-5 flex items-center gap-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${i === logs.length - 1 ? 'border-b-0' : ''}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      log.tipo === 'PRESA' ? 'bg-blue-50 text-blue-600' :
                      log.tipo === 'DONAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {log.tipo === 'SCAMBIO' ? <ArrowRightLeft size={18}/> : log.tipo === 'PRESA' ? <Download size={18}/> : <Plus size={18}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 leading-snug">
                        <span className="font-black text-slate-900">{log.utente}</span> ({log.classe}) {log.dettaglio} <span className="text-blue-600 font-bold italic">"{log.libro}"</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === 'admin' && (
            <section>
              <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <ShieldCheck className="text-orange-500"/> Dashboard Amministrativa
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatsCard icon={<Download/>} label="Prendi" value={stats.prelievi} color="blue" />
                <StatsCard icon={<Plus/>} label="Dona" value={stats.donazioni} color="emerald" />
                <StatsCard icon={<ArrowRightLeft/>} label="Scambi" value={stats.scambi} color="orange" />
              </div>

              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6">Attività Totale (Visualizzazione Grafica)</h3>
                <div className="flex items-end gap-10 h-64 border-b border-slate-100 pb-2 px-10">
                  <Bar val={stats.prelievi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-blue-500" label="Ritiri" />
                  <Bar val={stats.donazioni} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-emerald-500" label="Donazioni" />
                  <Bar val={stats.scambi} max={Math.max(stats.prelievi, stats.donazioni, stats.scambi, 1)} color="bg-orange-500" label="Scambi" />
                </div>
              </div>
            </section>
          )}

          {view === 'users' && (
            <section>
               <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <UserCog className="text-orange-500"/> Gestione Database Utenti
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Studente</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Classe</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{u.nome}</p>
                          <p className="text-[10px] text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-6 py-4 font-black text-blue-600">{u.classe}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => deleteUserAccount(u.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODAL TRANSATTIVA */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className={`px-8 py-6 flex justify-between items-center text-white ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>
              <h3 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                {modalType === 'dona' ? <Plus/> : <ArrowRightLeft/>}
                {modalType === 'dona' ? 'Inserisci Libro' : 'Effettua Scambio'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-2xl font-light hover:scale-110 transition-transform">&times;</button>
            </div>

            <form onSubmit={handleTransaction} className="p-8 space-y-5">
              {modalType === 'scambia' && (
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-6">
                  <p className="text-[10px] font-black text-orange-600 uppercase mb-1">Libro che stai prendendo:</p>
                  <p className="text-sm font-bold text-slate-800 italic">"{selectedBook?.titolo}"</p>
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Libro da depositare</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 mt-1 font-bold outline-none focus:border-blue-500" placeholder="Titolo del volume..." value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Autore</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 mt-1 font-bold outline-none focus:border-blue-500" placeholder="Nome autore..." value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 font-bold rounded-lg text-slate-500 uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="submit" className={`flex-1 py-4 text-white font-bold rounded-lg uppercase text-[10px] tracking-widest shadow-lg ${modalType === 'dona' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                  Conferma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, icon, label, onClick, color }) {
  const styles = {
    blue: active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50',
    emerald: active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50',
    orange: active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'
  };

  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg font-bold transition-all ${styles[color]}`}>
      {React.cloneElement(icon, { size: 18 })}
      <span className="hidden lg:block text-xs uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatsCard({ icon, label, value, color }) {
  const colors = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    orange: "text-orange-600 bg-orange-50"
  };
  return (
    <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colors[color]}`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function Bar({ val, max, color, label }) {
  const height = (val / max) * 100;
  return (
    <div className="flex-1 flex flex-col items-center gap-3">
      <div className="w-full bg-slate-50 rounded-t-lg relative overflow-hidden flex flex-col justify-end h-full">
        <div 
          className={`${color} w-full rounded-t-md transition-all duration-1000 ease-out`} 
          style={{ height: `${height}%` }}
        ></div>
        <span className="absolute top-2 w-full text-center text-[10px] font-black text-slate-800">{val}</span>
      </div>
      <span className="text-[9px] font-black text-slate-400 uppercase">{label}</span>
    </div>
  );
}
