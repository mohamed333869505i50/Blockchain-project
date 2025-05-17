const fs = require('fs');
const path = require('path');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { Wallet } = require('./wallet');
const { Transaction } = require('./transaction');

class ClientManager {
    constructor(blockchain) {
        this.clients = new Map();
        this.blockchain = blockchain;
        this.loadClients();
        // Subscribe to blockchain updates
        this.blockchain.onTransactionAdded = this.updateClientBalances.bind(this);
    }

    updateClientBalances(transaction) {
        // Update balances for both sender and receiver
        if (transaction.fromAddress) {
            const senderClient = this.clients.get(transaction.fromAddress);
            if (senderClient) {
                senderClient.balance = this.blockchain.getBalanceOfAddress(transaction.fromAddress);
            }
        }
        
        if (transaction.toAddress) {
            const receiverClient = this.clients.get(transaction.toAddress);
            if (receiverClient) {
                receiverClient.balance = this.blockchain.getBalanceOfAddress(transaction.toAddress);
            }
        }

        // Save updated balances to file
        this.saveClients();
    }

    saveClients() {
        const clientsData = Array.from(this.clients.entries()).map(([address, client]) => ({
            address,
            privateKey: client.wallet.privateKey,
            publicKey: client.wallet.publicKey,
            initialBalance: this.blockchain.getBalanceOfAddress(address), // Update with current balance
            name: client.name || ''
        }));

        const mainPath = path.join(__dirname, 'clients-data.json');
        const publicPath = path.join(__dirname, 'public', 'clients-data.json');

        fs.writeFileSync(mainPath, JSON.stringify(clientsData, null, 2));
        // انسخ الملف تلقائياً إلى public بعد كل حفظ
        try {
            fs.copyFileSync(mainPath, publicPath);
        } catch (err) {
            console.error('Failed to copy clients-data.json to public:', err.message);
        }
    }

    loadClients() {
        try {
            const data = fs.readFileSync(path.join(__dirname, 'clients-data.json'), 'utf8');
            const clientsData = JSON.parse(data);

            // قائمة الأسماء لأول 10 عملاء
            const names = ["mahmmed", "azma", "abdo", "hisham", "saber", "Eslam", "BOLBOL", "zaid", "Yousry", "Messi"];
            let unnamedIndex = 0;

            clientsData.forEach((clientData, idx) => {
                const wallet = new Wallet();
                wallet.keyPair = ec.keyFromPrivate(clientData.privateKey);
                wallet.publicKey = clientData.publicKey;
                wallet.privateKey = clientData.privateKey;

                // Get current balance from blockchain
                const currentBalance = this.blockchain.getBalanceOfAddress(clientData.address);

                // إذا لم يوجد اسم، أعطه اسم حسب الترتيب
                let name = clientData.name;
                if (!name || name === "") {
                    if (unnamedIndex < names.length) {
                        name = names[unnamedIndex];
                    } else {
                        name = `Client ${unnamedIndex + 1}`;
                    }
                    unnamedIndex++;
                }

                this.clients.set(clientData.address, {
                    wallet,
                    balance: currentBalance, // Use current balance from blockchain
                    name
                });
            });
            // حفظ التغييرات بعد التسمية
            this.saveClients();
        } catch (err) {
            console.log('No existing client data found, starting fresh');
        }
    }

    createRandomClient() {
        const wallet = new Wallet();
        const address = wallet.getAddress();
        const balance = Math.floor(Math.random() * 500) + 100;
        
        // أسماء العملاء لأول 10 فقط
        const names = ["mahmmed", "azma", "abdo", "hisham", "saber", "Eslam", "BOLBOL", "zaid", "Yousry", "Messi"];
        let name = `Client ${this.clients.size + 1}`;
        if (this.clients.size < names.length) {
            name = names[this.clients.size];
        }
        
        const networkBalance = this.blockchain.getBalanceOfAddress("network_fund");
        if (networkBalance < balance) {
            throw new Error(`Network funds insufficient: ${networkBalance} available, trying to allocate ${balance}`);
        }
        
        const fundingTx = new Transaction("network_fund", address, balance);
        fundingTx.signature = "SYSTEM";
        
        try {
            this.blockchain.addTransaction(fundingTx);
            this.clients.set(address, { wallet, balance, name });
            this.saveClients(); // Save with initial balance
            console.log(`👤 Client created: ${name} | ${address.slice(0, 12)}... | Balance: ${balance}`);
            return { wallet, address, balance, name };
        } catch (err) {
            throw new Error(`Failed to create client: ${err.message}`);
        }
    }

    createMultipleClients(count) {
        const newClients = [];
        for (let i = 0; i < count; i++) {
            try {
                newClients.push(this.createRandomClient());
            } catch (err) {
                console.log(`⛔ Failed to create client ${i+1}: ${err.message}`);
            }
        }
        return newClients;
    }

    listClients() {
        console.log('\n📋 Client List:');
        if (this.clients.size === 0) {
            console.log('No clients available');
            return;
        }
        
        this.clients.forEach((client, address) => {
            const currentBalance = this.blockchain.getBalanceOfAddress(address);
            console.log(`- Name: ${client.name} | Address: ${address.slice(0, 12)}... | Initial: ${client.balance} | Current: ${currentBalance}`);
        });
    }
}

module.exports = { ClientManager };