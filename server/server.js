const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DB_PATH = './db/gestor-xarxa.db';

// --- Configuració del Middleware ---
// Permet que Express parse les peticions JSON
app.use(bodyParser.json());
// Opcional: Configuració bàsica de CORS si faràs servir un frontend separat
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
	next();
});

// --- Connexió i Creació de Taules SQLite ---
const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		console.error('Error al obrir la base de dades:', err.message);
	} else {
		console.log('Connectat a la base de dades SQLite: ' + DB_PATH);

		// Executar les sentències de creació de taules
		db.serialize(() => {
			// 1. Usuaris
			db.run(`CREATE TABLE IF NOT EXISTS Usuaris (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nom TEXT,
				dni TEXT UNIQUE,
				ubicacio TEXT,
				departament TEXT,
				grups TEXT,
				notes TEXT,
				estat TEXT DEFAULT 'actiu' -- Canviat a 'estat'
		)`);

			// 2. Equips
			db.run(`CREATE TABLE IF NOT EXISTS Equips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_equip TEXT UNIQUE, -- Canviat a 'nom_equip'
    ip TEXT,
    model TEXT,
    ubicacio TEXT,
    notes TEXT,
    usuari_id INTEGER,
    estat TEXT DEFAULT 'actiu', -- Canviat a 'estat'
    FOREIGN KEY (usuari_id) REFERENCES Usuaris(id)
)`);

			// 3. Impressores
			db.run(`CREATE TABLE IF NOT EXISTS Impressores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_impressora TEXT UNIQUE NOT NULL, -- Canviat a 'nom_impressora'
    model TEXT,
    ubicacio TEXT,
    ip TEXT UNIQUE,
    estat TEXT DEFAULT 'actiu' -- Canviat a 'estat'
)`);

			// 4. Recursos Compartits (Unitats de xarxa/Carpetes)
			db.run(`CREATE TABLE IF NOT EXISTS Recursos_Compartits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_recurs TEXT UNIQUE,
    ruta_xarxa TEXT UNIQUE,
    descripcio TEXT,
    notes TEXT
)`);

			// 5. Taula de Relació Molts a Molts: Usuari <-> Recurs
			db.run(`CREATE TABLE IF NOT EXISTS Usuari_recurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuari_id INTEGER,
    recurs_id INTEGER,
    permis TEXT,
    FOREIGN KEY (usuari_id) REFERENCES Usuaris(id),
    FOREIGN KEY (recurs_id) REFERENCES Recursos_Compartits(id)
)`);

			console.log('Tablas inicializadas o ya existentes.');
		});
	}
});

// -----------------------------------------------------------------
// --- ENDPOINTS DE LA API REST (CRUD) ---
// -----------------------------------------------------------------

// POST: Crear nou Usuari
app.post('/api/usuaris', (req, res) => {
	const { nom, dni, ubicacio, departament, grups, notes } = req.body;
	const sql = 'INSERT INTO Usuaris (nom, dni, ubicacio, departament, grups, notes) VALUES (?, ?, ?, ?, ?, ?)';
	db.run(sql, [nom, dni, ubicacio, departament, grups, notes], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": { id: this.lastID, ...req.body, estat: 'actiu' } });
	});
});

