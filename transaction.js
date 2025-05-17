// Fixed transaction.js with special system transactions support
const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.timestamp = Date.now();
        this.signature = null;
    }

    calculateHash() {
        return crypto
            .createHash('sha256')
            .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
            .digest('hex');
    }

    signTransaction(signingKey) {
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('You cannot sign transactions for other wallets!');
        }

        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid() {
        // Special cases for system transactions (genesis block or network fund)
        if (this.fromAddress === null) return true;
        if (this.signature === "GENESIS" || this.signature === "SYSTEM") return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        try {
            const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
            return publicKey.verify(this.calculateHash(), this.signature);
        } catch (err) {
            console.error('Error validating transaction:', err);
            return false;
        }
    }
}

module.exports = { Transaction };