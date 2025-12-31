import { Redirect } from 'expo-router';
import { auth } from '../lib/firebase';

export default function Index() {
    return <Redirect href={auth.currentUser ? '/(tabs)/create' : '/auth/login'} />;
}

