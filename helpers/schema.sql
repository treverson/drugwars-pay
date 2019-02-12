CREATE TABLE payments (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(16) NOT NULL,
  type VARCHAR(16) NOT NULL,
  amount DECIMAL(24,3),
  paid INT DEFAULT 0,
  tx_id TEXT,
  PRIMARY KEY (`id`),
  KEY username (username),
  KEY paid (paid)
);
