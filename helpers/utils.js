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
const memoProd = 'Here is your cut';
const memoBurn = 'Got that for you';

// redis.flushall();

const getLastProdPayment = () => redis.getAsync('last_prod_payment');

const setLastProdPayment = (date) => redis.setAsync('last_prod_payment', date);

const getLastBurnPayment = () => redis.getAsync('last_burn_payment');

const setLastBurnPayment = (hours) => redis.setAsync('last_burn_payment', hours);

const processProdPayment = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM `character` ORDER BY drug_production_rate DESC; \n\
      SELECT SUM(drug_production_rate) AS totalProd FROM `character`';
    Promise.all([
      db.queryAsync(query),
      client.database.getAccounts([username]),
    ]).then(result => {
      const totalAmount = parseFloat(result[1][0].balance) / 100 * payPercentProd;
      const totalProd = result[0][1][0].totalProd;
      const ops = [];
      result[0][0].forEach(user => {
        const amount = parseFloat(totalAmount / totalProd * user.drug_production_rate).toFixed(3);
        if (amount >= 0.001) {
          ops.push(['transfer', {
            from: username,
            to: user.name,
            amount: `${amount} STEEM`,
            memo: memoProd,
          }]);
        }
      });
      let post = null;
      if (ops.length > 0) {
        let body = 'Here is the drug production rate payroll: \n\n';
        ops.forEach((op, i) => {
          body += `${i + 1}. @${op[1].to} +${op[1].amount} \n`;
        });
        body += '\nBest';
        post = [['comment', {
          parent_author: '',
          parent_permlink: 'drugwars',
          author: username,
          permlink: `prod-pay-${new Date().getTime()}`,
          title: 'Daily drug production rate payroll',
          body,
          json_metadata: JSON.stringify({}),
        }]];
      }
      if (pay) {
        client.broadcast.sendOperations(ops, PrivateKey.fromString(privateKey)).then(result => {
          console.log('prod-pool: Broadcast transfers done', result);
          if (post) {
            client.broadcast.sendOperations(post, PrivateKey.fromString(privateKey)).then(result => {
              console.log('prod-pool: Broadcast article done', result);
              resolve();
            }).catch(err => {
              console.error('prod-pool: Broadcast article failed', err);
              reject();
            });
          }
          resolve();
        }).catch(err => {
          console.error('prod-pool: Broadcast transfers failed', err);
          reject();
        });
      } else {
        console.log('prod-pool: Payment disabled');
        resolve();
      }
    }).catch(err => {
      console.error('prod-pool: Process loading data failed', err);
      reject();
    });
  });
};

const processBurnPayment = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM heist_pool ORDER BY saved_drugs DESC; \n\
      SELECT SUM(saved_drugs) AS totalBurn FROM heist_pool';
    Promise.all([
      db.queryAsync(query),
      client.database.getAccounts([username]),
    ]).then(result => {
      const totalAmount = parseFloat(result[1][0].balance) / 100 * payPercentBurn;
      const totalBurn = result[0][1][0].totalBurn;
      const ops = [];
      result[0][0].forEach(user => {
        const amount = parseFloat(totalAmount / totalBurn * user.saved_drugs).toFixed(3);
        if (amount >= 0.001 && user.name) {
          ops.push(['transfer', {
            from: username,
            to: user.name,
            amount: `${amount} STEEM`,
            memo: memoBurn,
          }]);
        }
      });
      let post = null;
      if (ops.length > 0) {
        let body = 'Here is the burn drugs payroll: \n\n';
        ops.forEach((op, i) => {
          body += `${i + 1}. @${op[1].to} +${op[1].amount} \n`;
        });
        body += '\nBest';
        post = [['comment', {
          parent_author: '',
          parent_permlink: 'drugwars',
          author: username,
          permlink: `burn-pay-${new Date().getTime()}`,
          title: 'Daily burn drugs payroll',
          body,
          json_metadata: JSON.stringify({}),
        }]];
      }
      if (pay) {
        client.broadcast.sendOperations(ops, PrivateKey.fromString(privateKey)).then(result => {
          console.log('burn-pool: Broadcast transfers done', result);
          resolve();
        }).catch(err => {
          console.error('burn-pool: Broadcast transfers failed', err);
          reject();
        });
      } else {
        console.log('burn-pool: Payment disabled');
        resolve();
      }
    }).catch(err => {
      console.error('burn-pool: Process loading data failed', err);
      reject();
    });
  });
};

module.exports = {
  getLastProdPayment,
  setLastProdPayment,
  getLastBurnPayment,
  setLastBurnPayment,
  processProdPayment,
  processBurnPayment,
};
