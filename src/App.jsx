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
  CheckSquare
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


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

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

  const [regForm, setRegForm] = useState({ classe: '' });
  const [bookForm, setBookForm] = useState({ titolo: '', autore: '', genere: 'Narrativa', descrizione: '' });

  const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

  // --- Gestione Autenticazione e Profilo ---
  useEffect(() => {
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
            // Se è l'admin e non ha profilo, lo creiamo auto-generato
            if (isUserAdmin) {
              const adminData = {
                nome: "Preside",
                cognome: "Lilla",
                classe: "Dirigenza",
                photoURL: u.photoURL || SCHOOL_LOGO,
                isAdmin: true,
                email: u.email,
                registeredAt: new Date().toISOString()
              };
              await setDoc(userRef, adminData);
              // Lo salviamo anche nella directory pubblica per la vista admin
              await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', u.uid), adminData);
              setUserData(adminData);
              setIsRegistering(false);
            } else {
              setIsRegistering(true);
            }
          }
        } catch (error) {
          console.error("Errore recupero profilo:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Sincronizzazione Libri ---
  useEffect(() => {
    if (!user || isRegistering) return;
    const booksRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    return onSnapshot(booksRef, (snapshot) => {
      setBooks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user, isRegistering]);

  // --- Sincronizzazione Utenti (Solo Admin) ---
  useEffect(() => {
    if (!isAdmin || view !== 'users') return;
    const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory');
    return onSnapshot(usersRef, (snapshot) => {
      setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [isAdmin, view]);

  const handleGoogleSignIn = () => signInWithPopup(auth, googleProvider);
  const handleSignOut = () => signOut(auth);

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
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profile);
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', user.uid), profile);
    setUserData(profile);
    setIsRegistering(false);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    const newBook = {
      ...bookForm,
      donatoreId: user.uid,
      donatoreNome: `${userData.nome} ${userData.cognome}`,
      donatoreClasse: userData.classe,
      dataLascito: new Date().toISOString(),
      status: 'disponibile',
      cronologia: [{
        tipo: 'donazione',
        utente: `${userData.nome} ${userData.cognome} (${userData.classe})`,
        data: new Date().toISOString()
      }]
    };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    setBookForm({ titolo: '', autore: '', genere: 'Narrativa', descrizione: '' });
    setShowAddModal(false);
  };

  const handleLoanAction = async (bookId, action) => {
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
  };

  const filteredBooks = books.filter(b => 
    b.titolo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.autore.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#1e293b] text-[#cbb26a]">
      <div className="text-center">
        <img src={SCHOOL_LOGO} className="h-20 mx-auto mb-4 animate-bounce" alt="Lilla" />
        <p className="font-black uppercase tracking-[0.3em] text-sm italic">Caricamento Sistema...</p>
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
          <p className="text-slate-500 font-bold text-sm mb-10 uppercase">Accedi con la tua email scolastica per consultare il catalogo digitale.</p>
          <button onClick={handleGoogleSignIn} className="bg-[#1e293b] text-white py-5 px-8 font-black uppercase text-sm tracking-widest hover:bg-[#cbb26a] hover:text-[#1e293b] transition-all flex items-center justify-center gap-4 border-b-4 border-slate-950">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 bg-white p-1" alt="" />
            Accedi con Google
          </button>
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
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">La tua Classe (es. 4A Scientifico)</label>
            <input required placeholder="SCRIVI QUI..." className="w-full p-4 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={regForm.classe} onChange={e => setRegForm({classe: e.target.value})} />
          </div>
          <button className="w-full bg-slate-900 text-white py-5 font-black uppercase tracking-[0.2em] hover:bg-[#cbb26a] hover:text-black transition-all">Configura Ora</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      {/* HEADER NAVBAR */}
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
                <p className="text-[11px] font-black uppercase leading-none">{userData?.nome} {userData?.cognome}</p>
                <p className="text-[9px] font-bold text-[#cbb26a] uppercase mt-1 bg-slate-900 px-2 inline-block italic">{userData?.classe}</p>
              </div>
              <img src={userData?.photoURL} className="w-12 h-12 border-4 border-slate-900 object-cover shadow-[4px_4px_0px_#cbb26a]" alt="User" />
              <button onClick={handleSignOut} className="p-2 hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-slate-900 transition-all"><LogOut size={20}/></button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* SIDEBAR SQUADRATA */}
        <aside className="w-72 border-r-[6px] border-slate-900 hidden md:block bg-white p-8">
          <div className="space-y-3">
            <p className="text-[11px] font-black text-slate-400 uppercase mb-6 tracking-widest">Esplorazione</p>
            <button onClick={() => setView('catalog')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'catalog' ? 'bg-slate-900 text-white border-slate-900 shadow-[6px_6px_0px_#cbb26a]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
              <LayoutDashboard size={18} /> Catalogo
            </button>
            <button onClick={() => setView('history')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'history' ? 'bg-slate-900 text-white border-slate-900 shadow-[6px_6px_0px_#cbb26a]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
              <Bookmark size={18} /> Miei Prestiti
            </button>

            {isAdmin && (
              <>
                <p className="text-[11px] font-black text-[#cbb26a] uppercase mt-12 mb-6 tracking-widest bg-slate-900 px-2 py-1 inline-block">Area Preside</p>
                <button onClick={() => setView('admin')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'admin' ? 'bg-[#cbb26a] text-slate-900 border-slate-900 shadow-[6px_6px_0px_#1e293b]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
                  <ShieldCheck size={18} /> Gestione Totale
                </button>
                <button onClick={() => setView('users')} className={`w-full flex items-center gap-4 px-6 py-5 font-black uppercase text-xs transition-all border-4 ${view === 'users' ? 'bg-[#cbb26a] text-slate-900 border-slate-900 shadow-[6px_6px_0px_#1e293b]' : 'border-transparent hover:bg-slate-50 text-slate-500'}`}>
                  <Users size={18} /> Registro Studenti
                </button>
              </>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-10 bg-[#fdfdfd]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 border-b-[6px] border-slate-900 pb-8 gap-6">
            <div>
              <h2 className="text-5xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">
                {view === 'catalog' ? 'Catalogo Libri' : view === 'history' ? 'Prestiti Attivi' : view === 'users' ? 'Database Utenti' : 'Pannello Admin'}
              </h2>
              <p className="text-slate-400 font-bold text-xs uppercase mt-3 tracking-widest">Digital Archive — Licenza I.I.S. Lilla</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-10 py-5 font-black uppercase text-xs tracking-widest flex items-center gap-4 hover:bg-[#cbb26a] hover:text-black transition-all shadow-[10px_10px_0px_#cbd5e1] border-2 border-slate-900">
              <Plus size={22} /> Aggiungi Libro
            </button>
          </div>

          {view === 'users' ? (
            <div className="grid grid-cols-1 gap-6">
              {allUsers.map(u => (
                <div key={u.id} className="bg-white border-4 border-slate-900 p-8 flex flex-col md:flex-row items-center justify-between hover:shadow-[12px_12px_0px_#cbb26a] transition-all">
                  <div className="flex items-center gap-8 mb-4 md:mb-0">
                    <img src={u.photoURL} className="w-20 h-20 border-4 border-slate-900 shadow-[4px_4px_0px_#f1f5f9]" alt="" />
                    <div>
                      <h4 className="font-black uppercase text-2xl text-slate-900 italic leading-none">{u.nome} {u.cognome}</h4>
                      <p className="text-slate-400 text-xs font-bold uppercase mt-2">{u.email}</p>
                      <span className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase mt-3 inline-block italic tracking-widest">{u.classe}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end border-l-4 border-slate-50 pl-8">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={14} className="text-[#cbb26a]" />
                      <p className="text-[11px] font-black text-slate-400 uppercase italic">Iscritto il</p>
                    </div>
                    <p className="font-black text-lg text-slate-900">{new Date(u.registeredAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {(view === 'catalog' ? filteredBooks.filter(b => b.status === 'disponibile') : 
                view === 'history' ? books.filter(b => b.presoDaId === user.uid) : 
                books).map(book => (
                <div key={book.id} className="bg-white border-[6px] border-slate-900 flex flex-col md:flex-row hover:shadow-[15px_15px_0px_#1e293b] transition-all group overflow-hidden">
                  <div className={`w-full md:w-16 ${book.status === 'disponibile' ? 'bg-[#cbb26a]' : 'bg-red-500'} flex items-center justify-center p-4 border-b-4 md:border-b-0 md:border-r-4 border-slate-900`}>
                    <p className="font-black text-slate-900 uppercase text-xs -rotate-0 md:-rotate-90 whitespace-nowrap tracking-widest italic">
                      {book.status === 'disponibile' ? 'Disponibile' : 'In Prestito'}
                    </p>
                  </div>
                  <div className="p-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-slate-100 text-slate-500 px-4 py-2 text-[10px] font-black uppercase border-2 border-slate-200">{book.genere}</span>
                      <BookOpen size={24} className="text-slate-200 group-hover:text-[#cbb26a] transition-all" />
                    </div>
                    <h3 className="text-3xl font-black uppercase leading-tight mb-2 italic tracking-tighter">{book.titolo}</h3>
                    <p className="text-slate-400 font-bold uppercase text-xs mb-8 tracking-[0.2em]">{book.autore}</p>
                    
                    <div className="bg-slate-50 border-2 border-slate-100 p-6 space-y-4 mb-8">
                      <div className="flex items-center gap-4 text-[11px] font-black uppercase text-slate-500">
                        <User size={16} className="text-[#cbb26a]" /> 
                        <span>Donatore: <span className="text-slate-900 ml-1">{book.donatoreNome}</span></span>
                      </div>
                      {book.status === 'ritirato' && (
                        <div className="flex items-center gap-4 text-[11px] font-black uppercase text-red-600">
                          <CheckSquare size={16} /> 
                          <span>Posseduto da: <span className="ml-1">{book.presoDaNome}</span></span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      {book.status === 'disponibile' ? (
                        <button onClick={() => handleLoanAction(book.id, 'ritirato')} className="flex-1 bg-slate-900 text-white py-5 font-black uppercase text-xs tracking-[0.2em] hover:bg-[#cbb26a] hover:text-black transition-all border-b-4 border-slate-950 flex items-center justify-center gap-3">
                          Prendi <ArrowRight size={18} />
                        </button>
                      ) : (
                        (isAdmin || book.presoDaId === user.uid) && (
                          <button onClick={() => handleLoanAction(book.id, 'reso')} className="flex-1 bg-green-500 text-white py-5 font-black uppercase text-xs tracking-[0.2em] border-b-4 border-green-700">Restituisci Libro</button>
                        )
                      )}
                      <button onClick={() => setShowHistoryModal(book)} className="p-5 bg-white border-4 border-slate-900 hover:bg-slate-50 transition-all">
                        <History size={20} />
                      </button>
                      {(isAdmin || book.donatoreId === user.uid) && (
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id))} className="p-5 border-4 border-slate-900 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all">
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* FOOTER PERSONALIZZATO SQUADRATO */}
      <footer className="bg-slate-900 text-white border-t-[8px] border-[#cbb26a] py-12 px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-[#cbb26a] border-4 border-white flex items-center justify-center font-black text-slate-900 text-2xl -rotate-6 shadow-[6px_6px_0px_white]">L</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-white italic">I.I.S. "Vincenzo Lilla"</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Biblioteca Digitale Ponzini • Polo Liceale Francavilla - Oria</p>
            </div>
          </div>
          <div className="text-center md:text-right border-l-4 border-[#cbb26a] pl-8 py-2">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#cbb26a] mb-2 leading-none italic">Creato da Giovanni Rochira</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.5em]">Sviluppo Software • A.S. 2024/2025</p>
          </div>
        </div>
      </footer>

      {/* MODAL AGGIUNTA LIBRO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div className="bg-white border-[8px] border-slate-900 w-full max-w-2xl p-12 shadow-[25px_25px_0px_#cbb26a]">
            <div className="flex justify-between items-start mb-10">
              <h2 className="text-4xl font-black uppercase italic text-slate-900 leading-none">Nuovo Volume</h2>
              <button onClick={() => setShowAddModal(false)} className="text-4xl font-black">&times;</button>
            </div>
            <form onSubmit={handleAddBook} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block italic">Titolo dell'Opera</label>
                  <input required className="w-full p-5 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={bookForm.titolo} onChange={e => setBookForm({...bookForm, titolo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block italic">Autore principale</label>
                  <input required className="w-full p-5 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" value={bookForm.autore} onChange={e => setBookForm({...bookForm, autore: e.target.value})} />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block italic">Genere / Sezione</label>
                  <select className="w-full p-5 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-black uppercase" value={bookForm.genere} onChange={e => setBookForm({...bookForm, genere: e.target.value})}>
                    <option value="Narrativa">Narrativa</option>
                    <option value="Classici Grechi/Latini">Classici Grechi/Latini</option>
                    <option value="Saggistica">Saggistica</option>
                    <option value="Scientifico">Scientifico</option>
                    <option value="Poesia">Poesia</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block italic">Descrizione (Opzionale)</label>
                  <input className="w-full p-5 bg-slate-50 border-4 border-slate-100 outline-none focus:border-slate-900 font-bold uppercase" placeholder="BREVE NOTA..." value={bookForm.descrizione} onChange={e => setBookForm({...bookForm, descrizione: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-2 flex gap-6 mt-8">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-6 font-black uppercase text-sm tracking-[0.3em] hover:bg-[#cbb26a] hover:text-black transition-all border-b-8 border-slate-950">Conferma Donazione</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRONOLOGIA PASSAGGI */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center p-6 z-[100]">
          <div className="bg-white border-[8px] border-slate-900 w-full max-w-md p-10 shadow-[20px_20px_0px_#cbb26a]">
            <div className="flex justify-between items-center mb-10 border-b-4 border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-black uppercase italic italic leading-none">{showHistoryModal.titolo}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Log degli spostamenti</p>
              </div>
              <History className="text-[#cbb26a]" size={30} />
            </div>
            <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-4 scrollbar-custom">
              {[...showHistoryModal.cronologia].reverse().map((log, i) => (
                <div key={i} className="flex gap-6 border-b-2 border-slate-50 pb-4 last:border-0">
                  <div className={`w-3 h-3 rounded-full mt-1 ${log.tipo === 'donazione' ? 'bg-[#cbb26a]' : log.tipo === 'prestito' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900 italic">{log.utente}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                      {log.tipo} • {new Date(log.data).toLocaleString('it-IT')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHistoryModal(null)} className="w-full mt-10 py-5 bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-[#cbb26a] hover:text-black transition-all">Chiudi Registro</button>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-custom::-webkit-scrollbar { width: 6px; }
        .scrollbar-custom::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 0; border: 2px solid #fff; }
      `}</style>
    </div>
  );
}
