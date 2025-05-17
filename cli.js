const readline = require('readline');

class CLI {
    constructor(blockchain, minerManager, clientManager) {
        this.blockchain = blockchain;
        this.minerManager = minerManager;
        this.clientManager = clientManager;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    start() {
        console.log('\n🚀 CryptoCoin System Started\n');
        this.showMenu();
    }

    showMenu() {
        console.log('1. 🏷️ List all miners');
        console.log('2. 👤 List all clients');
        console.log('3. ⛏️ Mine a block');
        console.log('4. 💸 Create new client');
        console.log('5. 🔄 Send transaction');
        console.log('6. 📊 Check balance');
        console.log('7. 🚪 Exit');
        console.log('8. 💰 Show miners mining rewards');
        console.log('9. 📦 Show blocks list');
        console.log('10. ⏳ Show pending transactions');
        console.log('11. ⛏️ Create new miner');

        this.rl.question('\nChoose an option: ', (answer) => {
            switch (answer) {
                case '1':
                    this.listMiners();
                    break;
                case '2':
                    this.listClients();
                    break;
                case '3':
                    this.mineBlock();
                    break;
                case '4':
                    this.createClient();
                    break;
                case '5':
                    this.sendTransaction();
                    break;
                case '6':
                    this.checkBalance();
                    break;
                case '7':
                    this.exit();
                    break;
                case '8':
                    this.showMinersBalances();
                    break;
                case '9':
                    this.showBlocksList();
                    break;
                case '10':
                    this.showPendingTransactions();
                    break;
                case '11':
                    this.createMiner();
                    break;
                default:
                    console.log('Invalid option');
                    this.showMenu();
            }
        });
    }

    listMiners() {
        console.log('\n⛏️ Miners List:');
        this.minerManager.miners.forEach((miner, index) => {
            const rewards = this.blockchain.getMiningRewards(miner.address);
            console.log(`${index + 1}. Name: ${miner.name} | Address: ${miner.address.slice(0, 12)}... | Power: ${miner.power} | Port: ${miner.port} | Mining Rewards: ${rewards} coins`);
        });
        this.showMenu();
    }

    listClients() {
        this.clientManager.listClients();
        this.showMenu();
    }

    mineBlock() {
        if (this.minerManager.miners.length === 0) {
            console.log('⛔ No miners available');
            return this.showMenu();
        }

        const pendingCount = this.blockchain.getPendingTransactionsCount();
        if (pendingCount === 0) {
            console.log('⛔ No pending transactions to mine');
            return this.showMenu();
        }

        console.log(`\n⏳ Mining block with ${pendingCount} transactions...`);
        try {
            this.blockchain.minePendingTransactions(null);
            console.log('✅ Block mined successfully');
        } catch (err) {
            console.log(`⛔ Mining failed: ${err.message}`);
        }
        this.showMenu();
    }

    createClient() {
        try {
            this.clientManager.createRandomClient();
            console.log('✅ Client created successfully');
        } catch (err) {
            console.log(`⛔ Failed to create client: ${err.message}`);
        }
        this.showMenu();
    }

    sendTransaction() {
        this.clientManager.listClients();
        this.rl.question('\nEnter sender address (or partial): ', (senderPartial) => {
            const sender = this.findClient(senderPartial);
            if (!sender) {
                console.log('⛔ Sender not found');
                return this.showMenu();
            }

            this.rl.question('Enter recipient address (or partial): ', (recipientPartial) => {
                const recipient = this.findClient(recipientPartial);
                if (!recipient) {
                    console.log('⛔ Recipient not found');
                    return this.showMenu();
                }

                this.rl.question('Enter amount: ', (amountStr) => {
                    // Validate that amount is a valid integer
                    const amount = parseInt(amountStr);
                    
                    if (isNaN(amount) || amount.toString() !== amountStr.trim() || amount <= 0) {
                        console.log('⛔ Transaction failed: Amount must be a positive integer');
                        return this.showMenu();
                    }
                    
                    try {
                        const tx = sender.wallet.createTransaction(
                            recipient.address, 
                            amount, 
                            this.blockchain
                        );
                        
                        // Broadcast transaction to all miners
                        this.minerManager.miners.forEach(miner => {
                            miner.network.broadcast({
                                type: 'TRANSACTION',
                                data: {
                                    fromAddress: tx.fromAddress,
                                    toAddress: tx.toAddress,
                                    amount: tx.amount,
                                    timestamp: tx.timestamp,
                                    signature: tx.signature
                                }
                            });
                        });
                        
                        console.log('✅ Transaction created successfully');
                    } catch (err) {
                        console.log(`⛔ Transaction failed: ${err.message}`);
                    }
                    this.showMenu();
                });
            });
        });
    }

    findClient(partialAddress) {
        // First check if it's a valid client address
        const validClientAddress = Array.from(this.clientManager.clients.keys()).find(
            address => address.includes(partialAddress)
        );

        if (!validClientAddress) {
            return null;
        }

        const client = this.clientManager.clients.get(validClientAddress);
        return { address: validClientAddress, wallet: client.wallet };
    }

    checkBalance() {
        console.log('\n📋 Client List:');
        this.clientManager.listClients();
        
        this.rl.question('\nEnter client address (or partial): ', (partialAddress) => {
            // First check if the address exists in clients
            const client = this.findClient(partialAddress);
            if (!client) {
                console.log('⛔ Error: Invalid client address. Please choose from the client list above.');
                return this.showMenu();
            }

            // Additional validation to ensure it's a client address
            const isValidClient = Array.from(this.clientManager.clients.keys()).some(
                clientAddress => clientAddress.includes(partialAddress)
            );

            if (!isValidClient) {
                console.log('⛔ Error: This address does not belong to any client. Please choose from the client list above.');
                return this.showMenu();
            }

            const balance = client.wallet.getBalance(this.blockchain);
            console.log(`\n💰 Balance for ${client.address.slice(0, 12)}...: ${balance} coins`);
            this.showMenu();
        });
    }

    exit() {
        console.log('\n👋 Exiting system...');
        this.rl.close();
        process.exit(0);
    }

    showMinersBalances() {
        console.log('\n💰 Miners Mining Rewards:');
        console.log('=======================');
        
        let totalRewards = 0;
        this.minerManager.miners.forEach((miner, index) => {
            const rewards = this.blockchain.getMiningRewards(miner.address);
            totalRewards += rewards;
            console.log(`\nMiner ${index + 1}:`);
            console.log(`Address: ${miner.address.slice(0, 12)}...`);
            console.log(`Power: ${miner.power}`);
            console.log(`Port: ${miner.port}`);
            console.log(`Mining Rewards: ${rewards} coins`);
            console.log('------------------');
        });
        
        console.log(`\n📊 Total mining rewards: ${totalRewards} coins`);
        this.showMenu();
    }

    showBlocksList() {
        console.log('\n📦 Blocks List:');
        console.log('==============');
        
        const blocks = this.blockchain.getBlocksList();
        if (blocks.length === 0) {
            console.log('No blocks in the chain');
            return this.showMenu();
        }

        blocks.forEach(block => {
            console.log(`\nBlock #${block.blockNumber}:`);
            console.log(`Timestamp: ${block.timestamp}`);
            console.log(`Transactions: ${block.transactions}`);
            console.log(`Previous Hash: ${block.previousHash}`);
            console.log(`Hash: ${block.hash}`);
            console.log(`Miner: ${block.miner}`);
            console.log('------------------');
        });

        console.log(`\nTotal Blocks: ${blocks.length}`);
        this.showMenu();
    }

    showPendingTransactions() {
        console.log('\n⏳ Pending Transactions:');
        console.log('=====================');
        
        const pendingTxs = this.blockchain.getPendingTransactionsInfo();
        const count = this.blockchain.getPendingTransactionsCount();
        
        if (count === 0) {
            console.log('No pending transactions');
            return this.showMenu();
        }

        console.log(`Total pending transactions: ${count}`);
        console.log(`Transactions until next block: ${10 - count}`);
        console.log('\nTransaction List:');
        console.log('----------------');

        pendingTxs.forEach(tx => {
            // Format the Unix timestamp (milliseconds) to English date string
            const date = new Date(parseInt(tx.timestamp));
            const formattedTime = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true,
                timeZone: 'UTC'
            });

            console.log(`\nTransaction #${tx.index}:`);
            console.log(`From: ${tx.from}`);
            console.log(`To: ${tx.to}`);
            console.log(`Amount: ${tx.amount} coins`);
            console.log(`Type: ${tx.type}`);
            console.log(`Time: ${formattedTime}`);
            console.log('----------------');
        });

