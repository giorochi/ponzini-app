import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, 
  setDoc, getDoc, deleteDoc, arrayUnion, query, orderBy, limit
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  Plus, Book, User, Trash2, LogOut, Search, Bookmark, 
  ShieldCheck, Users, LayoutDashboard, Calendar, 
  BookOpen, ArrowRightLeft, ArrowDownCircle, History,
  Clock, Globe, CheckCircle2, AlertCircle, Trash
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

const APP_ID = 'ponzini-v3-exchange';
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
  const [error, setError] = useState(null);

  // Modali
  const [showAddModal, setShowAddModal] = useState(false); // Dona
  const [showExchangeModal, setShowExchangeModal] = useState(null); // Scambia
  
  const [form, setForm] = useState({ titolo: '', autore: '', genere: 'Narrativa' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUserData(snap.data());
          setIsRegistering(false);
        } else {
          setIsRegistering(true);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || isRegistering) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(lRef, (snap) => {
      const sortedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(sortedLogs);
    });

    if (ADMIN_EMAILS.includes(user.email)) {
      const uRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory');
      onSnapshot(uRef, (snap) => setUsersList(snap.docs.map(d => d.data())));
    }
  }, [user, isRegistering]);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // --- AZIONI CORE ---

  const createLog = async (tipo, dettaglio, libroTitolo) => {
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      tipo,
      dettaglio,
      libro: libroTitolo,
      utente: user.displayName,
      classe: userData?.classe || 'N/A',
      timestamp: new Date().toISOString()
    });
  };

  const handleDona = async (e) => {
    e.preventDefault();
    if (!form.titolo) return;
    const newBook = { ...form, status: 'disponibile', dataInserimento: new Date().toISOString() };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    await createLog('DONAZIONE', `Ha donato un nuovo volume`, form.titolo);
    setForm({ titolo: '', autore: '', genere: 'Narrativa' });
    setShowAddModal(false);
  };

  const handlePrendi = async (book) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id));
    await createLog('RITIRO', `Ha prelevato il volume (rimosso dal catalogo)`, book.titolo);
  };

  const handleScambio = async (e) => {
    e.preventDefault();
    if (!form.titolo || !showExchangeModal) return;
    
    // 1. Rimuovi il vecchio
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', showExchangeModal.id));
    // 2. Aggiungi il nuovo
    const newBook = { ...form, status: 'disponibile', dataInserimento: new Date().toISOString() };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    // 3. Log
    await createLog('SCAMBIO', `Ha scambiato "${showExchangeModal.titolo}" con un nuovo volume`, form.titolo);
    
    setForm({ titolo: '', autore: '', genere: 'Narrativa' });
    setShowExchangeModal(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Caricamento Ponzini Hub...</div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-200 p-8 w-full max-w-sm rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <BookOpen className="text-white" size={32} />
        </div>
        <h1 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Ponzini Exchange</h1>
        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-8 italic">I.I.S. "V. Lilla" - Oria/Francavilla</p>
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-md">
          <Globe size={16} /> Entra con Google
        </button>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 p-8 w-full max-w-sm rounded-2xl shadow-xl">
        <h2 className="text-sm font-black uppercase mb-6 italic flex items-center gap-2"><User size={18}/> Completa Profilo</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tua Classe</label>
            <input placeholder="es. 4A LING" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold uppercase" value={form.classe} onChange={e => setForm({...form, classe: e.target.value})} />
          </div>
          <button onClick={async () => {
            const profile = { uid: user.uid, nome: user.displayName, email: user.email, classe: form.classe };
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profile);
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', user.uid), profile);
            setUserData(profile);
            setIsRegistering(false);
          }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg">Attiva Accesso</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 text-[12px] font-sans">
      {/* TOP NAV COMPATTA */}
      <header className="h-12 bg-white border-b border-slate-200 sticky top-0 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white"><BookOpen size={14}/></div>
          <span className="font-black uppercase tracking-tighter text-[11px] hidden sm:block italic">Biblioteca Ponzini</span>
        </div>

        <div className="flex-1 max-w-md mx-6 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={12} />
          <input 
            placeholder="Cerca titolo o autore..." 
            className="w-full bg-slate-100 border-none rounded-full h-8 pl-9 pr-4 text-[11px] focus:ring-1 ring-slate-300 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="font-bold text-[10px] leading-none uppercase">{user.displayName}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase leading-none mt-0.5">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 border border-slate-200 transition-all"><LogOut size={14}/></button>
        </div>
      </header>

      <div className="flex">
        {/* SIDEBAR DENSE */}
        <nav className="w-16 md:w-48 border-r border-slate-200 min-h-[calc(100vh-3rem)] bg-white p-2 flex flex-col gap-1">
          <SidebarLink active={view === 'catalog'} icon={<LayoutDashboard size={16}/>} label="Libri Disponibili" onClick={() => setView('catalog')} />
          <SidebarLink active={view === 'logs'} icon={<History size={16}/>} label="Lista Movimenti" onClick={() => setView('logs')} />
          
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="px-3 text-[8px] font-black text-slate-400 uppercase mb-2 hidden md:block">Amministrazione</p>
              <SidebarLink active={view === 'admin'} icon={<ShieldCheck size={16}/>} label="Gestione Hub" onClick={() => setView('admin')} />
              <SidebarLink active={view === 'users'} icon={<Users size={16}/>} label="Elenco Utenti" onClick={() => setView('users')} />
            </div>
          )}
        </nav>

        {/* CONTENT */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {view === 'catalog' && (
            <>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-lg font-black uppercase italic tracking-tight">Catalogo Attuale</h2>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">{books.length} Volumi Pronti allo Scambio</p>
                </div>
                <button onClick={() => { setForm({titolo:'', autore:'', genere:'Narrativa'}); setShowAddModal(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-md">
                  <Plus size={14}/> Dona Libro
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 transition-all group shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded tracking-tighter italic">{book.genere}</span>
                      <Book className="text-slate-200 group-hover:text-slate-400 transition-colors" size={16}/>
                    </div>
                    <h3 className="font-bold text-[13px] leading-tight mb-1">{book.titolo}</h3>
                    <p className="text-slate-400 text-[11px] mb-4 italic leading-tight">{book.autore || 'Autore Sconosciuto'}</p>
                    
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                      <button onClick={() => handlePrendi(book)} className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all font-bold text-[9px] uppercase">
                        <ArrowDownCircle size={12}/> Prendi
                      </button>
                      <button onClick={() => { setForm({titolo:'', autore:'', genere:'Narrativa'}); setShowExchangeModal(book); }} className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-900 hover:text-white transition-all font-bold text-[9px] uppercase">
                        <ArrowRightLeft size={12}/> Scambia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl">
              <h2 className="text-lg font-black uppercase italic mb-6">Registro Attività</h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3">Evento</th>
                      <th className="px-4 py-3">Utente / Classe</th>
                      <th className="px-4 py-3">Dettaglio / Libro</th>
                      <th className="px-4 py-3 text-right">Data e Ora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded ${
                            log.tipo === 'DONAZIONE' ? 'bg-green-100 text-green-700' :
                            log.tipo === 'RITIRO' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {log.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[10px]">{log.utente}</div>
                          <div className="text-[9px] text-slate-400 uppercase font-bold">{log.classe}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600 italic">
                          "{log.libro}" <br/>
                          <span className="text-[9px] not-italic text-slate-400 font-bold">{log.dettaglio}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 font-mono text-[10px]">
                          {new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatBox label="Totale Libri" value={books.length} color="blue" />
                <StatBox label="Operazioni Totali" value={logs.length} color="slate" />
                <StatBox label="Utenti Attivi" value={usersList.length} color="green" />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="font-black uppercase text-xs italic mb-4">Gestione Rapida Catalogo</h3>
                <div className="grid grid-cols-1 gap-2">
                   {books.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all">
                       <div className="flex items-center gap-3">
                         <div className="font-bold text-[11px] leading-none">{b.titolo}</div>
                         <div className="text-[9px] text-slate-400 uppercase font-black italic">{b.autore}</div>
                       </div>
                       <button onClick={async () => { if(window.confirm('Rimuovere definitivamente?')) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', b.id)) }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash size={14}/></button>
                     </div>
                   ))}
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <h3 className="font-black uppercase text-xs text-red-700 italic mb-4 flex items-center gap-2"><AlertCircle size={16}/> Zona Pericolosa</h3>
                <button onClick={async () => {
                   if(window.confirm('Vuoi davvero cancellare TUTTI i log delle attività?')) {
                     for(const l of logs) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'logs', l.id));
                   }
                }} className="text-[9px] font-black uppercase bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow-sm">Svuota Registro Attività</button>
              </div>
            </div>
          )}

          {view === 'users' && (
             <div className="max-w-xl">
               <h2 className="text-lg font-black uppercase italic mb-6 text-slate-400">Directory Utenti</h2>
               <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                 {usersList.map(u => (
                   <div key={u.uid} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400">{u.nome?.charAt(0)}</div>
                        <div>
                          <div className="font-bold uppercase text-[11px]">{u.nome}</div>
                          <div className="text-[9px] text-slate-400">{u.email}</div>
                        </div>
                     </div>
                     <span className="text-[9px] font-black bg-slate-100 px-3 py-1 rounded-full uppercase italic tracking-tighter text-slate-600">{u.classe}</span>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </main>
      </div>

      {/* MODALI (DONA / SCAMBIA) */}
      {(showAddModal || showExchangeModal) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-[10px] tracking-widest italic flex items-center gap-2">
                {showExchangeModal ? <ArrowRightLeft size={14}/> : <Plus size={14}/>}
                {showExchangeModal ? 'Procedi allo Scambio' : 'Dona un libro'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setShowExchangeModal(null); }} className="text-slate-400 hover:text-white"><Trash2 size={16}/></button>
            </div>
            
            <form onSubmit={showExchangeModal ? handleScambio : handleDona} className="p-6 space-y-4">
              {showExchangeModal && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2">
                  <p className="text-[8px] font-black uppercase text-slate-400 mb-1 leading-none">Stai restituendo:</p>
                  <p className="text-[11px] font-bold text-slate-900">{showExchangeModal.titolo}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Titolo del libro che lasci</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Autore</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Genere</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={form.genere} onChange={e => setForm({...form, genere: e.target.value})}>
                    <option>Narrativa</option><option>Saggistica</option><option>Classici</option><option>Scientifico</option><option>Lingue</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg mt-2">
                Conferma Operazione
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}>
      <span className={active ? 'text-white' : 'group-hover:text-slate-900'}>{icon}</span>
      <span className="hidden md:block font-black text-[10px] uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatBox({ label, value, color }) {
  const c = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    green: 'text-green-600 bg-green-50 border-green-100'
  }[color];
  return (
    <div className={`p-4 border rounded-2xl ${c} shadow-sm`}>
      <p className="text-[8px] font-black uppercase opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-black tracking-tighter leading-none italic">{value}</p>
    </div>
  );
}
