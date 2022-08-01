import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, browserSessionPersistence, signInWithEmailAndPassword, signInWithRedirect} from "firebase/auth";

const config = {
    apiKey: "AIzaSyBQ9S48zYA5mHPBPgX6uidDIb7vavq-VI0",
    authDomain: "sonosa-cloud.firebaseapp.com",
    projectId: "sonosa-cloud",
    storageBucket: "sonosa-cloud.appspot.com",
    messagingSenderId: "917245496801",
    appId: "1:917245496801:web:1fb82fb6bc311ace8916a0"
};

const app = initializeApp(config);
const db = getFirestore(app);

const auth = getAuth(app);
auth.setPersistence(browserSessionPersistence);

console.log(auth);
console.log(app);
console.log(db);



export {
    app,
    auth,
    db,
}