        this.showMenu();
    }

    createMiner() {
        console.log('\n⛏️ Create New Miner');
        console.log('=================');
        
        this.rl.question('Enter miner port (default: 3000): ', (portStr) => {
            const port = portStr ? parseInt(portStr) : 3000;
            
            if (isNaN(port) || port < 1024 || port > 65535) {
                console.log('⛔ Invalid port number. Must be between 1024 and 65535');
                return this.showMenu();
            }

            this.rl.question('Enter miner power (1-5, default: 1): ', (powerStr) => {
                const power = powerStr ? parseInt(powerStr) : 1;
                
                if (isNaN(power) || power < 1 || power > 5) {
                    console.log('⛔ Invalid power. Must be between 1 and 5');
                    return this.showMenu();
                }

                try {
                    const miner = this.minerManager.createMiner(port, power);
                    console.log(`\n✅ Miner created successfully:`);
                    console.log(`Address: ${miner.address.slice(0, 12)}...`);
                    console.log(`Port: ${miner.port}`);
                    console.log(`Power: ${miner.power}`);
                    
                    // Start the miner's network
                    miner.network.startServer();
                    console.log(`🌐 Miner network started on port ${port}`);
                } catch (err) {
                    console.log(`⛔ Failed to create miner: ${err.message}`);
                }
                
                this.showMenu();
            });
        });
    }
}

module.exports = { CLI };