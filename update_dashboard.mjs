import fs from 'fs';

let content = fs.readFileSync('website/app/dashboard/page.tsx', 'utf-8');

// 1. Add imports
content = content.replace(
  "import { onAuthStateChanged, signOut, User } from 'firebase/auth';",
  "import { onAuthStateChanged, signOut, User } from 'firebase/auth';\nimport { db } from '@/lib/firebaseClient';\nimport { collection, doc, onSnapshot } from 'firebase/firestore';"
);

// 2. Add commandStartTime state
content = content.replace(
  "const [refreshing, setRefreshing] = useState(false);",
  "const [commandStartTime, setCommandStartTime] = useState<number>(0);\n  const [refreshing, setRefreshing] = useState(false);"
);

// 3. Replace fetchData and the polling useEffects
const oldCodeStart = "  const fetchData = useCallback(async (currentUser: User, currentActiveCmd: string | null) => {";
const oldCodeEnd = "  }, [user, isCommandPending, activeCmd, fetchData]);";

const startIndex = content.indexOf(oldCodeStart);
const endIndex = content.indexOf(oldCodeEnd) + oldCodeEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = `
  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user || !db) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDeviceLinked(!!data?.fcmToken);
      }
    }, (error) => {
      console.error('Snapshot error (Check Firestore Rules!):', error);
      if (error.code === 'permission-denied') {
        setFeedback({ type: 'error', text: 'Database Access Denied: Please update Firebase Firestore Rules to allow client reads.' });
      }
    });

    const unsubResults = onSnapshot(collection(db, 'users', user.uid, 'results'), (snapshot) => {
      const newResults: Record<string, any> = {};
      snapshot.forEach(d => { newResults[d.id] = d.data(); });
      setResults(newResults);
      localStorage.setItem('veto_results', JSON.stringify(newResults));
    });

    const unsubPhotos = onSnapshot(collection(db, 'users', user.uid, 'photos'), (snapshot) => {
      const newPhotos: Record<string, any> = {};
      snapshot.forEach(d => { newPhotos[d.id] = d.data(); });
      setPhotos(newPhotos);
      localStorage.setItem('veto_photos', JSON.stringify(newPhotos));
    });

    return () => {
      unsubUser();
      unsubResults();
      unsubPhotos();
    };
  }, [user]);

  // Watch for command completion
  useEffect(() => {
    if (!activeCmd || !isCommandPending) return;
    const baseCmd = activeCmd.split(' ')[0];
    const res = results[baseCmd];
    const phto = photos[baseCmd];
    
    // Check if result OR photo is newer than command start time
    const resIsNew = res && new Date(res.timestamp).getTime() > commandStartTime;
    const photoIsNew = phto && new Date(phto.timestamp).getTime() > commandStartTime;
    
    if (resIsNew || photoIsNew) {
      setIsCommandPending(false);
      setActiveCmd(null);
      setFeedback({ type: 'success', text: 'Data updated instantly! ✨' });
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [results, photos, activeCmd, isCommandPending, commandStartTime]);

  // Initial fetch when auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);`;

  content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
} else {
  console.log("Could not find bounds to replace.");
}

// 4. Update sendCommand to set commandStartTime
content = content.replace(
  "setIsCommandPending(true);",
  "setIsCommandPending(true);\n    setCommandStartTime(Date.now());"
);

// 5. Remove handleRefresh button from UI
content = content.replace(
  /<button onClick=\{handleRefresh\}[\s\S]*?<\/button>/,
  ""
);

// 6. Remove handleRefresh function
const refreshFuncStart = "  const handleRefresh = async () => {";
const refreshFuncEnd = "    setTimeout(() => setFeedback(null), 3000);\n  };";
const rs = content.indexOf(refreshFuncStart);
const re = content.indexOf(refreshFuncEnd) + refreshFuncEnd.length;
if (rs !== -1 && re !== -1) {
  content = content.substring(0, rs) + content.substring(re);
}

fs.writeFileSync('website/app/dashboard/page.tsx', content);
console.log("Success");
