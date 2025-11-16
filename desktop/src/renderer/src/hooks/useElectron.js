import { useMemo } from 'react';
import electronIPC from '../services/electron-ipc';

export default function useElectron() {
    // In case we want to memoize / extend later
    const api = useMemo(() => electronIPC, []);
    return api;
}