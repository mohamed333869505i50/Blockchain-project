const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Blockchain } = require('./blockchain');
const { MinerManager } = require('./miner-manager');
const { ClientManager } = require('./client-manager');
const fs = require('fs');

// Initialize blockchain and managers
const blockchain = new Blockchain();
const minerManager = new MinerManager(blockchain);
const clientManager = new ClientManager(blockchain);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Send initial blockchain data
    socket.emit('blockchain-update', {
        blocks: blockchain.getBlocksList(),
        pendingTransactions: blockchain.getPendingTransactionsInfo(),
        miners: minerManager.miners.map(m => ({
            address: m.address,
            power: m.power,
            port: m.port,
            rewards: blockchain.getMiningRewards(m.address),
            name: m.name || ''
        })),
        clients: Array.from(clientManager.clients.entries()).map(([address, client]) => ({
            address,
            balance: blockchain.getBalanceOfAddress(address),
            name: client.name || (client.wallet && client.wallet.name) || ''
        }))
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Subscribe to blockchain updates
blockchain.onTransactionAdded = (transaction) => {
    io.emit('transaction-added', {
        pendingTransactions: blockchain.getPendingTransactionsInfo(),
        count: blockchain.getPendingTransactionsCount()
    });
};

// API Routes
app.get('/api/blocks', (req, res) => {
    res.json(blockchain.getBlocksList());
});

app.get('/api/pending-transactions', (req, res) => {
    res.json({
        transactions: blockchain.getPendingTransactionsInfo(),
        count: blockchain.getPendingTransactionsCount()
    });
});

app.get('/api/miners', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'miners-data.json'), 'utf8');
        const minersData = JSON.parse(data);
        // Add 'rewards' property for each miner
        const miners = minersData.map(miner => ({
            address: miner.address,
            port: miner.port,
            power: miner.power,
            name: miner.name || '',
            active: true, // or add logic if you want to detect real status
            rewards: blockchain.getMiningRewards(miner.address) || 0
        }));
        res.json(miners);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load miners data' });
    }
});

app.get('/api/clients', (req, res) => {
    res.json(Array.from(clientManager.clients.entries()).map(([address, client]) => ({
        address,
        balance: blockchain.getBalanceOfAddress(address),
        name: client.name || (client.wallet && client.wallet.name) || ''
    })));
});

app.post('/api/mine', (req, res) => {
    try {
        blockchain.minePendingTransactions(null);
        io.emit('blockchain-update', {
            blocks: blockchain.getBlocksList(),
            pendingTransactions: blockchain.getPendingTransactionsInfo()
        });
        res.json({ success: true, message: 'Block mined successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/create-client', (req, res) => {
    try {
        const client = clientManager.createRandomClient();
        io.emit('client-created', {
            address: client.address,
            balance: client.balance,
            name: client.name || ''
        });
        res.json({ success: true, client });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/send-transaction', (req, res) => {
    const { fromAddress, toAddress, amount } = req.body;
    try {
        const sender = clientManager.clients.get(fromAddress);
        if (!sender) {
            throw new Error('Sender not found');
        }

        const tx = sender.wallet.createTransaction(toAddress, amount, blockchain);
        res.json({ success: true, transaction: tx });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/miners', (req, res) => {
    try {
        const { port, power } = req.body;
        
        // Validate input
        if (!port || port < 1024 || port > 65535) {
            return res.status(400).json({ message: 'Invalid port number' });
        }
        if (!power || power < 1 || power > 5) {
            return res.status(400).json({ message: 'Invalid power value' });
        }

        // Check if port is already in use
        const existingMiner = minerManager.miners.find(m => m.port === port);
        if (existingMiner) {
            return res.status(400).json({ message: 'Port already in use' });
        }

        // Create new miner (this also saves to miners-data.json via minerManager)
        const miner = minerManager.createMiner(port, power);
        miner.network.startServer();

        // --- Extra safety: ensure the new miner is in miners-data.json ---
        const minersFile = path.join(__dirname, 'miners-data.json');
        let minersData = [];
        try {
            minersData = JSON.parse(fs.readFileSync(minersFile, 'utf8'));
        } catch (e) {}
        if (!minersData.find(m => m.address === miner.address)) {
            minersData.push({
                address: miner.address,
                privateKey: miner.wallet.privateKey,
                publicKey: miner.wallet.publicKey,
                port: miner.port,
                power: miner.power,
                name: miner.name || ''
            });
            fs.writeFileSync(minersFile, JSON.stringify(minersData, null, 2));
        }
        // --------------------------------------------------------------

        res.json({
            message: 'Miner created successfully',
            miner: {
                address: miner.address,
                port: miner.port,
                power: miner.power
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Serve the miners management page
app.get('/miners', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'miners.html'));
});

// Start server
const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📱 Web interface available at http://localhost:${PORT}`);
}); 