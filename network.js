const net = require('net');
const { Transaction } = require('./transaction');

class Network {
    constructor(port, peers = [], blockchain) {
        this.port = port;
        this.peers = peers;
        this.blockchain = blockchain;
        this.server = null;
        this.sockets = [];
    }

    startServer() {
        this.server = net.createServer((socket) => {
            this.handleConnection(socket);
        });

        this.server.listen(this.port, () => {
            console.log(`🌐 Network server started on port ${this.port}`);
        });

        this.connectToPeers();
    }

    handleConnection(socket) {
        this.sockets.push(socket);
        socket.on('data', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        });

        socket.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    connectToPeers() {
        this.peers.forEach((peer) => {
            const socket = net.connect(peer.port, peer.host, () => {
                console.log(`🔗 Connected to peer at ${peer.host}:${peer.port}`);
                this.sockets.push(socket);
            });

            socket.on('error', (err) => {
                console.error(`Failed to connect to ${peer.host}:${peer.port}`, err);
            });
        });
    }

    handleMessage(message) {
        switch (message.type) {
            case 'TRANSACTION':
                const tx = new Transaction(
                    message.data.fromAddress,
                    message.data.toAddress,
                    message.data.amount
                );
                tx.timestamp = message.data.timestamp;
                tx.signature = message.data.signature;
                this.blockchain.addTransaction(tx);
                break;

            case 'BLOCK':
                // Handle new block
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        this.sockets.forEach((socket) => {
            try {
                socket.write(data);
            } catch (err) {
                console.error('Error broadcasting message:', err);
                // Remove failed socket
                const index = this.sockets.indexOf(socket);
                if (index !== -1) {
                    this.sockets.splice(index, 1);
                }
            }
        });
    }
}

module.exports = { Network };