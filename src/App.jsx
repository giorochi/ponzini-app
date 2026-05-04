import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, 
  setDoc, getDoc, deleteDoc, query, orderBy, limit
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInAnonymously
} from 'firebase/auth';
import { 
  Plus, Book, User, Trash2, LogOut, Search, Bookmark, 
  ShieldCheck, Users, LayoutDashboard, Calendar, 
  BookOpen, ArrowRightLeft, ArrowDownCircle, History,
  Clock, Globe, CheckCircle2, AlertCircle, Trash, MoveRight
} from 'lucide-react';

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
const APP_ID = 'ponzini-v4-final';
const ADMIN_EMAILS = ["rochiragiovanni87@gmail.com", "admin@iisslilla.it"];

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
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modali
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', genere: 'Narrativa', classe: '' });

  // 1. Gestione Autenticazione
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Tentiamo il login anonimo se non c'è token, o attendiamo il popup
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch (e) { console.error("Auth error", e); }
    };
    initAuth();

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
            setIsRegistering(false);
          } else {
            setIsRegistering(true);
          }
          setLoading(false);
        }, () => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 2. Caricamento Dati (Solo se loggati)
  useEffect(() => {
    if (!user) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Books feed error", err));

    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(lRef, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });

    if (user && ADMIN_EMAILS.includes(user.email)) {
      const uRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory');
      onSnapshot(uRef, (snap) => setUsersList(snap.docs.map(d => d.data())));
    }
  }, [user]);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const createLog = async (tipo, dettaglio, libroTitolo) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      tipo,
      dettaglio,
      libro: libroTitolo,
      utente: user.displayName || 'Anonimo',
      classe: userData?.classe || 'N/A',
      timestamp: new Date().toISOString()
    });
  };

  const handleDona = async (e) => {
    e.preventDefault();
    if (!form.titolo) return;
    const newBook = { titolo: form.titolo, autore: form.autore, genere: form.genere, status: 'disponibile', dataInserimento: new Date().toISOString() };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    await createLog('DONAZIONE', `Ha donato un nuovo libro`, form.titolo);
    setShowAddModal(false);
    setForm({ titolo: '', autore: '', genere: 'Narrativa', classe: '' });
  };

  const handlePrendi = async (book) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id));
    await createLog('RITIRO', `Ha preso il libro`, book.titolo);
  };

  const handleScambio = async (e) => {
    e.preventDefault();
    if (!form.titolo || !showExchangeModal) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', showExchangeModal.id));
    const newBook = { titolo: form.titolo, autore: form.autore, genere: form.genere, status: 'disponibile', dataInserimento: new Date().toISOString() };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    await createLog('SCAMBIO', `Ha scambiato "${showExchangeModal.titolo}" con un nuovo volume`, form.titolo);
    setShowExchangeModal(null);
    setForm({ titolo: '', autore: '', genere: 'Narrativa', classe: '' });
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-indigo-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-indigo-900 font-bold animate-pulse">Connessione alla Biblioteca...</p>
    </div>
  );

  if (!user || user.isAnonymous) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 flex items-center justify-center p-6">
      <div className="bg-white p-10 w-full max-w-md rounded-3xl shadow-2xl border border-indigo-50 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
          <BookOpen className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Ponzini Digital Hub</h1>
        <p className="text-slate-500 mb-10">Il portale per lo scambio libri dell'I.I.S. "V. Lilla"</p>
        <button 
          onClick={() => signInWithPopup(auth, googleProvider)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-200"
        >
          <Globe size={20} /> Accedi con Google
        </button>
        <p className="mt-8 text-xs text-slate-400 font-medium uppercase tracking-widest">Riservato a studenti e docenti</p>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 w-full max-w-md rounded-3xl shadow-xl border border-indigo-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3"><User className="text-indigo-600" /> Profilo Studente</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">La tua Classe (es. 3B LING)</label>
            <input 
              placeholder="Inserisci classe e sezione..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 ring-indigo-500 outline-none transition-all"
              value={form.classe} 
              onChange={e => setForm({...form, classe: e.target.value})} 
            />
          </div>
          <button 
            onClick={async () => {
              if (!form.classe) return;
              const profile = { uid: user.uid, nome: user.displayName, email: user.email, classe: form.classe.toUpperCase() };
              await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profile);
              await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', user.uid), profile);
              setUserData(profile);
              setIsRegistering(false);
            }}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            Configura Accesso
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdff] text-slate-800 flex flex-col font-sans">
      {/* HEADER PRINCIPALE */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100"><BookOpen size={24}/></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">Ponzini Hub</h1>
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mt-1">I.I.S. Vincenzo Lilla</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-12 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Cerca un libro nel catalogo..." 
            className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-sm text-slate-900 leading-none">{user.displayName}</p>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all"><LogOut size={20}/></button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* NAVIGAZIONE LATERALE */}
        <aside className="w-20 lg:w-64 border-r border-slate-200 bg-white p-4 flex flex-col gap-2">
          <NavBtn active={view === 'catalog'} icon={<LayoutDashboard/>} label="Catalogo Libri" onClick={() => setView('catalog')} />
          <NavBtn active={view === 'logs'} icon={<History/>} label="Movimenti" onClick={() => setView('logs')} />
          
          {isAdmin && (
            <div className="mt-8 space-y-2">
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Admin Area</p>
              <NavBtn active={view === 'admin'} icon={<ShieldCheck/>} label="Gestione" onClick={() => setView('admin')} />
              <NavBtn active={view === 'users'} icon={<Users/>} label="Studenti" onClick={() => setView('users')} />
            </div>
          )}
        </aside>

        {/* AREA CONTENUTI */}
        <main className="flex-1 p-6 lg:p-10">
          {view === 'catalog' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Catalogo Libri</h2>
                  <p className="text-slate-500 font-medium mt-1">Prendi, dona o scambia volumi con altri studenti.</p>
                </div>
                <button 
                  onClick={() => { setForm({titolo:'', autore:'', genere:'Narrativa', classe:''}); setShowAddModal(true); }}
                  className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all hover:scale-[1.03]"
                >
                  <Plus size={20}/> Dona un libro
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase px-3 py-1 rounded-full">{book.genere}</span>
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all"><Book size={20}/></div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">{book.titolo}</h3>
                    <p className="text-slate-500 font-medium italic mb-8">{book.autore || 'Autore non specificato'}</p>
                    
                    <div className="mt-auto flex flex-col gap-2">
                      <button 
                        onClick={() => handlePrendi(book)}
                        className="w-full py-3 px-4 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                      >
                        <ArrowDownCircle size={18}/> Prendi Libro
                      </button>
                      <button 
                        onClick={() => { setForm({titolo:'', autore:'', genere:'Narrativa', classe:''}); setShowExchangeModal(book); }}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
                      >
                        <ArrowRightLeft size={18}/> Scambia con il mio
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'logs' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-8 tracking-tight italic">Registro Movimenti</h2>
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-5 text-xs font-bold uppercase text-slate-400 tracking-widest">Evento</th>
                        <th className="px-6 py-5 text-xs font-bold uppercase text-slate-400 tracking-widest">Studente</th>
                        <th className="px-6 py-5 text-xs font-bold uppercase text-slate-400 tracking-widest">Dettaglio</th>
                        <th className="px-6 py-5 text-xs font-bold uppercase text-slate-400 tracking-widest text-right">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-5">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                              log.tipo === 'DONAZIONE' ? 'bg-green-100 text-green-700' :
                              log.tipo === 'RITIRO' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {log.tipo}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-bold text-slate-900">{log.utente}</div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-tighter">{log.classe}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <Book size={14} className="text-slate-300" />
                              <span className="font-bold text-slate-700 italic">"{log.libro}"</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{log.dettaglio}</p>
                          </td>
                          <td className="px-6 py-5 text-right font-mono text-xs text-slate-400">
                            {new Date(log.timestamp).toLocaleDateString('it-IT')} {new Date(log.timestamp).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="max-w-4xl space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <StatCard label="Libri in Catalogo" value={books.length} icon={<Book/>} />
                <StatCard label="Log Registrati" value={logs.length} icon={<History/>} />
                <StatCard label="Studenti Iscritti" value={usersList.length} icon={<Users/>} />
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Manutenzione Catalogo</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {books.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">{b.titolo}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{b.autore}</p>
                      </div>
                      <button onClick={async () => { if(confirm('Eliminare questo libro?')) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', b.id)) }} className="text-slate-300 hover:text-red-500 p-2"><Trash size={20}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2"><AlertCircle/> Azioni Critiche</h3>
                <p className="text-red-600/70 text-sm mb-6">Attenzione: queste azioni sono irreversibili e cancelleranno i dati pubblici.</p>
                <button onClick={async () => { if(confirm('Svuotare tutto il registro dei movimenti?')) { for(const l of logs) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'logs', l.id)) } }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100">Svuota Registro Movimenti</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALI DI INSERIMENTO */}
      {(showAddModal || showExchangeModal) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-indigo-600 p-8 text-white">
              <h3 className="text-2xl font-extrabold flex items-center gap-4">
                {showExchangeModal ? <ArrowRightLeft size={28}/> : <Plus size={28}/>}
                {showExchangeModal ? 'Scambio Libro' : 'Dona un libro'}
              </h3>
              <p className="text-indigo-100 mt-2 font-medium">Inserisci i dettagli del volume che stai lasciando in biblioteca.</p>
            </div>
            
            <form onSubmit={showExchangeModal ? handleScambio : handleDona} className="p-8 space-y-6">
              {showExchangeModal && (
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl text-indigo-600"><BookOpen size={24}/></div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Stai restituendo</p>
                    <p className="font-bold text-slate-800 text-lg">"{showExchangeModal.titolo}"</p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Titolo del Libro</label>
                  <input required placeholder="Esempio: Il fu Mattia Pascal" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-base focus:ring-2 ring-indigo-500 outline-none transition-all font-medium" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Autore</label>
                  <input required placeholder="Esempio: Luigi Pirandello" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-base focus:ring-2 ring-indigo-500 outline-none transition-all font-medium" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Genere Literario</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-base focus:ring-2 ring-indigo-500 outline-none transition-all font-bold appearance-none cursor-pointer" value={form.genere} onChange={e => setForm({...form, genere: e.target.value})}>
                    <option>Narrativa</option><option>Saggistica</option><option>Classici</option><option>Scientifico</option><option>Lingue</option><option>Graphic Novel</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); setShowExchangeModal(null); }} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">Annulla</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2">
                  Conferma e Registra <MoveRight size={20}/>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
        active 
        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
        : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <span className={active ? 'text-white' : 'group-hover:scale-110 transition-transform'}>
        {React.cloneElement(icon, { size: 24 })}
      </span>
      <span className="hidden lg:block font-bold text-sm tracking-tight">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex items-center gap-5">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}