// GET: Obtenir Usuaris ACTIUS
app.get('/api/usuaris', (req, res) => {
	const sql = "SELECT * FROM Usuaris WHERE estat = 'actiu'"; // Utilitza 'estat'
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// GET: Obtenir Usuaris en HISTÒRIC
app.get('/api/usuaris/historic', (req, res) => {
	const sql = "SELECT * FROM Usuaris WHERE estat = 'historic'"; // Utilitza 'estat'
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// POST: Moure a HISTÒRIC o Restaurar (Lògica unificada)
app.post('/api/usuaris/:id/:accio', (req, res) => {
	const accio = req.params.accio;
	const nouEstat = accio === 'historic' ? 'historic' : (accio === 'restaurar' ? 'actiu' : null);

	if (!nouEstat) return res.status(400).json({ "error": "Acció no vàlida. Utilitza 'historic' o 'restaurar'." });

	const sql = "UPDATE Usuaris SET estat = ? WHERE id = ?"; // Utilitza 'estat'
	db.run(sql, [nouEstat, req.params.id], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		if (this.changes === 0) return res.status(404).json({ "message": `Usuari ${req.params.id} no trobat.` });
		res.json({ "message": `Usuari ${req.params.id} actualitzat a estat: ${nouEstat}`, "changes": this.changes });
	});
});

// POST: Crear nou Equip
app.post('/api/equips', (req, res) => {
	const { nom_equip, ip, model, ubicacio, notes, usuari_id } = req.body; // Utilitza 'nom_equip'
	const sql = 'INSERT INTO Equips (nom_equip, ip, model, ubicacio, notes, usuari_id) VALUES (?, ?, ?, ?, ?, ?)';
	db.run(sql, [nom_equip, ip, model, ubicacio, notes, usuari_id], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": { id: this.lastID, ...req.body, estat: 'actiu' } });
	});
});

// GET: Obtenir Equips ACTIUS (amb nom d'usuari)
app.get('/api/equips', (req, res) => {
	const sql = `
        SELECT e.*, u.nom AS nom_usuari 
        FROM Equips e 
        LEFT JOIN Usuaris u ON e.usuari_id = u.id
        WHERE e.estat = 'actiu' -- Utilitza 'estat'
    `;
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// GET: Obtenir Equips en HISTÒRIC
app.get('/api/equips/historic', (req, res) => {
	const sql = "SELECT * FROM Equips WHERE estat = 'historic'"; // Utilitza 'estat'
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// POST: Moure a HISTÒRIC o Restaurar (Lògica unificada)
app.post('/api/equips/:id/:accio', (req, res) => {
	const accio = req.params.accio;
	const nouEstat = accio === 'historic' ? 'historic' : (accio === 'restaurar' ? 'actiu' : null);

	if (!nouEstat) return res.status(400).json({ "error": "Acció no vàlida." });

	const sql = "UPDATE Equips SET estat = ? WHERE id = ?"; // Utilitza 'estat'
	db.run(sql, [nouEstat, req.params.id], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		if (this.changes === 0) return res.status(404).json({ "message": `Equip ${req.params.id} no trobat.` });
		res.json({ "message": `Equip ${req.params.id} actualitzat a estat: ${nouEstat}`, "changes": this.changes });
	});
});

// POST: Crear nova Impressora
app.post('/api/impressores', (req, res) => {
	const { nom_impressora, model, ubicacio, ip } = req.body; // Utilitza 'nom_impressora'
	const sql = 'INSERT INTO Impressores (nom_impressora, model, ubicacio, ip) VALUES (?, ?, ?, ?)';
	db.run(sql, [nom_impressora, model, ubicacio, ip], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": { id: this.lastID, ...req.body, estat: 'actiu' } });
	});
});

// GET: Obtenir Impressores ACTIVES
app.get('/api/impressores', (req, res) => {
	const sql = "SELECT * FROM Impressores WHERE estat = 'actiu'"; // Utilitza 'estat'
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// GET: Obtenir Impressores en HISTÒRIC
app.get('/api/impressores/historic', (req, res) => {
	const sql = "SELECT * FROM Impressores WHERE estat = 'historic'"; // Utilitza 'estat'
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// POST: Moure a HISTÒRIC o Restaurar (Lògica unificada)
app.post('/api/impressores/:id/:accio', (req, res) => {
	const accio = req.params.accio;
	const nouEstat = accio === 'historic' ? 'historic' : (accio === 'restaurar' ? 'actiu' : null);

	if (!nouEstat) return res.status(400).json({ "error": "Acció no vàlida." });

	const sql = "UPDATE Impressores SET estat = ? WHERE id = ?"; // Utilitza 'estat'
	db.run(sql, [nouEstat, req.params.id], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		if (this.changes === 0) return res.status(404).json({ "message": `Impressora ${req.params.id} no trobada.` });
		res.json({ "message": `Impressora ${req.params.id} actualitzada a estat: ${nouEstat}`, "changes": this.changes });
	});
});

// POST: Crear nou Recurs Compartit
app.post('/api/recursos', (req, res) => {
	const { nom_recurs, ruta_xarxa, descripcio, notes } = req.body;
	const sql = 'INSERT INTO Recursos_Compartits (nom_recurs, ruta_xarxa, descripcio, notes) VALUES (?, ?, ?, ?)';
	db.run(sql, [nom_recurs, ruta_xarxa, descripcio, notes], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": { id: this.lastID, ...req.body } });
	});
});

// GET: Obtenir tots els Recursos Compartits
app.get('/api/recursos', (req, res) => {
	const sql = 'SELECT * FROM Recursos_Compartits';
	db.all(sql, (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// POST: Assignar un Recurs a un Usuari (Crear relació)
app.post('/api/assignar_recurs', (req, res) => {
	const { usuari_id, recurs_id, permis } = req.body;
	if (!usuari_id || !recurs_id) return res.status(400).json({ "error": "Falten IDs d'usuari i recurs." });

	const sql = 'INSERT INTO Usuari_recurs (usuari_id, recurs_id, permis) VALUES (?, ?, ?)';
	db.run(sql, [usuari_id, recurs_id, permis], function (err) {
		if (err) return res.status(400).json({ "error": "Error d'assignació (potser la relació ja existeix): " + err.message });
		res.json({ "message": "Recurs assignat amb èxit", "data": req.body });
	});
});

// DELETE: Revocar l'assignació d'un recurs a un usuari
app.delete('/api/revocar_recurs', (req, res) => {
	const { usuari_id, recurs_id } = req.body;
	if (!usuari_id || !recurs_id) return res.status(400).json({ "error": "Falten IDs d'usuari i recurs." });

	const sql = 'DELETE FROM Usuari_recurs WHERE usuari_id = ? AND recurs_id = ?';
	db.run(sql, [usuari_id, recurs_id], function (err) {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "Assignació revocada", "changes": this.changes });
	});
});

// GET: Obtenir tots els recursos assignats a un usuari específic
app.get('/api/usuaris/:usuari_id/recursos', (req, res) => {
	const { usuari_id } = req.params;

	const sql = `
        SELECT 
            r.nom_recurs, 
            r.ruta_xarxa, 
            ur.permis,
            ur.id AS assignacio_id
        FROM Recursos_Compartits r
        JOIN Usuari_recurs ur ON r.id = ur.recurs_id
        WHERE ur.usuari_id = ?
    `;

	db.all(sql, [usuari_id], (err, rows) => {
		if (err) return res.status(400).json({ "error": err.message });
		res.json({ "message": "success", "data": rows });
	});
});

// -----------------------------------------------------------------

// Endpoint per verificar que el servidor està funcionant
app.get('/', (req, res) => {
	res.send('Servidor de Gestió de Xarxa Local funcionant.');
});

// Iniciar el servidor
app.listen(PORT, () => {
	console.log(`Servidor Node.js escoltant a http://localhost:${PORT}`);
});

// Tanca la connexió a la base de dades al finalitzar (opcional, però bona pràctica)
process.on('SIGINT', () => {
	db.close((err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connexió a SQLite tancada.');
		process.exit(0);
	});
});