const Promise = require('bluebird');
const { PrivateKey } = require('dsteem');
const redis = require('./redis');
const db = require('./db');
const client = require('./client');

const username = process.env.STEEM_USERNAME;
const privateKey = process.env.STEEM_WIF;
const pay = parseInt(process.env.PAYMENT) || 0;
const payPercentProd = parseFloat(process.env.PAYMENT_PERCENT_PROD) || 1;
const payPercentBurn = parseFloat(process.env.PAYMENT_PERCENT_BURN) || 1;
const memoProd = 'Here is your cut based on your drug production';
const memoBurn = 'Heist! We got that for you';
const maxOpsPerTx = parseFloat(process.env.MAX_OPS_PER_TX) || 2;

const getLastPayment = () => redis.getAsync('last_payment');

const setLastPayment = (date) => redis.setAsync('last_payment', date);

const insertPendingPayments = (data) => new Promise((resolve, reject) => {
  const query = 'INSERT INTO payments (username, type, amount) VALUES ?';
  db.queryAsync(query, [data]).then(result => {
    resolve(result);
  }).catch(err => {
    reject(err);
  });
});

const getPendingPayments = (totalProdPot, totalBurnPot) => new Promise((resolve, reject) => {
  const data = [];

  let query = 'SELECT * FROM users ORDER BY drug_production_rate DESC; ';
  query += 'SELECT SUM(drug_production_rate) AS totalProd FROM users; ';
  query += 'SELECT * FROM heist ORDER BY drugs DESC; ';
  query += 'SELECT SUM(drugs) AS totalBurn FROM heist; ';

  db.queryAsync(query).then(result => {
    const [users, [{ totalProd }], burns, [{ totalBurn }]] = result;

    users.forEach(user => {
      const amount = parseFloat(totalProdPot / totalProd * user.drug_production_rate).toFixed(3);
      if (amount >= 0.001) {
        data.push([user.username, 'daily', amount]);
      }
    });

    burns.forEach(burn => {
      const amount = parseFloat(totalBurnPot / totalBurn * burn.drugs).toFixed(3);
      if (amount >= 0.001) {
        data.push([burn.username, 'heist', amount]);
      }
    });

    resolve(data);
  }).catch(err => {
    reject(err);
  });
});

const storePendingPayments = () => new Promise((resolve, reject) => {
  client.database.getAccounts([username]).then(accounts => {
    const totalProdPot = parseFloat(accounts[0].balance) / 100 * payPercentProd;
    const totalBurnPot = parseFloat(accounts[0].balance) / 100 * payPercentBurn;

    getPendingPayments(totalProdPot, totalBurnPot).then(data => {
      console.log(`1: Pending payments: ${data.length}`);

      insertPendingPayments(data).then(result => {
        console.log('2: Pending payments stored on db');
        resolve();

      }).catch((err) => {
        console.error('Failed to store pending payments stored on db', err);
        reject();
      });
    }).catch((err) => {
      console.error('Failed to get pending payments', err);
      reject();
    });
  }).catch((err) => {
    console.error('Failed to load Steem account', err);
    reject();
  });
});

const processPayments = () => new Promise((resolve, reject) => {
  storePendingPayments().then((result) => {
    console.log('Process completed', result);
    // Clear heist table
    // Publish post
    resolve();
  }).catch(err => {
    console.error('Process failed', err);
    reject();
  });
});

const processQueue = () => new Promise((resolve, reject) => {
  const query = 'SELECT * FROM payments WHERE paid = ? ORDER BY id DESC LIMIT ?';
  db.queryAsync(query, [0, maxOpsPerTx]).then(payments => {

    if (payments && payments.length > 0) {
      const ops = [];
      const paymentsIds = [];

      payments.forEach(payment => {
        paymentsIds.push(payment.id);

        ops.push(['transfer', {
          from: username,
          to: payment.username,
          amount: `${payment.amount} STEEM`,
          memo: payment.type === 'daily' ? memoProd : memoBurn
        }]);
      });

      if (pay) {
        client.broadcast.sendOperations(ops, PrivateKey.fromString(privateKey)).then(result => {
          console.log('Broadcast transfers queue done', ops.length, JSON.stringify(result));

          const query = 'UPDATE payments SET tx_id = ?, paid = ? WHERE id IN ?';
          db.queryAsync(query, [result.id, 1, [paymentsIds]]).then(result => {
            console.log('Update transfer status done', JSON.stringify(result));
            resolve();

          }).catch((err) => {
            console.error('Update transfer status failed', err);
            reject(err);
          });
        }).catch((err) => {
          console.error('Broadcast transfer queue failed', JSON.stringify(ops), err);
          reject(err);
        });
      } else {
        console.log('Payment skipped, but there is payments pending', ops.length);
        resolve();
      }
    } else {
      console.log('No pending payments');
      resolve();
    }
  });
});

module.exports = {
  getLastPayment,
  setLastPayment,
  processPayments,
  processQueue,
};
