import { useMemo } from 'react';
import electronIPC from '../services/electron-ipc.js';  // ✅ Add .js extension

export default function useElectron() {
    const api = useMemo(() => electronIPC, []);
    return api;
}