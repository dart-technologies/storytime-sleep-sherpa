import { useEffect, useRef } from 'react';
import { validatePublicEnv } from '../lib/env';
import { useError } from './ErrorProvider';

export default function EnvValidator() {
    const { showToast } = useError();
    const didNotifyRef = useRef(false);

    useEffect(() => {
        if (didNotifyRef.current) return;
        didNotifyRef.current = true;

        const { missingRequired, missingAgentIds, misconfigured } = validatePublicEnv();

        if (missingRequired.length) {
            showToast({
                type: 'error',
                message: `Missing required env vars: ${missingRequired.join(', ')}`,
                duration: 7000,
            });
            if (missingAgentIds.length) {
                console.warn(`[Env] Voice not configured: ${missingAgentIds.join(', ')}`);
            }
            return;
        }

        if (misconfigured.length) {
            showToast({
                type: 'error',
                message: `Env config issue: ${misconfigured.join(' ')}`,
                duration: 7000,
            });
        }

        if (missingAgentIds.length) {
            showToast({
                type: 'info',
                message: `Voice not configured: ${missingAgentIds.join(', ')}`,
                duration: 7000,
            });
        }
    }, [showToast]);

    return null;
}
