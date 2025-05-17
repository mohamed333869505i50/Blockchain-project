const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { Transaction } = require('./transaction');

class Wallet {
    constructor() {
        this.keyPair = ec.genKeyPair();
        this.publicKey = this.keyPair.getPublic('hex');
        this.privateKey = this.keyPair.getPrivate('hex');
        this.transactions = [];
    }

    getAddress() {
        return this.publicKey;
    }

    getBalance(blockchain) {
        return blockchain.getBalanceOfAddress(this.publicKey);
    }

    createTransaction(toAddress, amount, blockchain) {
        const currentBalance = this.getBalance(blockchain);
        
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }
        
        if (currentBalance < amount) {
            throw new Error('Insufficient funds');
        }

        const tx = new Transaction(this.publicKey, toAddress, amount);
        tx.signTransaction(this.keyPair);
        blockchain.addTransaction(tx);
        this.transactions.push(tx);
        
        return tx;
    }

    getTransactionHistory(blockchain) {
        const history = [];
        for (const block of blockchain.chain) {
            for (const tx of block.transactions) {
                if (tx.fromAddress === this.publicKey || tx.toAddress === this.publicKey) {
                    history.push({
                        type: tx.fromAddress === this.publicKey ? 'OUT' : 'IN',
                        amount: tx.amount,
                        timestamp: new Date(tx.timestamp),
                        otherAddress: tx.fromAddress === this.publicKey ? tx.toAddress : tx.fromAddress
                    });
                }
            }
        }
        return history;
    }
}

module.exports = { Wallet };