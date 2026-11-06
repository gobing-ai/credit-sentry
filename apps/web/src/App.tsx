import type { Planet } from '@credit-sentry/api';
import { useEffect, useState } from 'react';
import { orpc } from './orpc';

export function App() {
    const [planets, setPlanets] = useState<Planet[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        orpc.list({}, { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) {
                    setPlanets(data);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : 'Failed to load planets');
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, []);

    if (loading) return <main>Loading planets…</main>;
    if (error) return <main>Error: {error}</main>;

    return (
        <main>
            <h1>Planets</h1>
            <ul>
                {planets.map((p) => (
                    <li key={p.id}>
                        {p.name}
                        {p.description && ` — ${p.description}`}
                    </li>
                ))}
            </ul>
        </main>
    );
}
