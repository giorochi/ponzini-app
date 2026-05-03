import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  setDoc,
  getDoc,
  deleteDoc,
  arrayUnion,
  query
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut
} from 'firebase/auth';
import { 
  Plus, 
  Book, 
  User, 
  Trash2, 
  LogOut, 
  History,
  Search,
  Bookmark,
  ShieldCheck,
  Users,
  LayoutDashboard,
  Calendar,
  ChevronRight,
  Info,
  BookOpen,
  ArrowRight,
  CheckSquare,
  AlertCircle
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

// CONFIGURAZIONE ADMIN
// Inserisci qui la tua email personale per avere i poteri di gestione
const ADMIN_EMAIL = "rochiragiovanni87@gmail.com"; 
const APP_ID = 'ponzini-library-lilla';


// Inizializzazione sicura
let db, auth, googleProvider;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.error("Firebase init error:", e);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [books, setBooks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [view, setView] = useState('catalog'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const [regForm, setRegForm] = useState({ classe: '' });
  const [bookForm, setBookForm] = useState({ titolo: '', autore: '', genere: 'Narrativa', descrizione: '' });

  const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

  // --- Timeout di Sicurezza per il caricamento ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 3000); // Se dopo 3 secondi non ha caricato, sblocca comunque
    return () => clearTimeout(timer);
  }, [loading]);

  // --- Gestione Autenticazione ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const isUserAdmin = u.email === ADMIN_EMAIL;
        setIsAdmin(isUserAdmin);
        
        try {
          const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUserData(userSnap.data());
            setIsRegistering(false);
          } else {
            setIsRegistering(true);
          }
        } catch (err) {
          console.error("Errore profilo:", err);
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Sincronizzazione Dati ---
  useEffect(() => {
    if (!user || isRegistering || !db) return;
    
    const booksRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(booksRef, (snapshot) => {
      setBooks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Dati in modalità demo (senza DB reale)");
    });

    return () => unsubBooks();
  }, [user, isRegistering]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Errore durante l'accesso. Controlla la console.");
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    const profile = { 
      nome: user.displayName?.split(' ')[0] || 'Studente',
      cognome: user.displayName?.split(' ').slice(1).join(' ') || 'Lilla',
      email: user.email,
      photoURL: user.photoURL,
      classe: regForm.classe,
      uid: user.uid,
      registeredAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profile);
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', user.uid), profile);
      setUserData(profile);
      setIsRegistering(false);
    } catch (err) {
      setError("Errore nel salvataggio profilo.");
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!bookForm.titolo || !bookForm.autore) return;

    const newBook = {
      ...bookForm,
      donatoreId: user.uid,
      donatoreNome: userData ? `${userData.nome} ${userData.cognome}` : user.displayName,
      donatoreClasse: userData?.classe || "N/A",
      dataLascito: new Date().toISOString(),
      status: 'disponibile',
      cronologia: [{
        tipo: 'donazione',
        utente: userData ? `${userData.nome} ${userData.cognome} (${userData.classe})` : user.displayName,
        data: new Date().toISOString()
      }]
    };

    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
      setBookForm({ titolo: '', autore: '', genere: 'Narrativa', descrizione: '' });
      setShowAddModal(false);
    } catch (err) {
      setError("Errore durante la donazione del libro.");
    }
  };

  const handleLoanAction = async (bookId, action) => {
    try {
      const bookRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', bookId);
      const log = {
        tipo: action === 'ritiro' ? 'prestito' : 'restituzione',
        utente: `${userData.nome} ${userData.cognome} (${userData.classe})`,
        data: new Date().toISOString()
      };
      
      await updateDoc(bookRef, {
        status: action === 'ritiro' ? 'ritirato' : 'disponibile',
        presoDaId: action === 'ritiro' ? user.uid : null,
        presoDaNome: action === 'ritiro' ? `${userData.nome} ${userData.cognome}` : null,
        cronologia: arrayUnion(log)
      });
    } catch (err) {
      setError("Errore nell'aggiornamento del prestito.");
    }
  };

  const filteredBooks = books.filter(b => 
    b.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.autore?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#1e293b] text-[#cbb26a]">
      <div className="text-center">
        <img src={SCHOOL_LOGO} className="h-24 mx-auto mb-6 animate-pulse" alt="Lilla" />
        <p className="font-black uppercase tracking-[0.4em] text-sm italic">Inizializzazione Sistema...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl border-[6px] border-slate-900 shadow-[20px_20px_0px_#1e293b] flex flex-col md:flex-row overflow-hidden">
        <div className="bg-[#1e293b] p-12 text-white md:w-1/2 flex flex-col justify-center items-center text-center">
          <img src={SCHOOL_LOGO} className="w-32 mb-8" alt="Lilla" />
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">I.I.S. Lilla</h2>
          <p className="text-[#cbb26a] font-bold uppercase tracking-widest text-xs">Biblioteca Ponzini</p>
        </div>
        <div className="p-12 md:w-1/2 flex flex-col justify-center">
          <h1 className="text-4xl font-black text-slate-900 mb-6 uppercase leading-none italic">Bentornato,<br />Studente.</h1>
          <button onClick={handleGoogleSignIn} className="bg-[#1e293b] text-white py-5 px-8 font-black uppercase text-sm tracking-widest hover:bg-[#cbb26a] hover:text-[#1e293b] transition-all flex items-center justify-center gap-4 border-b-4 border-slate-950">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 bg-white p-1" alt="" />
            Accedi con Google
          </button>
          {error && <p className="mt-4 text-red-500 font-bold text-xs uppercase">{error}</p>}
        </div>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-6">
      <div className="bg-white border-[6px] border-slate-900 p-12 max-w-md w-full shadow-[15px_15px_0px_#cbb26a]">
        <h2 className="text-3xl font-black uppercase italic mb-8 text-slate-900 border-b-4 border-slate-100 pb-2">Registrazione</h2>
        <form onSubmit={handleCompleteRegistration} className="space-y-8">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">La tua Classe (es. 4A LING)</label>
            <input required placeholder="SCRIVI QUI..." className="w-full p-4 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={regForm.classe} onChange={e => setRegForm({classe: e.target.value})} />
          </div>
          <button className="w-full bg-slate-900 text-white py-5 font-black uppercase tracking-[0.2em] hover:bg-[#cbb26a] hover:text-black transition-all">Configura Ora</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      {/* HEADER */}
      <nav className="bg-white border-b-[6px] border-slate-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-2 border-2 border-[#cbb26a]">
              <img src={SCHOOL_LOGO} className="h-10" alt="Logo" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black uppercase tracking-tighter leading-none italic">Ponzini Digital Hub</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Biblioteca I.I.S. Vincenzo Lilla</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center bg-slate-100 border-2 border-slate-200 px-4 h-12 w-64">
              <Search size={18} className="text-slate-400" />
              <input placeholder="CERCA VOLUME..." className="bg-transparent border-none outline-none ml-3 text-[11px] font-black w-full uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-4 pl-6 border-l-4 border-slate-100">
              <div className="text-right hidden md:block">
                <p className="text-[11px] font-black uppercase leading-none">{userData?.nome || user.displayName}</p>
                <p className="text-[9px] font-bold text-[#cbb26a] uppercase mt-1 bg-slate-900 px-2 inline-block italic">{userData?.classe || "Nuovo"}</p>
              </div>
              <img src={user.photoURL} className="w-12 h-12 border-4 border-slate-900 object-cover shadow-[4px_4px_0px_#cbb26a]" alt="User" />
              <button onClick={() => signOut(auth)} className="p-2 hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-slate-900 transition-all"><LogOut size={20}/></button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="w-72 border-r-[6px] border-slate-900 hidden md:block bg-white p-8">
          <div className="space-y-3">
            <button onClick={() => setView('catalog')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'catalog' ? 'bg-slate-900 text-white border-slate-900 shadow-[6px_6px_0px_#cbb26a]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
              <LayoutDashboard size={18} /> Catalogo
            </button>
            <button onClick={() => setView('history')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'history' ? 'bg-slate-900 text-white border-slate-900 shadow-[6px_6px_0px_#cbb26a]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
              <Bookmark size={18} /> Miei Prestiti
            </button>

            {isAdmin && (
              <div className="mt-12 pt-12 border-t-4 border-slate-100">
                <p className="text-[10px] font-black text-[#cbb26a] uppercase mb-4 bg-slate-900 px-2 py-1 inline-block italic">Pannello Preside</p>
                <button onClick={() => setView('users')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'users' ? 'bg-[#cbb26a] text-slate-900 border-slate-900 shadow-[6px_6px_0px_#1e293b]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
                  <Users size={18} /> Registro
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 p-10">
          {error && (
            <div className="mb-8 bg-red-100 border-4 border-red-500 p-4 flex items-center gap-4 text-red-700 font-bold uppercase text-xs">
              <AlertCircle size={20} /> {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 border-b-[6px] border-slate-900 pb-8 gap-6">
            <div>
              <h2 className="text-5xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">
                {view === 'catalog' ? 'Il Catalogo' : view === 'history' ? 'I Tuoi Libri' : 'Utenti'}
              </h2>
            </div>
            <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-10 py-5 font-black uppercase text-xs tracking-widest flex items-center gap-4 hover:bg-[#cbb26a] hover:text-black transition-all shadow-[10px_10px_0px_#cbd5e1] border-2 border-slate-900">
              <Plus size={22} /> Dona Libro
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {filteredBooks.map(book => (
              <div key={book.id} className="bg-white border-[6px] border-slate-900 flex flex-col md:flex-row hover:shadow-[15px_15px_0px_#1e293b] transition-all overflow-hidden">
                <div className={`w-full md:w-16 ${book.status === 'disponibile' ? 'bg-[#cbb26a]' : 'bg-red-500'} flex items-center justify-center p-4 border-b-4 md:border-b-0 md:border-r-4 border-slate-900`}>
                  <p className="font-black text-slate-900 uppercase text-xs -rotate-0 md:-rotate-90 whitespace-nowrap tracking-widest italic">
                    {book.status === 'disponibile' ? 'Disponibile' : 'Occupato'}
                  </p>
                </div>
                <div className="p-8 flex-1">
                  <h3 className="text-2xl font-black uppercase leading-tight mb-1 italic tracking-tighter">{book.titolo}</h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] mb-6 tracking-widest">{book.autore}</p>
                  
                  <div className="bg-slate-50 border-2 border-slate-100 p-4 mb-6">
                    <p className="text-[10px] font-black uppercase text-slate-500">Donato da: <span className="text-slate-900">{book.donatoreNome} ({book.donatoreClasse})</span></p>
                  </div>

                  <div className="flex gap-3">
                    {book.status === 'disponibile' ? (
                      <button onClick={() => handleLoanAction(book.id, 'ritirato')} className="flex-1 bg-slate-900 text-white py-4 font-black uppercase text-[10px] tracking-widest border-b-4 border-slate-950 flex items-center justify-center gap-2">
                        Preleva <ArrowRight size={14} />
                      </button>
                    ) : (
                      (isAdmin || book.presoDaId === user.uid) && (
                        <button onClick={() => handleLoanAction(book.id, 'reso')} className="flex-1 bg-green-500 text-white py-4 font-black uppercase text-[10px] tracking-widest border-b-4 border-green-700">Restituisci</button>
                      )
                    )}
                    <button onClick={() => setShowHistoryModal(book)} className="p-4 bg-white border-2 border-slate-900 hover:bg-slate-50">
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white border-t-[8px] border-[#cbb26a] py-12 px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-[#cbb26a] border-4 border-white flex items-center justify-center font-black text-slate-900 text-2xl -rotate-6 shadow-[6px_6px_0px_white]">L</div>
            <p className="text-xs font-black uppercase tracking-[0.4em] italic text-white">I.I.S.S. "Vincenzo Lilla"</p>
          </div>
          <div className="text-center md:text-right border-l-4 border-[#cbb26a] pl-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#cbb26a] italic">Progettato da Giovanni Rochira</p>
          </div>
        </div>
      </footer>

      {/* MODAL DONAZIONE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div className="bg-white border-[8px] border-slate-900 w-full max-w-xl p-10 shadow-[20px_20px_0px_#cbb26a]">
            <h2 className="text-3xl font-black uppercase italic mb-8">Nuova Donazione</h2>
            <form onSubmit={handleAddBook} className="space-y-6">
              <input required placeholder="TITOLO" className="w-full p-4 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={bookForm.titolo} onChange={e => setBookForm({...bookForm, titolo: e.target.value})} />
              <input required placeholder="AUTORE" className="w-full p-4 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={bookForm.autore} onChange={e => setBookForm({...bookForm, autore: e.target.value})} />
              <select className="w-full p-4 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-black uppercase" value={bookForm.genere} onChange={e => setBookForm({...bookForm, genere: e.target.value})}>
                <option value="Narrativa">Narrativa</option>
                <option value="Classici">Classici</option>
                <option value="Saggistica">Saggistica</option>
                <option value="Scientifico">Scientifico</option>
              </select>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-5 font-black uppercase text-xs tracking-widest">Conferma</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="px-8 py-5 border-4 border-slate-900 font-black uppercase text-xs">Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
