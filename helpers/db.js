const mysql = require('mysql');
const Pool = require('mysql/lib/Pool');
const Connection = require('mysql/lib/Connection');
const Promise = require('bluebird');

Promise.promisifyAll([Pool, Connection]);

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  connectionLimit: 15,
  multipleStatements: true,
});

module.exports = db;
