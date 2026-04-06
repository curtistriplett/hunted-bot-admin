const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Database
const db = {
  bans: new Map(),
  tempBans: new Map(),
  logs: [
    { id: '1', timestamp: new Date().toLocaleString(), action: 'Banned User', user: 'ToxicPlayer', userId: '101', executor: 'Hovia', reason: 'Harassment' },
  ],
  admins: new Map([
    ['1', { id: '1', username: 'Hovia', role: 'Owner', status: 'Active' }],
  ]),
  settings: {
    maintenanceMode: false,
    userAccessEnabled: true,
    siteName: 'HUNTED BOT',
    siteDescription: 'Roblox Admin Panel',
    themeColor: 'red',
    allowRegistration: true,
    maxAdmins: 10,
    logRetention: 30,
    discordWebhook: '',
    notifyOnBan: true,
    notifyOnKick: true,
    allowedRoles: ['Owner', 'Admin', 'Mod', 'Manager', 'Tester'],
    twoFactorRequired: false
  }
};

// Get avatar from Roblox
async function getRobloxAvatar(userId) {
  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );
    const data = await response.json();
    if (data.data && data.data[0] && data.data[0].imageUrl) {
      return data.data[0].imageUrl;
    }
  } catch (e) {}
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

// Generate user
async function generateUser(username) {
  const userId = Math.abs(username.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0)) % 900000000 + 100000000;
  
  const statuses = ['Online', 'Offline', 'In Game', 'AFK'];
  const lastSeen = ['Just now', '5 min ago', '15 min ago', '1 hour ago'][Math.floor(Math.random() * 4)];
  
  return {
    id: userId.toString(),
    username: username,
    displayName: username,
    avatar: await getRobloxAvatar(userId),
    role: 'Player',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    lastSeen: lastSeen,
    robloxProfile: `https://www.roblox.com/users/${userId}/profile`,
    isBanned: db.bans.has(userId.toString()) || db.tempBans.has(userId.toString())
  };
}

// API Routes
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json({ users: [], total: 0 });
  
  const variations = [q, q + '123', q + '_Official', 'Real' + q, q + 'Gaming'];
  const users = await Promise.all(variations.map(name => generateUser(name)));
  res.json({ users, total: users.length });
});

app.get('/api/users/:id', async (req, res) => {
  const user = await generateUser('User_' + req.params.id.slice(0, 6));
  user.id = req.params.id;
  user.avatar = await getRobloxAvatar(req.params.id);
  res.json(user);
});

app.get('/api/users/:id/last-game', async (req, res) => {
  const friends = await Promise.all(
    ['Alex', 'Jordan', 'Taylor', 'Morgan'].map(name => 
      generateUser(name + '_' + Math.floor(Math.random() * 1000))
    )
  );
  res.json({ players: friends });
});

app.post('/api/users/:id/ban', (req, res) => {
  const { id } = req.params;
  const { reason, executor } = req.body;
  db.bans.set(id, { userId: id, reason: reason || 'No reason', executor: executor || 'System', timestamp: new Date().toISOString() });
  db.logs.unshift({ id: Date.now().toString(), timestamp: new Date().toLocaleString(), action: 'Banned User', user: 'User_' + id.slice(0, 8), userId: id, executor: executor || 'System', reason: reason || 'No reason' });
  res.json({ success: true, message: 'User banned' });
});

app.post('/api/users/:id/tempban', (req, res) => {
  const { id } = req.params;
  const { reason, duration, executor } = req.body;
  const durationMs = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };
  const expiry = new Date(Date.now() + (durationMs[duration] || 86400000));
  db.tempBans.set(id, { userId: id, reason, duration, expiry: expiry.toISOString(), executor: executor || 'System' });
  db.logs.unshift({ id: Date.now().toString(), timestamp: new Date().toLocaleString(), action: 'Temp Banned User', user: 'User_' + id.slice(0, 8), userId: id, executor: executor || 'System', reason: reason || 'No reason', duration });
  res.json({ success: true, message: 'User temporarily banned' });
});

app.post('/api/users/:id/kick', (req, res) => {
  const { id } = req.params;
  const { reason, executor } = req.body;
  db.logs.unshift({ id: Date.now().toString(), timestamp: new Date().toLocaleString(), action: 'Kicked User', user: 'User_' + id.slice(0, 8), userId: id, executor: executor || 'System', reason: reason || 'No reason' });
  res.json({ success: true, message: 'User kicked' });
});

app.post('/api/users/:id/unban', (req, res) => {
  const { id } = req.params;
  const { executor } = req.body;
  db.bans.delete(id);
  db.tempBans.delete(id);
  db.logs.unshift({ id: Date.now().toString(), timestamp: new Date().toLocaleString(), action: 'Unbanned User', user: 'User_' + id.slice(0, 8), userId: id, executor: executor || 'System' });
  res.json({ success: true, message: 'User unbanned' });
});

app.get('/api/logs', (req, res) => {
  const { limit = 50 } = req.query;
  res.json({ logs: db.logs.slice(0, parseInt(limit)) });
});

app.get('/api/stats', (req, res) => {
  res.json({
    onlinePlayers: Math.floor(Math.random() * 500) + 1000,
    activeBans: db.bans.size,
    tempBans: db.tempBans.size,
    newLogs: db.logs.slice(0, 5).length,
    totalPlayers: 15000 + Math.floor(Math.random() * 5000),
    robloxApiConnected: true
  });
});

app.get('/api/status', (req, res) => {
  res.json({ isOnline: true, robloxApiConnected: true, maintenanceMode: db.settings.maintenanceMode, userAccessEnabled: db.settings.userAccessEnabled });
});

app.get('/api/settings', (req, res) => res.json({ settings: db.settings }));

app.post('/api/settings', (req, res) => {
  Object.assign(db.settings, req.body);
  res.json({ success: true, settings: db.settings });
});

app.get('/api/settings/export', (req, res) => {
  res.json({ success: true, export: { settings: db.settings, admins: Array.from(db.admins.values()), bans: Array.from(db.bans.values()), exportedAt: new Date().toISOString() } });
});

app.post('/api/settings/reset', (req, res) => {
  db.settings = { maintenanceMode: false, userAccessEnabled: true, siteName: 'HUNTED BOT', siteDescription: 'Roblox Admin Panel', themeColor: 'red', allowRegistration: true, maxAdmins: 10, logRetention: 30, discordWebhook: '', notifyOnBan: true, notifyOnKick: true, allowedRoles: ['Owner', 'Admin', 'Mod', 'Manager', 'Tester'], twoFactorRequired: false };
  res.json({ success: true, settings: db.settings });
});

app.get('/api/admins', (req, res) => res.json({ admins: Array.from(db.admins.values()) }));

app.post('/api/admins', (req, res) => {
  const { username, role } = req.body;
  const id = Date.now().toString();
  db.admins.set(id, { id, username, role, status: 'Active' });
  res.json({ success: true, admin: db.admins.get(id) });
});

app.delete('/api/admins/:id', (req, res) => {
  db.admins.delete(req.params.id);
  res.json({ success: true });
});

app.get('/api/game/check-ban', (req, res) => {
  const { userId } = req.query;
  const ban = db.bans.get(userId);
  const tempBan = db.tempBans.get(userId);
  if (ban) return res.json({ banned: true, permanent: true, reason: ban.reason });
  if (tempBan && new Date(tempBan.expiry) > new Date()) return res.json({ banned: true, permanent: false, reason: tempBan.reason, expiry: tempBan.expiry });
  res.json({ banned: false });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', robloxApiConnected: true }));

// Serve static HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('HUNTED BOT Server running on port ' + PORT);
});
