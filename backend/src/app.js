import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { connect, DB_LABEL } from './db.js';
import { identify } from './auth.js';
import orders from './routes/orders.js';
import menu from './routes/menu.js';
import images from './routes/images.js';
import admin from './routes/admin.js';
import customerAuth from './routes/auth.js';
import users from './routes/users.js';
import employees from './routes/employees.js';
import gallery from './routes/gallery.js';
import activity from './routes/activity.js';
import parlours from './routes/parlours.js';
import riders from './routes/riders.js';
import rider from './routes/rider.js';
import riderCash from './routes/riderCash.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', identify); // works out who is calling; each route decides what they may do
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); // routes that can be cached say so themselves
    next();
  });

  app.get('/api/health', async (req, res) => {
    await (await connect()).command({ ping: 1 });
    res.json({ ok: true, database: DB_LABEL });
  });
  app.use('/api/auth', customerAuth);
  app.use('/api/admin/users', users);
  app.use('/api/admin', admin);
  app.use('/api/employees', employees);
  app.use('/api/gallery', gallery);
  app.use('/api/activity', activity);
  app.use('/api/parlours', parlours);
  app.use('/api/riders', riders);
  app.use('/api/rider', rider);
  app.use('/api/rider-cash', riderCash);
  app.use('/api/orders', orders);
  app.use('/api/menu', menu);
  app.use('/api/images', images);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built website (npm run build) so `npm start` runs the whole site from one program.
  // On Vercel the frontend is served on its own and only /api reaches this backend.
  const dist = path.resolve(import.meta.dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(
      express.static(dist, {
        setHeaders: (res, file) => {
          const hashed = file.includes(`${path.sep}assets${path.sep}`);
          res.set('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      })
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message,
      ...(err.extra || {}),
    });
  });

  return app;
}
