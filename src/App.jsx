import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, 
  setDoc, getDoc, deleteDoc, arrayUnion, query, orderBy
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  Plus, Book, User, Trash2, LogOut, History, Search, Bookmark, 
  ShieldCheck, Users, LayoutDashboard, Calendar, ChevronRight, 
  Info, BookOpen, ArrowRight, CheckSquare, AlertCircle, 
  Filter, Star, MessageSquare, Clock, Globe
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


const APP_ID = 'ponzini-v3-lilla';
const ADMIN_EMAILS = ["rochiragiovanni87@gmail.com", "admin@iisslilla.it"];

// Inizializzazione
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenere, setFilterGenere] = useState('Tutti');
  const [error, setError] = useState(null);

  // Modali
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWishModal, setShowWishModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const [bookForm, setBookForm] = useState({ 
    titolo: '', autore: '', genere: 'Narrativa', isbn: '', condizione: 'Buona' 
  });

  // --- Auth Logic ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setUserData(snap.data());
            setIsRegistering(false);
          } else {
            setIsRegistering(true);
          }
        } catch (e) {
          console.error("Auth fetch error", e);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // --- Data Sync ---
  useEffect(() => {
    if (!user || isRegistering) return;

    const bRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'books');
    const unsubBooks = onSnapshot(bRef, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => setError("Connessione DB limitata (Modalità Offline)"));

    if (ADMIN_EMAILS.includes(user.email)) {
      const uRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory');
      onSnapshot(uRef, (snap) => setUsersList(snap.docs.map(d => d.data())));
    }

    const wRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'wishlist');
    onSnapshot(wRef, (snap) => setWishlist(snap.docs.map(d => d.data())));

  }, [user, isRegistering]);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // --- Actions ---
  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!bookForm.titolo || !bookForm.autore) return;
    try {
      const newBook = {
        ...bookForm,
        donatoreId: user.uid,
        donatoreNome: userData?.nome || user.displayName,
        donatoreClasse: userData?.classe || "N/A",
        dataDonazione: new Date().toISOString(),
        status: 'disponibile',
        rating: 0,
        recensioni: [],
        cronologia: [{ tipo: 'donazione', utente: user.displayName, data: new Date().toISOString() }]
      };
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'books'), newBook);
      setBookForm({ titolo: '', autore: '', genere: 'Narrativa', isbn: '', condizione: 'Buona' });
      setShowAddModal(false);
    } catch (e) { setError("Errore nel salvataggio del libro."); }
  };

  const toggleLoan = async (book) => {
    try {
      const bRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'books', book.id);
      const isRetiring = book.status === 'disponibile';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await updateDoc(bRef, {
        status: isRetiring ? 'in_prestito' : 'disponibile',
        presoDaId: isRetiring ? user.uid : null,
        presoDaNome: isRetiring ? user.displayName : null,
        dataScadenza: isRetiring ? dueDate.toISOString() : null,
        cronologia: arrayUnion({
          tipo: isRetiring ? 'prestito' : 'restituzione',
          utente: user.displayName,
          data: new Date().toISOString()
        })
      });
    } catch (e) { setError("Errore nell'operazione di prestito."); }
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = b.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || b.autore?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenere = filterGenere === 'Tutti' || b.genere === filterGenere;
      return matchesSearch && matchesGenere;
    });
  }, [books, searchTerm, filterGenere]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-900 p-8 w-full max-w-sm shadow-[8px_8px_0px_#1e293b] text-center">
        <img src="https://iisslilla.edu.it/wp-content/uploads/sites/996/lilla.png?x79845" className="h-16 mx-auto mb-6" alt="Lilla" />
        <h1 className="text-xl font-black uppercase tracking-tighter mb-6">Ponzini Library Hub</h1>
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-slate-900 text-white py-3 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-slate-700">
          <Globe size={16} /> Accedi Account Istituzionale
        </button>
      </div>
    </div>
  );

  if (isRegistering) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-900 p-8 w-full max-w-sm shadow-[8px_8px_0px_#cbb26a]">
        <h2 className="text-lg font-black uppercase mb-4 italic">Profilo Studente</h2>
        <input placeholder="CLASSE (es. 4A LING)" className="w-full border-2 border-slate-200 p-3 text-xs font-bold uppercase mb-4" value={bookForm.classe} onChange={e => setBookForm({...bookForm, classe: e.target.value})} />
        <button onClick={async () => {
          const profile = { uid: user.uid, nome: user.displayName, email: user.email, classe: bookForm.classe };
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'), profile);
          await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_directory', user.uid), profile);
          setUserData(profile);
          setIsRegistering(false);
        }} className="w-full bg-slate-900 text-white py-3 font-bold uppercase text-[10px]">Attiva Account</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-slate-900 text-[13px]">
      {/* HEADER COMPATTO */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BookOpen className="text-[#cbb26a]" size={20} />
          <span className="font-black uppercase tracking-tighter text-sm">Biblioteca Lilla</span>
        </div>
        
        <div className="flex-1 max-w-md mx-8 relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            placeholder="Cerca per titolo, autore o ISBN..." 
            className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-xs focus:ring-2 ring-slate-200"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block leading-tight">
            <div className="font-bold text-[11px]">{user.displayName}</div>
            <div className="text-[9px] text-slate-400 font-bold uppercase">{userData?.classe}</div>
          </div>
          <img src={user.photoURL} className="w-8 h-8 rounded-full border border-slate-200" alt="Avatar" />
          <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500"><LogOut size={16}/></button>
        </div>
      </nav>

      <div className="flex">
        {/* SIDEBAR MINI */}
        <aside className="w-16 md:w-56 border-r border-slate-200 min-h-[calc(100vh-3.5rem)] p-2 bg-white flex flex-col gap-1">
          <NavItem active={view === 'catalog'} icon={<LayoutDashboard size={18}/>} label="Catalogo" onClick={() => setView('catalog')} />
          <NavItem active={view === 'history'} icon={<Bookmark size={18}/>} label="I miei prestiti" onClick={() => setView('history')} />
          <NavItem active={view === 'wishlist'} icon={<Star size={18}/>} label="Desiderata" onClick={() => setView('wishlist')} />
          
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="px-3 text-[9px] font-black text-slate-400 uppercase mb-2 hidden md:block">Amministrazione</p>
              <NavItem active={view === 'admin'} icon={<ShieldCheck size={18}/>} label="Dashboard" onClick={() => setView('admin')} />
              <NavItem active={view === 'users'} icon={<Users size={18}/>} label="Utenti" onClick={() => setView('users')} />
            </div>
          )}
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-6">
          {view === 'catalog' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight italic">Esplora Volumi</h2>
                  <p className="text-slate-400 text-xs">Sfoglia tra i {books.length} titoli disponibili nel Ponzini Hub.</p>
                </div>
                <div className="flex gap-2">
                   <select 
                    className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs font-bold"
                    value={filterGenere}
                    onChange={e => setFilterGenere(e.target.value)}
                   >
                     <option>Tutti</option>
                     <option>Narrativa</option>
                     <option>Saggistica</option>
                     <option>Classici</option>
                     <option>Scientifico</option>
                   </select>
                   <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 hover:bg-[#cbb26a] transition-colors">
                     <Plus size={14} /> Dona
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredBooks.map(book => (
                  <div key={book.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow group relative">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${book.status === 'disponibile' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {book.status === 'disponibile' ? 'Libero' : 'In Prestito'}
                      </span>
                      <span className="text-slate-300 text-[10px] font-mono">{book.isbn || 'NO-ISBN'}</span>
                    </div>
                    <h3 className="font-bold text-sm leading-tight mb-1 group-hover:text-[#cbb26a] transition-colors cursor-pointer">{book.titolo}</h3>
                    <p className="text-slate-500 text-xs mb-3 italic">{book.autore}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-4 text-slate-400 font-medium">
                      <div className="flex items-center gap-1"><Book size={10}/> {book.genere}</div>
                      <div className="flex items-center gap-1"><Clock size={10}/> {book.condizione}</div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex -space-x-2">
                        {book.cronologia?.slice(-3).map((c, i) => (
                           <div key={i} className="w-5 h-5 bg-slate-100 border border-white rounded-full flex items-center justify-center text-[8px] font-bold" title={c.utente}>
                             {c.utente?.charAt(0)}
                           </div>
                        ))}
                      </div>
                      
                      {book.status === 'disponibile' ? (
                        <button onClick={() => toggleLoan(book)} className="bg-slate-900 text-white px-3 py-1.5 rounded text-[10px] font-bold">Prenota</button>
                      ) : (
                        (isAdmin || book.presoDaId === user.uid) && (
                          <button onClick={() => toggleLoan(book)} className="bg-green-600 text-white px-3 py-1.5 rounded text-[10px] font-bold">Restituisci</button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'admin' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Libri Totali" value={books.length} icon={<Book size={20}/>} color="blue" />
                <StatCard label="Prestiti Attivi" value={books.filter(b => b.status === 'in_prestito').length} icon={<Clock size={20}/>} color="orange" />
                <StatCard label="Utenti Registrati" value={usersList.length} icon={<Users size={20}/>} color="green" />
                <StatCard label="Wishlist" value={wishlist.length} icon={<Star size={20}/>} color="yellow" />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="font-black uppercase mb-4 text-sm italic">Prestiti in Scadenza / Irregolari</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                        <th className="py-3 px-2">Volume</th>
                        <th className="py-3 px-2">Utente</th>
                        <th className="py-3 px-2">Data Scadenza</th>
                        <th className="py-3 px-2">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.filter(b => b.status === 'in_prestito').map(b => (
                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 font-bold">{b.titolo}</td>
                          <td className="py-3 px-2">{b.presoDaNome}</td>
                          <td className="py-3 px-2">{new Date(b.dataScadenza).toLocaleDateString()}</td>
                          <td className="py-3 px-2">
                             <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">In Corso</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="text-lg font-black uppercase italic mb-6">Il mio archivio</h2>
              {books.filter(b => b.presoDaId === user.uid).map(b => (
                <div key={b.id} className="bg-white border-2 border-slate-900 p-4 flex justify-between items-center shadow-[4px_4px_0px_#f1f5f9]">
                  <div>
                    <h4 className="font-bold">{b.titolo}</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-black">Scade il: {new Date(b.dataScadenza).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => toggleLoan(b)} className="bg-green-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest">Restituisci</button>
                </div>
              ))}
              {books.filter(b => b.presoDaId === user.uid).length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <BookOpen className="mx-auto text-slate-300 mb-4" size={40} />
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Nessun prestito attivo al momento.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODALE AGGIUNTA LIBRO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-[100]">
          <div className="bg-white border-2 border-slate-900 w-full max-w-lg shadow-[12px_12px_0px_#cbb26a] overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-xs tracking-widest">Registra Donazione</h3>
              <button onClick={() => setShowAddModal(false)} className="hover:text-[#cbb26a]"><Trash2 size={16}/></button>
            </div>
            <form onSubmit={handleAddBook} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase">Titolo Volume</label>
                <input required className="w-full border-b-2 border-slate-100 p-2 text-xs font-bold focus:border-slate-900 outline-none" value={bookForm.titolo} onChange={e => setBookForm({...bookForm, titolo: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Autore</label>
                <input required className="w-full border-b-2 border-slate-100 p-2 text-xs font-bold focus:border-slate-900 outline-none" value={bookForm.autore} onChange={e => setBookForm({...bookForm, autore: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Genere</label>
                <select className="w-full border-b-2 border-slate-100 p-2 text-xs font-bold focus:border-slate-900 outline-none" value={bookForm.genere} onChange={e => setBookForm({...bookForm, genere: e.target.value})}>
                  <option>Narrativa</option><option>Classici</option><option>Saggistica</option><option>Scientifico</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">ISBN (Opzionale)</label>
                <input className="w-full border-b-2 border-slate-100 p-2 text-xs font-bold focus:border-slate-900 outline-none" value={bookForm.isbn} onChange={e => setBookForm({...bookForm, isbn: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Condizioni</label>
                <select className="w-full border-b-2 border-slate-100 p-2 text-xs font-bold focus:border-slate-900 outline-none" value={bookForm.condizione} onChange={e => setBookForm({...bookForm, condizione: e.target.value})}>
                  <option>Nuovo</option><option>Buona</option><option>Usurato</option>
                </select>
              </div>
              <button type="submit" className="col-span-2 mt-4 bg-slate-900 text-white py-3 font-black uppercase text-[10px] tracking-widest hover:bg-[#cbb26a] hover:text-slate-900 transition-colors">Conferma Donazione</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Componenti UI Riutilizzabili ---
function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
      <span className={active ? 'text-[#cbb26a]' : 'group-hover:text-slate-900'}>{icon}</span>
      <span className="hidden md:block font-bold text-[11px] uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100'
  };
  return (
    <div className={`p-4 border rounded-lg ${colors[color]} flex items-center justify-between`}>
      <div>
        <p className="text-[9px] font-black uppercase opacity-60 mb-1">{label}</p>
        <p className="text-2xl font-black leading-none tracking-tighter">{value}</p>
      </div>
      {icon}
    </div>
  );
}
