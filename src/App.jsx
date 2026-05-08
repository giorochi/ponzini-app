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
  BarChart3, UserCog, AlertCircle, 
  BookOpen, RefreshCw
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
  const [authError, setAuthError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState(null); 
  const [selectedBook, setSelectedBook] = useState(null);
  const [form, setForm] = useState({ titolo: '', autore: '', classe: '' });

  // 1. Gestione Autenticazione con Timeout
  useEffect(() => {
    let isMounted = true;
    
    // Timer per rilevare caricamento eccessivo
    const timeout = setTimeout(() => {
      if (loading && isMounted) {
        setAuthError("Il caricamento sta impiegando troppo tempo. Verifica la tua connessione o riprova.");
      }
    }, 8000);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.error("Errore Auth:", err);
        if (isMounted) setAuthError("Errore durante l'accesso sicuro. Token non valido o scaduto.");
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data');
          const snap = await getDoc(userRef);
          
          if (isMounted) {
            if (snap.exists()) {
              setUserData(snap.data());
              setIsRegistering(false);
            } else {
              setIsRegistering(true);
            }
            setUser(u);
            setLoading(false);
            clearTimeout(timeout);
          }
        } catch (e) {
          if (isMounted) setAuthError("Errore nel recupero dei dati profilo.");
        }
      } else {
        if (isMounted) {
          setUser(null);
          // Non settiamo loading false qui se ci aspettiamo un token imminente
          // ma lo facciamo se siamo sicuri che non ci sia nulla
          if (typeof __initial_auth_token === 'undefined' || !__initial_auth_token) {
            setLoading(false);
            clearTimeout(timeout);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // 2. Listeners Database
  useEffect(() => {
    if (!user) return;

    const booksRef = collection(db, 'artifacts', appId, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(booksRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Accesso negato Libri:", err));

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
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
          tipo: 'DONAZIONE', dettaglio: 'ha donato', libro: form.titolo, utente: userData.nome, classe: userData.classe, timestamp: serverTimestamp()
        });
      } else if (modalType === 'scambia' && selectedBook) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', selectedBook.id));
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), newBookData);
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
          tipo: 'SCAMBIO', dettaglio: `ha scambiato "${selectedBook.titolo}" con`, libro: form.titolo, utente: userData.nome, classe: userData.classe, timestamp: serverTimestamp()
        });
      }
      setModalType(null);
      setSelectedBook(null);
      setForm({ titolo: '', autore: '', classe: '' });
    } catch (err) { console.error(err); }
  };

  // Schermata di Caricamento con gestione errore/timeout
  if (loading || authError) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <img src={SCHOOL_LOGO} className={`h-16 mb-6 ${!authError ? 'animate-pulse' : ''}`} alt="Logo" />
      
      {!authError ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={14} className="animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-900">Verifica Identità in corso...</p>
          </div>
          <p className="text-slate-400 text-xs max-w-xs">Stiamo stabilendo una connessione sicura con i server scolastici.</p>
        </>
      ) : (
        <div className="animate-in fade-in zoom-in duration-300">
          <div className="bg-red-50 border border-red-100 p-6 rounded-3xl max-w-sm">
            <AlertCircle className="text-red-500 mx-auto mb-3" size={32} />
            <h2 className="text-red-900 font-black uppercase text-sm mb-2">Problema di Accesso</h2>
            <p className="text-red-700/70 text-xs mb-6 font-medium leading-relaxed">{authError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
            >
              Ricarica Hub
            </button>
          </div>
          <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">L'accesso anonimo è disabilitato per motivi di sicurezza.</p>
        </div>
      )}
    </div>
  );

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
       <img src={SCHOOL_LOGO} className="h-20 mb-8 grayscale opacity-50" alt="Logo" />
       <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-200 max-w-sm">
         <h1 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tighter">Accesso Non Autorizzato</h1>
         <p className="text-slate-500 text-xs font-medium leading-relaxed mb-0">
           Questa piattaforma è riservata agli studenti dell'IISS Lilla. 
           Per entrare, assicurati di aver effettuato il login tramite il portale scolastico.
         </p>
       </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border-b-8 border-blue-600">
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase text-center tracking-tighter">Profilo Studente</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Primo accesso rilevato. Inserisci i tuoi dati.</p>
        <div className="space-y-4">
          <input placeholder="Nome e Cognome" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold" onChange={e => setForm({...form, titolo: e.target.value})} />
          <input placeholder="Classe (es. 4AL)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-600 font-bold uppercase" onChange={e => setForm({...form, classe: e.target.value.toUpperCase()})} />
          <button 
            onClick={async () => {
              if (!form.titolo || !form.classe) return;
              const p = { nome: form.titolo, classe: form.classe, uid: user.uid, createdAt: serverTimestamp() };
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), p);
              setUserData(p);
              setIsRegistering(false);
            }}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            Attiva Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={SCHOOL_LOGO} className="h-8" alt="Logo" />
          <h1 className="text-lg font-black tracking-tighter text-blue-950 uppercase">Ponzini Hub</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-blue-900 uppercase">{userData?.nome}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-16 lg:w-64 bg-white border-r border-slate-200 p-3 space-y-2">
          <SidebarItem active={view === 'catalog'} icon={<LayoutDashboard/>} label="Biblioteca" onClick={() => setView('catalog')} />
          <SidebarItem active={view === 'logs'} icon={<History/>} label="Attività" onClick={() => setView('logs')} />
          {isAdmin && <SidebarItem active={view === 'admin'} icon={<ShieldCheck/>} label="Admin" onClick={() => setView('admin')} />}
        </nav>

        <main className="flex-1 p-6 overflow-y-auto">
          {view === 'catalog' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Catalogo Libri</h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input placeholder="Cerca..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-full outline-none focus:border-blue-600 font-medium" onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <button onClick={() => setModalType('dona')} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 text-[10px] uppercase tracking-widest">
                    <Plus size={16}/> Dona
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {books.filter(b => b.titolo?.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-2xl transition-colors"><BookOpen size={24} /></div>
                      <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase">{book.classe}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-1 leading-tight uppercase tracking-tighter">{book.titolo}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase mb-6">{book.autore}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { if(confirm(`Ritirare "${book.titolo}"?`)) handlePrendi(book) }} className="py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all">Prendi</button>
                      <button onClick={() => {setSelectedBook(book); setModalType('scambia');}} className="py-2.5 bg-orange-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-orange-600 transition-all">Scambia</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter italic">Cronologia Scambi</h2>
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center gap-4 border-b border-slate-50 last:border-0">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                      {log.tipo === 'SCAMBIO' ? <ArrowRightLeft size={16}/> : <Plus size={16}/>}
                    </div>
                    <div>
                      <p className="text-sm"><span className="font-black">{log.utente}</span> <span className="text-slate-400">{log.dettaglio}</span> <span className="font-bold text-blue-600">"{log.libro}"</span></p>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8">
            <h3 className="font-black uppercase text-xl mb-2 tracking-tighter italic">{modalType === 'dona' ? 'Nuova Donazione' : 'Effettua Scambio'}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 italic">Registrato come: {userData?.nome}</p>
            <form onSubmit={handleTransaction} className="space-y-4">
              <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-blue-600 text-sm" placeholder="Titolo del libro" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
              <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-blue-600 text-sm" placeholder="Autore" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 uppercase text-[10px] tracking-widest">Conferma</button>
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
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-4 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
      {React.cloneElement(icon, { size: 20 })}
      <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest leading-none">{label}</span>
    </button>
  );
}
