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
  arrayUnion
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
  BookOpen,
  ArrowRight,
  ChevronRight,
  Library,
  History,
  Search,
  Bookmark,
  AlertCircle,
  ShieldCheck,
  Users,
  Settings,
  RotateCcw
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

// Inizializzazione
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [view, setView] = useState('catalog'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [authError, setAuthError] = useState(null);

  const [regForm, setRegForm] = useState({ classe: '' });
  const [bookForm, setBookForm] = useState({ titolo: '', autore: '' });

  const SCHOOL_LOGO = "https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        const isUserAdmin = u.email === ADMIN_EMAIL;
        setIsAdmin(isUserAdmin);
        checkUserProfile(u, isUserAdmin);
      } else {
        setUser(null);
        setUserData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try { 
      await signInWithPopup(auth, googleProvider); 
    } catch (error) { 
      setAuthError("Errore di connessione. Verifica di aver autorizzato il dominio su Firebase.");
    }
  };

  const handleSignOut = () => signOut(auth);

  const checkUserProfile = async (u, isUserAdmin) => {
    try {
      if (isUserAdmin) {
        setUserData({
          nome: "Amministrazione",
          cognome: "Lilla",
          classe: "Staff Scuola",
          photoURL: SCHOOL_LOGO,
          isAdmin: true
        });
        setIsRegistering(false);
      } else {
        const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
          setIsRegistering(false);
        } else {
          setIsRegistering(true);
        }
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    const profileData = { 
      nome: user.displayName?.split(' ')[0] || 'Studente',
      cognome: user.displayName?.split(' ').slice(1).join(' ') || 'Lilla',
      email: user.email,
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      classe: regForm.classe,
      uid: user.uid, 
      registeredAt: new Date().toISOString() 
    };
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profileData);
      setUserData(profileData);
      setIsRegistering(false);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!user || isRegistering) return;
    const booksRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubscribe = onSnapshot(booksRef, (snapshot) => {
      const booksList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(booksList.sort((a, b) => new Date(b.dataLascito) - new Date(a.dataLascito)));
    });
    return () => unsubscribe();
  }, [user, isRegistering]);

  const addBook = async (e) => {
    e.preventDefault();
    const newBook = {
      titolo: bookForm.titolo,
      autore: bookForm.autore,
      donatoreId: isAdmin ? 'admin' : user.uid,
      donatoreNome: isAdmin ? "Scuola Lilla" : `${userData.nome} ${userData.cognome}`,
      donatoreClasse: isAdmin ? "Biblioteca" : userData.classe,
      dataLascito: new Date().toISOString(),
      status: 'disponibile',
      cronologia: [{
        tipo: 'donazione',
        utente: isAdmin ? "Scuola Lilla" : `${userData.nome} ${userData.cognome} (${userData.classe})`,
        data: new Date().toISOString()
      }]
    };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
    setBookForm({ titolo: '', autore: '' });
    setShowAddModal(false);
  };

  const withdrawBook = async (bookId) => {
    const bookRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', bookId);
    await updateDoc(bookRef, {
      status: 'ritirato',
      presoDaId: user.uid,
      presoDaNome: `${userData.nome} ${userData.cognome}`,
      dataRitiro: new Date().toISOString(),
      cronologia: arrayUnion({
        tipo: 'prestito',
        utente: `${userData.nome} ${userData.cognome} (${userData.classe})`,
        data: new Date().toISOString()
      })
    });
  };

  const returnBook = async (bookId) => {
    const bookRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', bookId);
    await updateDoc(bookRef, {
      status: 'disponibile',
      presoDaId: null,
      presoDaNome: null,
      cronologia: arrayUnion({
        tipo: 'restituzione',
        utente: `${userData.nome} ${userData.cognome} (${userData.classe})`,
        data: new Date().toISOString()
      })
    });
  };

  const filteredBooks = books.filter(b => 
    b.titolo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.autore.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableBooks = filteredBooks.filter(b => b.status === 'disponibile');
  const myBooks = filteredBooks.filter(b => b.status === 'ritirato' && b.presoDaId === user.uid);
  const allRetired = filteredBooks.filter(b => b.status === 'ritirato');

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white font-sans">
      <div className="text-center">
        <img src={SCHOOL_LOGO} alt="Lilla" className="h-20 mx-auto animate-pulse mb-4" />
        <p className="text-slate-400 text-[10px] tracking-widest uppercase font-bold">Caricamento Archivio...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-xl w-full max-w-md text-center border border-slate-100">
        <img src={SCHOOL_LOGO} alt="Lilla" className="h-32 mx-auto mb-8" />
        <h1 className="text-3xl font-serif font-bold text-[#1a365d] mb-2">Progetto Ponzini</h1>
        <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-bold mb-10 italic">I.I.S. "Vincenzo Lilla"</p>
        
        {authError && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs rounded-xl">{authError}</div>}

        <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center gap-4 bg-[#1a365d] text-white py-5 rounded-2xl font-bold hover:shadow-lg transition-all">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white p-0.5 rounded-full" alt="" />
          Accedi con Google
        </button>
      </div>
      <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Creato da Giovanni Rochira</p>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm text-center">
        <h2 className="text-2xl font-bold text-[#1a365d] mb-8">Benvenuto nel Progetto</h2>
        <form onSubmit={handleCompleteRegistration} className="space-y-6">
          <input required placeholder="Inserisci la tua Classe" className="w-full px-6 py-5 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#cbb26a] font-semibold" value={regForm.classe} onChange={(e) => setRegForm({classe: e.target.value})} />
          <button type="submit" className="w-full bg-[#1a365d] text-white py-5 rounded-2xl font-bold shadow-lg">Inizia subito</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-800 pb-32 font-sans selection:bg-[#cbb26a]/30">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={SCHOOL_LOGO} alt="Lilla" className="h-12" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-[#1a365d] leading-none">Liceo Lilla</h1>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Biblioteca Ponzini</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
              <Search size={16} className="text-slate-300" />
              <input placeholder="Cerca..." className="bg-transparent border-none outline-none ml-2 text-sm w-32" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <img src={userData?.photoURL} className="w-10 h-10 rounded-xl border-2 border-white shadow-md" alt="" />
            <button onClick={handleSignOut} className="p-2 text-slate-300 hover:text-red-500"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
          <h2 className="text-3xl font-bold text-[#1a365d] flex items-center gap-3">
            {view === 'catalog' ? 'Libri Disponibili' : view === 'history' ? 'I miei Libri' : 'Gestione Admin'}
            {isAdmin && <ShieldCheck className="text-[#cbb26a]" />}
          </h2>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setView('catalog')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${view === 'catalog' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-slate-400'}`}>Catalogo</button>
            <button onClick={() => setView('history')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${view === 'history' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-slate-400'}`}>Miei Prestiti</button>
            {isAdmin && <button onClick={() => setView('admin')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${view === 'admin' ? 'bg-[#1a365d] text-white shadow-sm' : 'text-slate-400'}`}>Admin</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(view === 'catalog' ? availableBooks : view === 'history' ? myBooks : allRetired).map(book => (
            <div key={book.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-1 bg-[#cbb26a] rounded-full"></div>
                <Book className="text-slate-100 group-hover:text-[#cbb26a]/20 transition-colors" size={32} />
              </div>
              <h3 className="text-xl font-bold text-[#1a365d] mb-1">{book.titolo}</h3>
              <p className="text-slate-400 text-xs font-bold uppercase mb-6">{book.autore}</p>
              
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <User size={12} /> Donato da: <span className="text-[#1a365d]">{book.donatoreNome}</span>
                </div>
                {book.status === 'ritirato' && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500">
                    <Bookmark size={12} /> In lettura a: <span className="font-black">{book.presoDaNome}</span>
                  </div>
                )}
                <button onClick={() => setShowHistoryModal(book)} className="text-[9px] uppercase tracking-widest font-black text-slate-300 hover:text-[#cbb26a] flex items-center gap-1">
                  <History size={12} /> Vedi Storia
                </button>
              </div>

              <div className="mt-8 flex gap-2">
                {book.status === 'disponibile' ? (
                  <>
                    <button onClick={() => withdrawBook(book.id)} className="flex-1 bg-[#1a365d] text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-[#122641]">Prendi</button>
                    {(isAdmin || book.donatoreId === user.uid) && (
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id))} className="p-3 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    )}
                  </>
                ) : (
                  (isAdmin || book.presoDaId === user.uid) && (
                    <button onClick={() => returnBook(book.id)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-green-700">Restituisci</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <button onClick={() => setShowAddModal(true)} className="fixed bottom-20 right-8 w-16 h-16 bg-[#cbb26a] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50">
        <Plus size={32} />
      </button>

      {/* Footer Crediti Giovanni */}
      <footer className="fixed bottom-0 left-0 w-full bg-[#1a365d] text-white py-4 px-6 flex justify-between items-center z-50 border-t border-white/10 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black tracking-[0.2em] uppercase">Sistema Attivo</span>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black tracking-[0.25em] uppercase opacity-90">Progetto Sviluppato da Giovanni Rochira</p>
          <p className="text-[8px] font-bold text-[#cbb26a] uppercase tracking-widest mt-0.5">Versione 1.0 - Biblioteca Lilla</p>
        </div>
      </footer>

      {/* Modal Aggiunta */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#1a365d]/90 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-[#1a365d] mb-6">Aggiungi Libro</h2>
            <form onSubmit={addBook} className="space-y-6">
              <input required placeholder="Titolo" className="w-full px-5 py-4 bg-slate-50 rounded-xl outline-none" value={bookForm.titolo} onChange={(e) => setBookForm({...bookForm, titolo: e.target.value})} />
              <input required placeholder="Autore" className="w-full px-5 py-4 bg-slate-50 rounded-xl outline-none" value={bookForm.autore} onChange={(e) => setBookForm({...bookForm, autore: e.target.value})} />
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 font-bold text-slate-400">Annulla</button>
                <button type="submit" className="flex-1 bg-[#1a365d] text-white py-4 rounded-xl font-bold">Conferma</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Storia */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 max-h-[70vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#1a365d] mb-6">Storia del Libro</h2>
            <div className="space-y-6">
              {[...showHistoryModal.cronologia].reverse().map((step, i) => (
                <div key={i} className="border-l-2 border-slate-100 pl-4 py-1 relative">
                  <div className="absolute -left-[5px] top-2 w-2 h-2 bg-[#cbb26a] rounded-full"></div>
                  <p className="text-xs font-black text-slate-700">{step.utente}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">{step.tipo} - {new Date(step.data).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHistoryModal(null)} className="w-full mt-10 py-4 font-bold text-[#1a365d]">Chiudi</button>
          </div>
        </div>
      )}
    </div>
  );
}
