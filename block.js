const crypto = require('crypto');

class Block {
    constructor(timestamp, transactions, previousHash = '', blockNumber = 0) {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
        this.blockNumber = blockNumber;
        this.MAX_TRANSACTIONS = 10;
    }

    calculateHash() {
        return crypto
            .createHash('sha256')
            .update(
                this.previousHash +
                this.timestamp +
                JSON.stringify(this.transactions) +
                this.nonce +
                this.blockNumber
            )
            .digest('hex');
    }

    mineBlock(difficulty) {
        if (this.transactions.length > this.MAX_TRANSACTIONS) {
            throw new Error(`Block cannot contain more than ${this.MAX_TRANSACTIONS} transactions`);
        }

        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`Block #${this.blockNumber} mined: ${this.hash}`);
    }

    hasValidTransactions() {
        if (this.transactions.length > this.MAX_TRANSACTIONS) {
            return false;
        }

        for (const tx of this.transactions) {
            if (!tx.isValid()) {
                return false;
            }
        }
        return true;
    }

    getBlockInfo() {
        return {
            blockNumber: this.blockNumber,
            timestamp: this.timestamp,
            transactions: this.transactions,
            previousHash: this.previousHash,
            hash: this.hash,
            nonce: this.nonce,
            transactionCount: this.transactions.length
        };
    }
}

module.exports = { Block };