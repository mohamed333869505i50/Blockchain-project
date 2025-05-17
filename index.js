const { Blockchain } = require('./blockchain');
const { MinerManager } = require('./miner-manager');
const { ClientManager } = require('./client-manager');
const { CLI } = require('./cli');

// 1. Initialize blockchain
const blockchain = new Blockchain();

// 2. Mine the genesis block if chain is empty
if (blockchain.chain.length === 1) {
    console.log('\n⛏️ Mining genesis block to initialize network funds...');
    const genesisBlock = blockchain.chain[0];
    genesisBlock.mineBlock(blockchain.difficulty);
    console.log(`Genesis block mined: ${genesisBlock.hash}`);
}

console.log(`Network fund balance: ${blockchain.getBalanceOfAddress("network_fund")} coins`);

// 3. Create managers (will auto-load existing data)
const minerManager = new MinerManager(blockchain);
const clientManager = new ClientManager(blockchain);

// 4. If no existing data, create initial setup
if (minerManager.miners.length === 0) {
    minerManager.createMiner(3000, 3);
    minerManager.createMiner(3001, 2);
    minerManager.createMiner(3002, 1);
}

if (clientManager.clients.size === 0) {
    console.log('\n👤 Creating initial clients...');
    clientManager.createMultipleClients(5);
}

// 5. Mine initial block if there are pending transactions
if (blockchain.pendingTransactions.length > 0) {
    console.log('\n⛏️ Mining initial block...');
    blockchain.minePendingTransactions(null);
}

// 6. Start all miners
minerManager.startAllMiners();

// 7. Start CLI interface
const cli = new CLI(blockchain, minerManager, clientManager);
cli.start();