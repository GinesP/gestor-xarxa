const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gestor-xarxa.db');

db.serialize(() => {
	db.run(`CREATE TABLE IF NOT EXISTS Usuaris (
        id INTEGER PRIMARY KEY,
        nom TEXT,
        dni TEXT UNIQUE,
				ubicacio TEXT,
        departament TEXT,
				notes TEXT
    )`);
	db.run(`CREATE TABLE IF NOT EXISTS Equips (
        id INTEGER PRIMARY KEY,
        nom_host TEXT,
        ip TEXT,
				model TEXT,
        ubicacio TEXT,
				notes TEXT,
        usuari_id INTEGER,
        FOREIGN KEY (usuari_id) REFERENCES Usuaris(id)
    )`);
	db.run(`CREATE TABLE IF NOT EXISTS Recursos_Compartits (
        id INTEGER PRIMARY KEY,
        nom_recurs TEXT,
        ruta_xarxa TEXT UNIQUE,
				descripcio TEXT,
				notes TEXT
    )`);
	db.run(`CREATE TABLE IF NOT EXISTS Usuari_recurs (
        id INTEGER PRIMARY KEY,
        usuari_id INTEGER,
				recurs_id INTEGER,
				permis TEXT,
        FOREIGN KEY (usuari_id) REFERENCES Usuaris(id),
        FOREIGN KEY (recurs_id) REFERENCES Recursos_Compartits(id)
    )`);
	// ... comandos para crear otras tablas
});