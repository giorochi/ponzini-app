import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  setDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  Plus, Book, User, LogOut, Search, 
  ShieldCheck, Users, LayoutDashboard, 
  BookOpen, ArrowDownCircle, History,
  Globe, AlertCircle
} from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
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
  const [authError, setAuthError] = useState(null);

  // 1. Gestione Autenticazione (Solo Google)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Se l'utente è loggato, cerchiamo il suo profilo
        const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
            setIsRegistering(false);
          } else {
            // Se il profilo non esiste, forziamo la registrazione (classe/sezione)
            setIsRegistering(true);
          }
          setLoading(false);
        }, (err) => {
          console.error("Errore caricamento profilo:", err);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 2. Caricamento Dati Pubblici
  useEffect(() => {
    if (!user || isRegistering) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(lRef, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });

    if (user && ADMIN_EMAILS.includes(user.email)) {
      const uRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory');
      onSnapshot(uRef, (snap) => setUsersList(snap.docs.map(d => d.data())));
    }
  }, [user, isRegistering]);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const createLog = async (tipo, dettaglio, libroTitolo) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      tipo,
      dettaglio,
      libro: libroTitolo,
      utente: user.displayName || 'Utente',
      classe: userData?.classe || 'N/A',
      timestamp: new Date().toISOString()
    });
  };

  const handleDona = async (e) => {
    e.preventDefault();
    if (!form.titolo) return;
    const newBook = { 
      titolo: form.titolo, 
      autore: form.autore, 
      genere: form.genere, 
      status: 'disponibile',
      donatoreId: user.uid,
      dataInserimento: new Date().toISOString() 
    };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    await createLog('DONAZIONE', `Ha donato un nuovo libro`, form.titolo);
    setShowAddModal(false);
    setForm({ titolo: '', autore: '', genere: 'Narrativa', classe: '' });
  };

  const handlePrendi = async (book) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id));
    await createLog('RITIRO', `Ha preso il libro`, book.titolo);
  };

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError("Impossibile completare l'accesso con Google. Riprova.");
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ titolo: '', autore: '', genere: 'Narrativa', classe: '' });

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-indigo-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-indigo-900 font-bold">Caricamento Ponzini Hub...</p>
    </div>
  );

  // Schermata di Login Obbligatoria
  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 flex items-center justify-center p-6">
      <div className="bg-white p-10 w-full max-w-md rounded-3xl shadow-2xl border border-indigo-50 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
          <BookOpen className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Ponzini Hub</h1>
        <p className="text-slate-500 mb-10">Accedi con la tua email scolastica per consultare il catalogo.</p>
        
        {authError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-center gap-3 text-left">
            <AlertCircle size={16} /> {authError}
          </div>
        )}

        <button 
          onClick={handleSignIn}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-200"
        >
          <Globe size={20} /> Accedi con Google
        </button>
        <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">I.I.S. Vincenzo Lilla - Francavilla Fontana</p>
      </div>
    </div>
  );

  // Registrazione Classe (solo al primo accesso)
  if (isRegistering) return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 w-full max-w-md rounded-3xl shadow-xl border border-indigo-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-3">Benvenuto, {user.displayName?.split(' ')[0]}</h2>
        <p className="text-slate-500 text-sm mb-6">Completa il profilo per accedere alla biblioteca.</p>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">La tua Classe (es. 4A LING)</label>
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
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg"
          >
            Configura Accesso
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdff] text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100"><BookOpen size={24}/></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">Ponzini Hub</h1>
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mt-1">Biblioteca Scolastica</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-12 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Cerca nel catalogo..." 
            className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 ring-indigo-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-sm text-slate-900 leading-none">{user.displayName}</p>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase">{userData?.classe}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 border border-slate-200 transition-all"><LogOut size={20}/></button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-20 lg:w-64 border-r border-slate-200 bg-white p-4 flex flex-col gap-2">
          <NavBtn active={view === 'catalog'} icon={<LayoutDashboard/>} label="Catalogo Libri" onClick={() => setView('catalog')} />
          <NavBtn active={view === 'logs'} icon={<History/>} label="Movimenti" onClick={() => setView('logs')} />
          {isAdmin && (
            <div className="mt-8 space-y-2">
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Admin</p>
              <NavBtn active={view === 'users'} icon={<Users/>} label="Studenti" onClick={() => setView('users')} />
            </div>
          )}
        </aside>

        <main className="flex-1 p-6 lg:p-10">
          {view === 'catalog' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Catalogo</h2>
                  <p className="text-slate-500 font-medium">Scambia i tuoi libri con la comunità scolastica.</p>
                </div>
                <button 
                  onClick={() => { setForm({titolo:'', autore:'', genere:'Narrativa', classe:''}); setShowAddModal(true); }}
                  className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                >
                  <Plus size={20}/> Dona un libro
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {books.filter(b => b.titolo.toLowerCase().includes(searchTerm.toLowerCase())).map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase px-3 py-1 rounded-full">{book.genere}</span>
                      <Book className="text-slate-300" size={24}/>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{book.titolo}</h3>
                    <p className="text-slate-500 font-medium italic mb-8">{book.autore || 'Autore ignoto'}</p>
                    
                    <button 
                      onClick={() => handlePrendi(book)}
                      className="mt-auto w-full py-3 px-4 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      <ArrowDownCircle size={18}/> Prendi Libro
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'logs' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-8 tracking-tight">Registro Passaggi</h2>
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Evento</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Studente</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Libro</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-indigo-50/50">
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                            log.tipo === 'DONAZIONE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{log.utente}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{log.classe}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 text-sm">"{log.libro}"</div>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString('it-IT')}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-indigo-600 p-8 text-white">
              <h3 className="text-2xl font-extrabold flex items-center gap-4"><Plus size={28}/> Dona un libro</h3>
            </div>
            <form onSubmit={handleDona} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Titolo Libro</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 ring-indigo-500 outline-none" value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Autore</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 ring-indigo-500 outline-none" value={form.autore} onChange={e => setForm({...form, autore: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 font-bold rounded-2xl">Annulla</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl">Aggiungi al Catalogo</button>
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
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}>
      {React.cloneElement(icon, { size: 22 })}
      <span className="hidden lg:block font-bold text-sm">{label}</span>
    </button>
  );
}
