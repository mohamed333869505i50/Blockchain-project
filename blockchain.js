const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transaction } = require('./transaction');
const { Block } = require('./block');

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.pendingTransactions = [];
        this.difficulty = 3;
        this.miners = new Map();
        this.networkFund = 1000000;
        this.miningRewards = new Map();
        this.onTransactionAdded = null; // Callback for transaction notifications
        this.loadChain();
    }

    saveChain() {
        const chainData = {
            chain: this.chain.map(block => ({
                timestamp: block.timestamp,
                transactions: block.transactions,
                previousHash: block.previousHash,
                hash: block.hash,
                nonce: block.nonce
            })),
            pendingTransactions: this.pendingTransactions,
            miners: Array.from(this.miners.entries()),
            miningRewards: Array.from(this.miningRewards.entries())
        };

        fs.writeFileSync(
            path.join(__dirname, 'chain-data.json'),
            JSON.stringify(chainData, null, 2)
        );
    }

    loadChain() {
        try {
            const data = fs.readFileSync(path.join(__dirname, 'chain-data.json'), 'utf8');
            const chainData = JSON.parse(data);

            this.chain = chainData.chain.map((blockData, index) => {
                const block = new Block(
                    blockData.timestamp,
                    blockData.transactions.map(txData => {
                        const tx = new Transaction(txData.fromAddress, txData.toAddress, txData.amount);
                        tx.timestamp = txData.timestamp;
                        tx.signature = txData.signature;
                        return tx;
                    }),
                    blockData.previousHash,
                    blockData.blockNumber !== undefined ? blockData.blockNumber : index
                );
                block.hash = blockData.hash;
                block.nonce = blockData.nonce;
                block.blockNumber = blockData.blockNumber !== undefined ? blockData.blockNumber : index;
                return block;
            });

            this.pendingTransactions = chainData.pendingTransactions.map(txData => {
                const tx = new Transaction(txData.fromAddress, txData.toAddress, txData.amount);
                tx.timestamp = txData.timestamp;
                tx.signature = txData.signature;
                return tx;
            });

            this.miners = new Map(chainData.miners);

            if (chainData.miningRewards) {
                this.miningRewards = new Map(chainData.miningRewards);
            }
        } catch (err) {
            console.log('No existing chain data found, starting fresh');
        }
    }

    createGenesisBlock() {
        const genesis = new Block(Date.now(), [], "0", 0);
        const initialTx = new Transaction(null, "network_fund", this.networkFund);
        initialTx.signature = "GENESIS";
        genesis.transactions.push(initialTx);
        return genesis;
    }


    registerMiner(minerAddress, power = 1) {
        this.miners.set(minerAddress, { power, active: true, balance: 0 });
        console.log(`✅ Miner registered: ${minerAddress.slice(0, 12)}... (Power: ${power})`);
    }

    selectRandomMiner() {
        if (this.miners.size === 0) {
            return null;
        }
        
        const minersList = [];
        let totalPower = 0;
        
        for (const [address, minerInfo] of this.miners.entries()) {
            if (minerInfo.active) {
                minersList.push({
                    address,
                    power: minerInfo.power
                });
                totalPower += minerInfo.power;
            }
        }
        
        if (minersList.length === 0) {
            return null;
        }
        
        let random = Math.random() * totalPower;
        for (const miner of minersList) {
            random -= miner.power;
            if (random <= 0) {
                return miner.address;
            }
        }
        
        return minersList[minersList.length - 1].address;
    }

    getMiningRewards(address) {
        return this.miningRewards.get(address) || 0;
    }

    minePendingTransactions(minerAddress) {
        const selectedMinerAddress = minerAddress || this.selectRandomMiner();
        
        if (!selectedMinerAddress) {
            throw new Error('⛔ No miners available');
        }
        
        if (!this.miners.has(selectedMinerAddress)) {
            throw new Error('⛔ Miner not registered');
        }

        const minerInfo = this.miners.get(selectedMinerAddress);
        const currentRewards = this.getMiningRewards(selectedMinerAddress);
        
        const transactionFees = this.pendingTransactions.reduce((sum, tx) => {
            if (tx.fromAddress !== null && tx.signature !== "SYSTEM" && tx.signature !== "GENESIS") {
                return sum + Math.floor(tx.amount * 0.01);
            }
            return sum;
        }, 0);

        const reward = Math.min(transactionFees, 50);

        const rewardTx = new Transaction(null, selectedMinerAddress, reward);
        this.pendingTransactions.unshift(rewardTx);

        if (this.onTransactionAdded) {
            this.onTransactionAdded(rewardTx);
        }

        const blockNumber = this.chain.length;
        const block = new Block(
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash,
            blockNumber
        );

        block.mineBlock(this.difficulty);
        this.chain.push(block);
        
        this.miningRewards.set(selectedMinerAddress, currentRewards + reward);
        
        this.pendingTransactions = [];
        this.saveChain();
        
        console.log(`⛏️ Block #${blockNumber} mined by ${selectedMinerAddress.slice(0, 12)}...`);
        console.log(`💰 Previous mining rewards: ${currentRewards} coins`);
        console.log(`💰 Mining reward: ${reward} coins`);
        console.log(`💰 Total mining rewards: ${currentRewards + reward} coins`);
        return block;
    }


    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    getBalanceOfAddress(address) {
        let balance = 0;
        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }
                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }
        return balance;
    }

    addTransaction(transaction) {
        if (transaction.fromAddress === null || transaction.signature === "GENESIS") {
            this.pendingTransactions.push(transaction);
            this.saveChain();
            if (this.onTransactionAdded) {
                this.onTransactionAdded(transaction);
            }
            return;
        }
        
        if (!transaction.isValid()) {
            throw new Error('Invalid transaction');
        }
        
        const senderBalance = this.getBalanceOfAddress(transaction.fromAddress);
        if (transaction.fromAddress !== null && senderBalance < transaction.amount) {
            throw new Error(`Insufficient balance: Sender has ${senderBalance}, trying to send ${transaction.amount}`);
        }
        
        this.pendingTransactions.push(transaction);
        
        if (this.onTransactionAdded) {
            this.onTransactionAdded(transaction);
        }
        
        if (this.pendingTransactions.length >= 10) {
            this.minePendingTransactions(null);
        }
        
        this.saveChain();
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const current = this.chain[i];
            const previous = this.chain[i - 1];

            if (current.hash !== current.calculateHash()) {
                return false;
            }

            if (current.previousHash !== previous.hash) {
                return false;
            }
        }
        return true;
    }

    getPendingTransactionsInfo() {
        return this.pendingTransactions.map((tx, index) => ({
            index: index + 1,
            from: tx.fromAddress ? tx.fromAddress.slice(0, 12) + '...' : 'SYSTEM',
            to: tx.toAddress.slice(0, 12) + '...',
            amount: tx.amount,
            timestamp: tx.timestamp,
            type: tx.fromAddress === null ? 'MINING_REWARD' : 
                  tx.signature === "SYSTEM" ? 'SYSTEM' : 
                  tx.signature === "GENESIS" ? 'GENESIS' : 'REGULAR'
        }));
    }

    getPendingTransactionsCount() {
        return this.pendingTransactions.length;
    }

    getBlocksList() {
        return this.chain.map((block, index) => ({
            blockNumber: block.blockNumber !== undefined ? block.blockNumber : index,
            timestamp: block.timestamp,
            transactions: block.transactions.length,
            previousHash: block.previousHash.slice(0, 12) + '...',
            hash: block.hash.slice(0, 12) + '...',
            miner: block.transactions[0]?.toAddress || 'N/A'
        }));
    }
}

module.exports = { Blockchain };