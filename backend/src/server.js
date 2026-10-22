import { setup, DB_LABEL } from './db.js';
import { initAuth } from './auth.js';
import { createApp } from './app.js';

// Connect to MongoDB, create indexes and (on first start) the admin login. Safe on every start.
await setup();
await initAuth();

const app = createApp();

// --port=NNNN wins over $PORT so the dev script never collides with the Vite port.
const argPort = process.argv.find((a) => a.startsWith('--port='))?.split('=')[1];
const PORT = argPort || process.env.PORT || 4100;
app.listen(PORT, () => console.log(`Amore API running on http://localhost:${PORT} — data in ${DB_LABEL}`));

export default app;
